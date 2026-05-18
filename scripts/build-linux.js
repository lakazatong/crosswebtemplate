import { ensureDir, run } from "./_utils.js";

run("npx vite build --outDir .build/web");

ensureDir(".build/linux/debug");

// Skip Zig for now as it's not installed, we'll mock the increment function if needed
// or just build the webview part.
run("cmake -S desktop -B .build/linux -DCMAKE_BUILD_TYPE=Debug -DWEBVIEW_GTK=ON -DWEBVIEW_EDGE=OFF");
run("cmake --build .build/linux --config Debug");
