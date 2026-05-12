import { ensureDir, run } from "./_utils.js";

run("vite build --outDir .build/web");

ensureDir(".build/zig/windows/debug");

run(
    "zig build-lib middle-end/core.zig " +
        "-target x86_64-windows-msvc " +
        "-O Debug " +
        "-static " +
        "-fcompiler-rt " +
        "-femit-bin=.build/zig/windows/debug/core.lib",
);
run("cmake -S desktop -B .build/windows -DCMAKE_BUILD_TYPE=Debug");
run("cmake --build .build/windows --config Debug");
