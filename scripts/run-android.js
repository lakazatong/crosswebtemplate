#!/usr/bin/env node
// std
import path from "path";
// internal
import { sleep, getMode, run, runCapture } from "./_utils.js";

const apkPath =
    getMode() === "debug"
        ? "mobile/android/app/build/outputs/apk/debug/app-debug.apk"
        : // : "dist/android/app-release.apk"; // adb install can't work until the apk is signed
          "mobile/android/app/build/outputs/apk/debug/app-debug.apk";

const namespace = "com.crosswebtemplate.app";

run(["adb", "install", `-r ${apkPath}`]);
run(["adb", "shell", "am", "start", `-n ${namespace}/.MainActivity`]);
let pid = null;
while (!pid) {
    sleep(300);
    pid = runCapture(["adb", "shell", "pidof", namespace]);
}
run(["adb", "logcat", `--pid=${pid}`, "*:I"]);
