import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { searchCatalog } from "../src/generated/search-catalog";
import { fileSuggestions335 } from "../src/components/home/file-suggestions-335";
import { createSearch } from "../src/search/search";

const published = new Set(
  readdirSync(new URL("../src/pages/tools/", import.meta.url))
    .filter((filename) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.astro$/u.test(filename))
    .map((filename) => "/tools/" + filename.replace(/\.astro$/u, "")),
);

describe("#115 / STR-354: real anonymous Home destinations", () => {
  it("resolves a concrete task from the generated search index without an account or browsing history", () => {
    const results = createSearch(searchCatalog).query("utm builder", {});
    const route = results.hits.find((entry) => entry.id === "utm-builder");
    expect(route?.route).toBe("/tools/utm-builder");
    expect(published.has(route?.route ?? "")).toBe(true);
    const tool = catalog.find((entry) => entry.id === "utm-builder");
    expect(tool?.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
  });

  it("connects a locally recognized PDF to an existing task without carrying file data", () => {
    const detected = {
      status: "supported" as const, format: "pdf" as const, mime: "application/pdf",
      name: "PRIVATE_354.pdf", bytes: 2048, readBytes: 32,
      method: "bounded-signature-and-container-metadata" as const,
      note: "candidate only; decoding and content safety are not verified" as const,
    };
    const choices = fileSuggestions335(detected, catalog, published);
    expect(choices[0]).toMatchObject({ toolId: "pdf-page-count-verifier", route: "/tools/pdf-page-count-verifier" });
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((choice) => published.has(choice.route))).toBe(true);
    expect(JSON.stringify(choices)).not.toContain(detected.name);
  });
});
