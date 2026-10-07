import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolSummary } from "../src/catalog/manifest";
import { catalog } from "../src/generated/catalog";
import { createBoundedTextPreview } from "../src/runtime/bounded-preview";
import { auditLegacyPrimaryOutputSource } from "../src/quality/legacy-result-primary";
import {
  buildResearchResultPresentation,
  createResearchResultArtifact,
  researchResultProvenance,
} from "../src/components/tools/research-knowledge/ResearchResultV2";
import {
  RESEARCH_RESULT_V2_IDS,
  researchResultV2Definition,
} from "../src/tools/research-result-v2";
import bibtexFormatterModule from "../src/tools/bibtex-formatter/module";
import citationDeduplicatorModule from "../src/tools/citation-deduplicator/module";
import risBibtexConverterModule from "../src/tools/ris-bibtex-converter/module";
import type { BibtexFormatterOutput } from "../src/tools/bibtex-formatter/types";
import type { RisBibtexConverterOutput } from "../src/tools/ris-bibtex-converter/types";

const root = resolve(import.meta.dirname, "..");
const context = { defaults: {} };

describe("research Result v2 migration", () => {
  it("covers every declared research Result v2 owner with local semantic classes and manifest-bound oracle identity", () => {
    const owned = catalog.filter(({ engine }) => engine === "research-knowledge" || engine === "research-reference") as readonly ToolSummary[];
    expect(owned).toHaveLength(RESEARCH_RESULT_V2_IDS.length);
    expect(owned.map(({ id }) => id).toSorted()).toEqual([...RESEARCH_RESULT_V2_IDS].toSorted());

    const counts = new Map<string, number>();
    for (const entry of owned) {
      const definition = researchResultV2Definition(entry.id as (typeof RESEARCH_RESULT_V2_IDS)[number]);
      expect(entry.runtime.network, entry.id).toBe("forbidden");
      expect(entry.result, entry.id).toEqual(definition.declaration);
      expect(entry.gold.oracleEntryId, entry.id).toBe(definition.oracleEntryId);
      expect(entry.engine, entry.id).toBe(definition.engine);
      expect(definition.declaration.class, entry.id).not.toBe("reference-network");
      counts.set(definition.declaration.class, (counts.get(definition.declaration.class) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ "text-code": 7, table: 8, validator: 8 });
  });

  it("keeps a long BibTeX result complete in copy/download data while bounding only the preview", async () => {
    const input = Array.from({ length: 120 }, (_, index) => [
      `@article{k${index},`,
      `  title = {Titolo ${index}},`,
      `  author = {Autore ${index}},`,
      "  year = {2026}",
      "}",
    ].join("\n")).join("\n\n");
    const result = await bibtexFormatterModule.run({ text: input }, context) as BibtexFormatterOutput;
    const presentation = buildResearchResultPresentation("bibtex-formatter", result);
    const artifact = createResearchResultArtifact(presentation);
    const preview = createBoundedTextPreview(artifact, 80, "text");

    expect(presentation.fullText).toBe(result.bibtex);
    expect(presentation.fullText).toContain("@article{k119,");
    expect(artifact.download.ready).toBe(true);
    expect(artifact.byteLength).toBe(new TextEncoder().encode(result.bibtex).byteLength);
    expect(preview.truncated).toBe(true);
    expect(preview.text).not.toContain("@article{k119,");
  });

  it("preserves exact RIS and BibTeX converter payloads with canonical oracle provenance", async () => {
    const ris = "TY  - JOUR\nAU  - Ada Smith\nTI  - A Synthetic Fixture\nPY  - 2026\nDO  - 10.1000/182\nER  - \n";
    const toBibtex = await risBibtexConverterModule.run({ text: ris, direction: "ris-to-bibtex" }, context) as RisBibtexConverterOutput;
    const bibtexPresentation = buildResearchResultPresentation("ris-bibtex-converter", toBibtex);
    expect(bibtexPresentation.fullText).toBe(toBibtex.bibtex);
    expect(bibtexPresentation.filename).toMatch(/\.bib$/u);
    expect(createResearchResultArtifact(bibtexPresentation).download.ready).toBe(true);

    const toRis = await risBibtexConverterModule.run({ text: toBibtex.bibtex, direction: "bibtex-to-ris" }, context) as RisBibtexConverterOutput;
    const risPresentation = buildResearchResultPresentation("ris-bibtex-converter", toRis);
    expect(risPresentation.fullText).toBe(toRis.ris);
    expect(risPresentation.filename).toMatch(/\.ris$/u);

    const provenance = researchResultProvenance("ris-bibtex-converter");
    expect(provenance).toContain("cand-187");
    expect(provenance).not.toContain("REFUSED");
    expect(provenance).not.toContain("ticket 276");
    const audit = JSON.parse(await readFile(resolve(root, "quality/functional-audit/records/ris-bibtex-converter.json"), "utf8")) as { decision: string };
    expect(audit.decision).toBe("UPGRADED");
  });

  it("exports deduplicated research identity as CSV without dropping DOI, ISBN or title", async () => {
    const result = await citationDeduplicatorModule.run({
      records: [
        { title: "Primary title", author: "Ada Rossi", year: "2026", doi: "10.1000/182", isbn: "9780306406157", url: "https://example.org/a" },
        { title: "Duplicate title", author: "Other", year: "2025", doi: "doi:10.1000/182", isbn: "9780306406157" },
        { title: "Only title" },
      ],
      mode: "identifier",
    }, context) as Record<string, unknown>;
    const presentation = buildResearchResultPresentation("citation-deduplicator", result);

    expect(presentation.mime).toBe("text/csv");
    expect(presentation.filename).toBe("citation-deduplicator.csv");
    expect(presentation.fullText.split("\n")[0]).toBe("Titolo,Autore,Anno,DOI,ISBN,URL");
    expect(presentation.fullText).toContain("Primary title,Ada Rossi,2026,10.1000/182,9780306406157,https://example.org/a");
    expect(presentation.fullText).toContain("Only title,,,,,");
    expect(presentation.fullText).not.toContain("Duplicate title");
  });

  it("keeps user source content in the result table and manifest/oracle provenance in a separate channel", () => {
    const sourceSentinel = "USER_SOURCE_SENTINEL_DO_NOT_TREAT_AS_PROVENANCE";
    const result = {
      csv: `title,url,date,source,doi,notes\nStudio,https://example.org,2026,${sourceSentinel},10.1000/182,nota`,
      headers: ["title", "url", "date", "source", "doi", "notes"],
      rows: [{ title: "Studio", url: "https://example.org", date: "2026", source: sourceSentinel, doi: "10.1000/182", notes: "nota" }],
      rowCount: 1,
      emptyRowCount: 0,
      emptyRowIndexes: [],
      engineVersion: "research-knowledge-v2",
    };
    const presentation = buildResearchResultPresentation("evidence-table-builder", result);
    const provenance = researchResultProvenance("evidence-table-builder");

    expect(presentation.table?.rows[0]).toContain(sourceSentinel);
    expect(presentation.fullText).toContain(sourceSentinel);
    expect(provenance).toContain("cand-196");
    expect(provenance).not.toContain(sourceSentinel);
  });

  it("keeps plain-text research output complete and reusable without serializing provenance into it", () => {
    const result = {
      records: ["prima", "PRIMA", "seconda"],
      unique: ["prima", "seconda"],
      duplicates: ["PRIMA"],
      removed: 1,
      inputCount: 3,
      outputCount: 2,
      comparison: "NFC",
      engineVersion: "research-knowledge-v2",
    };
    const presentation = buildResearchResultPresentation("notes-deduplicator", result);
    expect(presentation.fullText).toBe("prima\nseconda");
    expect(presentation.reuseText).toBe("prima\nseconda");
    expect(presentation.fullText).not.toContain("cand-197");
    expect(researchResultProvenance("notes-deduplicator")).toContain("cand-197");
  });

  it("removes the bespoke DOI/ISBN manual result panel from the legacy-primary audit", async () => {
    const file = "src/components/tools/DoiIsbnNormalizerTool.tsx";
    const source = await readFile(resolve(root, file), "utf8");
    expect(auditLegacyPrimaryOutputSource(file, source)).toEqual([]);
  });
});
