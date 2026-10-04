import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { friendlyToolErrorIt } from "../src/i18n/it/errors";
import { filePrivacyErrorIt } from "../src/components/tools/file-privacy/FilePrivacyTool";
import { holidayConfig } from "../src/components/tools/date-time/configs";
import { archiveChecksumManifest, batchRenamePreview, FilePrivacyError, folderCompare, inspectMetadataRisk } from "../src/engines/file-privacy";
import { lookupPublicHolidays } from "../src/engines/date-time";
import { estimateReadingTime, generateSampleData, languageStatistics, normalizeQuotes } from "../src/engines/text-writing";

const FIXTURES = new URL("../quality/fixtures/", import.meta.url);
const readFixture = (family: string): Record<string, never> => JSON.parse(readFileSync(new URL(`${family}/vectors.json`, FIXTURES), "utf8")) as Record<string, never>;

const MIME: Readonly<Record<string, string>> = {
  ".zip": "application/zip",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

interface FixtureFile {
  readonly name: string;
  readonly base64: string;
  readonly type?: string;
}

function fileOf(fixture: FixtureFile): File {
  const extension = fixture.name.slice(fixture.name.lastIndexOf("."));
  return new File([Buffer.from(fixture.base64, "base64")], fixture.name, { type: fixture.type ?? MIME[extension] ?? "application/octet-stream" });
}

function filesOf(files: readonly FixtureFile[]): File[] {
  return files.map(fileOf);
}

function errorCode(run: () => unknown): string {
  try {
    run();
    return "NO_THROW";
  } catch (error) {
    if (error instanceof FilePrivacyError) return error.code;
    return error instanceof Error ? error.message.split(":")[0] ?? error.message : String(error);
  }
}

async function asyncErrorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "NO_THROW";
  } catch (error) {
    if (error instanceof FilePrivacyError) return error.code;
    return error instanceof Error ? error.message.split(":")[0] ?? error.message : String(error);
  }
}

describe("archive checksum manifest — independent fixture vectors", () => {
  it("hashes hand-assembled ZIP archives and lists their central directory", async () => {
    const fixture = readFixture("archive-checksum-manifest");
    for (const vector of fixture.vectors as unknown as Array<{ id: string; input: { files: FixtureFile[] }; expected: Record<string, unknown> }>) {
      const result = await archiveChecksumManifest({ files: filesOf(vector.input.files) }) as unknown as Record<string, unknown>;
      const expected = vector.expected;
      expect(result.operation, vector.id).toBe(expected.operation);
      if (typeof expected.sha256 === "string") expect(result.sha256, vector.id).toBe(expected.sha256);
      if (expected.manifest !== undefined) expect(result.manifest, vector.id).toBe(expected.manifest);
      if (expected.entryCount !== undefined) expect(result.entryCount, vector.id).toBe(expected.entryCount);
      if (expected.entryPaths !== undefined) {
        expect((result.entries as Array<{ path: string }>).map((entry) => entry.path), vector.id).toEqual(expected.entryPaths);
      }
      if (expected.count !== undefined) {
        expect(result.count, vector.id).toBe(expected.count);
        expect(result.totalBytes, vector.id).toBe(expected.totalBytes);
      }
      if (typeof expected.sha256 === "object") {
        for (const [path, digest] of Object.entries(expected.sha256 as Record<string, string>)) {
          expect((result.entries as Array<{ path: string; sha256: string }>).find((entry) => entry.path === path)?.sha256, `${vector.id}:${path}`).toBe(digest);
        }
      }
      // A non-archive selection must never relabel itself as another tool.
      expect(result.operation, vector.id).toBe("archive-checksum-manifest");
    }
  });

  it("rejects an empty selection and an unrecognised archive", async () => {
    expect(await asyncErrorCode(() => archiveChecksumManifest({ files: [] }))).toBe("INVALID_INPUT");
    expect(await asyncErrorCode(() => archiveChecksumManifest({ files: [fileOf({ name: "rotto.zip", base64: "bm90LWEtemlw" })] }))).toBe("CORRUPT_ARCHIVE");
  });
});

describe("batch rename preview — independent fixture vectors", () => {
  it("previews collision-safe names without ever producing a directory tree", async () => {
    const fixture = readFixture("batch-rename-plan");
    for (const vector of fixture.vectors as unknown as Array<{ id: string; input: { names: string[] }; expected: { renamed: string[]; changedCount: number; collisionCount: number } }>) {
      const result = batchRenamePreview(vector.input) as unknown as { entries: Array<{ renamed: string }>; changedCount: number; collisionCount: number };
      expect(result.entries.map((entry) => entry.renamed), vector.id).toEqual(vector.expected.renamed);
      expect(result.changedCount, vector.id).toBe(vector.expected.changedCount);
      expect(result.collisionCount, vector.id).toBe(vector.expected.collisionCount);
      for (const entry of result.entries) {
        expect(entry.renamed.includes("/"), `${vector.id}: separator in ${entry.renamed}`).toBe(false);
        expect(entry.renamed.includes("\\"), `${vector.id}: separator in ${entry.renamed}`).toBe(false);
      }
      expect(new Set(result.entries.map((entry) => entry.renamed.toLocaleLowerCase("en-US"))).size, vector.id).toBe(result.entries.length);
    }
  });

  it("keeps the declared default pattern and reports the declared errors", async () => {
    expect((batchRenamePreview({ names: ["foto.png"] }) as unknown as { pattern: string }).pattern).toBe("{name}{ext}");
    const fixture = readFixture("batch-rename-plan");
    for (const vector of fixture.errors as unknown as Array<{ id: string; input: unknown; code: string }>) {
      expect(errorCode(() => batchRenamePreview(vector.input)), vector.id).toBe(vector.code);
    }
  });

  it("never compounds a collision suffix", () => {
    const many = Array.from({ length: 6 }, () => "foto.png");
    const result = batchRenamePreview({ names: many }) as unknown as { entries: Array<{ renamed: string }> };
    expect(result.entries.map((entry) => entry.renamed)).toEqual(["foto.png", "foto-2.png", "foto-3.png", "foto-4.png", "foto-5.png", "foto-6.png"]);
  });
});

describe("folder compare — independent fixture vectors", () => {
  it("diffs two bounded selections by sanitised relative path", async () => {
    const fixture = readFixture("folder-compare-diff");
    for (const vector of fixture.vectors as unknown as Array<{ id: string; input: { before: FixtureFile[]; after: FixtureFile[]; compareHashes: boolean }; expected: Record<string, unknown> }>) {
      const result = await folderCompare({ before: filesOf(vector.input.before), after: filesOf(vector.input.after), compareHashes: vector.input.compareHashes }) as unknown as Record<string, unknown>;
      expect(result.operation, vector.id).toBe(vector.expected.operation);
      for (const key of ["addedCount", "removedCount", "changedCount", "unchangedCount", "comparedBytes"]) {
        if (vector.expected[key] !== undefined) expect(result[key], `${vector.id}:${key}`).toBe(vector.expected[key]);
      }
      if (vector.expected.differences !== undefined) {
        expect((result.differences as Array<{ path: string; status: string }>).map((row) => `${row.path}:${row.status}`), vector.id).toEqual((vector.expected.differences as Array<{ path: string; status: string }>).map((row) => `${row.path}:${row.status}`));
      }
    }
  });

  it("uses SHA-256 for same-size files and fails closed on an empty side", async () => {
    const fixture = readFixture("folder-compare-diff") as unknown as { errors: Array<{ id: string; input: { before: FixtureFile[]; after: FixtureFile[] }; code: string }>; vectors: Array<{ id: string; input: { before: FixtureFile[]; after: FixtureFile[]; compareHashes: boolean } }> };
    const sameSize = fixture.vectors.find((vector) => vector.id === "hash-detection-when-size-matches");
    if (sameSize === undefined) throw new Error("hash-detection-when-size-matches vector is missing");
    const hashed = await folderCompare({ before: filesOf(sameSize.input.before), after: filesOf(sameSize.input.after), compareHashes: true }) as unknown as { changedCount: number; differences: Array<{ status: string }> };
    const sized = await folderCompare({ before: filesOf(sameSize.input.before), after: filesOf(sameSize.input.after), compareHashes: false }) as unknown as { changedCount: number };
    expect(sized.changedCount).toBe(0);
    expect(hashed.changedCount).toBe(1);
    expect(hashed.differences[0]?.status).toBe("changed");
    for (const vector of fixture.errors as unknown as Array<{ id: string; input: { before: FixtureFile[]; after: FixtureFile[] }; code: string }>) {
      expect(await asyncErrorCode(() => folderCompare({ before: filesOf(vector.input.before), after: filesOf(vector.input.after) })), vector.id).toBe(vector.code);
    }
  });

  it("refuses two selections whose names sanitise to the same relative path", async () => {
    const before = [fileOf({ name: "CON.txt", base64: "YQ==" })];
    const after = [fileOf({ name: "CON.txt", base64: "Yg==" }), fileOf({ name: "_CON.txt", base64: "Yw==" })];
    expect(await asyncErrorCode(() => folderCompare({ before, after }))).toBe("INVALID_INPUT");
  });
});

describe("metadata risk inspector — independent fixture vectors", () => {
  it("reads the real JPEG, PNG and PDF metadata containers", async () => {
    const fixture = readFixture("metadata-risk-scan");
    for (const vector of fixture.vectors as unknown as Array<{ id: string; input: { files: FixtureFile[] }; expected: { detectedMime: string; metadataContainers: string[]; metadataFields: string[]; scanCoverage: string; riskMarkers: string[]; riskCount: number } }>) {
      const result = await inspectMetadataRisk({ files: filesOf(vector.input.files) }) as unknown as { files: Array<Record<string, unknown>> };
      const row = result.files[0];
      expect(row?.detectedMime, vector.id).toBe(vector.expected.detectedMime);
      expect(row?.metadataContainers, vector.id).toEqual(vector.expected.metadataContainers);
      expect(row?.metadataFields, vector.id).toEqual(vector.expected.metadataFields);
      expect(row?.scanCoverage, vector.id).toBe(vector.expected.scanCoverage);
      expect(row?.riskCount, vector.id).toBe(vector.expected.riskCount);
      for (const marker of vector.expected.riskMarkers) {
        expect((row?.risks as string[]).some((risk) => risk.toLocaleLowerCase("en-US").includes(marker.toLocaleLowerCase("en-US"))), `${vector.id}:${marker}`).toBe(true);
      }
    }
  });

  it("reports an encrypted archive as not inspectable and never claims a clean file it could not read", async () => {
    const encryptedPdf = fileOf({ name: "cifrato.pdf", base64: Buffer.from("%PDF-1.7\n1 0 obj<</Encrypt 9 0 R>>endobj\n%%EOF\n", "utf8").toString("base64") });
    const result = await inspectMetadataRisk({ files: [encryptedPdf] }) as unknown as { files: Array<{ risks: string[]; metadataContainers: string[] }> };
    expect(result.files[0]?.metadataContainers).toContain("encrypted");
    expect(result.files[0]?.risks.some((risk) => risk.includes("encrypted"))).toBe(true);
    const unreadable = fileOf({ name: "vuoto.txt", base64: "" });
    const empty = await inspectMetadataRisk({ files: [unreadable] }) as unknown as { files: Array<{ riskCount: number }> };
    expect(empty.files[0]?.riskCount).toBe(1);
  });

  it("rejects an empty selection with the documented code", async () => {
    expect(await asyncErrorCode(() => inspectMetadataRisk({ files: [] }))).toBe("INVALID_INPUT");
  });
});

describe("public holiday lookup — independent fixture vectors", () => {
  it("matches hand-worked published calendars for four countries", () => {
    const fixture = readFixture("holiday-calendar") as unknown as {
      vectors: Array<{ id: string; input: { country: string; year: number }; expected: { country: string; source: string; holidays: Array<Record<string, unknown>> } }>;
      errors: Array<{ id: string; input: { country: string; year: number }; code: string }>;
    };
    for (const vector of fixture.vectors) {
      const result = lookupPublicHolidays(vector.input.country, vector.input.year);
      expect(result.country, vector.id).toBe(vector.expected.country);
      expect(result.source, vector.id).toBe(vector.expected.source);
      expect(result.holidays, vector.id).toEqual(vector.expected.holidays as never);
      // Two holidays can never share a date in one country's year.
      expect(new Set(result.holidays.map((holiday) => holiday.date)).size, vector.id).toBe(result.holidays.length);
    }
    for (const vector of fixture.errors) {
      expect(errorCode(() => lookupPublicHolidays(vector.input.country, vector.input.year)), vector.id).toBe(vector.code);
    }
  });

  it("applies each country's declared substitute rule to every substitute day", () => {
    const days = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
    for (let year = 2019; year <= 2035; year += 1) {
      for (const country of ["IT", "US", "CA", "GB"]) {
        for (const holiday of lookupPublicHolidays(country, year).holidays) {
          const label = `${country} ${year} ${holiday.date}`;
          if (!holiday.observed) continue;
          expect(days(holiday.date), label).not.toBe(0);
          expect(days(holiday.date), label).not.toBe(6);
          const actualDate = holiday.actualDate;
          expect(actualDate, label).toBeDefined();
          if (actualDate === undefined) continue;
          const actualWeekday = days(actualDate);
          if (country === "US") {
            // The federal in-lieu-of rule: Saturday -> preceding Friday, Sunday -> next Monday.
            expect([0, 6], label).toContain(actualWeekday);
            expect(days(holiday.date), label).toBe(actualWeekday === 6 ? 5 : 1);
          } else {
            // UK and Canada take the next free working day, which can be a
            // weekday already claimed by an earlier holiday (Boxing Day after a
            // weekend Christmas), so only the direction and the weekday hold.
            expect(holiday.date > actualDate, label).toBe(true);
          }
        }
      }
      for (const country of ["IT", "US", "CA", "GB"]) {
        const dates = lookupPublicHolidays(country, year).holidays.map((holiday) => holiday.date);
        expect(new Set(dates).size, `${country} ${year} duplicate dates`).toBe(dates.length);
      }
      expect(lookupPublicHolidays("IT", year).holidays.some((holiday) => holiday.observed), `IT ${year}`).toBe(false);
    }
  });

  it("marks the non-statutory civic day and never substitutes an Italian holiday", () => {
    const canada = lookupPublicHolidays("CA", 2024).holidays;
    expect(canada.find((holiday) => holiday.name === "Festa civica")?.statutory).toBe(false);
    expect(lookupPublicHolidays("IT", 2027).holidays.every((holiday) => holiday.observed)).toBe(false);
    expect(lookupPublicHolidays("IT", 2027).holidays).toHaveLength(11);
  });
});

describe("text-writing local jobs — independent fixture vectors", () => {
  it("estimates reading time with a bounded, internally consistent rate", () => {
    const fixture = readFixture("text-writing-local-jobs") as unknown as {
      reading_time: { vectors: Array<{ id: string; input: { text: string; wordsPerMinute?: number }; expected: Record<string, unknown> }>; errors: Array<{ id: string; input: unknown; code: string }> };
    };
    for (const vector of fixture.reading_time.vectors) {
      const result = estimateReadingTime(vector.input) as unknown as Record<string, number | string>;
      for (const [key, value] of Object.entries(vector.expected)) expect(result[key], `${vector.id}:${key}`).toBe(value);
      expect(result.seconds as number, `${vector.id}: consistency`).toBeLessThanOrEqual((result.minutes as number) * 60);
    }
    for (const vector of fixture.reading_time.errors) {
      expect(errorCode(() => estimateReadingTime(vector.input)), vector.id).toBe(vector.code);
    }
  });

  it("normalizes quotes idempotently in both directions", () => {
    const fixture = readFixture("text-writing-local-jobs") as unknown as {
      smart_quotes: { vectors: Array<{ id: string; input: { text: string; direction: "straight-to-curly" | "curly-to-straight" }; expected: Record<string, unknown> }>; errors: Array<{ id: string; input: unknown; code: string }> };
    };
    for (const vector of fixture.smart_quotes.vectors) {
      const result = normalizeQuotes(vector.input) as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(vector.expected)) expect(result[key], `${vector.id}:${key}`).toBe(value);
      const again = normalizeQuotes({ text: result.output as string, direction: vector.input.direction }) as unknown as Record<string, unknown>;
      expect(again.output, `${vector.id}: idempotence`).toBe(result.output);
      expect(again.convertedCount, `${vector.id}: second pass`).toBe(0);
    }
    expect((normalizeQuotes({ text: normalizeQuotes({ text: "\"a'b\"" }).output, direction: "curly-to-straight" }) as unknown as Record<string, string>).output).toBe("\"a'b\"");
    for (const vector of fixture.smart_quotes.errors) {
      expect(errorCode(() => normalizeQuotes(vector.input)), vector.id).toBe(vector.code);
    }
  });

  it("generates deterministic sample data with three distinct text layouts", () => {
    const fixture = readFixture("text-writing-local-jobs") as unknown as {
      sample_data: { vectors: Array<{ id: string; type: string; count: number; seed: number; rows: string[]; data: string }>; errors: Array<{ id: string; input: unknown; code: string }> };
    };
    for (const vector of fixture.sample_data.vectors) {
      const input = { type: vector.type, count: vector.count, seed: vector.seed };
      const result = generateSampleData(input) as unknown as Record<string, unknown>;
      expect(result.rows, `${vector.id}:rows`).toEqual(vector.rows);
      expect(result.data, `${vector.id}:data`).toBe(vector.data);
      expect(result.seed, `${vector.id}:seed`).toBe(vector.seed);
      expect((generateSampleData(input) as unknown as Record<string, unknown>).data, `${vector.id}:determinism`).toBe(vector.data);
      // Generated addresses must never resolve: the reserved .test TLD is used.
      if (vector.type === "emails" || vector.type === "rows") expect(String(result.data), vector.id).toContain("@example.test");
    }
    const layouts = ["lorem", "paragraphs", "sentences"].map((type) => (generateSampleData({ type, count: 2, seed: 3 }) as unknown as Record<string, string>).data);
    expect(new Set(layouts).size).toBe(3);
    expect((generateSampleData({ type: "rows", count: 3, seed: 1 }) as unknown as Record<string, string>).data).toBe((generateSampleData({ type: "rows", count: 3, seed: 99 }) as unknown as Record<string, string>).data);
    for (const vector of fixture.sample_data.errors) {
      expect(errorCode(() => generateSampleData(vector.input)), vector.id).toBe(vector.code);
    }
  });

  it("counts scripts without punctuation and identically for composed and decomposed text", () => {
    const fixture = readFixture("text-writing-local-jobs") as unknown as {
      language_statistics: { vectors: Array<{ id: string; input: { text: string }; expected: { dominantScript: string; language: string; scripts: Array<{ script: string; codePoints: number }>; confidence: string } }>; errors: Array<{ id: string; input: unknown; code: string }> };
    };
    for (const vector of fixture.language_statistics.vectors) {
      const result = languageStatistics(vector.input) as unknown as Record<string, unknown>;
      expect(result.dominantScript, `${vector.id}:dominant`).toBe(vector.expected.dominantScript);
      expect(result.language, `${vector.id}:language`).toBe(vector.expected.language);
      expect((result.scripts as Array<{ script: string; codePoints: number }>).map((row) => ({ script: row.script, codePoints: row.codePoints })), `${vector.id}:scripts`).toEqual(vector.expected.scripts);
      expect(result.confidence, `${vector.id}:confidence`).toBe(vector.expected.confidence);
      // `Other` only ever holds digits or letters of scripts the tool does not
      // name; a named language must never report one.
      if (vector.expected.language !== "und") expect((result.scripts as Array<{ script: string }>).some((row) => row.script === "Other"), `${vector.id}:punctuation is never a script`).toBe(false);
    }
    const composed = fixture.language_statistics.vectors.find((vector) => vector.id === "composed-counterpart")?.input.text ?? "";
    const decomposed = fixture.language_statistics.vectors.find((vector) => vector.id === "decomposed-combining-marks")?.input.text ?? "";
    expect(decomposed).not.toBe(composed);
    expect(JSON.stringify((languageStatistics({ text: composed }) as unknown as Record<string, unknown>).scripts)).toBe(JSON.stringify((languageStatistics({ text: decomposed }) as unknown as Record<string, unknown>).scripts));
    expect(JSON.stringify((languageStatistics({ text: "Ciao, mondo!" }) as unknown as Record<string, unknown>).scripts)).toBe(JSON.stringify((languageStatistics({ text: "Ciao mondo" }) as unknown as Record<string, unknown>).scripts));
    for (const vector of fixture.language_statistics.errors) {
      expect(errorCode(() => languageStatistics(vector.input)), vector.id).toBe(vector.code);
    }
  });
});

describe("Italian error states for the local-jobs tools", () => {
  it("never shows a machine code for a local file failure", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["INVALID_INPUT", "Controlla i dati selezionati"],
      ["FILE_TOO_LARGE", "limite locale"],
      ["TOO_MANY_FILES", "troppi file"],
      ["TEXT_TOO_LARGE", "limite locale"],
      ["CORRUPT_ARCHIVE", "archivio"],
      ["UNSUPPORTED_ARCHIVE", "non supporta"],
      ["ARCHIVE_TOO_LARGE", "limite locale"],
      ["UNSAFE_ARCHIVE_PATH", "cartella superiore"],
      ["HASH_FAILED", "SHA-256"],
      ["IO_FAILED", "leggere"],
      ["CANCELLED", "annullata"],
      ["UNSUPPORTED_INPUT", "non è supportato"],
    ];
    for (const [code, fragment] of cases) {
      const message = filePrivacyErrorIt(new FilePrivacyError(code as never, "internal detail"));
      expect(message, code).toContain(fragment);
      expect(message, code).not.toContain(code);
      expect(message, code).not.toContain("internal detail");
    }
    expect(filePrivacyErrorIt(new FilePrivacyError("SOMETHING_NEW" as never, "x"))).not.toContain("SOMETHING_NEW");
    expect(filePrivacyErrorIt(new Error("boom"))).toBe("L'operazione locale non è riuscita. Controlla i dati e riprova.");
  });

  it("explains the text-writing and date-time codes in Italian", () => {
    expect(friendlyToolErrorIt("INVALID_SAMPLE_TYPE: unknown")).toContain("tipo di dati di esempio");
    expect(friendlyToolErrorIt("INVALID_QUOTE_DIRECTION: sideways")).toContain("direzione di conversione");
    expect(friendlyToolErrorIt("INVALID_WORDS_PER_MINUTE: 0")).toContain("parole al minuto");
    expect(friendlyToolErrorIt("INVALID_YEAR: 1899")).toContain("1900");
    expect(friendlyToolErrorIt("INVALID_COUNTRY: ZZ")).toContain("Italia");
    for (const code of ["INVALID_SAMPLE_TYPE", "INVALID_QUOTE_DIRECTION", "INVALID_WORDS_PER_MINUTE", "INVALID_YEAR", "INVALID_COUNTRY"]) {
      expect(friendlyToolErrorIt(code), code).not.toContain(code);
    }
  });

  it("keeps the holiday tool's own Italian message ahead of the shared date-time sentence", () => {
    expect(holidayConfig.errorMessage?.("INVALID_COUNTRY: ZZ")).toContain("Italia");
    expect(holidayConfig.errorMessage?.("INVALID_YEAR: 1899")).toContain("1900");
    expect(holidayConfig.errorMessage?.("INVALID_ICS: x")).toBeUndefined();
  });

  it("declares the reading-rate bounds shown in the form", () => {
    const form = readFileSync(new URL("../src/components/tools/text-writing/TextWritingTool.tsx", import.meta.url), "utf8");
    expect(form).toContain("Lascia vuoto per usare 200 parole al minuto");
    expect(form).toContain("da 1 a 2000");
    expect(estimateReadingTime({ text: "uno" }).wordsPerMinute).toBe(200);
  });
});