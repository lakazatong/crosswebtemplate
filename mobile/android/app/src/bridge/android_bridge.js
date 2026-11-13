export default class AndroidBridge {
    #workerCount = 0;
    #fnMap = new Map();
    #pendingJobs = new Map();

    constructor(registry, numWorkers) {
        if (!Array.isArray(registry)) {
            throw new TypeError("Expected registry to be an array");
        }

        this.#workerCount = numWorkers;

        for (let fn_id = 0; fn_id < registry.length; fn_id++) {
            this.#fnMap.set(registry[fn_id], fn_id);
        }

        window.__cwtBridge = this;
        console.log("AndroidBridge worker count:", this.#workerCount);
    }

    async zigExport(name) {
        const response = await window.AndroidBridge.bridge_get_export(name);
        return Number(response);
    }

    static async create() {
        const { registry, worker_count } = JSON.parse(
            await window.AndroidBridge.bridge_get_registry(""),
        );

        return new AndroidBridge(registry, worker_count);
    }

    async #handleJobDone(job_id) {
        const pending = this.#pendingJobs.get(job_id);

        if (!pending) {
            console.error(`Unknown completed job: ${job_id}`);
            return;
        }

        this.#pendingJobs.delete(job_id);

        try {
            const response = JSON.parse(
                await window.AndroidBridge.bridge_take_output(JSON.stringify({ job_id })),
            );

            if (response.error) {
                throw new Error(response.error);
            }

            pending.resolve(response);
        } catch (error) {
            pending.reject(error);
        }
    }

    onJobDone(job_id) {
        this.#handleJobDone(job_id);
    }

    async call(funcName, inputObj) {
        const fn_id = this.#fnMap.get(funcName);

        if (fn_id === undefined) {
            throw new Error(`Function "${funcName}" not registered`);
        }

        const payload = { fn_id };

        if (inputObj !== undefined) {
            const serialized = JSON.stringify(inputObj);
            if (serialized === undefined) {
                throw new TypeError("Input cannot be serialized to JSON");
            }
            payload.input = serialized;
        }

        const response = JSON.parse(
            await window.AndroidBridge.bridge_enqueue(JSON.stringify(payload)),
        );

        if (response.error) {
            throw new Error(response.error);
        }

        return new Promise((resolve, reject) => {
            this.#pendingJobs.set(response.job_id, { resolve, reject });
        });
    }
}
