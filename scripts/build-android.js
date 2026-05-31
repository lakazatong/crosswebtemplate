#!/usr/bin/env node
// internal
import { isMain, run } from "./_utils.js";
import { getConfig } from "./_build_system.js";
import { generateAndroidIcons } from "./generate-icons.js";

export async function buildAndroid() {
    const config = getConfig();
    run(config.zigBuildCommand);
    run(config.zigLinkCommand);
    await generateAndroidIcons();
    run(config.frontendBuildCommand);
    run(config.gradleBuildCommand);
}

if (isMain(import.meta.url)) {
    buildAndroid();
}
