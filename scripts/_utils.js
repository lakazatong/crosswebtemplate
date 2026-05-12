import { mkdirSync } from "fs";
import { execSync } from "child_process";

export function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}

export function run(cmd) {
    execSync(cmd, { stdio: "inherit" });
}
