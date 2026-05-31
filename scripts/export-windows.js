#!/usr/bin/env node
// std
import { cpSync } from "fs";
// internal
import { isMain, ensureDir } from "./_utils.js";

export function exportWindows() {
    ensureDir("dist/windows");

    cpSync(".build/frontend", "dist/windows/www", { recursive: true });
    cpSync(".build/windows/release/cwt.exe", "dist/windows/cwt.exe");
}

if (isMain(import.meta.url)) {
    exportWindows();
}
