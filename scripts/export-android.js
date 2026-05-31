#!/usr/bin/env node
// std
import { cpSync } from "fs";
// internal
import { isMain, ensureDir } from "./_utils.js";

export function exportAndroid() {
    ensureDir("dist/android");

    cpSync(
        "mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk",
        "dist/android/app-release-unsigned.apk",
    );
}

if (isMain(import.meta.url)) {
    exportAndroid();
}
