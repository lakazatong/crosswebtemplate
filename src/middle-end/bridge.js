import { WASMBridge } from "./wasm_bridge.js";

let wasm = null;

if (["development", "web"].includes(__PLATFORM__)) {
    try {
        const response = await fetch("/core.wasm");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const { instance } = await WebAssembly.instantiateStreaming(response);

        wasm = new WASMBridge(instance.exports);

        console.log("WASM loaded successfully.");
    } catch (e) {
        wasm = null;
        console.debug("WASM failed to load:", e);
    }
}

export function register(fn_name, js_fn_mockup) {
    console.log(`Registering ${fn_name} for platform ${__PLATFORM__}`);
    return (data) => {
        if (["development", "web"].includes(__PLATFORM__)) {
            if (wasm) {
                console.log(
                    `${fn_name} called on platform ${__PLATFORM__}: using WASM`,
                );

                return wasm.call(fn_name, data);
            }

            if (__PLATFORM__ === "development" && js_fn_mockup) {
                return js_fn_mockup(data);
            }

            throw new Error(
                "WASM not initialized and no JS mockup was provided",
            );
        }

        if (["windows", "linux"].includes(__PLATFORM__)) {
            const js_fn_native = window?.[`bridge_${fn_name}`];

            if (!js_fn_native) {
                throw new Error(
                    `${__PLATFORM__} bridge method not found: bridge_${fn_name}`,
                );
            }

            console.log(
                `${fn_name} called on platform ${__PLATFORM__}: using native`,
            );
            return Promise.resolve(js_fn_native(JSON.stringify(data))).then(
                (res) => JSON.parse(res),
            );
        }

        if (__PLATFORM__ === "android") {
            const bridge = window?.AndroidBridge;

            if (!bridge) {
                throw new Error(`android bridge not found`);
            }

            const js_fn_native = bridge[`bridge_${fn_name}`];

            if (!js_fn_native) {
                throw new Error(
                    `android bridge method not found: bridge_${fn_name}`,
                );
            }

            console.log(
                `${fn_name} called on platform ${__PLATFORM__}: using native`,
            );
            return Promise.resolve(
                js_fn_native.call(bridge, JSON.stringify(data)),
            ).then((res) => JSON.parse(res));
        }

        throw new Error(`Unknown platform: ${__PLATFORM__}`);
    };
}
