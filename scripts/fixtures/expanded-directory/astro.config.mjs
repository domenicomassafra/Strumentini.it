import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import { resolve } from "node:path";

const outDir = process.env.EXPANDED_DIRECTORY_OUT_DIR;
if (!outDir) throw new Error("EXPANDED_DIRECTORY_OUT_DIR is required for the expanded-directory fixture build");

const repoRoot = resolve(import.meta.dirname, "../../..");

export default defineConfig({
  root: repoRoot,
  srcDir: resolve(import.meta.dirname, "src"),
  publicDir: resolve(repoRoot, "public"),
  outDir: resolve(outDir),
  site: "https://expanded-directory.invalid",
  output: "static",
  trailingSlash: "always",
  integrations: [preact()],
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
