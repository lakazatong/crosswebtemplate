#!/usr/bin/env node
// std
import { cpSync } from "fs";
// internal
import { getPlatformName, isMain, ensureDir } from "./_utils.js";

export function exportProject(platform) {
    switch (platform) {
        case "windows":
            ensureDir("dist/windows");

            cpSync(".build/frontend", "dist/windows/www", { recursive: true });
            cpSync(".build/windows/release/cwt.exe", "dist/windows/cwt.exe");
            break;
        case "linux":
            ensureDir("dist/linux");

            cpSync(".build/frontend", "dist/linux/www", { recursive: true });
            cpSync(".build/linux/Release/cwt", "dist/linux/cwt");
            break;
        case "web":
            ensureDir("dist/web");

            cpSync(".build/frontend", "dist/web", { recursive: true });
            cpSync(".build/zig/web/release/core.wasm", "dist/web/core.wasm");
            break;
        case "android":
            ensureDir("dist/android");

            cpSync(
                "mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk",
                "dist/android/app-release-unsigned.apk",
            );
            break;
        default:
            throw new Error(`Unknown platform: ${platform}`);
    }
}

if (isMain(import.meta.url)) {
    exportProject(getPlatformName());
}
