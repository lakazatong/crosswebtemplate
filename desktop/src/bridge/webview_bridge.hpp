#pragma once

// std
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <vector>

// external
#include "webview/webview.h"

class WebViewBridge
{
public:
    explicit WebViewBridge(webview::webview &webview);
    ~WebViewBridge();

    WebViewBridge(const WebViewBridge &) = delete;
    WebViewBridge &operator=(const WebViewBridge &) = delete;
    
    void notify_job_done(std::size_t job_id);

private:


    webview::webview &webview_;

    std::mutex mutex_;
    std::condition_variable condition_;
    std::vector<std::thread> workers_;

    std::size_t generation_ = 0;
    bool stopping_ = false;

    void start();
    void stop();
    void worker_loop();

    std::uint32_t get_export(const std::string &name);
    std::string get_registry();
    std::string enqueue(const std::string &input);
    std::string take_output(const std::string &input);
};