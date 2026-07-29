import { createReadStream } from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using vite's "mode" as a way to get the platform from the build system
export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        ...(mode === "development"
            ? [
                  {
                      name: "serve-wasm",
                      configureServer(server) {
                          server.middlewares.use(
                              "/middle-end.wasm",
                              (req, res) => {
                                  const wasmPath = path.join(
                                      process.cwd(),
                                      ".build",
                                      "zig",
                                      "web",
                                      "debug",
                                      "middle-end.wasm",
                                  );

                                  res.setHeader(
                                      "Content-Type",
                                      "application/wasm",
                                  );
                                  createReadStream(wasmPath).pipe(res);
                              },
                          );
                      },
                  },
              ]
            : []),
    ],
    base: "./",
    define: {
        __PLATFORM__: JSON.stringify(mode),
    },
    server: {
        host: "127.0.0.1",
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
}));
