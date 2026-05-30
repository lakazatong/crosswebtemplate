import { ensureDir } from "./_utils.js";
import { cpSync } from "fs";

ensureDir("dist/windows");

cpSync(".build/frontend", "dist/windows/www", { recursive: true });
cpSync(".build/windows/release/cwt.exe", "dist/windows/cwt.exe");
