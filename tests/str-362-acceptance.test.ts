import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { detectLocalFile } from "../src/runtime/file-detection";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { planVerifiedDownload339 } from "../src/runtime/download-policy-339";

const cases = [
  { label: "Photos", fixture: "image-metadata/synthetic-1x1-rgb.png", name: "foto.png", mime: "image/png", kind: "image", format: "png" },
  { label: "Files", fixture: "pdf-gold/simple-2page.pdf", name: "documento.pdf", mime: "application/pdf", kind: "pdf", format: "pdf" },
] as const;
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("STR-362 file → verified result → download bytes", () => {
  it.each(cases)("$label retains original bytes and independently reopens a verified result", async (entry) => {
    const source = readFileSync(new URL("../quality/fixtures/" + entry.fixture, import.meta.url));
    const input = new File([new Uint8Array(source)], entry.name, { type: entry.mime });
    expect(await detectLocalFile(input)).toMatchObject({ status: "supported", format: entry.format });
    const decoded = entry.kind === "image"
      ? await sharp(source).metadata()
      : await PDFDocument.load(source);
    expect(entry.kind === "image" ? "width" in decoded && decoded.width! > 0 : "getPageCount" in decoded && decoded.getPageCount() === 2).toBe(true);

    const result = createOutputArtifactDescriptor({
      kind: entry.kind, name: entry.name, mime: entry.mime, bytes: new Uint8Array(source),
      verification: { state: "verified", verifiedMime: entry.mime, method: "independent parser readback" },
      fidelity: "lossless", fidelityNote: "Fixture bytes preserved without transformation.",
    });
    const plan = planVerifiedDownload339(result);
    expect(plan.allowed).toBe(true);
    if (!plan.allowed) return;
    expect(plan.filename).toBe(entry.name);
    expect(plan.mime).toBe(entry.mime);
    expect(sha(plan.bytes)).toBe(sha(source));
    expect(sha(new Uint8Array(await input.arrayBuffer()))).toBe(sha(source));
  });
});
