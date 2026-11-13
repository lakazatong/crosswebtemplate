#include <jni.h>

#include <dlfcn.h>
#include <errno.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

extern void dispatchInit(void);
extern size_t getRegistryCount(void);
extern size_t getRegistryNamePtr(size_t fn_id);
extern size_t getRegistryNameLen(size_t fn_id);

extern uint8_t *heapAlloc(size_t size);
extern void heapFree(uint8_t *ptr, size_t size);

extern size_t enqueueJob(size_t fn_id, size_t input_ptr, size_t input_len);
extern bool processNextJob(void);
extern size_t getJobOutputPtr(size_t job_id);
extern size_t getJobOutputLen(size_t job_id);
extern void releaseJob(size_t job_id);

#define NO_JOB ((size_t)0xFFFFFFFFu)
#define JOB_SLOTS_SIZE 64

static pthread_mutex_t bridge_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t bridge_condition = PTHREAD_COND_INITIALIZER;

static pthread_t *workers = NULL;
static size_t worker_count = 0;
static uint64_t generation = 0;
static bool stopping = false;
static bool started = false;

static JavaVM *java_vm = NULL;
static jobject bridge_object = NULL;
static jmethodID notify_job_done_method = NULL;
static void *core_handle = NULL;

static void throw_java(JNIEnv *env, const char *class_name, const char *message)
{
    jclass exception_class = (*env)->FindClass(env, class_name);
    if (exception_class == NULL)
        return;

    (*env)->ThrowNew(env, exception_class, message);
    (*env)->DeleteLocalRef(env, exception_class);
}

static size_t append_utf8(char *output, uint32_t codepoint)
{
    if (codepoint <= 0x7F) {
        output[0] = (char)codepoint;
        return 1;
    }

    if (codepoint <= 0x7FF) {
        output[0] = (char)(0xC0 | (codepoint >> 6));
        output[1] = (char)(0x80 | (codepoint & 0x3F));
        return 2;
    }

    if (codepoint <= 0xFFFF) {
        output[0] = (char)(0xE0 | (codepoint >> 12));
        output[1] = (char)(0x80 | ((codepoint >> 6) & 0x3F));
        output[2] = (char)(0x80 | (codepoint & 0x3F));
        return 3;
    }

    output[0] = (char)(0xF0 | (codepoint >> 18));
    output[1] = (char)(0x80 | ((codepoint >> 12) & 0x3F));
    output[2] = (char)(0x80 | ((codepoint >> 6) & 0x3F));
    output[3] = (char)(0x80 | (codepoint & 0x3F));
    return 4;
}

static char *jstring_to_utf8(JNIEnv *env, jstring input, size_t *output_len)
{
    if (input == NULL)
        return NULL;

    const jsize length = (*env)->GetStringLength(env, input);
    const jchar *chars = (*env)->GetStringChars(env, input, NULL);
    if (chars == NULL)
        return NULL;

    char *output = malloc((size_t)length * 3 + 1);
    if (output == NULL) {
        (*env)->ReleaseStringChars(env, input, chars);
        return NULL;
    }

    size_t offset = 0;

    for (jsize i = 0; i < length; ++i) {
        uint32_t codepoint = chars[i];

        if (codepoint >= 0xD800 && codepoint <= 0xDBFF && i + 1 < length) {
            const uint32_t low = chars[i + 1];
            if (low >= 0xDC00 && low <= 0xDFFF) {
                codepoint = 0x10000 + ((codepoint - 0xD800) << 10) + (low - 0xDC00);
                ++i;
            } else {
                codepoint = 0xFFFD;
            }
        } else if (codepoint >= 0xD800 && codepoint <= 0xDFFF) {
            codepoint = 0xFFFD;
        }

        offset += append_utf8(output + offset, codepoint);
    }

    (*env)->ReleaseStringChars(env, input, chars);

    output[offset] = '\0';
    *output_len = offset;
    return output;
}

static uint32_t read_utf8_codepoint(const unsigned char *input, size_t length, size_t *offset)
{
    const unsigned char first = input[*offset];

    if (first <= 0x7F) {
        ++*offset;
        return first;
    }

    size_t count;
    uint32_t codepoint;
    uint32_t minimum;

    if (first >= 0xC2 && first <= 0xDF) {
        count = 2;
        codepoint = first & 0x1F;
        minimum = 0x80;
    } else if (first >= 0xE0 && first <= 0xEF) {
        count = 3;
        codepoint = first & 0x0F;
        minimum = 0x800;
    } else if (first >= 0xF0 && first <= 0xF4) {
        count = 4;
        codepoint = first & 0x07;
        minimum = 0x10000;
    } else {
        ++*offset;
        return 0xFFFD;
    }

    if (*offset + count > length) {
        ++*offset;
        return 0xFFFD;
    }

    for (size_t i = 1; i < count; ++i) {
        const unsigned char next = input[*offset + i];
        if ((next & 0xC0) != 0x80) {
            ++*offset;
            return 0xFFFD;
        }
        codepoint = (codepoint << 6) | (next & 0x3F);
    }

    *offset += count;

    if (codepoint < minimum || codepoint > 0x10FFFF ||
        (codepoint >= 0xD800 && codepoint <= 0xDFFF)) {
        return 0xFFFD;
    }

    return codepoint;
}

static jstring utf8_to_jstring(JNIEnv *env, const char *input, size_t length)
{
    if (length > (size_t)INT32_MAX || length > SIZE_MAX / sizeof(jchar) - 1)
        return NULL;

    jchar *chars = malloc((length + 1) * sizeof(jchar));
    if (chars == NULL)
        return NULL;

    size_t offset = 0;
    jsize char_count = 0;

    while (offset < length) {
        const uint32_t codepoint = read_utf8_codepoint(
            (const unsigned char *)input,
            length,
            &offset
        );

        if (codepoint <= 0xFFFF) {
            chars[char_count++] = (jchar)codepoint;
        } else {
            const uint32_t value = codepoint - 0x10000;
            chars[char_count++] = (jchar)(0xD800 | (value >> 10));
            chars[char_count++] = (jchar)(0xDC00 | (value & 0x3FF));
        }
    }

    jstring result = (*env)->NewString(env, chars, char_count);
    free(chars);
    return result;
}

static JNIEnv *get_jni_env(bool *attached)
{
    JNIEnv *env = NULL;
    *attached = false;

    if (java_vm == NULL)
        return NULL;

    const jint status = (*java_vm)->GetEnv(
        java_vm,
        (void **)&env,
        JNI_VERSION_1_6
    );

    if (status == JNI_OK)
        return env;

    if (status != JNI_EDETACHED)
        return NULL;

    JavaVMAttachArgs args = {
        .version = JNI_VERSION_1_6,
        .name = "CWT worker",
        .group = NULL,
    };

    if ((*java_vm)->AttachCurrentThread(java_vm, &env, &args) != JNI_OK)
        return NULL;

    *attached = true;
    return env;
}

void notify_host(size_t job_id)
{
    bool attached;
    JNIEnv *env = get_jni_env(&attached);
    if (env == NULL)
        return;

    if (bridge_object != NULL && notify_job_done_method != NULL) {
        (*env)->CallVoidMethod(
            env,
            bridge_object,
            notify_job_done_method,
            (jlong)job_id
        );

        if ((*env)->ExceptionCheck(env))
            (*env)->ExceptionClear(env);
    }

    if (attached)
        (*java_vm)->DetachCurrentThread(java_vm);
}

void sleep_ms(uint32_t milliseconds)
{
    struct timespec remaining = {
        .tv_sec = milliseconds / 1000,
        .tv_nsec = (long)(milliseconds % 1000) * 1000000L,
    };

    while (nanosleep(&remaining, &remaining) == -1 && errno == EINTR) {
    }
}

static void *worker_loop(void *unused)
{
    bool attached;
    JNIEnv *env = get_jni_env(&attached);
    if (env == NULL)
        return NULL;

    uint64_t observed_generation = 0;

    while (true) {
        pthread_mutex_lock(&bridge_mutex);

        while (!stopping && generation == observed_generation)
            pthread_cond_wait(&bridge_condition, &bridge_mutex);

        const bool should_stop = stopping;
        observed_generation = generation;

        pthread_mutex_unlock(&bridge_mutex);

        while (processNextJob()) {
        }

        if (should_stop)
            break;
    }

    if (attached)
        (*java_vm)->DetachCurrentThread(java_vm);

    return NULL;
}

static void stop_workers(JNIEnv *env)
{
    pthread_mutex_lock(&bridge_mutex);
    stopping = true;
    ++generation;
    pthread_cond_broadcast(&bridge_condition);
    pthread_mutex_unlock(&bridge_mutex);

    for (size_t i = 0; i < worker_count; ++i)
        pthread_join(workers[i], NULL);

    free(workers);
    workers = NULL;
    worker_count = 0;

    if (core_handle != NULL) {
        dlclose(core_handle);
        core_handle = NULL;
    }

    if (bridge_object != NULL) {
        (*env)->DeleteGlobalRef(env, bridge_object);
        bridge_object = NULL;
    }

    notify_job_done_method = NULL;

    pthread_mutex_lock(&bridge_mutex);
    generation = 0;
    stopping = false;
    started = false;
    pthread_mutex_unlock(&bridge_mutex);
}

JNIEXPORT jint JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeStart(JNIEnv *env, jobject thiz)
{
    pthread_mutex_lock(&bridge_mutex);
    const bool already_started = started;
    pthread_mutex_unlock(&bridge_mutex);

    if (already_started) {
        throw_java(env, "java/lang/IllegalStateException", "Android bridge is already started");
        return 0;
    }

    if ((*env)->GetJavaVM(env, &java_vm) != JNI_OK) {
        throw_java(env, "java/lang/IllegalStateException", "Could not obtain Java VM");
        return 0;
    }

    bridge_object = (*env)->NewGlobalRef(env, thiz);
    if (bridge_object == NULL)
        return 0;

    jclass bridge_class = (*env)->GetObjectClass(env, thiz);
    if (bridge_class == NULL) {
        stop_workers(env);
        return 0;
    }

    notify_job_done_method = (*env)->GetMethodID(
        env,
        bridge_class,
        "notifyJobDone",
        "(J)V"
    );
    (*env)->DeleteLocalRef(env, bridge_class);

    if (notify_job_done_method == NULL) {
        stop_workers(env);
        return 0;
    }

    core_handle = dlopen("libcore.so", RTLD_NOW);
    if (core_handle == NULL) {
        const char *error = dlerror();
        throw_java(
            env,
            "java/lang/UnsatisfiedLinkError",
            error != NULL ? error : "Could not open libcore.so"
        );
        stop_workers(env);
        return 0;
    }

    long available = sysconf(_SC_NPROCESSORS_ONLN);
    if (available < 1)
        available = 1;

    workers = calloc((size_t)available, sizeof(pthread_t));
    if (workers == NULL) {
        throw_java(env, "java/lang/OutOfMemoryError", "Could not allocate worker pool");
        stop_workers(env);
        return 0;
    }

    dispatchInit();

    pthread_mutex_lock(&bridge_mutex);
    stopping = false;
    generation = 0;
    started = true;
    pthread_mutex_unlock(&bridge_mutex);

    for (long i = 0; i < available; ++i) {
        const int status = pthread_create(&workers[worker_count], NULL, worker_loop, NULL);
        if (status != 0) {
            throw_java(env, "java/lang/RuntimeException", "Could not create native worker thread");
            stop_workers(env);
            return 0;
        }
        ++worker_count;
    }

    return (jint)worker_count;
}

JNIEXPORT void JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeStop(JNIEnv *env, jobject thiz)
{
    (void)thiz;

    pthread_mutex_lock(&bridge_mutex);
    const bool should_stop = started;
    pthread_mutex_unlock(&bridge_mutex);

    if (should_stop)
        stop_workers(env);
}

JNIEXPORT jobjectArray JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeGetRegistry(JNIEnv *env, jobject thiz)
{
    (void)thiz;

    const size_t count = getRegistryCount();
    if (count > (size_t)INT32_MAX) {
        throw_java(env, "java/lang/IllegalStateException", "Registry is too large");
        return NULL;
    }

    jclass string_class = (*env)->FindClass(env, "java/lang/String");
    if (string_class == NULL)
        return NULL;

    jobjectArray registry = (*env)->NewObjectArray(env, (jsize)count, string_class, NULL);
    (*env)->DeleteLocalRef(env, string_class);
    if (registry == NULL)
        return NULL;

    for (size_t i = 0; i < count; ++i) {
        const size_t ptr = getRegistryNamePtr(i);
        const size_t len = getRegistryNameLen(i);

        if (ptr == 0 || len == 0) {
            throw_java(env, "java/lang/IllegalStateException", "Invalid registry entry");
            return NULL;
        }

        jstring name = utf8_to_jstring(env, (const char *)ptr, len);
        if (name == NULL)
            return NULL;

        (*env)->SetObjectArrayElement(env, registry, (jsize)i, name);
        (*env)->DeleteLocalRef(env, name);

        if ((*env)->ExceptionCheck(env))
            return NULL;
    }

    return registry;
}

JNIEXPORT jlong JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeGetExport(JNIEnv *env, jobject thiz, jstring name)
{
    (void)thiz;

    size_t name_len = 0;
    char *symbol_name = jstring_to_utf8(env, name, &name_len);
    if (symbol_name == NULL) {
        throw_java(env, "java/lang/IllegalArgumentException", "Invalid export name");
        return 0;
    }

    pthread_mutex_lock(&bridge_mutex);

    if (!started || core_handle == NULL) {
        pthread_mutex_unlock(&bridge_mutex);
        free(symbol_name);
        throw_java(env, "java/lang/IllegalStateException", "Android bridge is not started");
        return 0;
    }

    dlerror();
    void *symbol = dlsym(core_handle, symbol_name);
    const char *error = dlerror();

    if (symbol == NULL || error != NULL) {
        pthread_mutex_unlock(&bridge_mutex);
        throw_java(
            env,
            "java/lang/IllegalArgumentException",
            error != NULL ? error : "Zig export not found"
        );
        free(symbol_name);
        return 0;
    }

    const uint32_t value = *(const uint32_t *)symbol;

    pthread_mutex_unlock(&bridge_mutex);
    free(symbol_name);

    return (jlong)value;
}

JNIEXPORT jlong JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeEnqueue(
    JNIEnv *env,
    jobject thiz,
    jint fn_id,
    jstring input
)
{
    (void)thiz;

    if (fn_id < 0) {
        throw_java(env, "java/lang/IllegalArgumentException", "Invalid function id");
        return (jlong)NO_JOB;
    }

    size_t input_len = 0;
    char *input_bytes = NULL;
    uint8_t *input_ptr = NULL;

    if (input != NULL) {
        input_bytes = jstring_to_utf8(env, input, &input_len);
        if (input_bytes == NULL) {
            throw_java(env, "java/lang/OutOfMemoryError", "Could not encode job input");
            return (jlong)NO_JOB;
        }

        input_ptr = heapAlloc(input_len);
        if (input_ptr == NULL) {
            free(input_bytes);
            throw_java(env, "java/lang/OutOfMemoryError", "Zig heap allocation failed");
            return (jlong)NO_JOB;
        }

        memcpy(input_ptr, input_bytes, input_len);
        free(input_bytes);
    }

    pthread_mutex_lock(&bridge_mutex);

    if (!started || stopping) {
        pthread_mutex_unlock(&bridge_mutex);
        if (input_ptr != NULL)
            heapFree(input_ptr, input_len);
        throw_java(env, "java/lang/IllegalStateException", "Android bridge is stopping");
        return (jlong)NO_JOB;
    }

    const size_t job_id = enqueueJob(
        (size_t)fn_id,
        (size_t)input_ptr,
        input_len
    );

    if (job_id == NO_JOB) {
        pthread_mutex_unlock(&bridge_mutex);
        if (input_ptr != NULL)
            heapFree(input_ptr, input_len);
        return (jlong)NO_JOB;
    }

    ++generation;
    pthread_cond_broadcast(&bridge_condition);
    pthread_mutex_unlock(&bridge_mutex);

    return (jlong)job_id;
}

JNIEXPORT jstring JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeTakeOutput(JNIEnv *env, jobject thiz, jlong job_id)
{
    (void)thiz;

    if (job_id < 0 || (uint64_t)job_id >= JOB_SLOTS_SIZE)
        return (*env)->NewStringUTF(env, "{\"error\":\"Invalid job id\"}");

    pthread_mutex_lock(&bridge_mutex);

    if (!started || stopping) {
        pthread_mutex_unlock(&bridge_mutex);
        return (*env)->NewStringUTF(env, "{\"error\":\"Android bridge is stopping\"}");
    }

    const size_t output_ptr = getJobOutputPtr((size_t)job_id);
    const size_t output_len = getJobOutputLen((size_t)job_id);

    if (output_ptr == 0 || output_len == 0) {
        pthread_mutex_unlock(&bridge_mutex);
        return (*env)->NewStringUTF(env, "{\"error\":\"Job has no output\"}");
    }

    jstring output = utf8_to_jstring(env, (const char *)output_ptr, output_len);

    heapFree((uint8_t *)output_ptr, output_len);
    releaseJob((size_t)job_id);

    pthread_mutex_unlock(&bridge_mutex);

    if (output == NULL && !(*env)->ExceptionCheck(env))
        throw_java(env, "java/lang/OutOfMemoryError", "Could not decode job output");

    return output;
}
