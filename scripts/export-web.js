import { ensureDir, run } from "./_utils.js";
import { cpSync } from "fs";

ensureDir("dist/web");

cpSync(".build/web", "dist/web", { recursive: true });
cpSync(".build/zig/web/release/core.wasm", "dist/web/core.wasm");
