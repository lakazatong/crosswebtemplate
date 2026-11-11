import { getZigExport, register } from "./bridge/register.js";

export const zigExport = await getZigExport();

export const increment = await register("increment", (data) => ({
    code: 0,
    origin: "JavaScript",
    value: data.value + 1,
}));

// export const sleep = await register("sleep", async (data) => {
//     await new Promise((resolve) => setTimeout(resolve, data.value * 1000));

//     return {
//         code: 0,
//         origin: "JavaScript",
//         value: data.value,
//     };
// });

export const sleep = await register("sleep", async (data) => {
    return {
        code: 0,
        origin: "JavaScript",
        value: 0,
    };
});
