import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to a real preview deployment during local dev.
      // Override via VITE_API_BASE env var.
      "/api": {
        target: process.env.VITE_API_BASE || "https://tg-challenge-bot-admin.pages.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
