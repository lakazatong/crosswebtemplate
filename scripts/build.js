#!/usr/bin/env node
// std
import path from "path";
// internal
import {
    getProjectRoot,
    getPlatformName,
    getMode,
    getRelativeBuildDir,
    getBuildDir,
    getZigOutDir,
    ensureDir,
    isMain,
    run,
    runCapture,
} from "./_utils.js";
import { generateAndroidIcons } from "./generate-icons.js";

const projectRoot = getProjectRoot();
const isRelease = getMode() === "release";

function cmdWithMSVC(cmd) {
    return [
        '"C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat" x64',
        "&&",
        ...cmd,
    ];
}

function getDockerCommand() {
    return [
        "docker",
        "run",
        "--rm",
        `-v ${projectRoot}:/app`,
        "-w /app",
        "cwt-build-linux",
    ];
}

function getZigBuildCommand(action, target, out, extra = []) {
    return [
        "zig",
        action,
        "src/middle-end/core.zig",
        `-O ${isRelease ? "ReleaseFast" : "Debug"}`,
        `-target ${target}`,
        ...extra,
        `-femit-bin=${out}`,
    ];
}

function getCMakeConfigureCommand(sourceDir, buildDir, extra = []) {
    return [
        "cmake",
        `-S ${sourceDir}`,
        `-B ${buildDir}`,
        "-G Ninja",
        "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
        `-DCMAKE_BUILD_TYPE=${isRelease ? "Release" : "Debug"}`,
        ...extra,
    ];
}

function getCMakeBuildCommand(buildDir) {
    return ["cmake", "--build " + buildDir];
}

function getFrontendBuildCommand(platform) {
    const buildDir = path.join(projectRoot, ".build", "frontend");
    return ["vite", "build", `--outDir ${buildDir}`, `--mode ${platform}`];
}

function runPipeline(pipeline) {
    for (const cmdArrayOrFunction of pipeline) {
        if (Array.isArray(cmdArrayOrFunction)) {
            run(cmdArrayOrFunction);
        } else {
            cmdArrayOrFunction();
        }
    }
}

export async function buildProject(platform) {
    if (!platform) {
        throw new Error(
            `Missing platform argument\nUsage: node scripts/build.js windows|linux|web|android`,
        );
    }

    const relativeBuildDir = getRelativeBuildDir(platform);
    const buildDir = getBuildDir(platform);
    const zigOutDir = getZigOutDir(platform);

    ensureDir(zigOutDir);

    const relativeDesktopSourceDir = "desktop";

    switch (platform) {
        case "windows":
            ensureDir(buildDir);
            const desktopSourceDir = path.join(
                projectRoot,
                relativeDesktopSourceDir,
            );
            runPipeline([
                getZigBuildCommand(
                    "build-lib",
                    "x86_64-windows-msvc",
                    path.join(zigOutDir, "core.lib"),
                    ["-static", "-fcompiler-rt"],
                ),
                cmdWithMSVC(
                    getCMakeConfigureCommand(desktopSourceDir, buildDir),
                ),
                cmdWithMSVC(getCMakeBuildCommand(buildDir)),
                getFrontendBuildCommand(platform),
            ]);
            break;
        case "linux":
            ensureDir(buildDir);
            try {
                runCapture(["docker", "info"]);
            } catch {
                throw new Error("Docker engine isn't running");
            }

            runPipeline([
                [
                    "docker",
                    "build",
                    "-f",
                    path.join(
                        projectRoot,
                        "desktop",
                        "docker",
                        "build-linux.Dockerfile",
                    ),
                    "-t",
                    "cwt-build-linux",
                    projectRoot,
                ],
                getZigBuildCommand(
                    "build-lib",
                    "x86_64-linux-gnu",
                    path.join(zigOutDir, "core.a"),
                    ["-static", "-fcompiler-rt", "-fPIC"],
                ),
                [
                    ...getDockerCommand(),
                    ...getCMakeConfigureCommand(
                        relativeDesktopSourceDir,
                        relativeBuildDir,
                    ),
                ],
                [
                    ...getDockerCommand(),
                    ...getCMakeBuildCommand(relativeBuildDir),
                ],
                getFrontendBuildCommand(platform),
            ]);
            break;
        case "web":
            runPipeline([
                getZigBuildCommand(
                    "build-exe",
                    "wasm32-freestanding",
                    path.join(zigOutDir, "core.wasm"),
                    ["-fno-entry", "-rdynamic"],
                ),
                getFrontendBuildCommand(platform),
            ]);
            break;
        case "android":
            // zigOutDir = path.join(zigOutDir, "arm64-v8a");

            function findLatestNdk() {
                const ndkDir = path.join(
                    os.homedir(),
                    "AppData",
                    "Local",
                    "Android",
                    "Sdk",
                    "ndk",
                );

                if (!fs.existsSync(ndkDir)) {
                    throw new Error(`NDK directory not found: ${ndkDir}`);
                }

                const candidates = fs
                    .readdirSync(ndkDir, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => {
                        const digits = entry.name.replace(/\D/g, "");
                        return digits
                            ? {
                                  value: BigInt(digits),
                                  path: path.join(ndkDir, entry.name),
                              }
                            : null;
                    })
                    .filter(Boolean);

                if (candidates.length === 0) {
                    throw new Error("No valid NDK versions found.");
                }

                return candidates.reduce((a, b) => (a.value > b.value ? a : b))
                    .path;
            }

            const ndk = findLatestNdk();
            const ndkWindows = ndk.join(
                "toolchains",
                "llvm",
                "prebuilt",
                "windows-x86_64",
            );

            function getZigLinkCommand() {
                const clang = path.join(
                    ndkWindows,
                    "bin",
                    "aarch64-linux-android24-clang.cmd",
                );
                const soFile = path.join(zigOutDir, "libcore.so");
                const jniInclude = path.join(
                    ndkWindows,
                    "sysroot",
                    "usr",
                    "include",
                );
                return [
                    clang,
                    "-shared",
                    "-fPIC",
                    "-o",
                    soFile,
                    objFile,
                    "src/middle-end/jni_bridge.c",
                    `-I${jniInclude}`,
                    "-lc",
                ];
            }

            function getGradleBuildCommand() {
                const task = isRelease ? "assembleRelease" : "assembleDebug";

                return [
                    "cd",
                    path.join(projectRoot, "mobile", "android"),
                    "&&",
                    "gradlew.bat",
                    task,
                ];
            }

            const objFile = path.join(zigOutDir, "core.o");

            runPipeline([
                getZigBuildCommand(
                    "build-obj",
                    "aarch64-linux-android",
                    objFile,
                    ["-fPIC"],
                ),
                getZigLinkCommand(),
                generateAndroidIcons,
                getGradleBuildCommand(),
                getFrontendBuildCommand(platform),
            ]);
            break;
        default:
            throw new Error(`Unknown platform: ${platform}`);
    }
}

if (isMain(import.meta.url)) {
    buildProject(getPlatformName());
}
