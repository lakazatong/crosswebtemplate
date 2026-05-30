import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Using vite's "mode" as a way to get the platform from the build system
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    base: "/",
    define: {
        __PLATFORM__: JSON.stringify(mode),
    },
}));
