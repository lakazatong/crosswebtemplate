#!/usr/bin/env node
// std
import path from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
// internal
import {
    getProjectRoot,
    getMode,
    run,
    runCapture,
    ensureDir,
    toWslPath,
} from "./_utils.js";

const DISTRO_NAME = "cwt-linux";
const projectRoot = getProjectRoot();

const dockerTar = path.join(
    projectRoot,
    ".build",
    "docker",
    "linux-runtime.tar",
);
const wslInstallDir = path.join(projectRoot, ".build", "wsl", DISTRO_NAME);

const dockerfilePath = path.join(
    projectRoot,
    "desktop",
    "docker",
    "run-linux.Dockerfile",
);
const dockerHashFile = path.join(
    projectRoot,
    ".build",
    "docker",
    "linux-runtime.hash",
);

function getDockerfileHash() {
    return createHash("sha256")
        .update(readFileSync(dockerfilePath))
        .digest("hex");
}

function isRuntimeStale() {
    if (!existsSync(dockerTar)) return true;
    if (!existsSync(dockerHashFile)) return true;
    return readFileSync(dockerHashFile, "utf8").trim() !== getDockerfileHash();
}

function distroExists() {
    try {
        const list = runCapture(["wsl", "--list", "--quiet"]);
        return list
            .replace(/\0/g, "")
            .split(/\r?\n/)
            .some((l) => l.trim().toLowerCase() === DISTRO_NAME.toLowerCase());
    } catch {
        return false;
    }
}

function buildRuntimeImage() {
    run([
        "docker",
        "build",
        `-f ${dockerfilePath}`,
        "-t cwt-run-linux",
        projectRoot,
    ]);
}

function exportRootfs() {
    ensureDir(path.dirname(dockerTar));
    const containerId = runCapture(["docker", "create", "cwt-run-linux"]);
    try {
        run(["docker", "export", "-o", dockerTar, containerId]);
    } finally {
        run(["docker", "rm", containerId]);
    }
    writeFileSync(dockerHashFile, getDockerfileHash());
}

function importDistro() {
    ensureDir(wslInstallDir);

    run([
        "wsl",
        "--import",
        DISTRO_NAME,
        wslInstallDir,
        dockerTar,
        "--version",
        "2",
    ]);
}

function ensureDistro() {
    const stale = isRuntimeStale();

    if (stale && distroExists()) {
        run(["wsl", "--unregister", DISTRO_NAME]);
    }

    if (stale) {
        buildRuntimeImage();
        exportRootfs();
    }

    if (!distroExists()) {
        importDistro();
    }
}

function runInWsl(wslBinaryPath, env = {}) {
    const envPairs = Object.entries({ GDK_BACKEND: "x11", ...env })
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");

    run([
        "wsl",
        `-d ${DISTRO_NAME}`,
        `-u ubuntu`,
        "--",
        "bash",
        "-c",
        `"env ${envPairs} ${wslBinaryPath}"`,
    ]);
}

ensureDistro();

if (getMode() === "release") {
    runInWsl(toWslPath(path.join(projectRoot, "dist", "linux", "cwt")));
} else {
    // WWW_PATH was baked in at cmake configure time as /app/.build/frontend (Docker path).
    // We override it here with the correct WSL mount path so the binary finds the frontend.
    // See desktop/src/main.cpp and search for CWT_WWW_PATH
    runInWsl(
        toWslPath(path.join(projectRoot, ".build", "linux", "debug", "cwt")),
        {
            CWT_WWW_PATH: toWslPath(
                path.join(projectRoot, ".build", "frontend"),
            ),
        },
    );
}
