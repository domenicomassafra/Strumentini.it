import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { fileSuggestions335 } from "../src/components/home/file-suggestions-335";
import { detectLocalFile } from "../src/runtime/file-detection";

// Public seam: actual bytes -> local signature inspection -> published tool URL.
// The compiled-browser runner separately verifies the result and download.
const routes = new Set(
  readdirSync(new URL("../src/pages/tools/", import.meta.url))
    .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.astro$/u.test(name))
    .map((name) => "/tools/" + name.slice(0, -".astro".length)),
);
const digest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

describe("STR-336 Photos/Files to a real local tool", () => {
  it.each([
    ["Photos", "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", "picked.png", "image/png", "png", "/tools/image-resize"],
    ["Files", "quality/fixtures/pdf-gold/simple-2page.pdf", "picked.pdf", "application/pdf", "pdf", "/tools/pdf-compression-lite"],
  ] as const)("%s detects original bytes and offers its published destination", async (_kind, fixture, name, mime, format, target) => {
    const bytes = readFileSync(new URL("../" + fixture, import.meta.url));
    const originalHash = digest(bytes);
    const file = new File([new Uint8Array(bytes)], name, { type: mime });
    const result = await detectLocalFile(file);
    expect(result).toMatchObject({ status: "supported", format, mime });
    const matches = fileSuggestions335(result, catalog, routes);
    expect(matches.map((entry) => entry.route)).toContain(target);
    const tool = catalog.find((entry) => entry.route === target);
    expect(tool?.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
    expect(digest(new Uint8Array(await file.arrayBuffer()))).toBe(originalHash);
  });
});
