import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyContentSecurityPolicy,
  contentSecurityPolicy,
  HEADER_LINE_LIMIT,
  inlineScriptHashes,
  verifyBuiltContentSecurityPolicy,
  withContentSecurityPolicy,
} from "../scripts/lib/content-security-policy-573.ts";

const checkedInHeaders = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
const temporaryDirectories: string[] = [];

async function fixtureDist(pages: Record<string, string>): Promise<string> {
  const dist = await mkdtemp(join(tmpdir(), "csp-573-"));
  temporaryDirectories.push(dist);
  await writeFile(join(dist, "_headers"), checkedInHeaders, "utf8");
  for (const [route, html] of Object.entries(pages)) {
    const path = join(dist, route, "index.html");
    await mkdir(join(dist, route), { recursive: true });
    await writeFile(path, html, "utf8");
  }
  return dist;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("#573 CSP covers exactly the inline scripts the build emits", () => {
  it("hashes executable inline scripts and ignores data blocks and external scripts", () => {
    const html = [
      '<script type="module">console.log("island")</script>',
      "<script>theme()</script>",
      '<script type="application/json" data-search-index>{"a":1}</script>',
      '<script type="application/ld+json">{"@type":"WebPage"}</script>',
      '<script type="module" src="/_astro/app.js"></script>',
    ].join("");
    const hashes = inlineScriptHashes(html);
    expect(hashes).toHaveLength(2);
    for (const hash of hashes) expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]{43}='$/u);
    expect(inlineScriptHashes('<script type="application/json">{"a":1}</script>')).toEqual([]);
  });

  it("builds one deterministic policy without weak script sources", () => {
    const policy = contentSecurityPolicy({ scriptHashes: ["'sha256-b'", "'sha256-a'", "'sha256-a'"] });
    const directives = new Map(policy.split("; ").map((directive) => [directive.split(" ")[0]!, directive]));
    expect(directives.get("script-src")).toBe(
      "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com " +
        "https://accounts.google.com 'sha256-a' 'sha256-b'",
    );
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
    expect(directives.get("script-src")).not.toContain("'unsafe-eval'");
    expect(directives.get("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directives.get("object-src")).toBe("object-src 'none'");
    expect(directives.get("base-uri")).toBe("base-uri 'self'");
    expect(directives.get("form-action")).toBe("form-action 'self'");
    expect(directives.get("connect-src")).toContain("https://huggingface.co");
    expect(directives.get("worker-src")).toContain("blob:");
    expect(directives.get("frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directives.get("img-src")).toBe("img-src 'self' data: blob:");
    expect(policy).not.toContain("\n");
  });

  it("keeps the checked-in security headers and rewrites the CSP line in place", () => {
    const once = withContentSecurityPolicy(checkedInHeaders, "default-src 'self'");
    expect(once).toContain("  Strict-Transport-Security: max-age=31536000; includeSubDomains");
    expect(once).toContain("  X-Frame-Options: DENY");
    expect(once.match(/content-security-policy/giu)).toHaveLength(1);
    const twice = withContentSecurityPolicy(once, "default-src 'self'");
    expect(twice).toBe(once);
    expect(withContentSecurityPolicy(once, "default-src 'none'")).toContain("Content-Security-Policy: default-src 'none'");
  });

  it("refuses a policy Cloudflare would reject", () => {
    const hashes = Array.from({ length: 40 }, (_, index) => `'sha256-${String(index).padStart(43, "A")}='`);
    expect(() => withContentSecurityPolicy(checkedInHeaders, contentSecurityPolicy({ scriptHashes: hashes })))
      .toThrow(/Cloudflare allows 2000/u);
    expect(() => withContentSecurityPolicy(checkedInHeaders, "default-src 'self'\nscript-src 'self'"))
      .toThrow(/single header line/u);
    expect(HEADER_LINE_LIMIT).toBe(2000);
  });

  it("materialises and verifies the policy on a built dist", async () => {
    const dist = await fixtureDist({
      "": '<script type="module">hydrate()</script>',
      "tools/business-day": "<script>boot()</script>",
    });
    const applied = await applyContentSecurityPolicy(dist);
    expect(applied).toMatchObject({ scriptHashCount: 2, pages: 2 });
    const headers = await readFile(join(dist, "_headers"), "utf8");
    expect(headers).toContain(`Content-Security-Policy: ${applied.policy}`);
    await expect(verifyBuiltContentSecurityPolicy(dist)).resolves.toMatchObject({ scriptHashCount: 2, pages: 2 });
  });

  it("fails closed on a missing policy, a weakened policy or an unhashed inline script", async () => {
    const dist = await fixtureDist({ "": "<script>boot()</script>" });
    await expect(verifyBuiltContentSecurityPolicy(dist)).rejects.toThrow(/expected one CSP/u);

    const applied = await applyContentSecurityPolicy(dist);
    await writeFile(join(dist, "_headers"), withContentSecurityPolicy(checkedInHeaders, applied.policy.replace("'wasm-unsafe-eval'", "'unsafe-inline'")), "utf8");
    await expect(verifyBuiltContentSecurityPolicy(dist)).rejects.toThrow(/'unsafe-inline'/u);

    const withoutWasm = await fixtureDist({ "": "<script>boot()</script>" });
    await writeFile(join(withoutWasm, "_headers"), withContentSecurityPolicy(checkedInHeaders, "default-src 'self'; script-src 'self'"), "utf8");
    await expect(verifyBuiltContentSecurityPolicy(withoutWasm)).rejects.toThrow(/'wasm-unsafe-eval'/u);

    const drifted = await fixtureDist({ "": "<script>boot()</script>" });
    await applyContentSecurityPolicy(drifted);
    await writeFile(join(drifted, "index.html"), '<script>boot()</script><script type="module">later()</script>', "utf8");
    await expect(verifyBuiltContentSecurityPolicy(drifted)).rejects.toThrow(/CSP misses inline scripts/u);
  });
});
