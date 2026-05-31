// std
import path from "path";
// internal
import { getProjectRoot, getMode, ensureDir } from "./_utils.js";

const projectRoot = getProjectRoot();

function cmdWithMSVC(cmd) {
    return [
        '"C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat" x64',
        "&&",
        ...cmd,
    ];
}

function getCMakeBuildType() {
    return getMode() === "release" ? "Release" : "Debug";
}

function getDockerCommand() {
    return [
        "docker",
        "run",
        "--rm",
        `-v ${projectRoot}:/app`,
        "-w /app",
        "linux-build",
    ];
}

function getZigBuildCommand(action, target, out, extra = []) {
    return [
        "zig",
        action,
        "src/middle-end/core.zig",
        `-O ${getMode() === "release" ? "ReleaseFast" : "Debug"}`,
        `-target ${target}`,
        ...extra,
        `-femit-bin=${out}`,
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

function getGradleBuildCommand() {
    const task = getMode() === "release" ? "assembleRelease" : "assembleDebug";

    return [
        "cd",
        path.join(projectRoot, "mobile", "android"),
        "&&",
        "gradlew.bat",
        task,
    ];
}

function getFrontendBuildCommand() {
    const configKey = getConfigKey();
    const buildDir = path.join(projectRoot, ".build", "frontend");
    return ["vite", "build", `--outDir ${buildDir}`, `--mode ${configKey}`];
}

function getConfigKey() {
    const script = path.basename(process.argv[1], ".js");
    // build-windows.js -> "windows", build-linux.js -> "linux", etc.
    const match = script.match(/build-(\w+)/);
    return match ? match[1] : null;
}

export function getConfig() {
    const configKey = getConfigKey();

    if (!configKey) {
        throw new Error(
            `getConfig only make sense when called from a build-*.js script`,
        );
    }

    const mode = getMode();

    let zigOutDir = path.join(projectRoot, ".build", "zig", configKey, mode);

    const relativeDesktopSourceDir = "desktop";
    const desktopSourceDir = path.join(projectRoot, relativeDesktopSourceDir);

    const relativeBuildDir = path.join(".build", configKey, mode);
    const buildDir = path.join(projectRoot, relativeBuildDir);

    let config = null;

    if (configKey === "windows") {
        ensureDir(zigOutDir);
        ensureDir(buildDir);
        config = {
            zigBuildCommand: getZigBuildCommand(
                "build-lib",
                "x86_64-windows-msvc",
                path.join(zigOutDir, "core.lib"),
                ["-static", "-fcompiler-rt"],
            ),
            cmakeConfigureCommand: cmdWithMSVC(
                getCMakeConfigureCommand(desktopSourceDir, buildDir),
            ),
            cmakeBuildCommand: cmdWithMSVC(getCMakeBuildCommand(buildDir)),
            frontendBuildCommand: getFrontendBuildCommand(),
        };
    }

    if (configKey === "linux") {
        ensureDir(zigOutDir);
        ensureDir(buildDir);
        config = {
            dockerImageBuildCommand: [
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
                ["-static", "-fcompiler-rt", "-fPIC"],
            ),
            cmakeConfigureCommand: [
                ...getDockerCommand(),
                ...getCMakeConfigureCommand(
                    relativeDesktopSourceDir,
                    relativeBuildDir,
                ),
            ],
            cmakeBuildCommand: [
                ...getDockerCommand(),
                ...getCMakeBuildCommand(relativeBuildDir),
            ],
            frontendBuildCommand: getFrontendBuildCommand(),
        };
    }

    if (configKey === "web") {
        ensureDir(zigOutDir);
        config = {
            zigBuildCommand: getZigBuildCommand(
                "build-exe",
                "wasm32-freestanding",
                path.join(zigOutDir, "core.wasm"),
                ["-fno-entry", "-rdynamic"],
            ),
            frontendBuildCommand: getFrontendBuildCommand(),
        };
    }

    if (configKey === "android") {
        zigOutDir = path.join(zigOutDir, "arm64-v8a");
        ensureDir(zigOutDir);
        const objFile = path.join(zigOutDir, "core.o");
        const soFile = path.join(zigOutDir, "libcore.so");
        const ndk =
            "C:/Users/Bo_wo/AppData/Local/Android/Sdk/ndk/28.2.13676358";
        const clang = `${ndk}/toolchains/llvm/prebuilt/windows-x86_64/bin/aarch64-linux-android24-clang.cmd`;
        const jniInclude = `${ndk}/toolchains/llvm/prebuilt/windows-x86_64/sysroot/usr/include`;

        config = {
            zigBuildCommand: [
                "zig",
                "build-obj",
                "src/middle-end/core.zig",
                `-O ${getMode() === "release" ? "ReleaseFast" : "Debug"}`,
                "-target aarch64-linux-android",
                "-fPIC",
                `-femit-bin=${objFile}`,
            ],
            zigLinkCommand: [
                clang,
                "-shared",
                "-fPIC",
                "-o",
                soFile,
                objFile,
                "src/middle-end/jni_bridge.c",
                `-I${jniInclude}`,
                "-lc",
            ],
            gradleBuildCommand: getGradleBuildCommand(),
            frontendBuildCommand: getFrontendBuildCommand(),
        };
    }

    if (!config) {
        throw new Error(`Unknown configKey: ${configKey}`);
    }

    return config;
}
