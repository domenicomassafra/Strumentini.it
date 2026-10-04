import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeVocabulary,
  buildEvidenceTable,
  convertBibtexToRis,
  convertRisToBibtex,
  countSourceDomains,
  createResearchPackManifest,
  dedupeBibtexEntries,
  dedupeCitationRecords,
  dedupeNotes,
  dedupeReadingList,
  formatBibtex,
  formatBibtexDocument,
  formatPdfPageCitation,
  generateCitationKey,
  citationKeysFor,
  normalizeDateSource,
  parseBibtexDocument,
  parseCitationRecords,
  parseRisDocument,
  RESEARCH_KNOWLEDGE_ENGINE_VERSION,
  sha256HexUtf8,
  sortReferenceList,
} from "../src/engines/research-knowledge";
import bibtexDeduplicator from "../src/tools/bibtex-deduplicator/module";
import bibtexFormatter from "../src/tools/bibtex-formatter/module";
import citationDeduplicator from "../src/tools/citation-deduplicator/module";
import citationKeyGenerator from "../src/tools/citation-key-generator/module";
import dateSourceNormalizer from "../src/tools/date-source-normalizer/module";
import domainFrequencyCounter from "../src/tools/domain-frequency-counter/module";
import evidenceTableBuilder from "../src/tools/evidence-table-builder/module";
import notesDeduplicator from "../src/tools/notes-deduplicator/module";
import pdfPageCitationHelper from "../src/tools/pdf-page-citation-helper/module";
import readingListDeduplicator from "../src/tools/reading-list-deduplicator/module";
import referenceListSorter from "../src/tools/reference-list-sorter/module";
import researchPackManifest from "../src/tools/research-pack-manifest/module";
import risBibtexConverter from "../src/tools/ris-bibtex-converter/module";
import vocabularyFrequencyAnalyzer from "../src/tools/vocabulary-frequency-analyzer/module";

function fixture<T>(family: string): T {
  return JSON.parse(readFileSync(new URL(`../quality/fixtures/${family}/vectors.json`, import.meta.url), "utf8")) as T;
}

interface IdentityVector {
  name: string;
  mode: "exact" | "identifier" | "title-author-year";
  records: unknown[];
  removed: number;
  outputCount: number;
  rules?: string[];
  output_titles?: string[];
  output_must_not_contain?: string;
}

const identityVectors = fixture<{
  vectors: IdentityVector[];
  sort_vectors: Array<{ order: "author" | "year" | "title"; records: unknown[]; output_titles: string[]; unchanged?: boolean; movedCount?: number }>;
  key_vectors: Array<{ record: Record<string, unknown>; key: string }>;
  key_collision_vector: { records: Array<Record<string, unknown>>; keys: string[]; collisions: number };
}>("research-citation-identity");

const pagesVectors = fixture<{
  vectors: Array<{
    input: { author: string; title: string; year: string | number; pages: string; style?: string };
    citation?: string;
    pages?: string;
    pageCount?: number;
    pageLabel?: string;
    throws?: string;
  }>;
}>("research-citation-pages");

const bibtexVectors = fixture<{
  parse_vectors: Array<{
    name: string;
    input: string;
    entry_count: number;
    directives: string[];
    truncated: boolean;
    entries: Array<{ type: string; key: string; fields: Record<string, string> }>;
    output_must_not_contain?: string;
  }>;
  format_vectors: Array<{ name: string; input?: string; entry?: { type: string; key: string; fields: Record<string, string> }; bibtex: string; warning_codes: string[]; directives?: string[] }>;
  dedupe_vectors: Array<{
    name: string;
    input: string;
    removed: number;
    outputCount: number;
    rules: string[];
    bibtex?: string;
    directive_count?: number;
  }>;
}>("research-bibtex-syntax");

const risVectors = fixture<{
  ris_to_bibtex_vectors: Array<{
    name: string;
    input: string;
    entry_count: number;
    key?: string;
    fields?: Record<string, string>;
    unknown_tags?: Array<{ record: number; tags: string[] }>;
    skipped_tag_lines?: number;
    truncated?: boolean;
    warning_codes: string[];
    output_must_not_contain?: string;
  }>;
  bibtex_to_ris_vectors: Array<{
    name: string;
    input: string;
    ris?: string;
    unknown_fields?: Array<{ entry: number; fields: string[] }>;
    warning_codes: string[];
  }>;
  round_trip_vector: { input: string; ris: string };
}>("research-ris-bibtex-conversion");

const dateVectors = fixture<{
  vectors: Array<{
    input: string;
    dayFirst?: boolean;
    valid: boolean;
    iso?: string;
    precision?: string;
    source: string;
    ambiguous?: boolean;
    alternativeIso?: string;
    dayFirst_effective?: boolean;
    reason?: string;
  }>;
}>("research-date-normalization");

const inventoryVectors = fixture<{
  domain_vectors: Array<{
    name: string;
    input: string[];
    total: number;
    unique: number;
    invalidCount: number;
    invalid?: string[];
    domains?: Array<{ domain: string; count: number; uniqueUrls: number; urls: string[] }>;
    domain_order?: string[];
    output_must_not_contain?: string;
  }>;
  evidence_vectors: Array<{
    name: string;
    input: unknown[];
    csv: string;
    rowCount: number;
    emptyRowCount: number;
    emptyRowIndexes: number[];
  }>;
  pack_vectors: Array<{
    name: string;
    name_input: string;
    tools_input: string[];
    tools?: string[];
    count?: number;
    canonicalPayload?: string;
    checksum_algorithm?: string;
    checksum_length?: number;
    checksum_hex?: boolean;
    throws?: string;
  }>;
}>("research-source-inventory");

const textVectors = fixture<{
  note_vectors: Array<{ name: string; input: unknown; removed: number; outputCount: number; records?: unknown[]; inputCount?: number }>;
  vocabulary_vectors: Array<{
    name: string;
    input: string;
    minLength?: number;
    limit?: number;
    stopwords?: string[];
    terms: Array<{ term: string; count: number }>;
    total?: number;
    unique?: number;
    ignoredStopwords?: number;
    ignoredShortTerms?: number;
    stopwordProfile?: string;
    effectiveLimit?: number;
    effectiveMinLength?: number;
  }>;
}>("research-text-frequency");

const sha2Vectors = fixture<{
  vectors: Array<{ algorithm: string; input_utf8: string; digest_hex: string }>;
}>("sha2-known-answers");

const context = { defaults: {} } as never;

describe("research-knowledge SHA-256 primitive", () => {
  it("matches the published known-answer vectors", () => {
    const sha256 = sha2Vectors.vectors.filter((vector) => vector.algorithm === "SHA-256");
    expect(sha256.length).toBeGreaterThan(0);
    for (const vector of sha256) {
      expect(sha256HexUtf8(vector.input_utf8)).toBe(vector.digest_hex);
    }
  });

  it("hashes multi-byte UTF-8 without depending on the host locale", () => {
    // Length 2 UTF-8 payload ("città" is 6 bytes) exercises the padding path.
    expect(sha256HexUtf8("città")).toMatch(/^[a-f0-9]{64}$/u);
    expect(sha256HexUtf8("città")).not.toBe(sha256HexUtf8("citta"));
  });
});

describe("research-citation-identity fixtures", () => {
  it.each(identityVectors.vectors.map((vector) => [vector.name, vector] as const))("%s", (_name, vector) => {
    const result = dedupeCitationRecords(vector.records as never, { mode: vector.mode });
    expect(result.removed).toBe(vector.removed);
    expect(result.outputCount).toBe(vector.outputCount);
    expect([...new Set(result.groups.map((group) => group.rule))].sort()).toEqual([...(vector.rules ?? [])].sort());
    if (vector.output_titles !== undefined) {
      expect(result.records.map((record) => (record as { title: string }).title)).toEqual(vector.output_titles);
    }
    if (vector.output_must_not_contain !== undefined) {
      expect(JSON.stringify(result)).not.toContain(vector.output_must_not_contain);
    }
  });

  it("is idempotent and conserves the input multiset", () => {
    for (const vector of identityVectors.vectors) {
      const once = dedupeCitationRecords(vector.records as never, { mode: vector.mode });
      const twice = dedupeCitationRecords(once.records as never, { mode: vector.mode });
      expect(twice.removed).toBe(0);
      expect(once.unique.length + once.duplicates.length).toBe(once.inputCount);
    }
  });

  it("agrees between the citation deduplicator and the reading-list deduplicator on identifier identity", () => {
    for (const vector of identityVectors.vectors.filter((entry) => entry.mode === "identifier")) {
      const reading = dedupeReadingList(vector.records as never);
      expect(reading.removed).toBe(vector.removed);
      expect(reading.outputCount).toBe(vector.outputCount);
    }
  });

  it.each(identityVectors.sort_vectors.map((vector) => [vector.order, vector] as const))("sorts references by %s", (order, vector) => {
    const sorted = sortReferenceList(vector.records as never, order);
    expect(sorted.records.map((record) => (record as { title: string }).title)).toEqual(vector.output_titles);
    expect(sorted.order).toBe(order);
    expect(sorted.comparator).not.toBe("");
    if (vector.unchanged !== undefined) {
      expect(sorted.unchanged).toBe(vector.unchanged);
      expect(sorted.movedCount).toBe(vector.movedCount);
    }
  });

  it("never mutates the caller's reference array", () => {
    const records = [{ title: "B" }, { title: "A" }];
    const snapshot = JSON.stringify(records);
    sortReferenceList(records as never, "title");
    expect(JSON.stringify(records)).toBe(snapshot);
  });

  it.each(identityVectors.key_vectors.map((vector) => [vector.key, vector] as const))("generates the citation key %s", (key, vector) => {
    expect(generateCitationKey(vector.record as never)).toBe(key);
  });

  it("suffixes colliding keys instead of repeating one", () => {
    const result = citationKeysFor(identityVectors.key_collision_vector.records as never);
    expect(result.keys).toEqual(identityVectors.key_collision_vector.keys);
    expect(result.collisions).toBe(identityVectors.key_collision_vector.collisions);
    expect(new Set(result.keys).size).toBe(result.keys.length);
  });
});

describe("research-citation-pages fixtures", () => {
  it.each(pagesVectors.vectors.map((vector, index) => [vector.input.pages, index, vector] as const))("page citation %s", (_pages, _index, vector) => {
    if (vector.throws !== undefined) {
      expect(() => formatPdfPageCitation(vector.input as never)).toThrow(vector.throws);
      return;
    }
    expect(formatPdfPageCitation(vector.input as never)).toMatchObject({
      citation: vector.citation,
      pages: vector.pages,
      pageCount: vector.pageCount,
      pageLabel: vector.pageLabel,
    });
  });

  it("agrees on the canonical page list for every accepted range spelling", () => {
    const canonical = new Set(["12-15", "12--15", "12–15", "12—15"].map((pages) => formatPdfPageCitation({
      author: "A", title: "T", year: "2026", pages,
    }).pages));
    expect([...canonical]).toEqual(["12–15"]);
  });

  it("uses the singular page prefix for exactly one page in every preset", () => {
    for (const style of ["apa", "mla", "chicago"] as const) {
      expect(formatPdfPageCitation({ author: "A", title: "T", year: "2026", pages: "7", style }).pageLabel).toBe(style === "chicago" ? "7" : "p. 7");
    }
  });
});

describe("research-bibtex-syntax fixtures", () => {
  it.each(bibtexVectors.parse_vectors.map((vector, index) => [vector.name, index, vector] as const))("parses %s", (_name, _index, vector) => {
    const document = parseBibtexDocument(vector.input);
    expect(document.entries).toHaveLength(vector.entry_count);
    expect(document.directives).toEqual(vector.directives);
    expect(document.truncated).toBe(vector.truncated);
    document.entries.forEach((entry, index) => {
      expect(entry.type).toBe(vector.entries[index]?.type);
      expect(entry.key).toBe(vector.entries[index]?.key);
      expect(entry.fields).toMatchObject(vector.entries[index]?.fields ?? {});
    });
    if (vector.output_must_not_contain !== undefined) {
      expect(JSON.stringify(document)).not.toContain(vector.output_must_not_contain);
    }
  });

  it.each(bibtexVectors.format_vectors.map((vector, index) => [vector.name, index, vector] as const))("formats %s", (_name, _index, vector) => {
    const entries = vector.entry === undefined ? parseBibtexDocument(vector.input ?? "").entries : [vector.entry];
    const formatted = formatBibtexDocument(entries);
    expect(formatted.bibtex).toBe(vector.bibtex);
    expect(formatted.warnings.map((warning) => warning.code)).toEqual(vector.warning_codes);
    if (vector.directives !== undefined) {
      expect(parseBibtexDocument(vector.input ?? "").directives).toEqual(vector.directives);
    }
  });

  it("is a fixed point: formatting a canonical document changes nothing", () => {
    for (const vector of bibtexVectors.format_vectors.filter((entry) => entry.entry === undefined)) {
      const once = formatBibtex(parseBibtexDocument(vector.input ?? "").entries);
      expect(formatBibtex(parseBibtexDocument(once).entries)).toBe(once);
    }
  });

  it.each(bibtexVectors.dedupe_vectors.map((vector, index) => [vector.name, index, vector] as const))("deduplicates %s", (_name, _index, vector) => {
    const document = parseBibtexDocument(vector.input);
    const result = dedupeBibtexEntries(document.entries);
    expect(result.removed).toBe(vector.removed);
    expect(result.outputCount).toBe(vector.outputCount);
    expect(result.rules).toEqual(vector.rules);
    expect(result.bibtex).toBe(vector.bibtex ?? result.bibtex);
    if (vector.directive_count !== undefined) expect(document.directives).toHaveLength(vector.directive_count);
  });

  it("never emits a BibTeX directive as a bibliography entry", () => {
    const document = parseBibtexDocument("@string{acm = \"ACM\"}\n@preamble{\"x\"}\n@comment{a, b}\n@article{k, title = {T}}");
    expect(document.entries.map((entry) => entry.type)).toEqual(["article"]);
    expect(document.directives).toEqual(["string", "preamble", "comment"]);
    expect(formatBibtex(document.entries)).not.toContain("@comment");
  });
});

describe("research-ris-bibtex-conversion fixtures", () => {
  it.each(risVectors.ris_to_bibtex_vectors.map((vector, index) => [vector.name, index, vector] as const))("converts RIS: %s", (_name, _index, vector) => {
    const result = convertRisToBibtex(vector.input);
    expect(result.entries).toHaveLength(vector.entry_count);
    if (vector.key !== undefined) expect(result.entries[0]?.key).toBe(vector.key);
    if (vector.fields !== undefined) expect(result.entries[0]?.fields).toMatchObject(vector.fields);
    if (vector.unknown_tags !== undefined) expect(result.unknownTags).toEqual(vector.unknown_tags);
    if (vector.skipped_tag_lines !== undefined) expect(result.skippedTagLines).toBe(vector.skipped_tag_lines);
    if (vector.truncated !== undefined) expect(result.truncated).toBe(vector.truncated);
    expect(result.warnings.map((warning) => warning.code)).toEqual(vector.warning_codes);
    if (vector.output_must_not_contain !== undefined) {
      expect(JSON.stringify(result)).not.toContain(vector.output_must_not_contain);
    }
  });

  it.each(risVectors.bibtex_to_ris_vectors.map((vector, index) => [vector.name, index, vector] as const))("converts BibTeX: %s", (_name, _index, vector) => {
    const result = convertBibtexToRis(vector.input);
    if (vector.ris !== undefined) expect(result.ris).toBe(vector.ris);
    if (vector.unknown_fields !== undefined) expect(result.unknownFields).toEqual(vector.unknown_fields);
    expect(result.warnings.map((warning) => warning.code)).toEqual(vector.warning_codes);
  });

  it("round-trips every mapped RIS tag back to RIS", () => {
    const forward = convertRisToBibtex(risVectors.round_trip_vector.input);
    const back = convertBibtexToRis(forward.bibtex);
    expect(back.ris).toBe(risVectors.round_trip_vector.ris);
    expect(back.unknownFields).toEqual([]);
  });

  it("reports every unmapped tag and field instead of dropping it", () => {
    const fromRis = convertRisToBibtex("TY  - JOUR\nTI  - T\nXX  - sconosciuto\nER  - \n");
    expect(fromRis.unknownTags).toEqual([{ record: 1, tags: ["XX"] }]);
    const fromBibtex = convertBibtexToRis("@article{a, title = {T}, xx = {1}}");
    expect(fromBibtex.unknownFields).toEqual([{ entry: 1, fields: ["xx"] }]);
  });
});

describe("research-date-normalization fixtures", () => {
  it.each(dateVectors.vectors.map((vector, index) => [vector.input, index, vector] as const))("normalizes %s", (_input, _index, vector) => {
    const result = normalizeDateSource(vector.input, { dayFirst: vector.dayFirst ?? false });
    expect(result.valid).toBe(vector.valid);
    expect(result.source).toBe(vector.source);
    if (!vector.valid) {
      expect(result).toMatchObject({ reason: vector.reason });
      expect("iso" in result).toBe(false);
      return;
    }
    const valid = result as { iso: string; precision: string; ambiguous?: boolean; alternativeIso?: string; dayFirst: boolean };
    expect(valid.iso).toBe(vector.iso);
    expect(valid.precision).toBe(vector.precision);
    expect(valid.ambiguous ?? false).toBe(vector.ambiguous ?? false);
    if (vector.ambiguous === true) expect(valid.alternativeIso).toBe(vector.alternativeIso);
    if (vector.dayFirst_effective !== undefined) expect(valid.dayFirst).toBe(vector.dayFirst_effective);
  });

  it("reports rejection reasons in Italian", () => {
    const reasons = new Set(dateVectors.vectors.filter((vector) => vector.reason !== undefined).map((vector) => vector.reason));
    expect(reasons.size).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(/[a-zà-ù]/u.test(reason ?? "")).toBe(true);
      expect(reason).toBe(reason?.toLocaleLowerCase("it"));
    }
  });

  it("is idempotent on a normalized value", () => {
    for (const vector of dateVectors.vectors.filter((entry) => entry.valid === true)) {
      const once = normalizeDateSource(vector.input);
      expect(once.valid).toBe(true);
      if (!once.valid) continue;
      const twice = normalizeDateSource(once.iso);
      expect(twice.valid).toBe(true);
      if (twice.valid) expect(twice.iso).toBe(once.iso);
    }
  });

  it("accepts the Italian example the tool page itself advertises", () => {
    expect(normalizeDateSource("24 settembre 2026")).toMatchObject({ valid: true, iso: "2026-09-24" });
  });
});

describe("research-source-inventory fixtures", () => {
  it.each(inventoryVectors.domain_vectors.map((vector, index) => [vector.name, index, vector] as const))("counts domains: %s", (_name, _index, vector) => {
    const result = countSourceDomains(vector.input);
    expect(result.total).toBe(vector.total);
    expect(result.unique).toBe(vector.unique);
    expect(result.invalidCount).toBe(vector.invalidCount);
    if (vector.invalid !== undefined) expect(result.invalid).toEqual(vector.invalid);
    if (vector.domain_order !== undefined) expect(result.domains.map((item) => item.domain)).toEqual(vector.domain_order);
    if (vector.domains !== undefined) expect(result.domains).toEqual(vector.domains);
    if (vector.output_must_not_contain !== undefined) {
      expect(JSON.stringify(result)).not.toContain(vector.output_must_not_contain);
    }
  });

  it.each(inventoryVectors.evidence_vectors.map((vector, index) => [vector.name, index, vector] as const))("builds an evidence table: %s", (_name, _index, vector) => {
    const result = buildEvidenceTable(vector.input as never);
    expect(result.csv).toBe(vector.csv);
    expect(result.rowCount).toBe(vector.rowCount);
    expect(result.emptyRowCount).toBe(vector.emptyRowCount);
    expect(result.emptyRowIndexes).toEqual(vector.emptyRowIndexes);
    expect(result.csv.split("\n")).toHaveLength(vector.rowCount + 1);
    expect(result.csv.split("\n")[0]?.split(",")).toHaveLength(result.headers.length);
  });

  it.each(inventoryVectors.pack_vectors.map((vector, index) => [vector.name, index, vector] as const))("builds a pack manifest: %s", (_name, _index, vector) => {
    if (vector.throws !== undefined) {
      expect(() => createResearchPackManifest(vector.name_input, vector.tools_input)).toThrow(vector.throws);
      return;
    }
    const manifest = createResearchPackManifest(vector.name_input, vector.tools_input);
    expect(manifest.tools).toEqual(vector.tools);
    expect(manifest.count).toBe(vector.count);
    expect(manifest.canonicalPayload).toBe(vector.canonicalPayload);
    expect(manifest.checksumAlgorithm).toBe(vector.checksum_algorithm);
    expect(manifest.checksum).toHaveLength(vector.checksum_length ?? 64);
    if (vector.checksum_hex === true) expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/u);
    // The checksum must be reproducible from the published payload alone.
    expect(sha256HexUtf8(manifest.canonicalPayload)).toBe(manifest.checksum);
  });

  it("never lets a spreadsheet formula through unprefixed", () => {
    const table = buildEvidenceTable([{ title: "=1+1" }, { title: " +cmd" }, { title: "-cmd" }, { title: "@cmd" }]);
    for (const row of table.csv.split("\n").slice(1)) {
      expect(row.startsWith("'")).toBe(true);
    }
  });
});

describe("research-text-frequency fixtures", () => {
  it.each(textVectors.note_vectors.map((vector, index) => [vector.name, index, vector] as const))("deduplicates notes: %s", (_name, _index, vector) => {
    const result = dedupeNotes(vector.input);
    expect(result.removed).toBe(vector.removed);
    expect(result.outputCount).toBe(vector.outputCount);
    if (vector.records !== undefined) expect(result.records).toEqual(vector.records);
    if (vector.inputCount !== undefined) expect(result.inputCount).toBe(vector.inputCount);
    expect(result.comparison).not.toBe("");
  });

  it("keeps a scalar note input instead of losing it", () => {
    expect(dedupeNotes("42").records).toEqual(["42"]);
    expect(dedupeNotes(42).records).toEqual(["42"]);
    expect(dedupeNotes(true).records).toEqual(["true"]);
  });

  it.each(textVectors.vocabulary_vectors.map((vector, index) => [vector.name, index, vector] as const))("analyzes vocabulary: %s", (_name, _index, vector) => {
    const result = analyzeVocabulary(vector.input, {
      ...(vector.minLength === undefined ? {} : { minLength: vector.minLength }),
      ...(vector.limit === undefined ? {} : { limit: vector.limit }),
      ...(vector.stopwords === undefined ? {} : { stopwords: vector.stopwords }),
    });
    expect(result.terms).toEqual(vector.terms);
    if (vector.total !== undefined) expect(result.total).toBe(vector.total);
    if (vector.unique !== undefined) expect(result.unique).toBe(vector.unique);
    if (vector.ignoredStopwords !== undefined) expect(result.ignoredStopwords).toBe(vector.ignoredStopwords);
    if (vector.ignoredShortTerms !== undefined) expect(result.ignoredShortTerms).toBe(vector.ignoredShortTerms);
    if (vector.stopwordProfile !== undefined) expect(result.stopwordProfile).toBe(vector.stopwordProfile);
    if (vector.effectiveLimit !== undefined) expect(result.limit).toBe(vector.effectiveLimit);
    if (vector.effectiveMinLength !== undefined) expect(result.minLength).toBe(vector.effectiveMinLength);
  });

  it("never reports a declared stopword as a frequent term", () => {
    const result = analyzeVocabulary("il lo la gli e per con una uno un del della delle di da dal in nel");
    expect(result.terms).toEqual([]);
    expect(result.ignoredStopwords).toBe(18);
  });
});

describe("research-knowledge tool modules", () => {
  it("formats BibTeX through the module and discloses directives", () => {
    const result = bibtexFormatter.run({ text: "@comment{nota, da ignorare}\n@article{a, year = {2026}, title = {T}, author = {Ada Smith}}" }, context) as {
      bibtex: string;
      entryCount: number;
      directiveCount: number;
      warnings: Array<{ message: string }>;
    };
    expect(result.bibtex).toBe("@article{a,\n  author = {Ada Smith},\n  title = {T},\n  year = {2026}\n}\n");
    expect(result.entryCount).toBe(1);
    expect(result.directiveCount).toBe(1);
    expect(result.warnings[0]?.message).toMatch(/@comment/u);
  });

  it("deduplicates BibTeX through the module with the reported identity rules", () => {
    const result = bibtexDeduplicator.run({ text: "@article{a, title = {A}, doi = {10.1000/182}}\n@article{b, title = {B}, doi = {doi:10.1000/182}}" }, context) as { removed: number; rules: string[] };
    expect(result.removed).toBe(1);
    expect(result.rules).toEqual(["doi"]);
  });

  it("deduplicates citations with the selected identity mode and fails closed on an unknown mode", () => {
    expect((citationDeduplicator.run({ records: [{ doi: "10.1000/1" }, { doi: "doi:10.1000/1" }], mode: "identifier" }, context) as { removed: number }).removed).toBe(1);
    expect(() => citationDeduplicator.run({ records: [], mode: "fuzzy" }, context)).toThrow("INVALID_INPUT");
    expect(() => citationDeduplicator.run({ mode: "identifier" }, context)).toThrow("INVALID_INPUT");
  });

  it("generates citation keys through the module and counts collisions", () => {
    const result = citationKeyGenerator.run({ records: [{ author: "Ada Smith", title: "Deep Learning", year: "2026" }, { author: "Ada Smith", title: "Deep Learning", year: "2026" }] }, context) as { keys: string[]; collisions: number; keyCount: number };
    expect(result.keys).toEqual(["smith_2026_deep", "smith_2026_deep_2"]);
    expect(result.collisions).toBe(1);
    expect(result.keyCount).toBe(2);
  });

  it("normalizes a date through the module and surfaces ambiguity", () => {
    const result = dateSourceNormalizer.run({ value: "01/02/2026" }, context) as { valid: boolean; ambiguous?: boolean; alternativeIso?: string };
    expect(result.valid).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.alternativeIso).toBe("2026-02-01");
  });

  it("counts domains through the module and reports invalid inputs", () => {
    const result = domainFrequencyCounter.run({ urls: "https://example.org/a\nnot a url" }, context) as { total: number; invalidCount: number };
    expect(result.total).toBe(1);
    expect(result.invalidCount).toBe(1);
  });

  it("builds the evidence table through the module", () => {
    const result = evidenceTableBuilder.run({ records: [{ title: "A", url: "https://example.org/a" }, { foo: 1 }] }, context) as { rowCount: number; emptyRowIndexes: number[] };
    expect(result.rowCount).toBe(2);
    expect(result.emptyRowIndexes).toEqual([2]);
    expect(() => evidenceTableBuilder.run({}, context)).toThrow("INVALID_INPUT");
  });

  it("deduplicates notes through the module", () => {
    const result = notesDeduplicator.run({ notes: "prima\nPRIMA\nseconda" }, context) as { removed: number; records: string[] };
    expect(result.removed).toBe(1);
    expect(result.records).toEqual(["prima", "seconda"]);
  });

  it("formats a PDF page citation through the module", () => {
    const result = pdfPageCitationHelper.run({ author: "A. Rossi", title: "Uno studio", year: "2026", pages: "12--15", style: "mla" }, context) as { citation: string };
    expect(result.citation).toBe('A. Rossi. "Uno studio." 2026, pp. 12–15.');
    expect(() => pdfPageCitationHelper.run({ author: "A", title: "T", year: "2026", pages: "15-12" }, context)).toThrow("INVALID_INPUT:pages");
  });

  it("deduplicates a reading list through the module", () => {
    const result = readingListDeduplicator.run({ records: [{ isbn: "0-306-40615-2" }, { isbn: "978-0-306-40615-7" }] }, context) as { removed: number };
    expect(result.removed).toBe(1);
  });

  it("sorts references through the module with an honest result shape", () => {
    const result = referenceListSorter.run({ records: [{ title: "Zeta", author: "Ada Rossi", year: "2020" }, { title: "Alfa", author: "Ada Smith", year: "2019" }], order: "author" }, context) as Record<string, unknown>;
    expect((result.records as Array<{ title: string }>).map((record) => record.title)).toEqual(["Zeta", "Alfa"]);
    expect(result).not.toHaveProperty("duplicates");
    expect(result).not.toHaveProperty("removed");
    expect(result.comparator).not.toBe("");
    expect((result.original as unknown[]).length).toBe(2);
  });

  it("creates a verifiable pack manifest through the module", () => {
    const result = researchPackManifest.run({ name: "Ricerca di base", tools: "quote-counter\ndoi-normalizer\nquote-counter" }, context) as { tools: string[]; checksum: string; canonicalPayload: string };
    expect(result.tools).toEqual(["doi-normalizer", "quote-counter"]);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(sha256HexUtf8(result.canonicalPayload)).toBe(result.checksum);
    expect(() => researchPackManifest.run({ name: "Vuoto", tools: "" }, context)).toThrow("INVALID_INPUT:tools");
    expect(() => researchPackManifest.run({ name: "Maiuscole", tools: "Quote-Counter" }, context)).toThrow("INVALID_INPUT:tool");
  });

  it("converts between RIS and BibTeX through the module in both directions", () => {
    const toBibtex = risBibtexConverter.run({ text: "TY  - JOUR\nTI  - T\nPY  - 2026\nER  - \n" }, context) as { bibtex: string; direction: string };
    expect(toBibtex.direction).toBe("ris-to-bibtex");
    expect(toBibtex.bibtex).toContain("title = {T}");
    const toRis = risBibtexConverter.run({ text: "@article{a, title = {T}, pages = {12--15}}", direction: "bibtex-to-ris" }, context) as { ris: string };
    expect(toRis.ris).toContain("SP  - 12");
    expect(() => risBibtexConverter.run({ text: "x", direction: "sideways" }, context)).toThrow("INVALID_INPUT");
  });

  it("analyzes vocabulary through the module and fails closed on non-string stopwords", () => {
    const result = vocabularyFrequencyAnalyzer.run({ text: "il gatto", minLength: "1", limit: "10" }, context) as { terms: Array<{ term: string }> };
    expect(result.terms.map((term) => term.term)).toEqual(["gatto"]);
    expect(() => vocabularyFrequencyAnalyzer.run({ text: "a", stopwords: [1] }, context)).toThrow("INVALID_INPUT:stopwords");
    expect(() => vocabularyFrequencyAnalyzer.run({ text: "a", stopwords: "beta" }, context)).toThrow("INVALID_INPUT");
  });

  it("reports the engine version and refuses empty required text", () => {
    for (const [tool, run] of [
      ["bibtex-formatter", () => bibtexFormatter.run({ text: "   " }, context)],
      ["vocabulary-frequency-analyzer", () => vocabularyFrequencyAnalyzer.run({}, context)],
      ["date-source-normalizer", () => dateSourceNormalizer.run({ value: "" }, context)],
    ] as const) {
      expect(() => run()).toThrow("INVALID_INPUT");
      expect(tool).not.toBe("");
    }
    expect((vocabularyFrequencyAnalyzer.run({ text: "gatto" }, context) as { engineVersion: string }).engineVersion).toBe(RESEARCH_KNOWLEDGE_ENGINE_VERSION);
  });

  it("propagates the abort signal before doing any work", () => {
    const controller = new AbortController();
    controller.abort();
    try {
      bibtexFormatter.run({ text: "@article{a,title={T}}" }, context, controller.signal);
      expect.unreachable("an aborted run must not produce a result");
    } catch (error) {
      expect((error as Error).name).toBe("AbortError");
    }
  });
});

describe("research-knowledge input coercion", () => {
  it("keeps scalar and single-record citation inputs", () => {
    expect(parseCitationRecords("42")).toEqual([{ value: "42" }]);
    expect(parseCitationRecords(42)).toEqual([{ value: "42" }]);
    expect(parseCitationRecords({ title: "A" })).toEqual([{ title: "A" }]);
    expect(parseCitationRecords([{ title: "A" }, null, 7])).toEqual([{ title: "A" }, { value: "7" }]);
    expect(parseCitationRecords("")).toEqual([]);
  });

  it("never treats an inherited object property as a RIS tag or BibTeX field", () => {
    const document = parseRisDocument("TY  - JOUR\nconstructor  - x\nER  - \n");
    expect(document.unknownTags).toEqual([]);
    expect(parseBibtexDocument("@article{a, title = {T}, constructor = {x}}").entries[0]?.fields.constructor).toBe("x");
  });

  it("bounds a single oversized input", () => {
    expect(() => parseBibtexDocument("@article{a,".padEnd(3 * 1024 * 1024, " "))).toThrow("INPUT_TOO_LARGE");
  });
});
