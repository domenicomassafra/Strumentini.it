/** Generate genuine on-disk PDFs for reproducible independent forensic review.
 * Run: tsx scripts/generate-pdf-malicious-237.ts
 * No production files, registry, release receipts or network calls.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  byteRangeSource237, complexRasterSource237, coveredRecoverableSource237,
  decompressionGeometryBomb237, hybridReference237, incrementalRevision237, orphanSignatureSource237,
} from "../tests/fixtures/pdf-redaction-malicious-237";

const destination = resolve(import.meta.dirname, "../tests/fixtures/pdf-redaction-malicious-237");
const fixtures = {
  "covered-orphan-237.pdf": coveredRecoverableSource237(),
  "incremental-prev-237.pdf": incrementalRevision237(),
  "hybrid-xrefstm-237.pdf": hybridReference237(),
  "fake-signed-byte-range-237.pdf": byteRangeSource237(),
  "orphan-signature-no-acroform-237.pdf": orphanSignatureSource237(),
  "complex-smask-form-237.pdf": complexRasterSource237(),
  "complex-rotate-90-237.pdf": complexRasterSource237(90),
  "complex-rotate-180-237.pdf": complexRasterSource237(180),
  "complex-rotate-270-237.pdf": complexRasterSource237(270),
  "image-geometry-bomb-237.pdf": decompressionGeometryBomb237(),
} as const;

await mkdir(destination, { recursive: true });
for (const [filename, bytes] of Object.entries(fixtures)) {
  await writeFile(resolve(destination, filename), bytes);
  console.log(`${filename}: ${bytes.length} B`);
}
