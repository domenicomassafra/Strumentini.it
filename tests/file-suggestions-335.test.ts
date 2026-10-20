import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ToolSummary } from "../src/catalog/manifest";
import { fileSuggestions335 } from "../src/components/home/file-suggestions-335";
import { catalog } from "../src/generated/catalog";
import type { LocalFileDetection, LocalFileFormat } from "../src/runtime/file-detection";

const liveRoutes = new Set(
  readdirSync(new URL("../src/pages/tools/", import.meta.url))
    .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.astro$/u.test(name))
    .map((name) => "/tools/" + name.slice(0, -".astro".length)),
);

const mimes: Partial<Record<LocalFileFormat, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  zip: "application/zip",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function detected(format: LocalFileFormat, mime = mimes[format] ?? ""): LocalFileDetection {
  return {
    status: "supported", format, mime, name: "PRIVATE-INPUT",
    bytes: 100, readBytes: 64,
    method: "bounded-signature-and-container-metadata",
    note: "candidate only; decoding and content safety are not verified",
  };
}

const ids = (format: LocalFileFormat) =>
  fileSuggestions335(detected(format), catalog, liveRoutes).map((entry) => entry.toolId);

describe("#335 manifest-grounded home file suggestions", () => {
  it("recommends a bounded and ordered subset for a verified PDF signature", () => {
    expect(ids("pdf")).toEqual([
      "pdf-page-count-verifier", "pdf-merge", "pdf-compression-lite",
      "pdf-split", "pdf-page-reorder", "pdf-text-extraction",
    ]);
    const entries = fileSuggestions335(detected("pdf"), catalog, liveRoutes);
    expect(entries).toHaveLength(6);
    expect(entries.every((entry) => liveRoutes.has(entry.route))).toBe(true);
    for (const entry of entries) {
      const matching = catalog.find((tool) => tool.id === entry.toolId);
      expect(matching?.inputTypes).toContain("application/pdf");
      expect(matching?.runtime).toMatchObject({ location: "LOCAL", network: "forbidden" });
      expect(matching?.engine).toBe("pdf");
    }
  });

  it.each(["png", "jpeg", "webp"] as const)("recommends relevant %s image operations", (format) => {
    expect(ids(format)).toEqual([
      "image-compression", "image-resize", "image-format-conversion",
      "exif-remover", "image-metadata-viewer", "image-crop",
    ]);
    for (const suggestion of fileSuggestions335(detected(format), catalog, liveRoutes)) {
      expect(liveRoutes.has(suggestion.route)).toBe(true);
      expect(catalog.find((tool) => tool.id === suggestion.toolId)?.inputTypes).toContain(mimes[format]);
    }
  });

  it("restricts GIF and ZIP to manifest-declared, local operations", () => {
    expect(ids("gif")).toEqual(["image-format-conversion", "images-to-pdf"]);
    expect(ids("zip")).toEqual(["zip-contents-inspector", "archive-checksum-manifest", "zip-creator"]);
  });

  it("recommends published local CSV operations only for structurally inspected CSV", () => {
    expect(ids("csv")).toEqual([
      "csv-cleaner", "csv-dedupe", "csv-column-map", "csv-filter", "csv-column-selector", "csv-group-count",
    ]);
    expect(fileSuggestions335(detected("csv", "application/pdf"), catalog, liveRoutes)).toEqual([]);
    for (const suggestion of fileSuggestions335(detected("csv"), catalog, liveRoutes)) {
      const tool = catalog.find((entry) => entry.id === suggestion.toolId);
      expect(tool?.inputTypes).toContain("csv");
      expect(["table-csv", "table-operations"]).toContain(tool?.engine);
      expect(tool?.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
    }
  });

  it("does not advertise Office or fake generic file routes", () => {
    expect(ids("docx")).toEqual([]);
    expect(ids("xlsx")).toEqual([]);
    expect(ids("pptx")).toEqual([]);
    expect(fileSuggestions335(detected("png", "text/csv"), catalog, liveRoutes)).toEqual([]);
    expect(fileSuggestions335(detected("pdf", "image/png"), catalog, liveRoutes)).toEqual([]);
    expect(fileSuggestions335({ status: "refused", reason: "UNSUPPORTED", name: "private.csv", bytes: 10, readBytes: 10, note: "no signature" }, catalog, liveRoutes)).toEqual([]);
  });

  it("rejects stale/missing routes, wrong MIME, remote/network and mismatched engines", () => {
    const good = catalog.find((tool) => tool.id === "pdf-page-count-verifier")!;
    const { result: _result, ...withoutResult } = good;
    const specimen: ToolSummary[] = [
      good,
      { ...good, id: "not-deployed", route: "/tools/not-deployed" },
      { ...good, id: "remote-copy", route: "/tools/remote-copy", runtime: { location: "REMOTE", network: "required" } },
      { ...good, id: "wrong-format", route: "/tools/wrong-format", inputTypes: ["image/png"] },
      { ...good, id: "generic-file", route: "/tools/generic-file", inputTypes: ["file"] },
      { ...good, id: "wrong-engine", route: "/tools/wrong-engine", engine: "table-csv" },
      { ...withoutResult, id: "no-result", route: "/tools/no-result" },
      { ...good, id: "path-trick", route: "/tools/../path-trick" },
      { ...good, id: "network-local", route: "/tools/network-local", runtime: { location: "LOCAL", network: "reference-only" } },
    ];
    const allFakeRoutes = new Set(specimen.filter((tool) => tool.id !== "not-deployed").map((tool) => tool.route));
    expect(fileSuggestions335(detected("pdf"), specimen, allFakeRoutes).map((item) => item.toolId))
      .toEqual(["pdf-page-count-verifier"]);
    expect(fileSuggestions335(detected("pdf"), [good], new Set())).toEqual([]);
  });

  it("deduplicates and discovers newly published manifest-compatible local PDF operations", () => {
    const original = catalog.find((tool) => tool.id === "pdf-page-count-verifier")!;
    const incoming: ToolSummary = {
      ...original, id: "pdf-new-local-operation", route: "/tools/pdf-new-local-operation", name: "PDF Nuovo",
    };
    const routes = new Set([original.route, incoming.route]);
    const suggestions = fileSuggestions335(detected("pdf"), [original, incoming, incoming], routes);
    expect(suggestions.map((item) => item.toolId)).toEqual(["pdf-page-count-verifier", "pdf-new-local-operation"]);
    expect(suggestions.every((item) => Object.keys(item).sort().join(",") === "format,name,route,toolId")).toBe(true);
    expect(JSON.stringify(suggestions)).not.toContain("PRIVATE-INPUT");
  });
});
