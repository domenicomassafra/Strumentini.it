import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createMemoryPersistence, type PersistenceAdapter } from "../src/persistence/persistence";
import {
  exportEditorProject412, importEditorProject412, loadEditorProject412,
  newEditorProject412, openEditorProject412, saveEditorProject412,
} from "../src/workbench/editor-project-412";
import { unzipSync, zipSync } from "fflate";

async function fixture() {
  return newEditorProject412({
    kind: "image",
    state: { version: 1, history: ["initial"] },
    files: [{ role: "source", name: "original.png", mime: "image/png", bytes: Uint8Array.of(137, 80, 78, 71) }],
  });
}

describe("STR-412 fail-closed refusal at the persistent project seam", () => {
  it("refuses future schemas, missing source files and checksum changes, preserving the previously saved version", async () => {
    const storage = createMemoryPersistence();
    const original = await fixture();
    await saveEditorProject412(storage, original, true);
    const before = await loadEditorProject412(storage, original.id);
    const variants = [
      { ...original, version: 3 },
      { ...original, files: [] },
      { ...original, files: [{ ...original.files[0], bytes: Uint8Array.of(0, 1, 2, 3) }] },
      { ...original, stateBytes: new TextEncoder().encode('{"version":2}') },
    ];
    for (const bad of variants) {
      await expect(openEditorProject412(bad)).rejects.toThrow("EDITOR_PROJECT_412_");
      await expect(saveEditorProject412(storage, bad, true)).rejects.toThrow("EDITOR_PROJECT_412_");
      expect(await loadEditorProject412(storage, original.id)).toEqual(before);
    }
    await expect(saveEditorProject412(storage, original, true)).rejects.toThrow("ALREADY_EXISTS");
    expect(await loadEditorProject412(storage, original.id)).toEqual(before);
  });

  it("does not destroy original data if the storage write aborts or readback is missing", async () => {
    const storage = createMemoryPersistence();
    const original = await fixture();
    await saveEditorProject412(storage, original, true);
    const before = await loadEditorProject412(storage, original.id);
    const next = await fixture();
    const refused: PersistenceAdapter = {
      get: (key) => storage.get(key),
      put: (key, value) => storage.put(key, value),
      async add() { throw new Error("QuotaExceededError"); },
      delete: (key) => storage.delete(key),
    };
    await expect(saveEditorProject412(refused, next, true)).rejects.toThrow("INSERT_REJECTED");
    expect(await loadEditorProject412(storage, original.id)).toEqual(before);
    expect(await loadEditorProject412(storage, next.id)).toBeNull();
    const silentDrop: PersistenceAdapter = {
      get: (key) => storage.get(key),
      put: (key, value) => storage.put(key, value),
      async add() { /* simulated dropped write */ },
      delete: (key) => storage.delete(key),
    };
    await expect(saveEditorProject412(silentDrop, next, true)).rejects.toThrow("READBACK_MISSING");
    expect(await loadEditorProject412(storage, original.id)).toEqual(before);
  });

  it("refuses concurrent attempts to overwrite an existing project ID", async () => {
    const storage = createMemoryPersistence();
    const original = await fixture();
    const second = await newEditorProject412({
      kind: "image", state: { version: 1, history: ["modified"] },
      files: [{ role: "source", name: "changed.png", mime: "image/png", bytes: Uint8Array.of(137, 80, 78, 71) }],
    });
    const altered = { ...second, id: original.id };
    const outcomes = await Promise.allSettled([
      saveEditorProject412(storage, original, true),
      saveEditorProject412(storage, altered, true),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const reopened = await loadEditorProject412(storage, original.id);
    expect(reopened === null).toBe(false);
    expect([original, altered]).toContainEqual(reopened);
  });

  it("refuses incomplete, future or tampered portable backups without touching persistent snapshots", async () => {
    const storage = createMemoryPersistence();
    const original = await fixture();
    await saveEditorProject412(storage, original, true);
    const before = await loadEditorProject412(storage, original.id);
    const archive = await exportEditorProject412(original);
    const entries = unzipSync(archive);
    const missing = { ...entries };
    delete missing["files/0"];
    await expect(importEditorProject412(zipSync(missing))).rejects.toThrow("EDITOR_PROJECT_412_");
    const futureManifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
    futureManifest.version = 99;
    await expect(importEditorProject412(zipSync({
      ...entries, "manifest.json": new TextEncoder().encode(JSON.stringify(futureManifest)),
    }))).rejects.toThrow("EDITOR_PROJECT_412_");
    await expect(importEditorProject412(zipSync({ ...entries, "files/0": Uint8Array.of(7, 8, 9, 10) })))
      .rejects.toThrow("FILE_HASH_MISMATCH");
    expect(await loadEditorProject412(storage, original.id)).toEqual(before);
  });
});

it("STR-412 PDF: refuses ID collision and a future schema without changing the saved legacy PDF", async () => {
  const { savePdfProject138, loadPdfProject138 } = await import("../src/workbench/pdf-project-138");
  const { createPdfProjectHistory138 } = await import("../src/engines/pdf/project-history-138");
  const { migrateSavedPdfProject412, loadPdfSnapshot412, listPdfSnapshots412 } =
    await import("../src/workbench/pdf-project-412");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage([80, 90]);
  const original = await pdf.save();
  const file = new File([original.slice().buffer], "refuse.pdf", { type: "application/pdf" });
  const history = createPdfProjectHistory138(1);
  const legacy = await savePdfProject138(file, history);
  await migrateSavedPdfProject412(legacy.id);
  await expect(migrateSavedPdfProject412(legacy.id)).rejects.toThrow("ALREADY_EXISTS");
  const initial = await loadPdfSnapshot412(legacy.id);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("strumentini-editor-projects-412", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const key = "editor-project/412/v2/" + legacy.id;
  const raw = await new Promise<any>((resolve, reject) => {
    const req = db.transaction("state", "readonly").objectStore("state").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tampered = { ...raw, version: 3 };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(tampered, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await expect(loadPdfSnapshot412(legacy.id)).rejects.toThrow("UNSUPPORTED_SCHEMA_OR_MISSING_FILES");
  expect((await listPdfSnapshots412()).unreadableCount).toBeGreaterThan(0);
  await expect(migrateSavedPdfProject412(legacy.id)).rejects.toThrow("ALREADY_EXISTS");
  expect((await loadPdfProject138(legacy.id))?.history).toEqual(history);
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(original);
  expect(initial?.history).toEqual(history);
});
