import { wasmExports, callWasm, callNative } from "./bridge.js";

function register(fn_name, fn) {
    return (data) => {
        if (wasmExports) return callWasm(fn_name, data);
        if (window[`bridge_${fn_name}`]) return callNative(fn_name, data);
        return fn(data);
    };
}

export const increment = register("increment", (data) => ({
    origin: "From JavaScript: ",
    value: data.value + 1,
}));
