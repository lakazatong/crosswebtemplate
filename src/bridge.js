export function increment(input) {
    if (window.bridge?.increment) {
        return window.bridge.increment(input);
    }

    const data = JSON.parse(input);

    return JSON.stringify({
        data: data.data + 1,
    });
}
