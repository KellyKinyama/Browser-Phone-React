import { defineConfig } from "vite";

// Phase 1 ("dynamic") config: bundle src/phone.ts, serve static assets from public/.
// Vendor libraries (jQuery, SIP.js, Moment, Fabric, Croppie, Chart, Strophe) are still
// loaded as global <script> includes in index.html and referenced ambiently (see global.d.ts).
export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: "dist",
    target: "es2019",
    sourcemap: true
  }
});
