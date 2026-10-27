#!/usr/bin/env node
/** #115: deterministic official SITUAS date-exact snapshot, never date ranges. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readOfficialInput } from "./lib/read-official-input-500.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = "quality/reference-data/italy/artifacts/115-administrative-geography/situas-date-exact-20261010";
const outPath = "src/reference-data/italy/geography-115-date-exact-20261010.snapshot.json";
const specs = [
  { date: "1900-01-01", report: 51, rows: 8262, sha: "bf0686aa6759fbba1f2015d383c95bf86ad7fcb4a0014219b99e8d193be655ee" },
  { date: "1940-01-01", report: 50, rows: 7336, sha: "1088a432bb01e117e12cb944c2b1edc8dd557f9c0dc56419d73e8387abd3fc5d" },
  { date: "2025-01-01", report: 61, rows: 7896, sha: "0e2736d735431949c6f4f7f9951600ff04c61d3667383d9b8505137ea3692cc9" },
  { date: "2026-01-01", report: 61, rows: 7896, sha: "1bb3012a18a539b0c4211df392141f82a243470d57c62cfcda10662f7bfc6e7f" },
];
const metadata = [
  { report: 51, date: "1900-01-01", sha: "aae18dafa33e9a39e9d79609b393926c9d6edacf354aa4e31602307123c27ba6" },
  { report: 50, date: "1940-01-01", sha: "fb5b078deaf50af37be5a00d4ad2ce7d710a0c6212d5be5ace93fc0855b00c20" },
  { report: 61, date: "2025-01-01", sha: "f0517ab7ab612234d4aa51c1a00609047b5eb09d85cbe73525e792656d68d2c9" },
];
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
const readPinned = (path, expectedSha) => {
  const body = readOfficialInput(root, path);
  if (digest(body) !== expectedSha) throw new Error(`SITUAS_OFFICIAL_SOURCE_HASH_MISMATCH: ${path}`);
  return JSON.parse(body.toString("utf8"));
};
const sourceRefs = [];
const snapshotDays = [];
for (const spec of specs) {
  const source = `${artifacts}/situas-${spec.report}-${spec.date}.json`;
  const doc = readPinned(source, spec.sha);
  if (!Array.isArray(doc.resultset) || doc.resultset.length !== spec.rows) throw new Error(`SITUAS_ROWCOUNT_MISMATCH: ${source}`);
  const idSeen = new Set();
  const rows = doc.resultset.map((record, index) => {
    const id = record.PRO_COM_T, name = record.COMUNE, code = record.COD_CATASTO;
    if (typeof id !== "string" || !/^\d{6}$/u.test(id) || typeof name !== "string" || name.length < 1 ||
        typeof code !== "string" || !/^(?:[A-Z][0-9]{3}|ND)$/u.test(code) || idSeen.has(id)) {
      throw new Error(`SITUAS_INVALID_SOURCE_ROW: ${source} row ${index + 1}`);
    }
    idSeen.add(id);
    // Keep original SITUAS row index, never infer missing ND from an adjacent
    // snapshot or official historical names that may refer to another entity.
    return [id, name, code, index] ;
  });
  sourceRefs.push({ report: spec.report, date: spec.date, rows: spec.rows, path: source, sha256: `sha256:${spec.sha}` });
  snapshotDays.push({ report: spec.report, date: spec.date, rows });
}
const metadataRefs = metadata.map((spec) => {
  const source = `${artifacts}/situas-${spec.report}-metadata.json`;
  const parsed = readPinned(source, spec.sha);
  if (parsed["REPORT NAME"] !== "Elenco dei codici e delle denominazioni delle unità territoriali" ||
      typeof parsed["REPORT DESCRIZIONE"] !== "string" || !parsed["REPORT DESCRIZIONE"].includes("data")) {
    throw new Error(`SITUAS_UNEXPECTED_METADATA: ${source}`);
  }
  return { report: spec.report, path: source, sha256: `sha256:${spec.sha}` };
});
const result = {
  schemaVersion: 1,
  version: "115-situas-date-exact-2026-10-10.1",
  checkedAt: "2026-10-10",
  authority: "Istat SITUAS",
  interpretation: "Only four exact official snapshot dates, not historical lifespan intervals",
  sourceRefs,
  metadataRefs,
  days: snapshotDays,
};
const rendered = JSON.stringify(result) + "\n";
const output = resolve(root, outPath);
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("SITUAS_DATE_EXACT_NORMALIZATION_DRIFT");
  console.log(`PASS ${specs.length} snapshot dates verified from official SITUAS SHA-256; output ${digest(Buffer.from(rendered))}`);
} else {
  writeFileSync(output, rendered);
  console.log(`Generated ${specs.length} official SITUAS date snapshots, SHA-256 ${digest(Buffer.from(rendered))}`);
}
