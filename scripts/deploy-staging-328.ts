/**
 * #328: source-bound, fail-closed staging publisher. This is intentionally
 * separate from production deploy and does not use production credentials.
 *
 * npm run staging:build:328  - verify boundary and build, never publish
 * npm run staging:deploy:328 - verify, rebuild with staging key, then publish
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STAGING_WORKER = "strumentini-328-staging-20261015";
export const STAGING_ORIGIN = "https://strumentini-328-staging-20261015.massafradomenico4.workers.dev";
export const STAGING_PUBLIC_TURNSTILE_KEY = "0x4AAAAAAFXpnIPuzw5crK4C";
const STAGING_D1_ID = "807467ce-5366-4104-9509-8c012f836e2a";
const PRODUCTION_D1_ID = "3351c8bf-31fc-4716-9d92-2b07c4d8fd2a";
const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const STAGING_CONFIG = "worker/wrangler.staging.jsonc";

export function assertStagingConfig(source: string): void {
  const config = JSON.parse(source.replace(/^\s*\/\/[^\n]*(?:\n|$)/gmu, "")) as Record<string, any>;
  const reviewedKeys = ["$schema", "assets", "compatibility_date", "d1_databases", "main", "name", "routes", "workers_dev"];
  if (Object.keys(config).sort().join("|") !== reviewedKeys.join("|")) {
    throw new Error("#328 refusal: unreviewed staging deployment configuration fields");
  }
  if (config.name !== STAGING_WORKER || config.workers_dev !== true ||
      config.compatibility_date !== "2026-09-24" ||
      !Array.isArray(config.routes) || config.routes.length !== 0 ||
      config.main !== "index.ts" ||
      config.assets?.directory !== "../dist" ||
      config.assets?.binding !== "ASSETS" ||
      !Array.isArray(config.d1_databases) || config.d1_databases.length !== 1 ||
      config.d1_databases[0]?.binding !== "AUTH_DB" ||
      config.d1_databases[0]?.database_id !== STAGING_D1_ID ||
      config.d1_databases[0]?.database_id === PRODUCTION_D1_ID ||
      config.d1_databases[0]?.database_name !== STAGING_WORKER ||
      config.d1_databases[0]?.migrations_dir !== "migrations") {
    throw new Error("#328 refusal: staging is not isolated from production");
  }
}

export function assertStagingHtml(source: string): void {
  const keys = [...source.matchAll(/data-turnstile-site-key="([^"]+)"/gu)].map((x) => x[1]);
  if (keys.length === 0 || keys.some((key) => key !== STAGING_PUBLIC_TURNSTILE_KEY)) {
    throw new Error("#328 refusal: compiled auth page has missing or wrong staging Turnstile key");
  }
  if (!source.includes(STAGING_ORIGIN)) {
    throw new Error("#328 refusal: compiled auth page does not identify the staging origin");
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`#328 staging command failed: ${command} (exit ${result.status})`);
}

export function buildAndMaybeDeploy(mode: "--build-only" | "--deploy"): void {
  assertStagingConfig(readFileSync(resolve(ROOT, STAGING_CONFIG), "utf8"));
  const env = {
    ...process.env,
    PUBLIC_SITE_URL: STAGING_ORIGIN,
    PUBLIC_TURNSTILE_SITE_KEY: STAGING_PUBLIC_TURNSTILE_KEY,
  };
  run("npm", ["run", "build"], env);
  assertStagingHtml(readFileSync(resolve(ROOT, "dist/accedi/index.html"), "utf8"));
  if (mode === "--deploy") {
    run(resolve(ROOT, "node_modules/.bin/wrangler"), ["deploy", "--config", STAGING_CONFIG], env);
  }
  process.stdout.write(`#328 staging ${mode === "--deploy" ? "deploy" : "build"} validated: isolated Worker, D1, site key and origin\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== "--build-only" && mode !== "--deploy" || process.argv.length !== 3) {
    throw new Error("Use --build-only or --deploy; no implicit production operation");
  }
  buildAndMaybeDeploy(mode);
}
