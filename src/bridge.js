export let wasmExports = null;

(async () => {
    try {
        const response = await fetch("/core.wasm");
        if (response.ok) {
            const { instance } =
                await WebAssembly.instantiateStreaming(response);
            wasmExports = instance.exports;
            console.log("Zig WASM loaded successfully.");
        } else {
            console.debug("WASM not found:", response);
        }
    } catch (e) {
        console.debug("WASM failed to load:", e);
    }
})();

function writeString(str) {
    const encoded = new TextEncoder().encode(str);
    const ptr = wasmExports.getInputBuffer();
    const heap = new Uint8Array(wasmExports.memory.buffer);
    heap.set(encoded, ptr);
    heap[ptr + encoded.length] = 0;
    return ptr;
}

function readString(ptr) {
    const heap = new Uint8Array(wasmExports.memory.buffer);
    let end = ptr;
    while (heap[end] !== 0) end++;
    return new TextDecoder().decode(heap.slice(ptr, end));
}

export function callZigWasm(fn_name, data) {
    const ptr = writeString(JSON.stringify(data));
    const outPtr = wasmExports[fn_name](ptr);
    return JSON.parse(readString(outPtr));
}

export function callNative(fn_name, data) {
    return window[`bridge_${fn_name}`](JSON.stringify(data)).then((res) =>
        JSON.parse(res),
    );
}
