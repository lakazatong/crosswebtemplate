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

function callZigWasm(data) {
    const encoder = new TextEncoder();
    const inputText = JSON.stringify(data);
    const encodedInput = encoder.encode(inputText);

    const inputPtr = wasmExports.getInputBuffer();
    console.log("inputPtr:", inputPtr);
    console.log("inputText:", inputText);
    console.log("encodedInput:", encodedInput);

    const heap = new Uint8Array(wasmExports.memory.buffer);
    heap.set(encodedInput, inputPtr);
    heap[inputPtr + encodedInput.length] = 0;

    console.log(
        "heap at inputPtr before call:",
        heap.slice(inputPtr, inputPtr + encodedInput.length + 1),
    );

    const outPtr = wasmExports.increment(inputPtr);
    console.log("outPtr:", outPtr);

    console.log(
        "heap at inputPtr after call:",
        heap.slice(inputPtr, inputPtr + 20),
    );
    console.log("heap at outPtr after call:", heap.slice(outPtr, outPtr + 50));

    let endPtr = outPtr;
    while (heap[endPtr] !== 0) endPtr++;
    console.log("endPtr:", endPtr);

    const outputEncoded = heap.slice(outPtr, endPtr);
    const outputText = new TextDecoder().decode(outputEncoded);
    console.log("outputText:", outputText);

    return JSON.parse(outputText);
}
