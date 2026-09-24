import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://example.invalid",
  output: "static",
  trailingSlash: "always",
  integrations: [preact()],
  vite: {
    build: {
      sourcemap: true
    }
  }
});
