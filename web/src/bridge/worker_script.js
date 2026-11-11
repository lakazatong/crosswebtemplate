onmessage = async (e) => {
    if (e.data.type !== "start") return;

    const { module, memory, signalBuffer } = e.data;

    const instance = await WebAssembly.instantiate(module, {
        env: {
            memory,
            notify_host: (job_id) => {
                postMessage({
                    type: "job_done",
                    job_id,
                });
            },
            sleep_ms: (milliseconds) => {
                const buffer = new SharedArrayBuffer(4);
                const signal = new Int32Array(buffer);
                Atomics.wait(signal, 0, 0, milliseconds);
            },
        },
    });

    instance.exports.dispatchInit();

    let signal = new Int32Array(signalBuffer);

    postMessage({
        type: "ready",
    });

    let generation = Atomics.load(signal, 0);

    while (true) {
        Atomics.wait(signal, 0, generation);
        generation = Atomics.load(signal, 0);

        while (instance.exports.processNextJob()) {}
    }
};
