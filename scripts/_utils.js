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

function cmdWithMSVC(cmd) {
    return [
        '"C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat" x64',
        "&&",
        ...cmd,
    ];
}

function getCMakeConfigureCommand(s, b, extra = []) {
    return [
        "cmake",
        `-S ${s}`,
        `-B ${b}`,
        "-G Ninja",
        "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
        `-DCMAKE_BUILD_TYPE=${getCMakeBuildType()}`,
        ...extra,
    ];
}

function getCMakeBuildCommand(b) {
    return ["cmake", "--build " + b];
}

function getZigBuildCommand(action, target, out, optimization, extra = []) {
    return [
        "zig",
        action,
        "src/middle-end/core.zig",
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

function getFrontendBuildCommand(platform) {
    const buildDir = path.join(projectRoot, ".build", "frontend");
    return ["vite", "build", `--outDir ${buildDir}`, `--mode ${platform}`];
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

    const mode = getMode();

    const relativeCMakeSourceDir = "desktop";
    const relativeCMakeBuildDir = path.join(".build", configKey, mode);
    const cmakeSourceDir = path.join(projectRoot, relativeCMakeSourceDir);
    const cmakeBuildDir = path.join(projectRoot, relativeCMakeBuildDir);

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
            cmakeConfigureCommand: cmdWithMSVC(
                getCMakeConfigureCommand(cmakeSourceDir, cmakeBuildDir),
            ),
            cmakeBuildCommand: cmdWithMSVC(getCMakeBuildCommand(cmakeBuildDir)),
            frontendBuildCommand: getFrontendBuildCommand("desktop"),
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
                ),
            ],
            cmakeBuildCommand: [
                ...getDockerCommand(),
                ...getCMakeBuildCommand(relativeCMakeBuildDir),
            ],
            frontendBuildCommand: getFrontendBuildCommand("desktop"),
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
            frontendBuildCommand: getFrontendBuildCommand("web"),
        };
    }

    if (!config) {
        throw Error(`Unknown configKey: ${configKey}`);
    }

    return config;
}

function run(cmd) {
    if (Array.isArray(cmd)) cmd = cmd.join(" ");
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
