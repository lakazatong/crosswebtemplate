#!/usr/bin/env node
// std
import path from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";
// external
import sharp from "sharp";
// internal
import { isMain, getProjectRoot } from "./_utils.js";

const projectRoot = getProjectRoot();
const src = path.join(projectRoot, "src/assets/icons/favicon.svg");

export async function generateAndroidIcons() {
    const androidResDir = path.join(
        projectRoot,
        "mobile/android/app/src/main/res",
    );

    // Remove and recreate anydpi-v26 folder
    const anydpiDir = path.join(androidResDir, "mipmap-anydpi-v26");
    rmSync(anydpiDir, { recursive: true, force: true });
    mkdirSync(anydpiDir, { recursive: true });

    // Generate adaptive icon XMLs
    const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

    writeFileSync(path.join(anydpiDir, "ic_launcher.xml"), adaptiveIconXml);
    writeFileSync(
        path.join(anydpiDir, "ic_launcher_round.xml"),
        adaptiveIconXml,
    );

    // Generate background color in values
    const valuesDir = path.join(androidResDir, "values");
    mkdirSync(valuesDir, { recursive: true });
    writeFileSync(
        path.join(valuesDir, "ic_launcher_background.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>`,
    );

    // Generate foreground layers at each density
    // Adaptive icon canvas is 108dp, safe zone is 72dp centered (16.66dp inset each side)
    // Foreground should be ~66% of canvas size
    const foregroundSizes = [
        { dir: "mipmap-mdpi", canvas: 108, icon: 72 },
        { dir: "mipmap-hdpi", canvas: 162, icon: 108 },
        { dir: "mipmap-xhdpi", canvas: 216, icon: 144 },
        { dir: "mipmap-xxhdpi", canvas: 324, icon: 216 },
        { dir: "mipmap-xxxhdpi", canvas: 432, icon: 288 },
    ];

    const regularSizes = [
        { dir: "mipmap-mdpi", size: 48 },
        { dir: "mipmap-hdpi", size: 72 },
        { dir: "mipmap-xhdpi", size: 96 },
        { dir: "mipmap-xxhdpi", size: 144 },
        { dir: "mipmap-xxxhdpi", size: 192 },
    ];

    for (const { dir, canvas, icon } of foregroundSizes) {
        const outDir = path.join(androidResDir, dir);
        mkdirSync(outDir, { recursive: true });

        const pad = (canvas - icon) / 2;

        // Foreground: icon centered on transparent canvas
        const iconBuffer = await sharp(src).resize(icon, icon).toBuffer();
        await sharp({
            create: {
                width: canvas,
                height: canvas,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([{ input: iconBuffer, left: pad, top: pad }])
            .webp()
            .toFile(path.join(outDir, "ic_launcher_foreground.webp"));

        console.log(`Generated ${dir} foreground (${canvas}x${canvas})`);
    }

    for (const { dir, size } of regularSizes) {
        const outDir = path.join(androidResDir, dir);
        mkdirSync(outDir, { recursive: true });

        // Regular icon: white background + icon
        await sharp(src)
            .resize(size, size)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .webp()
            .toFile(path.join(outDir, "ic_launcher.webp"));

        // Round icon: circular crop
        const circle = Buffer.from(
            `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
        );
        await sharp(src)
            .resize(size, size)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
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
