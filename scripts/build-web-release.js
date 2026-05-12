import { ensureDir, run } from "./_utils.js";

ensureDir(".build/zig/web/release");
ensureDir(".build/web");

run(
    "zig build-lib middle-end/core.zig " +
        "-target wasm32-freestanding " +
        "-O ReleaseFast " +
        "-femit-bin=.build/zig/web/release/core.wasm",
);

run("vite build --outDir .build/web");
