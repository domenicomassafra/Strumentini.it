/**
 * #348: conservative, read-only inventory of the currently approved network surface.
 * This is a feasibility gate; it never calls providers or enables a server feature.
 * All fingerprints are reviewed source snapshots, not a runtime security boundary.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const FREE_CLOUDFLARE_LIMITS_2026_10_11 = Object.freeze({
  requestsPerDay: 100_000,
  cpuMsPerRequest: 10,
  // Conservative MiB cap below Cloudflare's published 128 MB/isolate.
  memoryMiB: 120,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
  // Cloudflare publishes 5 GB, not 5 GiB. Use decimal bytes to avoid oversubscription.
  d1StorageBytes: 5_000_000_000,
  sourceVerifiedOn: "2026-10-11",
  sourceUrls: [
    "https://developers.cloudflare.com/workers/platform/limits/",
    "https://developers.cloudflare.com/d1/platform/pricing/",
    "https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/",
  ],
});

// An intentionally strict inventory of the Worker implementation, migrations,
// and all first-party browser files that currently expose a transport primitive.
// Source changes require new review and re-baselining instead of silent adoption.
const WORKER_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
  "worker/auth.ts": "664b94e8fa8a4e616fff3a8b9a616093398add78adf401a4a00e94eb8caab772",
  "worker/bindings.d.ts": "7ffff0bb60450e06b6acaec8b3d43e747e44ef711b1abf48a274bd812e18355e",
  "worker/db.ts": "6ee1f3935d551fd557a71c6fb776fbaff17517d6d4f270beb3823c2d42d88abd",
  "worker/google.ts": "09ee69a8ab31e4eabac118bb2b3d4cdd579d655c260aa452fb8e359f32cba2db",
  "worker/index.ts": "cd1694a762c9bc28534ca21d747b51b6bc2af0914a2bea108eeb5b3da10387e7",
  "worker/migrations/0001_init.sql": "5402f41511baf4b74f4bf6b8bb46621d663a00d8352746c6acd1089c4c3f7417",
  "worker/migrations/0002_google_auth.sql": "80f0a007030410b018863ec36ca31fc6dff99ce52762979a071bc4c9af1fa6b9",
  "worker/migrations/0003_favorite_sync.sql": "b9e02301f5b76766039487dab65c57bf06b3c982c23cac3bcfc48dfa1747b6ea",
  "worker/turnstile.ts": "bd7434f8233b9fe0e99fc42bdc5a4b11f919649364b58258b6ae77f0fcf32124",
  "worker/validation.ts": "1b82c7b041b17959ed31f6e6d61e34ab1fd7cbc91f1519eea3a91d889a5519f3",
  "worker/vies.ts": "344c9deae1b7dde4eaa374e713252fb7b9d4987e40e8bf717f9e31b761eb2d04",
});

const BROWSER_TRANSPORT_SHA256: Readonly<Record<string, string>> = Object.freeze({
  // 2026-10-12 #328 reviewed: same GET /api/auth/session and same POST
  // /api/auth/logout, now only a confirmed 204 redirects after logout.
  // Keep full-byte binding so any future unreviewed transport still fails.
  // 2026-10-14 #350: mobile-only aria-label, identical session GET and logout
  // POST/204 semantics; browser Axe detects the icon-only accessible name.
  "src/components/account/AccountChip.astro": "93d41212427af8611bd3ece42d9d3993725a17139c7da2f256418299472e9a34",
  "src/components/account/MembershipBootstrap.astro": "ada60c9c8bea11b5d937c386f265e396f1cf354dc8cda6664f0fec040d240cca",
  "src/components/account/auth-client.ts": "326bcbe8d7a08aa37c7030b766e128974ebcd68e8cc56c5809a0dd44e6bcc8a0",
  // 2026-10-12 #330 reviewed: external GET remains explicit opt-in, no credentials/referrer, no new endpoint, abort/stale guard.
  "src/components/tools/ConnectionDeviceInfoTool.tsx": "fe92363d300ef4ac5e1e73d55f28ddb06eade2d46b218be6e73d3670b92acc84",
  "src/components/tools/research-knowledge/ViesVerificationPanel.tsx": "8e5032a786b97b117b7c079ffd7077ba2f70118fecf0c735b17bd5a05425e147",
  "src/engines/pdf/pdf-to-pptx-255.ts": "d810c0cbb05f8d59810bcbf04dc070a953e800e12fdba5b94d073493416b2a6c",
  "src/engines/url-marketing/index.ts": "b21ca7a9fe2002ba75e4a40e83a824e40bf06a57833f5eec58a59f09dbfae521",
  // 2026-10-11 reviewed #340 UI-only island/CSS change: the existing single
  // GET /api/auth/session is unchanged; no new transport API or endpoint.
  // 2026-10-14 #350: selected nav text now uses existing AA --brand-active
  // token; the only session GET, credentials and endpoints remain unchanged.
  "src/pages/preferiti.astro": "d2294aed56d99fd30480b3b34da7bcb07402950fb70850b335ee9111258ce8f7",
  "src/telemetry/adapter.ts": "cc00368b762ea6d80d00b5a854764765a84e127b25c15049cf1b30e27cbbf50e",
  "src/telemetry/browser.ts": "2f2ecebad8da951a2329bd8364c727ec5f43f97fdc525ecc6c6077587f40ac1a",
  "src/workbench/membership.ts": "b82d1137427e58fffc0414ff0fc04af2dbc4d883a585982405b2837451833b2a",
});

const ALLOWED_ROUTES: ReadonlySet<string> = new Set([
  "POST /api/auth/register", "POST /api/auth/login", "GET /api/auth/google/config",
  "POST /api/auth/google", "POST /api/auth/google/link", "POST /api/auth/logout",
  "GET /api/auth/session", "PATCH /api/auth/profile", "POST /api/auth/password",
  "GET /api/auth/sessions", "DELETE /api/auth/sessions/:id", "DELETE /api/auth/account",
  "GET /api/favorites", "DELETE /api/favorites", "GET /api/favorites/sync",
  "POST /api/favorites/sync", "PUT /api/favorites/:toolId", "DELETE /api/favorites/:toolId",
  "POST /api/vies/check",
]);

const TRANSPORT_PATTERN = /\b(?:fetch|fetchImpl|fetcher|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(|\.fetch\s*\(|\bnew\s+(?:XMLHttpRequest|WebSocket|EventSource)\b|\[\s*["'](?:fetch|sendBeacon)["']\s*\]\s*\(|<form\b[^>]*\baction\s*=/u;
const SOURCE_PATTERN = /\.(?:astro|tsx?|jsx?|mjs|cjs)$/u;

type ReadSource = (path: string) => string;

function repoSources(root: string): string[] {
  const paths: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link in audited tree: ${path}`);
      if (entry.isDirectory()) {
        if (path.startsWith("src/") && path.split("/").includes("vendor")) continue;
        visit(path);
      } else if (entry.isFile() && (directory.startsWith("worker") || SOURCE_PATTERN.test(entry.name))) {
        if (path.startsWith("worker/") && !/\.(?:ts|sql)$/u.test(path)) {
          paths.push(path); // unknown executable/config surface: fail closed
        } else if (path.startsWith("worker/") || SOURCE_PATTERN.test(path)) paths.push(path);
      }
    }
  };
  visit("worker");
  visit("src");
  return paths.sort();
}

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export function transportFingerprintFailure(path: string, source: string): string | null {
  const expected = BROWSER_TRANSPORT_SHA256[path];
  if (TRANSPORT_PATTERN.test(source)) {
    if (expected === undefined) return `UNREVIEWED_BROWSER_TRANSPORT:${path}`;
    if (sha256(source) !== expected) return `CHANGED_BROWSER_TRANSPORT:${path}`;
  } else if (expected !== undefined) return `MISSING_TRANSPORT_FINGERPRINT:${path}`;
  return null;
}

export function routesFromWorker(source: string): string[] | null {
  // Parse the real route table via TypeScript AST. Unknown/dynamic route entries
  // are rejected; a regex over matching strings would miss computed dispatches.
  const file = ts.createSourceFile("worker/index.ts", source, ts.ScriptTarget.Latest, true);
  if ((file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) return null;
  let routes: string[] | null = null;
  const walk = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "ROUTES") {
      if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer) || routes !== null) return;
      const parsed: string[] = [];
      for (const entry of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(entry)) return;
        const props = new Map<string, ts.Expression>();
        for (const property of entry.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) return;
          props.set(property.name.text, property.initializer);
        }
        const pattern = props.get("pattern");
        const method = props.get("method");
        if (!pattern || !method || !ts.isStringLiteral(pattern) || !ts.isStringLiteral(method) || props.size !== 3 || !props.has("handle")) return;
        parsed.push(`${method.text} ${pattern.text}`);
      }
      routes = parsed;
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  return routes;
}

export interface StaticSurfaceResult {
  readonly baselineSafe: boolean;
  readonly serverMode: "NO_GO";
  readonly inspectedFiles: number;
  readonly routes: readonly string[];
  readonly violations: readonly string[];
}

/** readSource injection exists solely to test hostile snapshots without mutating the repository. */
export function auditStaticSurface(root: string, readSource?: ReadSource): StaticSurfaceResult {
  const violations: string[] = [];
  const read = readSource ?? ((path: string) => readFileSync(join(root, path), "utf8"));
  const record = (code: string): void => { violations.push(code); };
  let paths: string[] = [];
  try { paths = repoSources(root); } catch { record("SOURCE_TREE_UNREADABLE"); }
  const actual = new Set(paths);
  for (const path of Object.keys(WORKER_SOURCE_SHA256)) if (!actual.has(path)) record(`MISSING_WORKER_SOURCE:${path}`);
  for (const path of Object.keys(BROWSER_TRANSPORT_SHA256)) if (!actual.has(path)) record(`MISSING_BROWSER_TRANSPORT:${path}`);
  for (const path of paths) {
    try {
      const source = read(path);
      if (path.startsWith("worker/")) {
        const expected = WORKER_SOURCE_SHA256[path];
        if (expected === undefined) record(`UNREVIEWED_WORKER_SOURCE:${path}`);
        else if (sha256(source) !== expected) record(`CHANGED_WORKER_SOURCE:${path}`);
      } else {
        const failure = transportFingerprintFailure(path, source);
        if (failure !== null) record(failure);
      }
    } catch { record(`SOURCE_UNREADABLE:${path}`); }
  }
  let routes: string[] = [];
  try {
    const parsed = routesFromWorker(read("worker/index.ts"));
    if (parsed === null) record("ROUTES_UNPARSEABLE");
    else {
      routes = parsed;
      if (routes.length !== ALLOWED_ROUTES.size || new Set(routes).size !== routes.length || routes.some((route) => !ALLOWED_ROUTES.has(route))) record("SERVER_ROUTE_DRIFT");
    }
  } catch { record("ROUTES_UNREADABLE"); }
  try {
    const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", read("wrangler.jsonc"));
    const config = parsed.config as Record<string, unknown> | undefined;
    if (parsed.error || !config || typeof config !== "object") throw new Error("invalid JSONC");
    const assets = config.assets as Record<string, unknown> | undefined;
    const databases = config.d1_databases;
    const routesConfig = config.routes;
    const configKeys = Object.keys(config).filter((k) => k !== "$schema").sort().join(",");
    if (configKeys !== "assets,compatibility_date,d1_databases,main,name,routes" ||
      config.name !== "strumentini" || config.main !== "worker/index.ts" ||
      config.compatibility_date !== "2026-09-24" ||
      !assets || Object.keys(assets).sort().join(",") !== "binding,directory,html_handling,not_found_handling" ||
      assets.directory !== "./dist" || assets.binding !== "ASSETS" || assets.not_found_handling !== "404-page" ||
      assets.html_handling !== "auto-trailing-slash" ||
      !Array.isArray(routesConfig) || routesConfig.length !== 1 ||
      routesConfig[0]?.pattern !== "strumentini.it" || routesConfig[0]?.custom_domain !== true ||
      Object.keys(routesConfig[0]).sort().join(",") !== "custom_domain,pattern" ||
      !Array.isArray(databases) || databases.length !== 1 ||
      databases[0]?.binding !== "AUTH_DB" || databases[0]?.database_name !== "strumentini-auth" ||
      databases[0]?.migrations_dir !== "worker/migrations" ||
      databases[0]?.database_id !== "3351c8bf-31fc-4716-9d92-2b07c4d8fd2a" ||
      Object.keys(databases[0]).sort().join(",") !== "binding,database_id,database_name,migrations_dir") record("WRANGLER_CONFIG_DRIFT");
  } catch { record("WRANGLER_CONFIG_UNREADABLE"); }
  return { baselineSafe: violations.length === 0, serverMode: "NO_GO", inspectedFiles: paths.length, routes, violations };
}

export interface CandidateBudget {
  readonly informedConsent: boolean;
  readonly explicitAction: boolean;
  readonly perJobDisclosure: boolean;
  readonly expectedBytes: number;
  readonly maxInputBytes: number;
  readonly cpuMs: number;
  readonly maxCpuMs: number;
  readonly timeoutMs: number;
  readonly maxTimeoutMs: number;
  readonly memoryMiB: number;
  readonly maxMemoryMiB: number;
  readonly dailyRequests: number;
  readonly dailyRowsRead: number;
  readonly dailyRowsWritten: number;
  readonly extraStorageBytes: number;
  /** Exact account-wide usage including existing auth, sync and other Workers. */
  readonly usedDailyRequests: number | null;
  readonly usedDailyRowsRead: number | null;
  readonly usedDailyRowsWritten: number | null;
  readonly usedStorageBytes: number | null;
  readonly providerLimitsVerified: boolean;
  readonly fallbackLocalAvailable: boolean;
}

export interface BudgetDecision {
  readonly outcome: "BUDGET_ONLY" | "NO_GO";
  readonly fallback: "local" | "unavailable";
  readonly reasons: readonly string[];
}

/** Pure design estimate. BUDGET_ONLY never authorizes a network call or deployment. */
export function evaluateCandidateBudget(budget: CandidateBudget): BudgetDecision {
  const reasons: string[] = [];
  if (!budget.informedConsent || !budget.explicitAction || !budget.perJobDisclosure) reasons.push("CONSENT_NOT_ESTABLISHED");
  if (!budget.providerLimitsVerified) reasons.push("PROVIDER_LIMITS_UNVERIFIED");
  const values = [budget.expectedBytes, budget.maxInputBytes, budget.cpuMs, budget.maxCpuMs,
    budget.timeoutMs, budget.maxTimeoutMs, budget.memoryMiB, budget.maxMemoryMiB,
    budget.dailyRequests, budget.dailyRowsRead, budget.dailyRowsWritten, budget.extraStorageBytes,
    budget.usedDailyRequests, budget.usedDailyRowsRead, budget.usedDailyRowsWritten, budget.usedStorageBytes];
  if (values.some((value) => value === null || !Number.isSafeInteger(value) || value < 0)) reasons.push("BUDGET_OR_ACCOUNT_USAGE_UNKNOWN");
  if (budget.expectedBytes <= 0 || budget.maxInputBytes <= 0 || budget.expectedBytes > budget.maxInputBytes ||
    budget.cpuMs > budget.maxCpuMs || budget.maxCpuMs > FREE_CLOUDFLARE_LIMITS_2026_10_11.cpuMsPerRequest ||
    budget.timeoutMs <= 0 || budget.maxTimeoutMs <= 0 || budget.timeoutMs > budget.maxTimeoutMs ||
    budget.memoryMiB > budget.maxMemoryMiB || budget.maxMemoryMiB > FREE_CLOUDFLARE_LIMITS_2026_10_11.memoryMiB ||
    budget.dailyRequests <= 0) reasons.push("JOB_HARD_LIMIT_EXCEEDED");
  for (const [label, used, requested, limit] of [
    ["WORKER", budget.usedDailyRequests, budget.dailyRequests, FREE_CLOUDFLARE_LIMITS_2026_10_11.requestsPerDay],
    ["D1_READ", budget.usedDailyRowsRead, budget.dailyRowsRead, FREE_CLOUDFLARE_LIMITS_2026_10_11.d1RowsReadPerDay],
    ["D1_WRITE", budget.usedDailyRowsWritten, budget.dailyRowsWritten, FREE_CLOUDFLARE_LIMITS_2026_10_11.d1RowsWrittenPerDay],
    ["D1_STORAGE", budget.usedStorageBytes, budget.extraStorageBytes, FREE_CLOUDFLARE_LIMITS_2026_10_11.d1StorageBytes],
  ] as const) {
    if (used !== null && requested !== null && Number.isSafeInteger(used) && Number.isSafeInteger(requested) && used + requested > limit) reasons.push(`${label}_OVER_FREE_QUOTA`);
  }
  return { outcome: reasons.length === 0 ? "BUDGET_ONLY" : "NO_GO", fallback: budget.fallbackLocalAvailable ? "local" : "unavailable", reasons };
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = auditStaticSurface(root);
  console.log(JSON.stringify(result, null, 2));
  if (!result.baselineSafe) process.exitCode = 1;
}
