const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class WASMBridge {
    constructor(exports) {
        this.exports = exports;

        // maps fn_name to reusable output buffers
        this.#outputs = new Map();
        // maps fn_name to output cleanup timeout
        this.#outputTimeouts = new Map();
        // maps fn_name to initial output capacity
        this.#outputCapacities = new Map();
    }

    #outputs;
    #outputTimeouts;
    #outputCapacities;

    /**
     * Gets the amount of time an unused output buffer stays alive before being freed.
     *
     * @param {string} fn_name
     * @returns {number}
     */
    getOutputTimeout(fn_name) {
        return this.#outputTimeouts.get(fn_name) ?? 60_000;
    }

    /**
     * Sets how long reusable output buffers for a function stay alive after release.
     *
     * @param {string} fn_name
     * @param {number} timeout
     */
    setOutputTimeout(fn_name, timeout) {
        if (timeout < 0) throw new Error("timeout is negative");
        this.#outputTimeouts.set(fn_name, timeout);
    }

    /**
     * Gets the initial capacity used when creating reusable output buffers
     * for a function.
     *
     * Larger values reduce the chance of Zig needing to reallocate the buffer,
     * at the cost of keeping more WASM memory alive. Default is 1024 bytes if never set.
     *
     * @param {string} fn_name
     * @returns {number}
     */
    getOutputCapacity(fn_name) {
        return this.#outputCapacities.get(fn_name) ?? 1024;
    }

    /**
     * Sets the initial capacity used when creating reusable output buffers
     * for a function. Default is 1024 bytes if never set.
     *
     * This only affects newly created buffers. Existing buffers keep their
     * current capacity.
     *
     * @param {string} fn_name
     * @param {number} capacity
     */
    setOutputCapacity(fn_name, capacity) {
        if (capacity <= 0) {
            throw new Error("Output capacity must be greater than zero");
        }

        this.#outputCapacities.set(fn_name, capacity);
    }

    #getOutputs(fn_name) {
        let outputs = this.#outputs.get(fn_name);

        if (!outputs) {
            outputs = [];
            this.#outputs.set(fn_name, outputs);
        }

        return outputs;
    }

    #newInput(data) {
        const json = JSON.stringify(data);
        if (json === undefined) {
            throw new Error("Input is not JSON serializable");
        }

        const encoded = encoder.encode(json);
        const ptr = this.exports.allocBuffer(encoded.length);

        if (!ptr) {
            throw new Error("WASM allocation failed");
        }

        new Uint8Array(this.exports.memory.buffer).set(encoded, ptr);

        return {
            ptr,
            len: encoded.length,
        };
    }

    #newOutput(fn_name) {
        const initialCapacity = this.getOutputCapacity(fn_name);

        const ptrPtr = this.exports.allocBuffer(4);

        if (!ptrPtr) {
            throw new Error("WASM allocation failed");
        }

        const lenPtr = this.exports.allocBuffer(4);

        if (!lenPtr) {
            this.exports.freeBuffer(ptrPtr, 4);
            throw new Error("WASM allocation failed");
        }

        const capacityPtr = this.exports.allocBuffer(4);

        if (!capacityPtr) {
            this.exports.freeBuffer(ptrPtr, 4);
            this.exports.freeBuffer(lenPtr, 4);
            throw new Error("WASM allocation failed");
        }

        const ptr = this.exports.allocBuffer(initialCapacity);

        if (!ptr) {
            this.exports.freeBuffer(ptrPtr, 4);
            this.exports.freeBuffer(lenPtr, 4);
            this.exports.freeBuffer(capacityPtr, 4);
            throw new Error("WASM allocation failed");
        }

        const view = new DataView(this.exports.memory.buffer);

        view.setUint32(ptrPtr, ptr, true);
        view.setUint32(lenPtr, 0, true);
        view.setUint32(capacityPtr, initialCapacity, true);

        return {
            ptrPtr,
            lenPtr,
            capacityPtr,
            capacity: initialCapacity,
            cleanupTimer: null,
        };
    }

    #acquireOutput(fn_name) {
        const outputs = this.#getOutputs(fn_name);

        const output = outputs.find((output) => !!output.cleanupTimer);

        if (output) {
            clearTimeout(output.cleanupTimer);
            output.cleanupTimer = null;

            const view = new DataView(this.exports.memory.buffer);

            view.setUint32(output.capacityPtr, output.capacity, true);

            return output;
        }

        const newOutput = this.#newOutput(fn_name);
        outputs.push(newOutput);

        console.log(
            `Created new WASM output buffer for ${fn_name} (${outputs.length} alive)`,
        );

        return newOutput;
    }

    #freeOutput(output) {
        const view = new DataView(this.exports.memory.buffer);

        const ptr = view.getUint32(output.ptrPtr, true);
        const capacity = view.getUint32(output.capacityPtr, true);

        if (ptr) {
            this.exports.freeBuffer(ptr, capacity);
        }

        this.exports.freeBuffer(output.ptrPtr, 4);
        this.exports.freeBuffer(output.lenPtr, 4);
        this.exports.freeBuffer(output.capacityPtr, 4);
    }

    #releaseOutput(fn_name, output) {
        output.cleanupTimer = setTimeout(() => {
            if (output.cleanupTimer === null) {
                return;
            }

            this.#freeOutput(output);

            const outputs = this.#getOutputs(fn_name);
            const index = outputs.indexOf(output);

            if (index !== -1) {
                outputs.splice(index, 1);
            }

            console.log(
                `Released expired WASM output buffer for ${fn_name} (${outputs.length} remaining)`,
            );

            if (outputs.length === 0) {
                this.#outputs.delete(fn_name);
            }
        }, this.getOutputTimeout(fn_name));
    }

    #readOutput(output) {
        const view = new DataView(this.exports.memory.buffer);

        const ptr = view.getUint32(output.ptrPtr, true);
        const len = view.getUint32(output.lenPtr, true);

        if (!ptr) {
            // should never happen thanks to if (code !== 0)
            throw new Error("Zig returned a NULL output ptr");
        }

        const json = decoder.decode(
            new Uint8Array(this.exports.memory.buffer, ptr, len),
        );

        try {
            return JSON.parse(json);
        } catch (e) {
            throw new Error(
                `Invalid JSON returned by Zig: ${json}\n${e.message}`,
            );
        }
    }

    /**
     * Calls a WASM exported function.
     *
     * The input object is serialized to JSON and passed to WASM.
     * The output buffer is automatically acquired, reused when possible,
     * and released after a timeout when unused.
     *
     * @param {string} fn_name
     * @param {object} inObj
     * @returns {object}
     */
    call(fn_name, inObj) {
        const input = this.#newInput(inObj);
        let output;
        try {
            output = this.#acquireOutput(fn_name);
        } catch (e) {
            this.exports.freeBuffer(input.ptr, input.len);
            throw e;
        }

        try {
            const code = this.exports[fn_name](
                input.ptr,
                input.len,
                output.ptrPtr,
                output.lenPtr,
                output.capacityPtr,
            );

            if (code !== 0) {
                throw new Error(`WASM error code: ${code}`);
            }

            const view = new DataView(this.exports.memory.buffer);
            output.capacity = view.getUint32(output.capacityPtr, true);

            return this.#readOutput(output);
        } finally {
            this.exports.freeBuffer(input.ptr, input.len);
            this.#releaseOutput(fn_name, output);
        }
    }

    /**
     * Immediately frees every reusable WASM output buffer.
     *
     * Call this when the WASM bridge is no longer needed.
     */
    dispose() {
        for (const [fn_name, outputs] of this.#outputs) {
            for (const output of outputs) {
                if (output.cleanupTimer !== null) {
                    clearTimeout(output.cleanupTimer);
                }

                this.#freeOutput(output);
            }

            console.log(
                `Disposed ${outputs.length} WASM output buffer(s) for ${fn_name}`,
            );
        }

        this.#outputs.clear();
    }
}
