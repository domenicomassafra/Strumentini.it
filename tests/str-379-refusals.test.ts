import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPdfProjectHistory138, recordPdfProjectEdit138,
  validatePdfProjectHistory138,
} from "../src/engines/pdf/project-history-138";
import { openSavedPdfDatabase341, SAVED_PDF_DB_341 } from "../src/workbench/saved-pdf-341";
import { deletePdfProject138, inspectPdfProjects138, loadPdfProject138, savePdfProject138 } from "../src/workbench/pdf-project-138";

async function sourcePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 420]);
  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], "progetto.pdf", { type: "application/pdf" });
}

async function rawRecord(storeName: "projects" | "pdf", id: string): Promise<Record<string, unknown> | undefined> {
  const db = await openSavedPdfDatabase341();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function putRawRecord(storeName: "projects" | "pdf", value: Record<string, unknown>): Promise<void> {
  const db = await openSavedPdfDatabase341();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function actualSha(record: Record<string, unknown> | undefined): string {
  expect(record?.bytes).toBeInstanceOf(Uint8Array);
  return createHash("sha256").update(record!.bytes as Uint8Array).digest("hex");
}

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(SAVED_PDF_DB_341);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("test database is still open"));
  });
});

describe("STR-379 PDF project refusals", () => {
  it("rejects unsupported history versions and corrupt edits while preserving source state", () => {
    const source = createPdfProjectHistory138(3);
    const snapshot = structuredClone(source);
    const bad = [
      { ...source, version: 2 },
      { ...source, index: 5 },
      { ...source, states: [{ order: [1, 1, 3], selected: [], mode: "reorder" }] },
      { ...source, states: [{ order: [1, 2, 3], selected: [4], mode: "selected" }] },
      { ...source, states: [{ order: [1, 2, 3], selected: [], mode: "unknown" }] },
      { ...source, states: [] },
    ];
    for (const record of bad) expect(validatePdfProjectHistory138(record, 3)).toBe(false);
    expect(source).toEqual(snapshot);
    expect(validatePdfProjectHistory138(source, 3)).toBe(true);
  });

  it("refuses invalid edits without damaging a valid undo history", () => {
    const source = recordPdfProjectEdit138(createPdfProjectHistory138(3),
      { order: [3, 2, 1], selected: [], mode: "reorder" }, 3);
    const snapshot = structuredClone(source);
    expect(() => recordPdfProjectEdit138(source,
      { order: [1, 2, 2], selected: [], mode: "reorder" }, 3)).toThrow();
    expect(() => recordPdfProjectEdit138(source,
      { order: [1, 2, 3], selected: [1, 1], mode: "selected" }, 3)).toThrow();
    expect(source).toEqual(snapshot);
  });

  it("refuses future and corrupted snapshots through IndexedDB, keeping bytes and legacy PDFs on reopen", async () => {
    const file = await sourcePdf();
    const history = createPdfProjectHistory138(1);
    const valid = await savePdfProject138(file, history);
    const future = await savePdfProject138(file, history);
    await putRawRecord("pdf", { id: "legacy341", sentinel: "unchanged" });
    const before = await rawRecord("projects", future.id);
    const sourceSha = actualSha(before);
    expect(before?.sha256).toBe(sourceSha);
    await putRawRecord("projects", { ...before, schemaVersion: 2 });

    // A new module instance simulates a fresh tab after the previous one closed.
    vi.resetModules();
    const reopened = await import("../src/workbench/pdf-project-138");
    await expect(reopened.loadPdfProject138(future.id)).rejects.toThrow("CORRUPT_OR_FUTURE_VERSION");
    expect(await reopened.inspectPdfProjects138()).toMatchObject({ unreadableCount: 1 });
    expect(actualSha(await rawRecord("projects", future.id))).toBe(sourceSha);
    expect(await rawRecord("projects", future.id)).toMatchObject({ schemaVersion: 2, sha256: sourceSha });
    expect(await rawRecord("pdf", "legacy341")).toMatchObject({ sentinel: "unchanged" });
    expect(actualSha(await rawRecord("projects", valid.id))).toBe(sourceSha);
    expect((await reopened.loadPdfProject138(valid.id))?.history).toEqual(history);

    const corrupt = await rawRecord("projects", valid.id);
    await putRawRecord("projects", { ...corrupt, sha256: "0".repeat(64) });
    await expect(reopened.loadPdfProject138(valid.id)).rejects.toThrow("CORRUPT_OR_FUTURE_VERSION");
    expect(actualSha(await rawRecord("projects", valid.id))).toBe(sourceSha);
    expect(await rawRecord("projects", valid.id)).toMatchObject({ sha256: "0".repeat(64) });
  });

  it("frees only the selected project at the three-snapshot limit without touching other records", async () => {
    const file = await sourcePdf();
    const history = createPdfProjectHistory138(1);
    const first = await savePdfProject138(file, history);
    const middle = await savePdfProject138(file, history);
    const last = await savePdfProject138(file, history);
    const firstSha = actualSha(await rawRecord("projects", first.id));
    const lastSha = actualSha(await rawRecord("projects", last.id));
    await putRawRecord("pdf", { id: "legacy341", sentinel: "preserved" });

    await expect(savePdfProject138(file, history)).rejects.toThrow("QUOTA_OR_CORRUPT_RECORD");
    expect((await inspectPdfProjects138()).items).toHaveLength(3);
    await deletePdfProject138(middle.id);
    expect(await rawRecord("projects", middle.id)).toBeUndefined();
    expect(actualSha(await rawRecord("projects", first.id))).toBe(firstSha);
    expect(actualSha(await rawRecord("projects", last.id))).toBe(lastSha);
    expect(await rawRecord("pdf", "legacy341")).toMatchObject({ sentinel: "preserved" });

    const next = await savePdfProject138(file, history);
    expect((await inspectPdfProjects138()).items).toHaveLength(3);
    expect((await loadPdfProject138(next.id))?.history).toEqual(history);
    await expect(deletePdfProject138("unsafe-id")).rejects.toThrow("INVALID_ID");
    expect(actualSha(await rawRecord("projects", first.id))).toBe(firstSha);
  });
});
