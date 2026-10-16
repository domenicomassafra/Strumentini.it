import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import { loadEnv } from "vite";

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
  integrations: [preact()],
  vite: {
    ...(process.env.STRUMENTINI_DEV_LINKED_DEPS ? { server: { fs: { allow: [process.cwd(), process.env.STRUMENTINI_DEV_LINKED_DEPS] } } } : {}),
    build: {
      sourcemap: true
    }
  }
});
