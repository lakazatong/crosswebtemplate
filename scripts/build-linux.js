#!/usr/bin/env node

import {
    isMain,
    buildDockerImage,
    buildZig,
    buildCMake,
    buildFrontend,
} from "./_utils.js";

export function buildLinux() {
    buildDockerImage();
    buildZig();
    buildCMake();
    buildFrontend();
}

if (isMain(import.meta.url)) {
    buildLinux();
}
