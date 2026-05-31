// std
import path from "path";
import { mkdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export function getProjectRoot() {
    return projectRoot;
}

export function getMode() {
    return process.argv[2] === "release" ? "release" : "debug";
}

export function isMain(url) {
    return url === `file:///${process.argv[1]}`.replaceAll("\\", "/");
}

export function ensureDir(dirPath) {
    mkdirSync(dirPath, { recursive: true });
}

export function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function run(cmd) {
    if (Array.isArray(cmd)) cmd = cmd.join(" ");
    console.log(cmd);
    execSync(cmd, { stdio: "inherit" });
}

export function runCapture(cmd) {
    if (Array.isArray(cmd)) cmd = cmd.join(" ");
    return execSync(cmd, { encoding: "utf8" }).trim();
}
