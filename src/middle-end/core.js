import { register } from "./bridge.js";

export const increment = register("increment", (data) => ({
    origin: "From JavaScript: ",
    value: data.value + 1,
}));
