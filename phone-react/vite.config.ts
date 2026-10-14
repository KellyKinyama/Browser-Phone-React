import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@styles": fileURLToPath(new URL("./src/styles", import.meta.url))
    }
  },
  server: {
    port: 5174,
    open: false
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler"
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
