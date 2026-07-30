import Worker from "./worker_script.js?worker";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function readString(mem, ptr, len) {
    return decoder.decode(new Uint8Array(mem.buffer, ptr, len).slice());
}

export default class WASMBridge {
    #module;
    #memory;
    #mainInstance;

    #workers = [];
    #pendingJobs = new Map();
    #fnMap = {};

    constructor(module, memory, mainInstance, signalBuffer) {
        this.#module = module;
        this.#memory = memory;
        this.#mainInstance = mainInstance;

        const count = mainInstance.exports.getRegistryCount();

        for (let fn_id = 0; fn_id < count; fn_id++) {
            const ptr = mainInstance.exports.getRegistryNamePtr(fn_id);
            const len = mainInstance.exports.getRegistryNameLen(fn_id);

            this.#fnMap[readString(memory, ptr, len)] = fn_id;
        }

        this.signal = new Int32Array(signalBuffer);
    }

    #spawnWorker(signalBuffer) {
        return new Promise((resolve) => {
            const worker = new Worker();

            worker.onmessage = (e) => {
                switch (e.data.type) {
                    case "ready":
                        resolve();
                        break;

                    case "job_done":
                        this.#handleJobDone(e.data.job_id);
                        break;
                }
            };

            worker.postMessage({
                type: "start",
                module: this.#module,
                memory: this.#memory,
                signalBuffer,
            });

            this.#workers.push(worker);
        });
    }

    static async create(
        wasmBytes,
        numWorkers = navigator.hardwareConcurrency || 4,
    ) {
        const module = await WebAssembly.compile(wasmBytes);

        const memory = new WebAssembly.Memory({
            initial: 32,
            maximum: 65536,
            shared: true,
        });

        const signalBuffer = new SharedArrayBuffer(4); // 4 bytes, one i32

        const mainInstance = await WebAssembly.instantiate(module, {
            env: {
                memory,
                notify_host: () => {},
            },
        });

        const bridge = new WASMBridge(
            module,
            memory,
            mainInstance,
            signalBuffer,
        );

        await Promise.all(
            Array.from({ length: numWorkers }, () =>
                bridge.#spawnWorker(signalBuffer),
            ),
        );

        return bridge;
    }

    #handleJobDone(job_id) {
        const pending = this.#pendingJobs.get(job_id);

        if (!pending) return;

        this.#pendingJobs.delete(job_id);

        const ptr = this.#mainInstance.exports.getJobOutputPtr(job_id);
        const len = this.#mainInstance.exports.getJobOutputLen(job_id);
        const json = readString(this.#memory, ptr, len);

        let result;

        try {
            result = JSON.parse(json);
        } catch (e) {
            this.#mainInstance.exports.heapFree(ptr, len);
            this.#mainInstance.exports.releaseJob(job_id);

            pending.reject(e);
            return;
        }

        this.#mainInstance.exports.heapFree(ptr, len);
        this.#mainInstance.exports.releaseJob(job_id);

        pending.resolve(result);
    }

    call(funcName, inputObj) {
        const fn_id = this.#fnMap[funcName];

        if (fn_id === undefined) {
            throw new Error(`Function "${funcName}" not registered`);
        }

        const encoded = encoder.encode(JSON.stringify(inputObj));
        const inputPtr = this.#mainInstance.exports.heapAlloc(encoded.length);

        if (!inputPtr) {
            throw new Error("Out of memory");
        }

        new Uint8Array(this.#memory.buffer, inputPtr, encoded.length).set(
            encoded,
        );

        const job_id = this.#mainInstance.exports.enqueueJob(
            fn_id,
            inputPtr,
            encoded.length,
        );

        if (job_id === 0xffffffff) {
            this.#mainInstance.exports.heapFree(inputPtr, encoded.length);

            throw new Error("No free slots");
        }

        const promise = new Promise((resolve, reject) => {
            this.#pendingJobs.set(job_id, {
                resolve,
                reject,
            });
        });

        Atomics.add(this.signal, 0, 1);
        Atomics.notify(this.signal, 0, 1);

        return promise;
    }
}
