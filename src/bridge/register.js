// let wasmPromise = null;
// let desktopPromise = null;

// function getWASMBridge() {
//     if (!wasmPromise) {
//         wasmPromise = fetch("/core.wasm")
//             .then(async (response) => {
//                 if (!response.ok) throw new Error(`HTTP ${response.status}`);

//                 const WASMBridge = (await import("../../web/src/bridge/wasm_bridge.js")).default;

//                 const bytes = await response.arrayBuffer();
//                 const wasm = await WASMBridge.create(bytes, 1);

//                 console.log("WASM loaded successfully.");

//                 return wasm;
//             })
//             .catch((err) => {
//                 console.error("WASM failed to load:", err);
//                 wasmPromise = null;
//                 throw err;
//             });
//     }

//     return wasmPromise;
// }

// export function zigExport(name) {
//     return getWASMBridge().then((wasm) => wasm.zigExport(name));
// }

// function getWASMBridge(fn_name, js_fn_mockup) {
//     if (!wasmPromise) {
//         wasmPromise = fetch("/core.wasm")
//             .then(async (response) => {
//                 if (!response.ok) throw new Error(`HTTP ${response.status}`);

//                 const WASMBridge = (await import("../../web/src/bridge/wasm_bridge.js")).default;

//                 const bytes = await response.arrayBuffer();
//                 const wasm = await WASMBridge.create(bytes, 1);

//                 console.log("WASM loaded successfully.");

//                 return wasm;
//             })
//             .catch((err) => {
//                 console.error("WASM failed to load:", err);
//                 wasmPromise = null;
//                 throw err;
//             });
//     }

//     return wasmPromise
//         .then((wasm) => {
//             console.log(`Registering ${fn_name} for platform ${__PLATFORM__}: using WASM`);

//             return (data) => wasm.call(fn_name, data);
//         })
//         .catch((err) => {
//             if (js_fn_mockup) {
//                 console.warn(`Registering ${fn_name} for platform ${__PLATFORM__}: using mockup`);
//                 return js_fn_mockup;
//             }

//             throw new Error(`no JS mockup was provided, have nothing to register ${fn_name} with`, {
//                 cause: err,
//             });
//         });
// }

// function getDesktopBridge(fn_name, js_fn_mockup) {
//     if (!desktopPromise) {
//         desktopPromise = import("../../desktop/src/bridge/webview_bridge.js")
//             .then(async ({ default: DesktopBridge }) => {
//                 const bridge = await DesktopBridge.create();

//                 console.log("Desktop bridge loaded successfully.");

//                 return bridge;
//             })
//             .catch((err) => {
//                 console.error("Desktop bridge failed to load:", err);
//                 desktopPromise = null;
//                 throw err;
//             });
//     }

//     return desktopPromise
//         .then((bridge) => {
//             console.log(`Registering ${fn_name} for platform ${__PLATFORM__}: using native`);
//             return (data) => bridge.call(fn_name, data);
//         })
//         .catch((err) => {
//             if (js_fn_mockup) {
//                 console.warn(`Registering ${fn_name} for platform ${__PLATFORM__}: using mockup`);
//                 return js_fn_mockup;
//             }

//             throw new Error(`no JS mockup was provided, have nothing to register ${fn_name} with`, {
//                 cause: err,
//             });
//         });
// }

// export default function register(fn_name, js_fn_mockup) {
//     if (["development", "web"].includes(__PLATFORM__)) {
//         return getWASMBridge(fn_name, js_fn_mockup);
//     }

//     if (["windows", "linux"].includes(__PLATFORM__)) {
//         return getDesktopBridge(fn_name, js_fn_mockup);
//     }

//     if (__PLATFORM__ === "android") {
//         const bridge = window?.AndroidBridge;

//         if (!bridge) {
//             throw new Error(`android bridge not found`);
//         }

//         const js_fn_native = bridge[`bridge_${fn_name}`];

//         if (!js_fn_native) {
//             throw new Error(`android bridge method not found: bridge_${fn_name}`);
//         }

//         console.log(`Registering ${fn_name} for platform ${__PLATFORM__}: using native`);
//         return (data) =>
//             Promise.resolve(js_fn_native.call(bridge, JSON.stringify(data))).then((res) =>
//                 JSON.parse(res),
//             );
//     }

//     throw new Error(`Unknown platform: ${__PLATFORM__}`);
// }
let wasmPromise = null;
let desktopPromise = null;

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
        const bridge = window?.AndroidBridge;

        if (!bridge) {
            throw new Error("android bridge not found");
        }

        return Promise.resolve({
            call: (fn_name, data) => {
                const fn = bridge[`bridge_${fn_name}`];

                if (!fn) {
                    throw new Error(`android bridge method not found: bridge_${fn_name}`);
                }

                return Promise.resolve(fn.call(bridge, JSON.stringify(data))).then((res) =>
                    JSON.parse(res),
                );
            },
        });
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
