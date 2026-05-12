import { rmSync, existsSync } from "fs";

const dirs = [".build", "dist"];

for (const dir of dirs) {
    if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        console.log(`deleted: ${dir}`);
    }
}
