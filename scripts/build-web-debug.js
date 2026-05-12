import { ensureDir, run } from "./_utils.js";

ensureDir(".build/zig/web/debug");
ensureDir(".build/web");

run(
    "zig build-lib middle-end/core.zig " +
        "-target wasm32-freestanding " +
        "-O Debug " +
        "-femit-bin=.build/zig/web/debug/core.wasm",
);

run("vite build --outDir .build/web");
