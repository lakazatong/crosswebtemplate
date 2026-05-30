// std
#include <iostream>
#include <sstream>
#include <string>

// external
#ifndef _WIN32
#include "httplib/httplib.h"
#endif /* _WIN32 */
#include "nlohmann/json.hpp"
#include "webview/webview.h"

// native
#ifdef _WIN32
#include <windows.h>
#include <WebView2.h>
#include <wrl.h>
// #include <wrl/client.h>
#else /* _WIN32 */
#include <filesystem>
#include <gtk/gtk.h>
#endif /* _WIN32 */

using json = nlohmann::json;

// Forward declare the Zig function (or mock if not linked)
extern "C" const char *increment(const char *ptr);

#ifndef _WIN32

void show_message(const std::string &text)
{
    GtkWidget *dialog = gtk_message_dialog_new(
        nullptr,
        GTK_DIALOG_MODAL,
        GTK_MESSAGE_INFO,
        GTK_BUTTONS_OK,
        "%s",
        text.c_str());

    gtk_dialog_run(GTK_DIALOG(dialog));
    gtk_widget_destroy(dialog);
}

#endif /* _WIN32 */

void app(void)
{
    bool debug = DEVELOPMENT_BUILD == 1;
    webview::webview w(debug, nullptr);
    w.set_title_bar(0);
    w.set_size(1280, 720, WEBVIEW_HINT_NONE);

#ifdef _WIN32

    HWND hwnd = static_cast<HWND>(webview_get_native_handle(
        reinterpret_cast<webview_t>(&w),
        WEBVIEW_NATIVE_HANDLE_KIND_UI_WINDOW));

    if (hwnd)
    {
        HICON icon = static_cast<HICON>(LoadImageA(
            GetModuleHandleA(NULL),
            "IDI_APP_ICON",
            IMAGE_ICON,
            0, 0,
            LR_DEFAULTSIZE | LR_SHARED));
        SendMessage(hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(icon));
        SendMessage(hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(icon));
    }

    // 1. Use the C API to get the BROWSER_CONTROLLER handle
    // We cast 'w' to webview_t (which is what the C API expects)
    auto *controller = static_cast<ICoreWebView2Controller *>(
        webview_get_native_handle(reinterpret_cast<webview_t>(&w), WEBVIEW_NATIVE_HANDLE_KIND_BROWSER_CONTROLLER));

    if (controller)
    {
        Microsoft::WRL::ComPtr<ICoreWebView2> coreWebView2;
        Microsoft::WRL::ComPtr<ICoreWebView2_3> webview3;

        // 2. Get the actual WebView2 engine from the controller
        if (SUCCEEDED(controller->get_CoreWebView2(&coreWebView2)))
        {
            // 3. Cast to Interface 3 (which supports Host Mapping)
            if (SUCCEEDED(coreWebView2.As(&webview3)))
            {
                std::wstring webPath;

#if DEVELOPMENT_BUILD == 1

                std::string rawPath = WWW_PATH;
                // Helper to convert std::string to std::wstring
                webPath = std::wstring(rawPath.begin(), rawPath.end());

#else /* DEVELOPMENT_BUILD == 1 */

                wchar_t exePath[MAX_PATH];
                if (GetModuleFileNameW(NULL, exePath, MAX_PATH))
                {
                    PathRemoveFileSpecW(exePath);
                    webPath = std::wstring(exePath) + L"\\www";
                }

#endif /* DEVELOPMENT_BUILD == 1 */

                // 4. Set the mapping
                webview3->SetVirtualHostNameToFolderMapping(
                    L"app.local",
                    webPath.c_str(),
                    COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);

                // 5. Navigate to the virtual domain
                w.navigate("http://app.local/index.html");
            }
            else
            {
                w.navigate("data:text/html,<h1>Failed to cast to Interface 3</h1>");
            }
        }
        else
        {
            w.navigate("data:text/html,<h1>Failed to get the WebView2 engine from the controller</h1>");
        }
    }
    else
    {
        w.navigate("data:text/html,<h1>Failed to initialize WebView2 Controller</h1>");
    }

#else /* _WIN32 */

#if DEVELOPMENT_BUILD == 1

    w.navigate("file://" + std::string(WWW_PATH) + "/index.html");

#else /* DEVELOPMENT_BUILD == 1 */

    std::string exe_path = std::filesystem::canonical("/proc/self/exe").parent_path().string();
    std::string www_path = exe_path + "/www";

    // Start a local HTTP server to serve the www directory
    auto *svr = new httplib::Server();
    svr->set_mount_point("/", www_path.c_str());

    // Bind to any available port on loopback
    int port = svr->bind_to_any_port("127.0.0.1");

    std::thread([svr]()
                { svr->listen_after_bind(); })
        .detach();

    w.navigate("http://127.0.0.1:" + std::to_string(port) + "/index.html");

#endif /* DEVELOPMENT_BUILD == 1 */

#endif /* _WIN32 */

    w.bind("start_dragging", [&](const std::string &input) -> std::string
           { 
                w.start_dragging();
                return R"({})"; });
    w.bind("bridge_increment", [](const std::string &input) -> std::string
           {
            const char *result = increment(input.c_str());
            if (!result) return R"({"error":"null result"})";
            return std::string(result); });

    w.run();
}
#ifdef _WIN32

int WINAPI WinMain(HINSTANCE /*hInst*/, HINSTANCE /*hPrevInst*/, LPSTR /*lpCmdLine*/,
                   int /*nCmdShow*/)
{

#ifdef _MSC_VER
// Anything that has to do with MSVC only
#endif /* _MSC_VER */

#else /* _WIN32 */

int main(void)
{

#endif /* _WIN32 */

    try
    {
        app();
    }
    catch (const std::exception &e)
    {
#ifdef _WIN32

        MessageBoxA(NULL, e.what(), "Initialization Error", MB_OK | MB_ICONERROR);

#else /* _WIN32 */

        std::cerr << e.what() << std::endl;

#endif /* _WIN32 */

        return 1;
    }

    return 0;
}
