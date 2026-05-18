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
        console.debug(
            "WASM not found or failed to load; proceeding to check other environments.",
        );
    }
})();

/**
 * @param {{ value: number }} data
 * @returns {{ origin: string, value: number }}
 */
export function increment(data) {
    if (window.bridge_increment) {
        return window
            .bridge_increment(JSON.stringify(data))
            .then((res) => JSON.parse(res));
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
    const { increment: zigFn, memory } = wasmExports;

    // 1. Prepare input: Zig expects a JSON string
    // Based on your core.zig, it parses an array like bridge_increment sends: [{"value": n}]
    const inputStr = JSON.stringify([data]);
    const encoder = new TextEncoder();
    const encodedInput = encoder.encode(inputStr);

    // 2. Write to WASM memory (using start of heap for simplicity)
    const heap = new Uint8Array(memory.buffer);
    heap.set(encodedInput, 0);

    // 3. Call Zig
    const outPtr = zigFn(0, encodedInput.length);

    // 4. Read result (null-terminated string)
    let endPtr = outPtr;
    while (heap[endPtr] !== 0) endPtr++;

    const outputEncoded = heap.slice(outPtr, endPtr);
    return JSON.parse(new TextDecoder().decode(outputEncoded));
}
