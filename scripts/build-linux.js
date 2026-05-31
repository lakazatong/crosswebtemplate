#!/usr/bin/env node
// internal
import { isMain, run } from "./_utils.js";
import { getConfig } from "./_build_system.js";

export function buildLinux() {
    const config = getConfig();

    run(config.dockerImageBuildCommand);
    run(config.zigBuildCommand);
    run(config.cmakeConfigureCommand);
    run(config.cmakeBuildCommand);
    run(config.frontendBuildCommand);
}

if (isMain(import.meta.url)) {
    buildLinux();
}
