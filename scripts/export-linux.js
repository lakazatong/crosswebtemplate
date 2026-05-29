import { ensureDir } from "./_utils.js";
import { cpSync } from "fs";

ensureDir("dist/linux");

cpSync(".build/frontend", "dist/linux/www", { recursive: true });
cpSync(".build/linux/Release/cwt", "dist/linux/cwt");
