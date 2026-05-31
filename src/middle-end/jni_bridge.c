#include <jni.h>

extern const char *increment(const char *ptr);

JNIEXPORT jstring JNICALL
Java_com_crosswebtemplate_app_Bridge_nativeIncrement(JNIEnv *env, jobject obj, jstring input)
{
    const char *str = (*env)->GetStringUTFChars(env, input, NULL);
    const char *result = increment(str);
    (*env)->ReleaseStringUTFChars(env, input, str);
    return (*env)->NewStringUTF(env, result);
}
