import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed dev server port
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch the Rust source from Vite
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor code for better caching
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
