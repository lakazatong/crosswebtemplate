let instance = null;

onmessage = async (e) => {
    switch (e.data.type) {
        case "init":
            const { module, memory } = e.data;

            instance = await WebAssembly.instantiate(module, {
                env: {
                    memory,
                    notify_js: (job_id) => {
                        postMessage({ type: "job_done", job_id });
                    },
                },
            });

            instance.exports.dispatchInit();

            postMessage({ type: "ready" });
            break;

        case "wake":
            instance.exports.wake(e.data.job_id);
            break;
    }
};
