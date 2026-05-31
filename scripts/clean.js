#!/usr/bin/env node
// std
import { rmSync, existsSync } from "fs";
// internal
import { isMain, run } from "./_utils.js";

function killAll(processName) {
    try {
        run(`taskkill /F /T /IM ${processName}`, { stdio: "ignore" });
    } catch {}
}

export function clean() {
    killAll("cwt.exe");

    const dirs = [
        ".build",
        "dist",
        "mobile/android/.gradle",
        "mobile/android/.idea",
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
