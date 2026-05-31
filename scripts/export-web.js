#!/usr/bin/env node
// std
import { cpSync } from "fs";
// internal
import { isMain, ensureDir } from "./_utils.js";

export function exportWeb() {
    ensureDir("dist/web");

    cpSync(".build/frontend", "dist/web", { recursive: true });
    cpSync(".build/zig/web/release/core.wasm", "dist/web/core.wasm");
}

if (isMain(import.meta.url)) {
    exportWeb();
}
