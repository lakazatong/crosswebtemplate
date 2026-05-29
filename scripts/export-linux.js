#!/usr/bin/env node

import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, ".build", "linux-release");
const destDir = path.join(projectRoot, "dist", "linux");

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Copy the executable
const sourceExe = path.join(sourceDir, "cwt");
const destExe = path.join(destDir, "cwt");

if (fs.existsSync(sourceExe)) {
    fs.copyFileSync(sourceExe, destExe);
    fs.chmodSync(destExe, 0o755);
    console.log(`✓ Exported Linux executable: ${destExe}`);
} else {
    console.error(`Error: Build artifact not found at ${sourceExe}`);
    process.exit(1);
}

// Copy web assets
const sourceWeb = path.join(projectRoot, ".build", "web");
const destWeb = path.join(destDir, "www");

if (fs.existsSync(destWeb)) {
    fs.rmSync(destWeb, { recursive: true });
}
fs.cpSync(sourceWeb, destWeb, { recursive: true });
console.log(`✓ Exported web assets: ${destWeb}`);
