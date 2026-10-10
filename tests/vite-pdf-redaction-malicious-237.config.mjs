import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const dependencies = resolve(root, "node_modules");
const rawWorker = resolve(dependencies, "pdfjs-dist/build/pdf.worker.mjs");
export default defineConfig({ root, cacheDir: resolve(root, "node_modules/.vite-redaction-237"),
  // The full monorepo contains a heavy-browser spike with an older nested
  // pdfjs-dist. Pin this harness to the root installation so its API and its
  // worker share the same version; a mismatch silently hangs PDF.js startup.
  resolve: { alias: [{ find: /^pdfjs-dist(?=\/|$)/u, replacement: resolve(dependencies, "pdfjs-dist") }] },
  optimizeDeps: { force: true, entries: ["tests/fixtures/pdf-redaction-malicious-237.html"] },
  server: { host: "127.0.0.1", strictPort: true,
  port: 18479, fs: { allow: [root, dependencies] } }, plugins: [{
    name: "237-raw-pdfjs-worker",
    // Vite injects its HMR runtime into otherwise static PDF.js workers in dev.
    // Test the actual standalone worker bytes that production builds ship.
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/node_modules/pdfjs-dist/build/pdf.worker.mjs"
          || request.url?.includes("?url")) return next();
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(readFileSync(rawWorker));
      });
    },
  }] });
