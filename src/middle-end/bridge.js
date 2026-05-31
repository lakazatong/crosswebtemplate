export let wasmExports = null;

async function loadWasm() {
    const response = await fetch("/core.wasm");

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const mime = response.headers.get("content-type") || "";

    try {
        if (
            WebAssembly.instantiateStreaming &&
            mime.includes("application/wasm")
        ) {
            const { instance } =
                await WebAssembly.instantiateStreaming(response);

            wasmExports = instance.exports;
            console.log("WASM loaded successfully.");
            return;
        }

        const buffer = await response.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(buffer);

        wasmExports = instance.exports;
        console.log("WASM loaded successfully.");
    } catch (e) {
        console.debug("WASM failed to load:", e);
    }
}

// by dev we mean `npm run dev`
if (!import.meta.env.DEV && __PLATFORM__ === "web") {
    try {
        loadWasm();
    } catch (e) {
        console.debug("WASM failed to load:", e);
    }
}

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

export function register(fn_name, fn) {
    console.log(`Registering ${fn_name} for platform ${__PLATFORM__}`);
    return (data) => {
        console.log(`${fn_name} called on platform ${__PLATFORM__}`);

        if (__PLATFORM__ === "development") {
            return fn(data);
        }

        if (__PLATFORM__ === "web") {
            if (!wasmExports) {
                throw new Error("WASM not initialized");
            }

            const ptr = writeStringWASM(JSON.stringify(data));
            const outPtr = wasmExports[fn_name](ptr);
            return JSON.parse(readStringWASM(outPtr));
        }

        if (__PLATFORM__ === "android") {
            const bridge = window?.AndroidBridge;

            if (!bridge) {
                throw new Error(`Android bridge not found`);
            }

            const method = bridge[`bridge_${fn_name}`];

            if (!method) {
                throw new Error(
                    `Android bridge method not found: bridge_${fn_name}`,
                );
            }

            return Promise.resolve(
                method.call(bridge, JSON.stringify(data)),
            ).then((res) => JSON.parse(res));
        }

        if (["windows", "linux"].includes(__PLATFORM__)) {
            const bridge = window?.[`bridge_${fn_name}`];

            if (!bridge) {
                throw new Error(`Windows bridge not found: bridge_${fn_name}`);
            }

            return Promise.resolve(bridge(JSON.stringify(data))).then((res) =>
                JSON.parse(res),
            );
        }

        throw new Error(`Unknown platform: ${__PLATFORM__}`);
    };
}
