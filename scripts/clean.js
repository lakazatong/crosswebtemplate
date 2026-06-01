#!/usr/bin/env node
// std
import { rmSync, existsSync, readdirSync, statSync } from "fs";
// internal
import { isMain, run } from "./_utils.js";

function killAll(processName) {
    try {
        run(`taskkill /F /T /IM ${processName}`);
    } catch {}
}

function deleteRecursive(targetPath) {
    if (!existsSync(targetPath)) return;

    try {
        rmSync(targetPath, { recursive: true, force: true });
        console.log(`deleted: ${targetPath}`);
        return;
    } catch {}

    // fast path failed — walk and retry entry by entry
    const stat = statSync(targetPath, { throwIfNoEntry: false });
    if (!stat) return;

    if (stat.isDirectory()) {
        for (const entry of readdirSync(targetPath)) {
            deleteRecursive(`${targetPath}/${entry}`);
        }
        try {
            rmSync(targetPath, { force: true });
            console.log(`deleted: ${targetPath}`);
        } catch (e) {
            console.warn(`could not delete dir: ${targetPath} — ${e.message}`);
        }
    } else {
        try {
            rmSync(targetPath, { force: true });
            console.log(`deleted: ${targetPath}`);
        } catch (e) {
            console.warn(`could not delete file: ${targetPath} — ${e.message}`);
        }
    }
}

function unregisterWslDistro(distroName) {
    try {
        run(`wsl --unregister ${distroName}`);
    } catch {}
}

export function clean() {
    killAll("cwt.exe");
    unregisterWslDistro("cwt-linux");

    for (const dir of [
        ".build",
        "dist",
        "mobile/android/.gradle",
        "mobile/android/.idea",
        "mobile/android/.kotlin",
        "mobile/android/app/build",
    ]) {
        deleteRecursive(dir);
    }
}

if (isMain(import.meta.url)) {
    clean();
}
