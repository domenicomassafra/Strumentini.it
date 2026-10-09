/** Frozen, reproducible official ISTAT geography pack (#115).
 * Run: node scripts/build-italy-geography-115.mjs [--check]
 * This script NEVER manufactures codes, infers code reuse or guesses active dates.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readXlsxFile from "read-excel-file/node";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = "quality/reference-data/italy/artifacts/115-administrative-geography";
const files = {
  current: [`${dir}/istat-elenco-comuni-2026-02-21.xlsx`, "83842076860450f7e482daecea6b7a769f5f93d0bf5b0d48802b44896d7a26d5"],
  suppressed: [`${dir}/istat-situas-128-suppressed-2026-10-09.json`, "33242ea1db0dee2e1fc5179b4c0c8757e3be0888d4111088d9865b2ef39c29d7"],
  foreign: [`${dir}/istat-situas-469-foreign-2026-10-09.json`, "9f6076b40e2146cbb452428ec032b0bd8ece696b733a979c1649e4645e98e154"],
};
const bytes = {};
for (const [key, [path, pinnedSha256]] of Object.entries(files)) {
  const buffer = await readFile(resolve(root, path));
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== pinnedSha256) throw new Error(`#115 primary source ${key} SHA256 changed; review required`);
  bytes[key] = buffer;
}

const sheets = await readXlsxFile(resolve(root, files.current[0]));
const worksheet = sheets.find(({ sheet }) => sheet === "CODICI al 21_02_2026")?.data;
if (!worksheet || worksheet[0]?.[20] !== "Codice Catastale del Comune") throw new Error("#115 unexpected ISTAT workbook schema");

const fourChars = (value) => typeof value === "string" && /^[A-Z][0-9]{3}$/u.test(value.trim()) ? value.trim() : null;
const current = worksheet.slice(1).map((row) => {
  const istatCode = row[4];
  const belfiore = fourChars(row[20]);
  if (typeof istatCode !== "string" || !/^[0-9]{6}$/u.test(istatCode) || !belfiore) {
    throw new Error(`#115 current municipality invalid identifier or code: ${istatCode}`);
  }
  return { istatCode, name: row[5], nameItalian: row[6], province: row[14], region: row[10], belfiore };
});

const report = (key) => {
  const parsed = JSON.parse(bytes[key].toString("utf8"));
  if (!Array.isArray(parsed.resultset)) throw new Error(`#115 SITUAS ${key} missing resultset`);
  return parsed.resultset;
};
const suppressed = report("suppressed").map((row, sourceRow) => {
  if (!/^[0-9]{6}$/u.test(row.PRO_COM_T) || !/^\d{4}-\d{2}-\d{2}T/u.test(row.DATA_INIZIO_AMMINISTRATIVA)) {
    throw new Error(`#115 suppressed row ${sourceRow} missing ISTAT id or change date`);
  }
  // COD_CATASTO_REL identifies a related municipality; it must never backfill ND.
  return {
    sourceRow, istatCode: row.PRO_COM_T, name: row.COMUNE,
    belfiore: fourChars(row.COD_CATASTO),
    changeDate: row.DATA_INIZIO_AMMINISTRATIVA.slice(0, 10),
    changeType: row.COD_VARIAZIONE,
    relatedIstatCode: row.PRO_COM_T_REL ?? null,
    relatedName: row.COMUNE_REL,
    relatedBelfiore: fourChars(row.COD_CATASTO_REL),
  };
});
const foreign = report("foreign").map((row) => {
  if (!Number.isInteger(row.CODICE_ISTAT) || typeof row.DENOMINAZIONE_IT !== "string") {
    throw new Error("#115 foreign row missing official id/name");
  }
  return {
    istatCode: row.CODICE_ISTAT, name: row.DENOMINAZIONE_IT,
    type: row.TIPO_PAESE, belfiore: fourChars(row.COD_AT),
    isoAlpha2: row.ISO_3166_ALPHA2 ?? null,
  };
});

const unique = (values) => new Set(values).size;
const missing = suppressed.filter(({ belfiore }) => belfiore === null);
const coverage = {
  currentMunicipalityRows: current.length,
  suppressedEventRows: suppressed.length,
  suppressedRowsWithCode: suppressed.length - missing.length,
  suppressedRowsWithoutCode: missing.length,
  suppressedDistinctMunicipalitiesWithoutCode: unique(missing.map((row) => `${row.istatCode}:${row.name}`)),
  foreignRows: foreign.length,
  foreignRowsWithCode: foreign.filter(({ belfiore }) => belfiore !== null).length,
  foreignRowsWithoutCode: foreign.filter(({ belfiore }) => belfiore === null).length,
};
const expected = [7894, 2637, 2619, 18, 16, 262, 239, 23];
if (JSON.stringify(Object.values(coverage)) !== JSON.stringify(expected)) {
  throw new Error(`#115 unexpected official source coverage: ${JSON.stringify(coverage)}`);
}
if (unique(current.map(({ istatCode }) => istatCode)) !== current.length) throw new Error("#115 duplicate current ISTAT id");
if (unique(foreign.map(({ istatCode }) => istatCode)) !== foreign.length) throw new Error("#115 duplicate foreign ISTAT id");

const snapshot = {
  schemaVersion: 1,
  version: "115-situas-2026-10-09.1",
  checkedAt: "2026-10-09",
  currentMunicipalitiesAsOf: "2026-02-21",
  suppressedMunicipalitiesFrom: "1861-03-17",
  foreignStatesFrom: "1990-01-01",
  sources: Object.fromEntries(Object.entries(files).map(([key, [path, sha256]]) => [key, { path, sha256: `sha256:${sha256}` }])),
  coverage, current, suppressed, foreign,
};
const target = resolve(root, "src/reference-data/italy/geography-115.snapshot.json");
const serialized = JSON.stringify(snapshot) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== serialized) throw new Error("#115 normalized snapshot not reproducible");
  console.log("PASS #115 snapshot reproducible", JSON.stringify(coverage));
} else {
  await writeFile(target, serialized);
  console.log("BUILD #115 snapshot", JSON.stringify(coverage));
}
