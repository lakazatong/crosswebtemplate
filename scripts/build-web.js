#!/usr/bin/env node
// internal
import { isMain, run } from "./_utils.js";
import { getConfig } from "./_build_system.js";

export function buildWeb() {
    const config = getConfig();

    run(config.zigBuildCommand);
    run(config.frontendBuildCommand);
}

if (isMain(import.meta.url)) {
    buildWeb();
}
