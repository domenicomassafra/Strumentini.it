import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * #573 Content-Security-Policy for the compiled site.
 *
 * Cloudflare workers static assets serve `_headers` verbatim, so the policy has
 * to be materialised inside `dist/_headers` at build time: the executable inline
 * scripts Astro emits have per-build contents, and a CSP that allows them
 * without `'unsafe-inline'` needs their exact SHA-256 hashes. The static part of
 * the policy stays in `public/_headers`, which the API Worker also imports, so
 * there is still one checked-in source for the plain headers.
 *
 * Everything listed below is inspected in the compiled output, not guessed:
 * `/_astro` chunks and fonts are first-party, images/tool previews use `data:`
 * and `blob:` object URLs, media previews use `blob:`, the PDF/OCR/audio/image
 * tools compile self-hosted WebAssembly modules in page and blob workers,
 * `/accedi/` loads Turnstile from Cloudflare and Google Identity only when the
 * matching build variables are configured, and the optional Cloudflare Web
 * Analytics beacon is the only telemetry script.
 */
export const CSP_REMOTE = Object.freeze({
  script: Object.freeze([
    "https://challenges.cloudflare.com",
    "https://static.cloudflareinsights.com",
    "https://accounts.google.com",
  ]),
  frame: Object.freeze([
    "https://challenges.cloudflare.com",
    "https://accounts.google.com",
  ]),
  connect: Object.freeze([
    "https://cloudflareinsights.com",
    "https://accounts.google.com",
    "https://huggingface.co",
    "https://cdn-lfs.huggingface.co",
    "https://cdn-lfs-us-1.huggingface.co",
  ]),
});

/** Cloudflare Workers static assets reject a `_headers` line above 2000 characters. */
export const HEADER_LINE_LIMIT = 2000;

/** Cloudflare Workers static assets allow at most 100 `_headers` rules. */
export const HEADER_RULE_LIMIT = 100;

const EXECUTABLE_SCRIPT_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
]);

export interface InlineScriptHashes {
  /** `sha256-...` tokens for every executable inline script of the document. */
  readonly scripts: readonly string[];
}

function sha256Token(content: string): string {
  return `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;
}

/**
 * Hashes only inline scripts the browser executes. `<script type="application/json">`
 * and `application/ld+json` data blocks are not covered by `script-src`.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gu)) {
    const attributes = match[1] ?? "";
    if (/\bsrc\s*=/u.test(attributes)) continue;
    const type = /\btype\s*=\s*"([^"]*)"/u.exec(attributes)?.[1]?.trim().toLowerCase() ?? "";
    if (!EXECUTABLE_SCRIPT_TYPES.has(type)) continue;
    hashes.push(sha256Token(match[2] ?? ""));
  }
  return hashes;
}

export interface ContentSecurityPolicyOptions {
  readonly scriptHashes: readonly string[];
}

/** Single directive per line for reviewability; joined with `; ` by the caller. */
export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const hashes = [...new Set(options.scriptHashes)].sort();
  const directives: [string, readonly string[]][] = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    // 'wasm-unsafe-eval' is scoped to WebAssembly.compile/instantiate; it does
    // not enable eval(). Without it every local tool engine is blocked.
    ["script-src", ["'self'", "'wasm-unsafe-eval'", ...CSP_REMOTE.script, ...hashes]],
    // Inline style attributes rendered by tool UIs (thousands of occurrences)
    // cannot be hashed, so styles keep 'unsafe-inline'; scripts never do.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["media-src", ["'self'", "blob:"]],
    ["connect-src", ["'self'", ...CSP_REMOTE.connect]],
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", ["blob:", ...CSP_REMOTE.frame]],
    ["manifest-src", ["'self'"]],
    ["upgrade-insecure-requests", []],
  ];
  return directives.map(([name, sources]) => [name, ...sources].join(" ")).join("; ");
}

/**
 * Inserts (or replaces) the CSP line inside the `/*` rule of a `_headers` file
 * without touching the checked-in security headers.
 */
export function withContentSecurityPolicy(headersFile: string, policy: string): string {
  if (policy.includes("\n")) throw new Error("#573 CSP must be a single header line");
  const line = `  Content-Security-Policy: ${policy}`;
  if (line.length > HEADER_LINE_LIMIT) {
    throw new Error(`#573 CSP is ${line.length} characters; Cloudflare allows ${HEADER_LINE_LIMIT} per _headers line`);
  }
  const lines = headersFile.split("\n");
  const kept = lines.filter((candidate) => !/^\s*content-security-policy\s*:/iu.test(candidate));
  const ruleStart = kept.findIndex((candidate) => candidate.trim() === "/*");
  if (ruleStart === -1) throw new Error("#573 _headers has no `/*` rule");
  let insertion = kept.length;
  for (let index = ruleStart + 1; index < kept.length; index += 1) {
    const candidate = kept[index] ?? "";
    if (candidate.trim() !== "" && !/^\s/u.test(candidate)) { insertion = index; break; }
  }
  while (insertion > ruleStart + 1 && (kept[insertion - 1] ?? "").trim() === "") insertion -= 1;
  kept.splice(insertion, 0, line);
  const rules = kept.filter((candidate) => candidate.trim() !== "" && !/^\s/u.test(candidate) && !candidate.startsWith("#")).length;
  if (rules > HEADER_RULE_LIMIT) {
    throw new Error(`#573 _headers has ${rules} rules; Cloudflare allows ${HEADER_RULE_LIMIT}`);
  }
  return `${kept.join("\n")}${kept.at(-1) === "" ? "" : "\n"}`;
}

async function collectHtml(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(path));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

export interface AppliedContentSecurityPolicy {
  readonly policy: string;
  readonly scriptHashCount: number;
  readonly pages: number;
}

/**
 * Rewrites `dist/_headers` with a CSP covering every inline script actually
 * emitted in `dist/**\/*.html`. Deterministic, so a rebuild yields the same bytes.
 */
export async function applyContentSecurityPolicy(dist: string): Promise<AppliedContentSecurityPolicy> {
  const pages = await collectHtml(dist);
  if (pages.length === 0) throw new Error(`#573 no built HTML under ${dist}`);
  const hashes: string[] = [];
  for (const page of pages) hashes.push(...inlineScriptHashes(await readFile(page, "utf8")));
  const policy = contentSecurityPolicy({ scriptHashes: hashes });
  const headersPath = join(dist, "_headers");
  const headers = await readFile(headersPath, "utf8");
  await writeFile(headersPath, withContentSecurityPolicy(headers, policy), "utf8");
  return { policy, scriptHashCount: new Set(hashes).size, pages: pages.length };
}

/**
 * Build gate: the shipped `dist/_headers` must carry exactly one CSP that
 * covers every executable inline script of the compiled pages, without
 * `'unsafe-inline'` or `'unsafe-eval'` on scripts.
 */
export async function verifyBuiltContentSecurityPolicy(dist: string): Promise<AppliedContentSecurityPolicy> {
  const headers = await readFile(join(dist, "_headers"), "utf8");
  const declared = headers.split("\n").filter((line) => /^\s*content-security-policy\s*:/iu.test(line));
  if (declared.length !== 1) throw new Error(`#573 expected one CSP in dist/_headers, found ${declared.length}`);
  const policy = declared[0]!.replace(/^\s*content-security-policy\s*:\s*/iu, "");
  const scriptSrc = /(?:^|;\s*)script-src([^;]*)/u.exec(policy)?.[1] ?? "";
  if (scriptSrc === "") throw new Error("#573 CSP has no script-src");
  for (const banned of ["'unsafe-inline'", "'unsafe-eval'"]) {
    if (scriptSrc.includes(banned)) throw new Error(`#573 script-src must not allow ${banned}`);
  }
  if (!scriptSrc.includes("'wasm-unsafe-eval'")) throw new Error("#573 script-src must allow 'wasm-unsafe-eval'");
  const pages = await collectHtml(dist);
  const missing: string[] = [];
  let expected = 0;
  for (const page of pages) {
    for (const hash of inlineScriptHashes(await readFile(page, "utf8"))) {
      expected += 1;
      if (!policy.includes(hash)) missing.push(`${hash} in ${page}`);
    }
  }
  if (missing.length > 0) throw new Error(`#573 CSP misses inline scripts: ${missing.slice(0, 3).join("; ")}`);
  return { policy, scriptHashCount: new Set(policy.match(/'sha256-[^']+'/gu) ?? []).size, pages: pages.length };
}
