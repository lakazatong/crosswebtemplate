#!/usr/bin/env node
// std
import { cpSync } from "fs";
// internal
import { isMain, ensureDir } from "./_utils.js";

export function exportLinux() {
    ensureDir("dist/linux");

    cpSync(".build/frontend", "dist/linux/www", { recursive: true });
    cpSync(".build/linux/Release/cwt", "dist/linux/cwt");
}

if (isMain(import.meta.url)) {
    exportLinux();
}
