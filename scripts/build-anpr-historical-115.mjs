#!/usr/bin/env node
/** Independent #115 ANPR 2023 government archive normalization, no synthesis. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Papa from "papaparse";
import { readOfficialInput } from "./lib/read-official-input-500.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const csvRel = "quality/reference-data/italy/artifacts/115-administrative-geography/anpr-archivio-comuni-2023-10-03.csv";
const legendRel = "quality/reference-data/italy/artifacts/115-administrative-geography/anpr-archivio-comuni-legenda-2019-v001.md";
const outputRel = "src/reference-data/italy/geography-115-anpr-history.snapshot.json";
const expected = {
  csv: "c86791d240f35861a662db78ba4d48978b844a47b5204a38117fe39c4341edb0",
  legend: "70f12753ac0569627c1a4264cd658ba1ec4c6f89e60268a4d6391e7b03d3bd4a",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const csv = readOfficialInput(root, csvRel);
const legend = readOfficialInput(root, legendRel);
if (sha(csv) !== expected.csv || sha(legend) !== expected.legend) {
  throw new Error("ANPR_SOURCE_HASH_MISMATCH: refusing to normalize changed official bytes");
}
const parsed = Papa.parse(csv.toString("utf8").replace(/^\uFEFF/u, ""), { header: true, skipEmptyLines: true });
if (parsed.errors.length || parsed.data.length !== 19352) {
  throw new Error(`ANPR_CSV_PARSE_FAILED: rows=${parsed.data.length} errors=${parsed.errors.length}`);
}
const date = /^\d{4}-\d{2}-\d{2}$/u;
const municipalities = parsed.data.map((row, i) => {
  const { CODISTAT: istat, CODCATASTALE: code, DENOMINAZIONE_IT: name,
    DATAISTITUZIONE: from, DATACESSAZIONE: to, STATO: state } = row;
  if (!/^\d{6}$/u.test(istat) || !/^(?:[A-Z][0-9]{3}|ND)$/u.test(code)
    || !name || !date.test(from) || !date.test(to) || from > to || !["A", "C"].includes(state)) {
    throw new Error(`ANPR_INVALID_OFFICIAL_ROW: ${i + 2}`);
  }
  // All values are unmodified archival fields. ND is preserved as null only
  // with its explicit original raw value, never filled using a successor.
  return [istat, name, code, from, to, state, i + 2];
});
const result = {
  schemaVersion: 1,
  version: "115-anpr-government-archive-2023-10-03.1",
  publishedArchiveRevision: "ada00dea2b9266f797c72a315db21d68bc64244b",
  lastRepoCommitAt: "2023-10-03",
  license: "CC-BY-4.0",
  sourceSha256: { csv: `sha256:${expected.csv}`, legend: `sha256:${expected.legend}` },
  rows: municipalities,
};
const resultText = JSON.stringify(result) + "\n";
const target = resolve(root, outputRel);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== resultText) throw new Error("ANPR_HISTORICAL_SNAPSHOT_DRIFT");
  console.log(`ANPR historical source check PASS: ${municipalities.length} records; SHA256=${sha(Buffer.from(resultText))}`);
} else {
  writeFileSync(target, resultText);
  console.log(`ANPR historical source generated: ${municipalities.length} records; SHA256=${sha(Buffer.from(resultText))}`);
}
