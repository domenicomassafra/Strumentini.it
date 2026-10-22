import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import { copyFile } from "node:fs/promises";
import { loadEnv } from "vite";
import { isPublicSitemapUrl } from "./src/seo/sitemap-routes.ts";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const site = env.SITE_URL ?? env.PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "https://strumentini.it";
if (site !== undefined) {
  const parsed = new URL(site);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("SITE_URL must use http or https");
}

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  // The old Library is now the catalogue directory; the redirect keeps every
  // inbound link and bookmark working.
  redirects: {
    "/library": "/strumenti",
  },
  integrations: [
    preact(),
    sitemap({ filter: (url) => isPublicSitemapUrl(url, site) }),
    {
      name: "sitemap-283-legacy-url",
      hooks: {
        // The official integration writes sitemap-0.xml. Existing robots,
        // metadata links and release gates require this single URL set at
        // /sitemap.xml too. Run after the sitemap integration's build hook.
        "astro:build:done": async ({ dir }) => {
          await copyFile(new URL("sitemap-0.xml", dir), new URL("sitemap.xml", dir));
        },
      },
    },
  ],
  vite: {
    // iconv-lite (MSG donor) relies on Node buffer; map it to a browser-safe polyfill.
    resolve: { alias: { buffer: "buffer/" } },
    plugins: [{
      name: "whisper-298-prune-optional-onnx-asyncify",
      apply: "build",
      generateBundle(_options, bundle) {
        // Transformers.js 4.3.1 configures ONNX WASM paths to versioned jsDelivr;
        // its bundled fallback .asyncify binary is never used by our worker.
        // The fallback alone exceeds Cloudflare's 25 MiB asset ceiling.
        for (const path of Object.keys(bundle)) {
          if (/(?:^|\/)ort-wasm-simd-threaded\.asyncify-[\w-]+\.wasm$/u.test(path)) delete bundle[path];
        }
      },
    }, {
      name: "portrait-modnet-274-self-host-onnx-wasm",
      apply: "build",
      generateBundle() {
        // Reuse exact installed MIT onnxruntime-web 1.31 dev release from the lockfile.
        // No runtime request goes to external model or WASM CDNs.
        const dist = dirname(require.resolve("onnxruntime-web"));
        for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
          this.emitFile({ type: "asset", fileName: `vendor/portrait-modnet/${file}`, source: readFileSync(join(dist, file)) });
        }
      },
    }],
    ...(process.env.STRUMENTINI_DEV_LINKED_DEPS ? { server: { fs: { allow: [process.cwd(), process.env.STRUMENTINI_DEV_LINKED_DEPS] } } } : {}),
    build: {
      sourcemap: true
    }
  }
});
