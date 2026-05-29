#!/usr/bin/env node

import { isMain, buildZig, buildFrontend } from "./_utils.js";

export function buildWeb() {
    buildZig("web");
    buildFrontend();
}

if (isMain(import.meta.url)) {
    buildWeb();
}
