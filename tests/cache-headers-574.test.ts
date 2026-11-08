import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { secureApiResponse } from "../worker/security-headers";

const policy = readFileSync(resolve(import.meta.dirname, "../public/_headers"), "utf8");

function headersOf(selector: string): Map<string, string> {
  const headers = new Map<string, string>();
  let inside = false;
  for (const line of policy.split("\n")) {
    if (/^\S/u.test(line)) {
      inside = line.trim() === selector;
      continue;
    }
    const header = inside ? /^\s+([^:]+):\s*(.+)$/u.exec(line) : null;
    if (header !== null) headers.set(header[1]!.toLowerCase(), header[2]!);
  }
  return headers;
}

describe("#574 cache policy for public/_headers", () => {
  it("caches content-hashed Astro assets for a year as immutable", () => {
    expect(headersOf("/_astro/*").get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("gives stable static asset directories a one week cache", () => {
    for (const selector of ["/fonts/*", "/models/*", "/ocr-246/*", "/ocr-395/*"]) {
      expect(headersOf(selector).get("cache-control"), selector).toBe("public, max-age=604800");
    }
  });

  it("leaves the global block free of cache directives, so HTML keeps revalidating", () => {
    const global = headersOf("/*");
    expect(global.has("cache-control")).toBe(false);
    expect(global.get("x-content-type-options")).toBe("nosniff");
  });

  it("never copies a per-path cache rule onto API responses", () => {
    const response = secureApiResponse(new Response("{}", { headers: { "cache-control": "no-store" } }));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("permissions-policy")).toContain("camera=(self)");
  });
});
