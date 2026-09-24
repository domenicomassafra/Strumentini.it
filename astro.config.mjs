import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const site = env.SITE_URL ?? env.PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL;
if (site !== undefined) {
  const parsed = new URL(site);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("SITE_URL must use http or https");
}

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  integrations: [preact()],
  vite: {
    build: {
      sourcemap: true
    }
  }
});
