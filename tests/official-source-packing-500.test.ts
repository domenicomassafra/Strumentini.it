import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import geographyEvidence from "../quality/reference-data/italy/115-administrative-geography-evidence.json";
import dateEvidence from "../quality/reference-data/italy/115-situas-date-exact-20261010-evidence.json";
import anprEvidence from "../quality/reference-data/italy/115-anpr-historical-supplement-evidence.json";

const root = resolve(import.meta.dirname, "..");
const sources = [
  ...geographyEvidence.artifacts,
  ...geographyEvidence.frozenOfficialBulkArtifacts,
  ...dateEvidence.sources,
  ...dateEvidence.metadata,
  ...anprEvidence.artifacts,
];

describe("#500 official inputs retain their original bytes and immutable source hashes", () => {
  it("recovers every pinned source without network access and keeps XLSX in its native ZIP format", () => {
    expect(sources).toHaveLength(13);
    for (const { path, sha256 } of sources) {
      const logicalPath = resolve(root, path);
      const isWorkbook = path.endsWith(".xlsx");
      const packedPath = isWorkbook ? logicalPath : `${logicalPath}.gz`;
      expect(existsSync(packedPath), `missing pinned source: ${path}`).toBe(true);
      if (!isWorkbook) expect(existsSync(logicalPath), `unpacked duplicate: ${path}`).toBe(false);

      const compressed = readFileSync(packedPath);
      const original = isWorkbook ? compressed : gunzipSync(compressed);
      expect(`sha256:${createHash("sha256").update(original).digest("hex")}`, path).toBe(sha256);
      if (!isWorkbook) expect(compressed.length, `gzip larger than original: ${path}`).toBeLessThan(original.length);
    }
  });

  it("keeps the three canonical normalized snapshots byte-for-byte identical", () => {
    for (const expected of [
      geographyEvidence.normalizedLocalPack,
      dateEvidence.normalized,
      anprEvidence.normalizedSupplement,
    ]) {
      const bytes = readFileSync(resolve(root, expected.path));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`, expected.path).toBe(expected.sha256);
    }
  });
});
