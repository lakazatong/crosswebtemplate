import Worker from "./worker_script.js?worker";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const heapBase = 2 * Math.pow(2, 20); // 2 MiB

function readString(mem, ptr, len) {
    const raw = new Uint8Array(mem.buffer, ptr, len);
    const data = raw.slice();
    return decoder.decode(data);
}

export default class WASMBridge {
    #module;
    #memory;
    #mainInstance;

    #workers = [];
    #pendingJobs = new Map(); // job_id -> { resolve, reject, inputPtr, inputLen }
    // same as coreInit in core.zig
    #fnMap = {};

    constructor(module, memory, mainInstance) {
        this.#module = module;
        this.#memory = memory;
        this.#mainInstance = mainInstance;

        const count = mainInstance.exports.getRegistryCount();

        for (let fn_id = 0; fn_id < count; fn_id++) {
            const ptr = mainInstance.exports.getRegistryNamePtr(fn_id);
            const len = mainInstance.exports.getRegistryNameLen(fn_id);
            const name = readString(memory, ptr, len);
            this.#fnMap[name] = fn_id;
        }

        console.log("fnMap:", this.#fnMap);
    }

    #spawnWorker(index) {
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
                type: "init",
                module: this.#module,
                memory: this.#memory,
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
            maximum: 65536, // 4GiB virtual
            shared: true,
        });

        const mainInstance = await WebAssembly.instantiate(module, {
            env: { memory, notify_js: () => {} },
        });

        console.log("exports:", Object.keys(mainInstance.exports));

        const bridge = new WASMBridge(module, memory, mainInstance);

        // Spawn workers
        await Promise.all(
            Array.from({ length: numWorkers }, (_, i) =>
                bridge.#spawnWorker(i),
            ),
        );

        return bridge;
    }

    #handleJobDone(job_id) {
        const pending = this.#pendingJobs.get(job_id);

        if (!pending) {
            return;
        }

        this.#pendingJobs.delete(job_id);

        if (pending.inputPtr) {
            this.#mainInstance.exports.heapFree(
                pending.inputPtr,
                pending.inputLen,
            );
        }

        const ptr = this.#mainInstance.exports.getJobOutputPtr(job_id);
        const len = this.#mainInstance.exports.getJobOutputLen(job_id);

        if (ptr === 0) {
            this.#mainInstance.exports.releaseJob(job_id);
            pending.reject(new Error("Job completed but output is NULL"));
            return;
        }

        const json = readString(this.#memory, ptr, len);

        let result;

        try {
            result = JSON.parse(json);
        } catch (e) {
            this.#mainInstance.exports.heapFree(ptr, len);
            this.#mainInstance.exports.releaseJob(job_id);
            pending.reject(new Error(`Invalid JSON: ${json}`));
            return;
        }

        this.#mainInstance.exports.heapFree(ptr, len);
        this.#mainInstance.exports.releaseJob(job_id);
        pending.resolve(result);
    }

    #wakeWorkers(jobId) {
        for (const worker of this.#workers) {
            worker.postMessage({ type: "wake", job_id: jobId });
        }
    }

    // Public: submit a job and get a Promise
    call(funcName, inputObj) {
        const funcId = this.#fnMap[funcName];
        if (funcId === undefined) {
            throw new Error(`Function "${funcName}" not registered`);
        }

        const json = JSON.stringify(inputObj);
        const encoded = encoder.encode(json);

        if (encoded.length === 0) {
            throw new Error("Empty inputObj");
        }

        const inputPtr = this.#mainInstance.exports.heapAlloc(encoded.length);

        if (!inputPtr) {
            throw new Error("Out of memory for input");
        }

        new Uint8Array(this.#memory.buffer, inputPtr, encoded.length).set(
            encoded,
        );

        const jobId = this.#mainInstance.exports.submitJob(
            funcId,
            inputPtr,
            encoded.length,
        );

        if (jobId === 0xffffffff) {
            this.#mainInstance.exports.heapFree(inputPtr, encoded.length);
            throw new Error("No free job slots");
        }

        const promise = new Promise((resolve, reject) => {
            this.#pendingJobs.set(jobId, {
                resolve,
                reject,
                inputPtr,
                inputLen: encoded.length,
            });
        });

        this.#wakeWorkers(jobId);

        console.log(
            `[call] created job ${jobId} for function ${funcName} with input ${inputPtr - heapBase} of length ${encoded.length}`,
        );

        return promise;
    }
}
