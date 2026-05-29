// We'll hold the wasm exports here once loaded
let wasmExports = null;

// This self-executing function tries to load the WASM if it exists in the root
(async () => {
    try {
        const response = await fetch("/core.wasm");
        if (response.ok) {
            const { instance } =
                await WebAssembly.instantiateStreaming(response);
            wasmExports = instance.exports;
            console.log("Zig WASM loaded successfully.");
        }
    } catch (e) {
        // If this fails, we just won't have wasmExports, which is fine for Dev/Native
        console.debug("WASM not found or failed to load:", e);
    }
})();

/**
 * @param {{ value: number }} data
 * @returns {{ origin: string, value: number }}
 */
export function increment(data) {
    // The native webview binding transports one UTF-8 string in and one UTF-8
    // string out. JSON is an application-level convention here, not a webview
    // binding-layer behavior.
    if (window.bridge_increment) {
        return window
            .bridge_increment(JSON.stringify(data))
            .then((res) => JSON.parse(res));
    }

    if (wasmExports) {
        return callZigWasm(data);
    }

    return {
        origin: "From JavaScript: ",
        value: data.value + 1,
    };
}

/**
 * Helper to handle the string-based communication Zig expects
 */
function callZigWasm(data) {
    const { increment, memory } = wasmExports;

    // 1. Prepare input: Zig expects the same app-level JSON object string used
    // by the native desktop bridge.
    const inputStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const encodedInput = encoder.encode(inputStr);

    // 2. Write to WASM memory (using start of heap for simplicity)
    const heap = new Uint8Array(memory.buffer);
    heap.set(encodedInput, 0);

    // 3. Call Zig
    const outPtr = increment(0, encodedInput.length);

    // 4. Read result (null-terminated string)
    let endPtr = outPtr;
    while (heap[endPtr] !== 0) endPtr++;

    const outputEncoded = heap.slice(outPtr, endPtr);
    return JSON.parse(new TextDecoder().decode(outputEncoded));
}
