import { resolve } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Entirely local bindings: no production/staging Wrangler config or D1 IDs.
export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    main: "./worker/index.ts",
    miniflare: {
      compatibilityDate: "2026-09-24",
      d1Databases: ["AUTH_DB"],
      durableObjects: { PASSWORD_KDF: { className: "PasswordKdf", useSQLite: true } },
      serviceBindings: {
        ASSETS: () => new Response("local asset fixture", { headers: { "content-type": "text/plain" } }),
      },
      ratelimits: {
        KDF_IP_LIMIT: { namespace_id: "28500001", simple: { limit: 8, period: 60 } },
        KDF_COLO_LIMIT: { namespace_id: "28500002", simple: { limit: 30, period: 60 } },
      },
      bindings: { TEST_MIGRATIONS: await readD1Migrations(resolve("worker/migrations")) },
    },
  }))],
  test: {
    include: ["tests/workerd/**/*.test.ts"],
    setupFiles: ["tests/workerd/setup.ts"],
    maxWorkers: 1,
    testTimeout: 60_000,
  },
});
