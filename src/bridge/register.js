export default function register(fn_name, js_fn_mockup) {
    if (["development", "web"].includes(__PLATFORM__)) {
        return fetch("/middle-end.wasm")
            .then(async (response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const WASMBridge = (await import("./wasm_bridge.js")).default;
                const bytes = await response.arrayBuffer();
                const wasm = await WASMBridge.create(bytes, 1);

                console.log("WASM loaded successfully.");
                console.log(
                    `Registering ${fn_name} for platform ${__PLATFORM__}: using WASM`,
                );

                // return wasm.idk.bind(wasm);
                return (data) => wasm.call(fn_name, data);
                // return (data) => wasm.allocTest();
            })
            .catch((err) => {
                console.error("WASM failed to load:", err);

                if (js_fn_mockup) {
                    console.warn(
                        `Registering ${fn_name} for platform ${__PLATFORM__}: using mockup`,
                    );
                    return js_fn_mockup;
                }

                throw new Error(
                    `no JS mockup was provided, have nothing to register ${fn_name} with`,
                );
            });
    }

    if (["windows", "linux"].includes(__PLATFORM__)) {
        const js_fn_native = window?.[`bridge_${fn_name}`];

        if (!js_fn_native) {
            throw new Error(
                `${__PLATFORM__} bridge method not found: bridge_${fn_name}`,
            );
        }

        console.log(
            `Registering ${fn_name} for platform ${__PLATFORM__}: using native`,
        );
        return (data) =>
            Promise.resolve(js_fn_native(JSON.stringify(data))).then((res) =>
                JSON.parse(res),
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
            `Registering ${fn_name} for platform ${__PLATFORM__}: using native`,
        );
        return (data) =>
            Promise.resolve(
                js_fn_native.call(bridge, JSON.stringify(data)),
            ).then((res) => JSON.parse(res));
    }

    throw new Error(`Unknown platform: ${__PLATFORM__}`);
}
