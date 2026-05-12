// std
#include <iostream>
#include <sstream>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <WebView2.h>
#include <wrl.h>
#include <wrl/client.h>
#endif

// external
#include "nlohmann/json.hpp"
#include "webview/webview.h"

using json = nlohmann::json;

extern "C" const char *increment(const char *ptr, size_t len);

void app(void)
{
    try
    {
        webview::webview w(DEVELOPMENT_BUILD == 1, nullptr);
        w.set_title("Cross Web Template");
        w.set_size(1280, 720, WEBVIEW_HINT_NONE);

#ifdef _WIN32
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
#else
                    wchar_t exePath[MAX_PATH];
                    if (GetModuleFileNameW(NULL, exePath, MAX_PATH))
                    {
                        PathRemoveFileSpecW(exePath);
                        webPath = std::wstring(exePath) + L"\\www";
                    }
#endif
                    // 4. Set the mapping
                    webview3->SetVirtualHostNameToFolderMapping(
                        L"app.local",
                        webPath.c_str(),
                        COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);

                    // 5. Navigate to the virtual domain
                    w.navigate("http://app.local/index.html");
                }
            }
        }
        else
        {
            w.navigate("data:text/html,<h1>Failed to initialize WebView2 Controller</h1>");
        }
#else
        // Linux/Mac fallback
        w.navigate("file:///" + std::string(WWW_PATH) + "/index.html");
#endif

        w.bind("bridge_increment", [](const std::string &input)
               { return std::string(increment(input.c_str(), input.size())); });

        w.run();
    }
    catch (const std::exception &e)
    {
        // Using standard exception to catch more than just webview-specific ones
#ifdef _WIN32
        MessageBoxA(NULL, e.what(), "Initialization Error", MB_OK | MB_ICONERROR);
#else
        std::cerr << "Error: " << e.what() << std::endl;
#endif
    }
}
#ifdef _WIN32
int WINAPI WinMain(HINSTANCE /*hInst*/, HINSTANCE /*hPrevInst*/, LPSTR /*lpCmdLine*/,
                   int /*nCmdShow*/)
{
#ifdef _MSC_VER
#endif /* _MSC_VER */

#else  /* _WIN32 */
int main(void)
{
#endif /* _WIN32 */

    try
    {
        app();
    }
    catch (const webview::exception &e)
    {
        std::cerr << e.what() << std::endl;
        return 1;
    }

    return 0;
}
