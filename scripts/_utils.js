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

export function getProjectRoot() {
    return projectRoot;
}

export function getMode() {
    return process.argv[2] === "release" ? "release" : "debug";
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

export function ensureDir(dirPath) {
    mkdirSync(dirPath, { recursive: true });
}

function getConfig(configKey) {
    const relativeCMakeSourceDir = "desktop";
    const relativeCMakeBuildDir = path.join(".build", configKey);
    const cmakeSourceDir = path.join(projectRoot, relativeCMakeSourceDir);
    const cmakeBuildDir = path.join(projectRoot, relativeCMakeBuildDir);

    const mode = getMode();
    const zigOutDir = path.join(projectRoot, ".build", "zig", configKey, mode);
    const zigOptimization = mode === "release" ? "ReleaseFast" : "Debug";

    ensureDir(zigOutDir);

    if (configKey === "windows") {
        ensureDir(cmakeBuildDir);
        return {
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
        const dockerfile = path.join(
            projectRoot,
            "desktop",
            "docker",
            "linux-build.Dockerfile",
        );
        return {
            dockerBuildCommand: [
                "docker",
                "build",
                "-f",
                dockerfile,
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
        return {
            zigBuildCommand: getZigBuildCommand(
                "build-exe",
                "wasm32-freestanding",
                path.join(zigOutDir, "core.wasm"),
                zigOptimization,
                ["-fno-entry", "-rdynamic"],
            ),
        };
    }

    throw Error(`Unknown configKey: ${configKey}`);
}

export function run(cmd) {
    if (Array.isArray(cmd)) {
        cmd = cmd.join(" ");
    }
    console.log(cmd);
    execSync(cmd, { stdio: "inherit" });
}

export function buildDockerImage(configKey) {
    const config = getConfig(configKey);
    console.log(`[${configKey}] Building Docker image...`);
    run(config.dockerBuildCommand);
}

export function buildZig(configKey) {
    const config = getConfig(configKey);
    const mode = getMode();
    console.log(`[${configKey}-${mode}] Building Zig...`);
    run(config.zigBuildCommand);
}

export function buildCMake(configKey) {
    // We assume anyone building this template runs on Windows
    // TODO: don't assume that lol, also support Linux, then MacOS?
    // i.e. make it possible to build for windows and macos on linux
    // and build for windows and linux on macos?
    const config = getConfig(configKey);
    const mode = getMode();
    console.log(`[${configKey}-${mode}] Configuring CMake...`);
    run(config.cmakeConfigureCommand);
    console.log(`[${configKey}-${mode}] Building Desktop...`);
    run(config.cmakeBuildCommand);
}

export function buildFrontend() {
    const buildDir = path.join(projectRoot, ".build", "frontend");
    console.log(`Building Frontend...`);
    run(["vite", "build", `--outDir ${buildDir}`]);
}
