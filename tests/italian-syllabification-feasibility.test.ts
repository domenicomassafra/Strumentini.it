import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface CorpusCase {
  readonly id: string;
  readonly tags: readonly string[];
  readonly sourceExpected: readonly string[];
  readonly classification: "match" | "mismatch" | "unresolved";
}

interface Corpus {
  readonly decision: string;
  readonly evaluatedCandidate: {
    readonly package: string;
    readonly version: string;
    readonly engineLicense: string;
    readonly semantics: string;
  };
  readonly sources: readonly { readonly id: string; readonly url: string }[];
  readonly cases: readonly CorpusCase[];
}

async function loadCorpus(): Promise<Corpus> {
  return JSON.parse(await readFile(
    new URL("../quality/fixtures/italian-syllabification/corpus.json", import.meta.url),
    "utf8",
  )) as Corpus;
}

describe("Italian syllabification feasibility evidence", () => {
  it("keeps the decision refused while the evaluated engine only proves hyphenation", async () => {
    const corpus = await loadCorpus();
    expect(corpus.decision).toBe("REFUSE");
    expect(corpus.evaluatedCandidate).toMatchObject({ package: "hyphen", version: "1.14.1", engineLicense: "ISC" });
    expect(corpus.evaluatedCandidate.semantics).toMatch(/hyphenation/u);
    expect(corpus.sources.length).toBeGreaterThanOrEqual(4);
    expect(corpus.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
  });

  it("covers the required ambiguity classes with held-out words", async () => {
    const corpus = await loadCorpus();
    const tags = new Set(corpus.cases.flatMap((entry) => entry.tags));
    for (const required of ["apostrophe", "digraph", "hiatus", "diphthong", "foreign-word"]) {
      expect(tags.has(required), `missing corpus category ${required}`).toBe(true);
    }
    expect(new Set(corpus.cases.map((entry) => entry.id)).size).toBe(corpus.cases.length);
  });

  it("records concrete source-backed mismatches instead of treating the candidate as authoritative", async () => {
    const corpus = await loadCorpus();
    const mismatches = corpus.cases.filter((entry) => entry.classification === "mismatch");
    expect(mismatches.length).toBeGreaterThanOrEqual(4);
    expect(mismatches.some((entry) => entry.tags.includes("hiatus"))).toBe(true);
    expect(mismatches.some((entry) => entry.tags.includes("apostrophe"))).toBe(true);
    expect(corpus.cases.some((entry) => entry.classification === "unresolved" && entry.tags.includes("foreign-word"))).toBe(true);
    expect(mismatches.every((entry) => entry.sourceExpected.length > 0)).toBe(true);
  });
});
