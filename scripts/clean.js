#!/usr/bin/env node
// std
import { rmSync, existsSync } from "fs";
// internal
import { isMain } from "./_utils.js";

export function clean() {
    const dirs = [
        ".build",
        "dist",
        "mobile/android/.gradle",
        "mobile/android/.kotlin",
        "mobile/android/app/build",
    ];

    for (const dir of dirs) {
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
            console.log(`deleted: ${dir}`);
        }
    }
}

if (isMain(import.meta.url)) {
    clean();
}
