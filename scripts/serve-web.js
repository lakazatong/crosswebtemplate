import os from "os";
import path from "path";
import { createReadStream, existsSync } from "fs";

import express from "express";
import chalk from "chalk";
import clipboardy from "clipboardy";
import stripAnsi from "strip-ansi";

import { getMode, getProjectRoot } from "./_utils.js";

const port = 5173;
const mode = getMode();
const buildRoot = path.join(getProjectRoot(), ".build");
const app = express();

app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const ms = Date.now() - start;
        const status = res.statusCode;
        const statusText =
            status < 400
                ? chalk.green(`Returned ${status}`)
                : chalk.red(`Returned ${status}`);
        const date = chalk.gray(
            (() => {
                const d = new Date();
                return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
            })(),
        );
        const ip = chalk.yellow(req.ip);
        const method = chalk.blue(req.method);
        console.log(
            ` ${chalk.bgBlue(" HTTP ")} ${date} ${ip} ${method} ${req.url}`,
        );
        console.log(
            ` ${chalk.bgBlue(" HTTP ")} ${date} ${ip} ${statusText} in ${ms} ms`,
        );
    });
    next();
});

if (mode === "release") {
    app.use(express.static(path.join(getProjectRoot(), "dist", "web")));
} else {
    app.get("/core.wasm", (req, res) => {
        const wasmPath = path.join(
            buildRoot,
            "zig",
            "web",
            "debug",
            "core.wasm",
        );
        res.setHeader("Content-Type", "application/wasm");
        createReadStream(wasmPath).pipe(res);
    });
    app.use(express.static(path.join(buildRoot, "frontend")));
}

const localUrl = `http://localhost:${port}`;
const networkIp = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i.family === "IPv4" && !i.internal)?.address;
const networkUrl = networkIp ? `http://${networkIp}:${port}` : "unavailable";

const pad = (url) => url.padEnd(22);

const server = app.listen(port, () => {
    const padLine = (content) =>
        `   │   ${content}${" ".repeat(40 - stripAnsi(content).length)}│`;

    clipboardy.writeSync(localUrl);
    const lines = [
        "",
        chalk.green("   ┌───────────────────────────────────────────┐"),
        chalk.green("   │                                           │"),
        chalk.green(padLine("Serving!")),
        chalk.green("   │                                           │"),
        chalk.green(padLine(chalk.white(`- Local:    ${localUrl}`))),
        chalk.green(padLine(chalk.white(`- Network:  ${networkUrl}`))),
        chalk.green("   │                                           │"),
        chalk.green(padLine(chalk.gray("Copied local address to clipboard!"))),
        chalk.green("   │                                           │"),
        chalk.green("   └───────────────────────────────────────────┘"),
        "",
    ];

    console.log(lines.join("\n"));
});

function onSIGINT() {
    process.off("SIGINT", onSIGINT);

    console.log(
        `\n ${chalk.bgMagenta(" INFO ")} Gracefully shutting down. Please wait...`,
    );

    server.close(() => {
        process.exit(0);
    });
}

process.on("SIGINT", onSIGINT);
