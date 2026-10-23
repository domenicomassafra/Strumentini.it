import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createMemoryPersistence } from "../src/persistence/persistence";
import {
  exportEditorProject412, importEditorProject412, loadEditorProject412,
  migratePdfProject138To412, newEditorProject412, openEditorProject412,
  saveEditorProject412,
} from "../src/workbench/editor-project-412";

const pdfId = "11111111-1111-4111-8111-111111111111";
const image = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+r5k8AAAAASUVORK5CYII=",
  "base64",
));

async function checksum(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function legacyPdf() {
  const document = await PDFDocument.create();
  document.addPage([60, 60]);
  const bytes = await document.save();
  const history = { version: 1, index: 0, states: [{ order: [1], selected: [], mode: "reorder" }] };
  return {
    id: pdfId, name: "original.pdf", mime: "application/pdf",
    schemaVersion: 1, createdAt: "2026-10-01T12:00:00.000Z",
    byteLength: bytes.byteLength, pages: 1, bytes, history,
    sha256: await checksum(bytes),
    historySha256: await checksum(new TextEncoder().encode(JSON.stringify(history))),
  };
}

describe("STR-412 versioned PDF and image projects", () => {
  it("migrates the existing PDF #138 v1 snapshot and restores a portable backup without changing the original", async () => {
    const original = await legacyPdf();
    const before = structuredClone(original);
    const migrated = await migratePdfProject138To412(original);
    expect(migrated.version).toBe(2);
    expect(migrated.kind).toBe("pdf");
    expect(migrated.id).toBe(original.id);
    expect(migrated.files[0]?.bytes).toEqual(original.bytes);
    expect(original).toEqual(before);

    const storage = createMemoryPersistence();
    await expect(saveEditorProject412(storage, migrated, false)).rejects.toThrow("CONSENT_REQUIRED");
    expect(await loadEditorProject412(storage, original.id)).toBeNull();
    await saveEditorProject412(storage, migrated, true);
    const reopened = await loadEditorProject412(storage, original.id);
    expect(reopened?.stateBytes).toEqual(migrated.stateBytes);
    expect(reopened?.files[0]?.bytes).toEqual(before.bytes);

    const portable = await exportEditorProject412(reopened);
    const restored = await importEditorProject412(portable);
    expect(restored).toEqual(reopened);
    expect(original).toEqual(before);
  });

  it("roundtrips an image source and editing history through an explicit local save and a portable export", async () => {
    const initial = { initial: { width: 1, height: 1, rotate: 0 }, current: { width: 1, height: 1, rotate: 90 }, past: [] };
    const project = await newEditorProject412({
      kind: "image", state: initial,
      files: [{ role: "source", name: "original.png", mime: "image/png", bytes: image }],
    });
    const storage = createMemoryPersistence();
    const saved = await saveEditorProject412(storage, project, true);
    expect(saved.stateFormat).toBe("image-transform-v1");
    const reopened = await loadEditorProject412(storage, project.id);
    expect(await openEditorProject412(reopened)).toEqual(project);
    expect(await importEditorProject412(await exportEditorProject412(reopened))).toEqual(project);
    expect(JSON.parse(new TextDecoder().decode(reopened?.stateBytes))).toEqual(initial);
    expect(reopened?.files[0]?.bytes).toEqual(image);
  });
});
