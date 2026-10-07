import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readFatturaPaBatch } from "../src/engines/italy";
import fatturaPaReaderManifest from "../src/tools/fatturapa-reader/manifest";
import fatturaPaBatchManifest from "../src/tools/fatturapa-batch-csv/manifest";
import artigianiManifest from "../src/tools/inps-artigiani-commercianti/manifest";
import gestioneManifest from "../src/tools/gestione-separata-contributi/manifest";
import pontiManifest from "../src/tools/ponti-ferie-optimizer/manifest";
import fatturaPaReaderModule from "../src/tools/fatturapa-reader/module";
import fatturaPaBatchModule from "../src/tools/fatturapa-batch-csv/module";
import artigianiModule from "../src/tools/inps-artigiani-commercianti/module";
import gestioneModule from "../src/tools/gestione-separata-contributi/module";
import pontiModule from "../src/tools/ponti-ferie-optimizer/module";
import { parseToolManifest } from "../src/tool-factory";

const root = process.cwd();

function namedBlob(text: string, name: string): Blob {
  const blob = new Blob([text], { type: "application/xml" });
  Object.defineProperty(blob, "name", { configurable: true, enumerable: true, value: name });
  return blob;
}

describe("Italy public consumer routes", () => {
  it("binds every public route to its reserved oracle and shared 2026 fixture family", () => {
    const cases = [
      [fatturaPaReaderManifest, "cand-255", "file"],
      [artigianiManifest, "cand-256", "calculator"],
      [gestioneManifest, "cand-257", "calculator"],
      [pontiManifest, "cand-258", "calculator"],
      [fatturaPaBatchManifest, "cand-259", "batch"],
    ] as const;
    for (const [manifest, oracleEntryId, resultClass] of cases) {
      const parsed = parseToolManifest(manifest);
      expect(parsed.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(parsed.gold.oracleEntryId).toBe(oracleEntryId);
      expect(parsed.gold.fixtureFamilies).toEqual(["italy-2026-consumers"]);
      expect(parsed.result?.class).toBe(resultClass);
      expect(parsed.acceptance).toMatchObject({ independentOracle: true, privacy: true, accessibility: true, bundle: true });
    }
  });

  it("runs contribution and bridge routes through their public tool modules", async () => {
    expect(artigianiModule.run({ year: 2026, profile: "artigiano", incomeEur: "56224", contributionSeniority: "before-1996" }, { defaults: {} })).toMatchObject({
      totalContributionEur: 13501.2,
      firstBandUpperEur: 56224,
    });
    expect(gestioneModule.run({ year: 2026, profile: "professional-no-other-mandatory-pension-coverage", incomeEur: "10000" }, { defaults: {} })).toMatchObject({
      totalContributionEur: 2607,
      belowFullYearCreditMinimum: true,
    });
    expect(pontiModule.run({ year: 2026, leaveDayBudget: 4, workweek: ["MON", "TUE", "WED", "THU", "FRI"], maxResults: 100 }, { defaults: {} })).toMatchObject({
      year: 2026,
      opportunities: expect.arrayContaining([expect.objectContaining({ startDate: "2026-04-04", endDate: "2026-04-12", leaveDaysUsed: 4 })]),
    });
  });

  it("runs the single-reader route from a local Blob and preserves the filename", async () => {
    const xml = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const output = await fatturaPaReaderModule.run({ file: namedBlob(xml, "demo.xml") }, { defaults: {} }) as Record<string, unknown>;
    expect(output).toMatchObject({ filename: "demo.xml", transmissionFormat: "FPR12", xsdVersion: "1.2.3" });
  });

  it("isolates malformed FatturaPA files in a mixed batch and reconciles represented ordinary totals", async () => {
    const ordinary = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const simplified = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"), "utf8");
    const partial = ordinary.replace("<Data>2026-10-06</Data>", "<Data>2026-02-30</Data>");
    const hostile = ordinary.replace("<p:FatturaElettronica", '<!DOCTYPE invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<p:FatturaElettronica');
    const result = readFatturaPaBatch([
      { filename: "ordinary.xml", text: ordinary, bytes: Buffer.byteLength(ordinary) },
      { filename: "simple.xml", text: simplified, bytes: Buffer.byteLength(simplified) },
      { filename: "partial.xml", text: partial, bytes: Buffer.byteLength(partial) },
      { filename: "hostile.xml", text: hostile, bytes: Buffer.byteLength(hostile) },
    ]);
    expect(result).toMatchObject({ fileCount: 4, invoiceRowCount: 4, okFileCount: 2, partialFileCount: 1, errorFileCount: 1, completeExport: true });
    expect(result.rows.find(({ filename }) => filename === "ordinary.xml")).toMatchObject({
      fileStatus: "ok",
      transmissionFormat: "FPR12",
      xsdVersion: "1.2.3",
      documentTotal: "122.00",
      representedGrandTotal: "122.00",
      totalsReconciliation: "matched",
    });
    expect(result.rows.find(({ filename }) => filename === "simple.xml")).toMatchObject({ fileStatus: "ok", transmissionFormat: "FSM10", totalsReconciliation: "unavailable" });
    expect(result.rows.find(({ filename }) => filename === "partial.xml")).toMatchObject({ fileStatus: "partial", fieldErrorCount: 1 });
    expect(result.rows.find(({ filename }) => filename === "hostile.xml")).toMatchObject({ fileStatus: "error", error: expect.stringMatching(/DTD|ENTITY|external entit/iu) });
    expect(result.csv.split("\n")[0]).toContain("filename,fileStatus,bodyIndex,schemaFamily,transmissionFormat,xsdVersion");
    expect(result.csv.split("\n")).toHaveLength(5);
  });

  it("keeps batch preview bounded while the complete CSV contains all invoice rows", async () => {
    const ordinary = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const files = Array.from({ length: 30 }, (_, index) => ({ filename: `invoice-${String(index + 1).padStart(2, "0")}.xml`, text: ordinary, bytes: Buffer.byteLength(ordinary) }));
    const result = readFatturaPaBatch(files);
    expect(result.previewRows).toHaveLength(25);
    expect(result.rows).toHaveLength(30);
    expect(result.csv.split("\n")).toHaveLength(31);
    expect(result.csvBytes).toBe(new TextEncoder().encode(result.csv).byteLength);
  });

  it("runs the public batch module and does not abort after one malformed file", async () => {
    const ordinary = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const output = await fatturaPaBatchModule.run({ files: [namedBlob("not xml", "bad.xml"), namedBlob(ordinary, "good.xml")] }, { defaults: {} }) as { errorFileCount: number; okFileCount: number; rows: Array<{ filename: string }> };
    expect(output.errorFileCount).toBe(1);
    expect(output.okFileCount).toBe(1);
    expect(output.rows.map(({ filename }) => filename)).toEqual(["bad.xml", "good.xml"]);
  });
});
