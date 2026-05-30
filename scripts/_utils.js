import path from "path";
import { mkdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export function isMain(url) {
    return url === `file:///${process.argv[1]}`.replaceAll("\\", "/");
}

export function ensureDir(dirPath) {
    mkdirSync(dirPath, { recursive: true });
}

export function getMode() {
    return process.argv[2] === "release" ? "release" : "debug";
}

export function getProjectRoot() {
    return projectRoot;
}

function getCMakeBuildType() {
    return getMode() === "release" ? "Release" : "Debug";
}

function getCMakeConfigureCommand(s, b, extra = []) {
    return ["cmake", "-S " + s, "-B " + b, ...extra];
}

function getCMakeBuildCommand(b) {
    return ["cmake", "--build " + b, "--config " + getCMakeBuildType()];
}

function getZigBuildCommand(action, target, out, optimization, extra = []) {
    return [
        "zig",
        action,
        "middle-end/core.zig",
        `-O ${optimization}`,
        `-target ${target}`,
        ...extra,
        `-femit-bin=${out}`,
    ];
}

function getDockerCommand() {
    return [
        "docker",
        "run",
        "--rm",
        `-v ${getProjectRoot()}:/app`,
        "-w /app",
        "linux-build",
    ];
}

function getFrontendBuildCommand() {
    const buildDir = path.join(projectRoot, ".build", "frontend");
    return ["vite", "build", `--outDir ${buildDir}`];
}

function getConfigKey() {
    const script = path.basename(process.argv[1], ".js");
    // build-windows.js -> "windows", build-linux.js -> "linux", etc.
    const match = script.match(/build-(\w+)/);
    return match ? match[1] : null;
}

function getConfig() {
    const configKey = getConfigKey();

    if (!configKey) {
        throw Error(
            `getConfig only make sense when called from a build-*.js script`,
        );
    }

    const relativeCMakeSourceDir = "desktop";
    const relativeCMakeBuildDir = path.join(".build", configKey);
    const cmakeSourceDir = path.join(projectRoot, relativeCMakeSourceDir);
    const cmakeBuildDir = path.join(projectRoot, relativeCMakeBuildDir);

    const mode = getMode();
    const zigOutDir = path.join(projectRoot, ".build", "zig", configKey, mode);
    const zigOptimization = mode === "release" ? "ReleaseFast" : "Debug";

    ensureDir(zigOutDir);

    let config = null;

    if (configKey === "windows") {
        ensureDir(cmakeBuildDir);
        config = {
            zigBuildCommand: getZigBuildCommand(
                "build-lib",
                "x86_64-windows-msvc",
                path.join(zigOutDir, "core.lib"),
                zigOptimization,
                ["-static", "-fcompiler-rt"],
            ),
            cmakeConfigureCommand: getCMakeConfigureCommand(
                cmakeSourceDir,
                cmakeBuildDir,
            ),
            cmakeBuildCommand: getCMakeBuildCommand(cmakeBuildDir),
        };
    }

    if (configKey === "linux") {
        ensureDir(cmakeBuildDir);
        config = {
            dockerBuildCommand: [
                "docker",
                "build",
                "-f",
                path.join(
                    projectRoot,
                    "desktop",
                    "docker",
                    "linux-build.Dockerfile",
                ),
                "-t",
                "linux-build",
                projectRoot,
            ],
            zigBuildCommand: getZigBuildCommand(
                "build-lib",
                "x86_64-linux-gnu",
                path.join(zigOutDir, "core.a"),
                zigOptimization,
                ["-static", "-fcompiler-rt", "-fPIC"],
            ),
            cmakeConfigureCommand: [
                ...getDockerCommand(),
                ...getCMakeConfigureCommand(
                    relativeCMakeSourceDir,
                    relativeCMakeBuildDir,
                    ['-G "Ninja Multi-Config"'],
                ),
            ],
            cmakeBuildCommand: [
                ...getDockerCommand(),
                ...getCMakeBuildCommand(relativeCMakeBuildDir),
            ],
        };
    }

    if (configKey === "web") {
        config = {
            zigBuildCommand: getZigBuildCommand(
                "build-exe",
                "wasm32-freestanding",
                path.join(zigOutDir, "core.wasm"),
                zigOptimization,
                ["-fno-entry", "-rdynamic"],
            ),
        };
    }

    if (!config) {
        throw Error(`Unknown configKey: ${configKey}`);
    }

    config.frontendBuildCommand = getFrontendBuildCommand();

    return config;
}

function run(cmd) {
    if (Array.isArray(cmd)) {
        cmd = cmd.join(" ");
    }
    console.log(cmd);
    execSync(cmd, { stdio: "inherit" });
}

function buildLog(msg) {
    console.log(`[${getConfigKey()}-${getMode()}] ${msg}`);
}

export function buildDockerImage() {
    const config = getConfig();
    buildLog(`Building Docker image...`);
    run(config.dockerBuildCommand);
}

export function buildZig() {
    const config = getConfig();
    buildLog(`Building Zig...`);
    run(config.zigBuildCommand);
}

export function buildCMake() {
    // We assume anyone building this template runs on Windows
    // TODO: don't assume that lol, also support Linux, then MacOS?
    // i.e. make it possible to build for windows and macos on linux
    // and build for windows and linux on macos?
    const config = getConfig();
    buildLog(`Configuring CMake...`);
    run(config.cmakeConfigureCommand);
    buildLog(`Building Desktop...`);
    run(config.cmakeBuildCommand);
}

export function buildFrontend() {
    const config = getConfig();
    buildLog("Building Frontend...");
    run(config.frontendBuildCommand);
}
