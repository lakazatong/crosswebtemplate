// std
#include <atomic>
#include <cstdint>
#include <exception>
#include <string>
#include <utility>
#include <stdexcept>

#ifdef _WIN32
    #include <windows.h>
#else
    #include <dlfcn.h>
#endif

// external
#include "json/json.hpp"

// internal
#include "webview_bridge.hpp"

using json = nlohmann::json;

extern "C"
{
    void dispatchInit();
    std::size_t getRegistryCount();
    std::size_t getRegistryNamePtr(std::size_t fn_id);
    std::size_t getRegistryNameLen(std::size_t fn_id);

    std::uint8_t *heapAlloc(std::size_t size);
    void heapFree(std::uint8_t *ptr, std::size_t size);

    std::size_t enqueueJob(
        std::size_t fn_id,
        std::size_t input_ptr,
        std::size_t input_len
    );

    bool processNextJob();

    std::size_t getJobOutputPtr(std::size_t job_id);
    std::size_t getJobOutputLen(std::size_t job_id);
    void releaseJob(std::size_t job_id);
}

namespace
{
    constexpr std::size_t NO_JOB = 0xFFFFFFFFu;

    std::atomic<WebViewBridge *> active_bridge = nullptr;

    std::string make_error(const std::string &message)
    {
        return json{{"error", message}}.dump();
    }
}

extern "C" void notify_host(std::size_t job_id)
{
    WebViewBridge *bridge = active_bridge.load(std::memory_order_acquire);

    if (bridge)
    {
        bridge->notify_job_done(job_id);
    }
}

extern "C" void sleep_ms(std::uint32_t milliseconds)
{
    std::this_thread::sleep_for(
        std::chrono::milliseconds(milliseconds)
    );
}

WebViewBridge::WebViewBridge(webview::webview &webview)
    : webview_(webview)
{
    start();
}

WebViewBridge::~WebViewBridge()
{
    stop();
}

void WebViewBridge::start()
{
    WebViewBridge *expected = nullptr;

    if (!active_bridge.compare_exchange_strong(
            expected,
            this,
            std::memory_order_release,
            std::memory_order_relaxed))
    {
        throw std::runtime_error("A WebViewBridge is already active");
    }

    webview_.bind("bridge_get_export", [this](const std::string &name) {
        try
        {
            return std::to_string(get_export(name));
        }
        catch (const std::exception &e)
        {
            return make_error(e.what());
        }
    });

    webview_.bind("bridge_get_registry", [this](const std::string &unused) {
        return get_registry();
    });

    webview_.bind("bridge_enqueue", [this](const std::string &input) {
        return enqueue(input);
    });

    webview_.bind("bridge_take_output", [this](const std::string &input) {
        return take_output(input);
    });

    dispatchInit();

    std::size_t count = std::thread::hardware_concurrency();

    if (count == 0)
        count = 1;

    workers_.reserve(count);

    for (std::size_t i = 0; i < count; ++i)
    {
        workers_.emplace_back(&WebViewBridge::worker_loop, this);
    }
}

std::uint32_t WebViewBridge::get_export(const std::string &name)
{
#ifdef _WIN32
    HMODULE module = GetModuleHandleW(nullptr);
    FARPROC symbol = GetProcAddress(module, name.c_str());
#else
    void *module = dlopen(nullptr, RTLD_NOW);
    void *symbol = dlsym(module, name.c_str());
#endif

    if (!symbol)
    {
        throw std::runtime_error("Zig export not found: " + name);
    }

    return *reinterpret_cast<const std::uint32_t *>(symbol);
}

void WebViewBridge::stop()
{
    active_bridge.store(nullptr, std::memory_order_release);

    {
        std::lock_guard<std::mutex> lock(mutex_);
        stopping_ = true;
        ++generation_;
    }

    condition_.notify_all();

    for (std::thread &worker : workers_)
    {
        if (worker.joinable())
        {
            worker.join();
        }
    }

    workers_.clear();
}

void WebViewBridge::worker_loop()
{
    std::size_t observed_generation = 0;

    while (true)
    {
        {
            std::unique_lock<std::mutex> lock(mutex_);

            condition_.wait(lock, [this, &observed_generation] {
                return stopping_ || generation_ != observed_generation;
            });

            if (stopping_)
            {
                return;
            }

            observed_generation = generation_;
        }

        while (processNextJob())
        {
        }
    }
}

std::string WebViewBridge::get_registry()
{
    json registry = json::array();

    const std::size_t count = getRegistryCount();

    for (std::size_t i = 0; i < count; ++i)
    {
        const std::size_t ptr = getRegistryNamePtr(i);
        const std::size_t len = getRegistryNameLen(i);

        if (ptr == 0 || len == 0)
        {
            return make_error("Invalid registry entry");
        }

        registry.push_back(
            std::string(reinterpret_cast<const char *>(ptr), len)
        );
    }

    // meh but it works
    return json{
        {"registry", registry},
        {"worker_count", workers_.size()}
    }.dump();
}

std::string WebViewBridge::enqueue(const std::string &input)
{
    try
    {
        const json request = json::parse(input);

        if (!request.is_object() || !request.contains("fn_id"))
        {
            return make_error("Invalid enqueue request");
        }

        const std::size_t fn_id = request.at("fn_id").get<std::size_t>();

        std::uint8_t *ptr = nullptr;
        std::size_t len = 0;

        if (request.contains("input"))
        {
            const std::string serialized = request.at("input").dump();
            len = serialized.size();

            ptr = heapAlloc(len);

            if (!ptr)
            {
                return make_error("Out of memory");
            }

            std::memcpy(ptr, serialized.data(), len);
        }

        std::lock_guard<std::mutex> lock(mutex_);

        if (stopping_)
        {
            if (ptr)
            {
                heapFree(ptr, len);
            }

            return make_error("Bridge is stopping");
        }

        const std::size_t job_id = enqueueJob(
            fn_id,
            reinterpret_cast<std::size_t>(ptr),
            len
        );

        if (job_id == NO_JOB)
        {
            if (ptr)
            {
                heapFree(ptr, len);
            }

            return make_error("No free job slots");
        }

        ++generation_;
        condition_.notify_all();

        return json{{"job_id", job_id}}.dump();
    }
    catch (const std::exception &e)
    {
        return make_error(e.what());
    }
}

std::string WebViewBridge::take_output(const std::string &input)
{
    try
    {
        const json request = json::parse(input);

        if (!request.is_object() || !request.contains("job_id"))
        {
            return make_error("Invalid output request");
        }

        const std::size_t job_id = request.at("job_id").get<std::size_t>();

        std::lock_guard<std::mutex> lock(mutex_);

        const std::size_t output_ptr = getJobOutputPtr(job_id);
        const std::size_t output_len = getJobOutputLen(job_id);

        if (output_ptr == 0 || output_len == 0)
        {
            return make_error("Job has no output");
        }

        std::string output(
            reinterpret_cast<const char *>(output_ptr),
            output_len
        );

        heapFree(
            reinterpret_cast<std::uint8_t *>(output_ptr),
            output_len
        );

        releaseJob(job_id);

        return output;
    }
    catch (const std::exception &e)
    {
        return make_error(e.what());
    }
}

void WebViewBridge::notify_job_done(std::size_t job_id)
{
    webview_.dispatch([this, job_id] {
        webview_.eval(
            "window.__cwtBridge?.onJobDone(" +
            std::to_string(job_id) +
            ");"
        );
    });
}