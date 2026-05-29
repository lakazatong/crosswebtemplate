#!/usr/bin/env node

import { isMain, buildZig, buildCMake, buildFrontend } from "./_utils.js";

export function buildLinux() {
    buildZig("linux");
    buildCMake("linux");
    buildFrontend();
}

if (isMain(import.meta.url)) {
    buildLinux();
}
