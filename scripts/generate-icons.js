#!/usr/bin/env node
// std
import path from "path";
import { mkdirSync } from "fs";
// external
import sharp from "sharp";
// internal
import { isMain, getProjectRoot } from "./_utils.js";

const projectRoot = getProjectRoot();
const src = path.join(projectRoot, "src/assets/icons/favicon.svg");

export async function generateAndroidIcons() {
    const androidSizes = [
        { dir: "mipmap-mdpi", size: 48 },
        { dir: "mipmap-hdpi", size: 72 },
        { dir: "mipmap-xhdpi", size: 96 },
        { dir: "mipmap-xxhdpi", size: 144 },
        { dir: "mipmap-xxxhdpi", size: 192 },
    ];

    const androidResDir = path.join(
        projectRoot,
        "mobile/android/app/src/main/res",
    );

    for (const { dir, size } of androidSizes) {
        const outDir = path.join(androidResDir, dir);
        mkdirSync(outDir, { recursive: true });

        // normal
        await sharp(src)
            .resize(size, size)
            .webp()
            .toFile(path.join(outDir, "ic_launcher.webp"));

        // round — circular crop via SVG mask
        const circle = Buffer.from(
            `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
        );

        await sharp(src)
            .resize(size, size)
            .composite([{ input: circle, blend: "dest-in" }])
            .webp()
            .toFile(path.join(outDir, "ic_launcher_round.webp"));

        console.log(`Generated ${dir} (${size}x${size})`);
    }
}

if (isMain(import.meta.url)) {
    const target = process.argv[2];
    switch (target) {
        case "android":
            generateAndroidIcons();
            break;
        default:
            console.log(`Unknown target ${target}`);
    }
}
