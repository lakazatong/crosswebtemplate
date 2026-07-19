let wasmExports = null;

function writeStringWASM(str) {
    const encoded = new TextEncoder().encode(str);
    const ptr = wasmExports.getInputBuffer();
    const heap = new Uint8Array(wasmExports.memory.buffer);
    heap.set(encoded, ptr);
    heap[ptr + encoded.length] = 0;
    return ptr;
}

function readStringWASM(ptr) {
    const heap = new Uint8Array(wasmExports.memory.buffer);
    let end = ptr;
    while (heap[end] !== 0) end++;
    return new TextDecoder().decode(heap.slice(ptr, end));
}

if (["development", "web"].includes(__PLATFORM__)) {
    try {
        const response = await fetch("/core.wasm");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const { instance } = await WebAssembly.instantiateStreaming(response);
        wasmExports = instance.exports;
        console.log("WASM loaded successfully.");
    } catch (e) {
        wasmExports = null;
        console.debug("WASM failed to load:", e);
    }
}

export function register(fn_name, js_fn_mockup) {
    console.log(`Registering ${fn_name} for platform ${__PLATFORM__}`);
    return (data) => {
        if (["development", "web"].includes(__PLATFORM__)) {
            if (wasmExports?.[fn_name]) {
                console.log(
                    `${fn_name} called on platform ${__PLATFORM__}: using WASM`,
                );
                const ptr = writeStringWASM(JSON.stringify(data));
                const outPtr = wasmExports[fn_name](ptr);
                return JSON.parse(readStringWASM(outPtr));
            }

            if (__PLATFORM__ === "development") {
                console.log(
                    `${fn_name} called on platform ${__PLATFORM__}: using JS mockup`,
                );
                return js_fn_mockup(data);
            }

            throw new Error(
                `WASM not initialized or ${fn_name} not found in wasmExports`,
            );
        }

        if (["windows", "linux"].includes(__PLATFORM__)) {
            const js_fn_native = window?.[`bridge_${fn_name}`];

            if (!js_fn_native) {
                throw new Error(`Windows bridge not found: bridge_${fn_name}`);
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
                throw new Error(`Android bridge not found`);
            }

            const js_fn_native = bridge[`bridge_${fn_name}`];

            if (!js_fn_native) {
                throw new Error(
                    `Android bridge method not found: bridge_${fn_name}`,
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
