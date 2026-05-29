#!/usr/bin/env node

import {
    isMain,
    buildDockerImage,
    buildZig,
    buildCMake,
    buildFrontend,
} from "./_utils.js";

export function buildLinux() {
    buildDockerImage("linux");
    buildZig("linux");
    buildCMake("linux");
    buildFrontend();
}

if (isMain(import.meta.url)) {
    buildLinux();
}
