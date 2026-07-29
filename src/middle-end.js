import register from "./bridge/register.js";

export const increment = await register("increment", (data) => ({
    code: 0,
    origin: "From JavaScript: ",
    value: data.value + 1,
}));
