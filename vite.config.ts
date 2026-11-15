import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const runtimeTarget = process.env.ACIDMADE_RUNTIME_URL ?? "http://127.0.0.1:4317";

export default defineConfig({
  // Relative asset paths so the same build works from http:// and from the
  // packaged desktop app, which loads dist/index.html over file://.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: false,
    watch: {
      ignored: ["**/.acidmade/**"],
    },
    proxy: {
      "/api": {
        target: runtimeTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: runtimeTarget,
        changeOrigin: true,
      },
    },
  },
});
