#!/usr/bin/env node

import { isMain, buildZig, buildCMake, buildFrontend } from "./_utils.js";

export function buildWindows() {
    buildZig("windows");
    buildCMake("windows");
    buildFrontend();
}

if (isMain(import.meta.url)) {
    buildWindows();
}
