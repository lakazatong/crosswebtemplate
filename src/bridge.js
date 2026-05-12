/**
 * @param {{ value: number }} data
 * @returns {{ origin: string, value: number }}
 */
export function increment(data) {
    if (window.bridge_increment) {
        return window.bridge_increment(data);
    }

    return {
        origin: "From JavaScript: ",
        value: data.value + 1,
    };
}
