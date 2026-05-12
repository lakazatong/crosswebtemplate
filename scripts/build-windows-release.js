import { ensureDir, run } from "./_utils.js";

run("vite build --outDir .build/web");

ensureDir(".build/zig/windows/release");

run(
    "zig build-lib middle-end/core.zig " +
        "-target x86_64-windows-msvc " +
        "-O ReleaseFast " +
        "-static " +
        "-fcompiler-rt " +
        "-femit-bin=.build/zig/windows/release/core.lib",
);
run("cmake -S desktop -B .build/windows -DCMAKE_BUILD_TYPE=Release");
run("cmake --build .build/windows --config Release");
