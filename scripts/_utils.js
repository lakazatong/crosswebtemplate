// std
import fs from "fs";
import path from "path";
import { mkdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const cachePath = path.join(projectRoot, ".build", "cache");

export function getProjectRoot() {
    return projectRoot;
}

export function getPlatformName() {
    return process.argv[2] ?? null;
}

export function getMode() {
    return process.argv[3] === "release" ? "release" : "debug";
}

export function getRelativeBuildDir(platform) {
    const mode = getMode();
    return path.join(".build", platform, mode);
}

export function getBuildDir(platform) {
    return path.join(projectRoot, getRelativeBuildDir(platform));
}

export function getZigOutDir(platform) {
    return path.join(projectRoot, ".build", "zig", platform, getMode());
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

export function readCache() {
    if (!fs.existsSync(cachePath)) {
        return {};
    }

    const cache = {};

    for (const line of fs.readFileSync(cachePath, "utf8").split("\n")) {
        if (!line.trim()) {
            continue;
        }

        const index = line.indexOf("=");

        if (index === -1) {
            continue;
        }

        cache[line.slice(0, index)] = line.slice(index + 1);
    }

    return cache;
}

export function writeCache(cache) {
    ensureDir(path.dirname(cachePath));

    fs.writeFileSync(
        cachePath,
        Object.entries(cache)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n"),
    );
}

export function readCacheEntry(key) {
    return readCache()[key]; // return undefined if absent
}

export function writeCacheEntry(key, value) {
    const cache = readCache();
    cache[key] = value; // insert or replace
    writeCache(cache);
}

export function deleteCacheEntry(key) {
    const cache = readCache();
    delete cache[key]; // noop if it doesn't exist
    writeCache(cache);
}
