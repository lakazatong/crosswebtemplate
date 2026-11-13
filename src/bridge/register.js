let wasmPromise = null;
let desktopPromise = null;
let androidPromise = null;

function getBridge() {
    if (["development", "web"].includes(__PLATFORM__)) {
        if (!wasmPromise) {
            wasmPromise = fetch("/core.wasm")
                .then(async (response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const WASMBridge = (await import("../../web/src/bridge/wasm_bridge.js"))
                        .default;

                    const bytes = await response.arrayBuffer();
                    const bridge = await WASMBridge.create(bytes);

                    console.log("WASM bridge loaded successfully.");

                    return bridge;
                })
                .catch((err) => {
                    console.error("WASM bridge failed to load:", err);
                    wasmPromise = null;
                    throw err;
                });
        }

        return wasmPromise;
    }

    if (["windows", "linux"].includes(__PLATFORM__)) {
        if (!desktopPromise) {
            desktopPromise = import("../../desktop/src/bridge/webview_bridge.js")
                .then(async ({ default: DesktopBridge }) => {
                    const bridge = await DesktopBridge.create();

                    console.log("Desktop bridge loaded successfully.");

                    return bridge;
                })
                .catch((err) => {
                    console.error("Desktop bridge failed to load:", err);
                    desktopPromise = null;
                    throw err;
                });
        }

        return desktopPromise;
    }

    if (__PLATFORM__ === "android") {
        if (!androidPromise) {
            androidPromise = import("../../mobile/android/app/src/bridge/android_bridge.js")
                .then(async ({ default: AndroidBridge }) => {
                    const bridge = await AndroidBridge.create();

                    console.log("Android bridge loaded successfully.");

                    return bridge;
                })
                .catch((err) => {
                    console.error("Android bridge failed to load:", err);
                    androidPromise = null;
                    throw err;
                });
        }

        return androidPromise;
    }

    throw new Error(`Unknown platform: ${__PLATFORM__}`);
}

export function getZigExport() {
    return getBridge().then((bridge) => (name) => bridge.zigExport(name));
}

export function register(fn_name, js_fn_mockup) {
    return getBridge()
        .then((bridge) => {
            console.log(`Registering ${fn_name} for platform ${__PLATFORM__}: using native bridge`);

            return (data) => bridge.call(fn_name, data);
        })
        .catch((err) => {
            if (js_fn_mockup) {
                console.warn(`Registering ${fn_name} for platform ${__PLATFORM__}: using mockup`);
                return js_fn_mockup;
            }

            throw new Error(`no JS mockup was provided, have nothing to register ${fn_name} with`, {
                cause: err,
            });
        });
}
