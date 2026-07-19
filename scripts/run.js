#!/usr/bin/env node
// std
import os from "os";
import path from "path";
import {
    cpSync,
    existsSync,
    readFileSync,
    writeFileSync,
    createReadStream,
} from "fs";
import { createHash } from "crypto";
// external
import express from "express";
import chalk from "chalk";
import clipboardy from "clipboardy";
import stripAnsi from "strip-ansi";
// internal
import {
    sleep,
    getProjectRoot,
    getPlatformName,
    getMode,
    isMain,
    ensureDir,
    runCapture,
    run,
    getBuildDir,
} from "./_utils.js";

const projectRoot = getProjectRoot();
const isRelease = getMode() === "release";

function runLinux() {
    const DISTRO_NAME = "cwt-linux";
    const CONTAINER_NAME = "cwt-run-linux";
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
        return (
            readFileSync(dockerHashFile, "utf8").trim() !== getDockerfileHash()
        );
    }

    function distroExists() {
        try {
            const list = runCapture(["wsl", "--list", "--quiet"]);
            return list
                .replace(/\0/g, "")
                .split(/\r?\n/)
                .some(
                    (l) => l.trim().toLowerCase() === DISTRO_NAME.toLowerCase(),
                );
        } catch {
            return false;
        }
    }

    function buildRuntimeImage() {
        run([
            "docker",
            "build",
            `-f ${dockerfilePath}`,
            `-t ${CONTAINER_NAME}`,
            projectRoot,
        ]);
    }

    function exportRootfs() {
        ensureDir(path.dirname(dockerTar));
        const containerId = runCapture(["docker", "create", CONTAINER_NAME]);
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

    function toWslPath(winPath) {
        const forward = winPath.replaceAll("\\", "/");
        // Match drive letter at start: "C:/..."
        const match = forward.match(/^([A-Za-z]):\/(.*)$/);
        if (!match) throw new Error(`Cannot convert to WSL path: ${winPath}`);
        const letter = match[1].toLowerCase();
        const rest = match[2];
        return `/mnt/${letter}/${rest}`;
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

    if (isRelease) {
        runInWsl(toWslPath(path.join(projectRoot, "dist", "linux", "cwt")));
    } else {
        // WWW_PATH was baked in at cmake configure time as /app/.build/frontend (Docker path).
        // We override it here with the correct WSL mount path so the binary finds the frontend.
        // See desktop/src/main.cpp and search for CWT_WWW_PATH
        runInWsl(
            toWslPath(
                path.join(projectRoot, ".build", "linux", "debug", "cwt"),
            ),
            {
                CWT_WWW_PATH: toWslPath(
                    path.join(projectRoot, ".build", "frontend"),
                ),
            },
        );
    }
}

function runWeb() {
    const port = 5173;
    const buildRoot = path.join(projectRoot, ".build");
    const app = express();

    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            const ms = Date.now() - start;
            const status = res.statusCode;
            const statusText =
                status < 400
                    ? chalk.green(`Returned ${status}`)
                    : chalk.red(`Returned ${status}`);
            const date = chalk.gray(
                (() => {
                    const d = new Date();
                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
                })(),
            );
            const ip = chalk.yellow(req.ip);
            const method = chalk.blue(req.method);
            console.log(
                ` ${chalk.bgBlue(" HTTP ")} ${date} ${ip} ${method} ${req.url}`,
            );
            console.log(
                ` ${chalk.bgBlue(" HTTP ")} ${date} ${ip} ${statusText} in ${ms} ms`,
            );
        });
        next();
    });

    if (isRelease) {
        app.use(express.static(path.join(projectRoot, "dist", "web")));
    } else {
        app.get("/core.wasm", (req, res) => {
            const wasmPath = path.join(
                buildRoot,
                "zig",
                "web",
                "debug",
                "core.wasm",
            );
            res.setHeader("Content-Type", "application/wasm");
            createReadStream(wasmPath).pipe(res);
        });
        app.use(express.static(path.join(buildRoot, "frontend")));
    }

    const localUrl = `http://localhost:${port}`;
    const networkIp = Object.values(os.networkInterfaces())
        .flat()
        .find((i) => i.family === "IPv4" && !i.internal)?.address;
    const networkUrl = networkIp
        ? `http://${networkIp}:${port}`
        : "unavailable";

    const server = app.listen(port, () => {
        const padLine = (content) =>
            `   │   ${content}${" ".repeat(40 - stripAnsi(content).length)}│`;

        clipboardy.writeSync(localUrl);
        const lines = [
            "",
            chalk.green("   ┌───────────────────────────────────────────┐"),
            chalk.green("   │                                           │"),
            chalk.green(padLine("Serving!")),
            chalk.green("   │                                           │"),
            chalk.green(padLine(chalk.white(`- Local:    ${localUrl}`))),
            chalk.green(padLine(chalk.white(`- Network:  ${networkUrl}`))),
            chalk.green("   │                                           │"),
            chalk.green(
                padLine(chalk.gray("Copied local address to clipboard!")),
            ),
            chalk.green("   │                                           │"),
            chalk.green("   └───────────────────────────────────────────┘"),
            "",
        ];

        console.log(lines.join("\n"));
    });

    function onSIGINT() {
        process.off("SIGINT", onSIGINT);

        console.log(
            `\n ${chalk.bgMagenta(" INFO ")} Gracefully shutting down. Please wait...`,
        );

        server.close(() => {
            process.exit(0);
        });
    }

    process.on("SIGINT", onSIGINT);
}

function runAndroid() {
    const apkPath = isRelease
        ? // "dist/android/app-release.apk"; // adb install can't work until the apk is signed
          "mobile/android/app/build/outputs/apk/debug/app-debug.apk"
        : "mobile/android/app/build/outputs/apk/debug/app-debug.apk";

    const namespace = "com.crosswebtemplate.app";

    run(["adb", "install", `-r ${apkPath}`]);
    run(["adb", "shell", "am", "start", `-n ${namespace}/.MainActivity`]);
    let pid = null;
    while (!pid) {
        sleep(300);
        pid = runCapture(["adb", "shell", "pidof", namespace]);
    }
    run(["adb", "logcat", `--pid=${pid}`, "*:I"]);
}

export function runProject(platform) {
    switch (platform) {
        case "windows":
            run(
                isRelease
                    ? path.join("dist", platform, "cwt.exe")
                    : getBuildDir(platform).join("cwt.exe"),
            );
            break;
        case "linux":
            runLinux();
            break;
        case "web":
            runWeb();
            break;
        case "android":
            runAndroid();
            break;
        default:
            throw new Error(`Unknown platform: ${platform}`);
    }
}

if (isMain(import.meta.url)) {
    runProject(getPlatformName());
}
