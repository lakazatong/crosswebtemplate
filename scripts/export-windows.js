import { ensureDir, run } from "./_utils.js";
import { cpSync } from "fs";

ensureDir("dist/windows");

cpSync(".build/frontend", "dist/windows/www", { recursive: true });
cpSync(".build/windows/Release/cwt.exe", "dist/windows/cwt.exe");
