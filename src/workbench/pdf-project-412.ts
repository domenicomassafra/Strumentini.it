import { PDFDocument } from "pdf-lib";
import { PDF_LIMITS } from "../engines/pdf/types";
import { validatePdfProjectHistory138, type PdfProjectHistory138 } from "../engines/pdf/project-history-138";
import { createIndexedDbPersistence } from "../persistence/persistence";
import {
  loadEditorProject412, migratePdfProject138To412, newEditorProject412,
  saveEditorProject412, type EditorProject412,
} from "./editor-project-412";
import { loadPdfProject138 } from "./pdf-project-138";
import { openSavedPdfDatabase341 } from "./saved-pdf-341";

const DATABASE = "strumentini-editor-projects-412";
const STORE = "state";
const PREFIX = "editor-project/412/v2/";
const storage = createIndexedDbPersistence({ databaseName: DATABASE, storeName: STORE });
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/iu;

export interface PdfSnapshotSummary412 {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  try {
    const document = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
    const count = document.getPageCount();
    if (count >= 1 && count <= PDF_LIMITS.maxPages) return count;
  } catch { /* Unsupported, encrypted or malformed PDFs must never restore. */ }
  throw new Error("PDF_PROJECT_412_INVALID_SOURCE");
}

async function validatedSource(file: File, history: PdfProjectHistory138): Promise<Uint8Array> {
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") ||
      file.size === 0 || file.size > PDF_LIMITS.maxBytes) throw new Error("PDF_PROJECT_412_INVALID_SOURCE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validatePdfProjectHistory138(history, await pageCount(bytes))) {
    throw new Error("PDF_PROJECT_412_INVALID_HISTORY");
  }
  return bytes;
}

/** Opt-in creates a distinct v2 record, leaving the PDF and v1 snapshots untouched. */
export async function savePdfSnapshot412(file: File, history: PdfProjectHistory138): Promise<EditorProject412> {
  const bytes = await validatedSource(file, history);
  const candidate = await newEditorProject412({
    kind: "pdf", state: history,
    files: [{ name: file.name, mime: "application/pdf", role: "source", bytes }],
  });
  return saveEditorProject412(storage, candidate, true);
}

/** Check legacy schema, checksums, history and actual PDF before add-only migration. */
export async function migrateSavedPdfProject412(id: string): Promise<EditorProject412> {
  if (!UUID.test(id)) throw new Error("PDF_PROJECT_412_INVALID_ID");
  const legacy = await loadPdfProject138(id);
  if (!legacy) throw new Error("PDF_PROJECT_412_LEGACY_NOT_FOUND");
  const db = await openSavedPdfDatabase341();
  let raw: unknown;
  try {
    raw = await new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readonly");
      const req = tx.objectStore("projects").get(id);
      req.onsuccess = () => { raw = req.result; };
      tx.oncomplete = () => resolve(raw);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
  const candidate = await migratePdfProject138To412(raw);
  // The legacy loader already checked pages and hashes: refuse records changed during the read.
  const source = candidate.files.find((entry) => entry.role === "source");
  const legacyBytes = new Uint8Array(await legacy.file.arrayBuffer());
  if (!source || source.bytes.length !== legacyBytes.length ||
      !source.bytes.every((part, i) => part === legacyBytes[i]) ||
      JSON.stringify(JSON.parse(new TextDecoder().decode(candidate.stateBytes))) !== JSON.stringify(legacy.history)) {
    throw new Error("PDF_PROJECT_412_LEGACY_CHANGED");
  }
  return saveEditorProject412(storage, candidate, true);
}

/** No file/history is applied to the editor until all hashes and semantics pass. */
export async function loadPdfSnapshot412(id: string): Promise<{
  file: File; history: PdfProjectHistory138; project: EditorProject412;
} | null> {
  const project = await loadEditorProject412(storage, id);
  if (!project) return null;
  if (project.kind !== "pdf") throw new Error("PDF_PROJECT_412_WRONG_KIND");
  const source = project.files.find((entry) => entry.role === "source");
  if (!source || source.bytes.byteLength > PDF_LIMITS.maxBytes) throw new Error("PDF_PROJECT_412_INVALID_SOURCE");
  const count = await pageCount(source.bytes);
  let state: unknown;
  try { state = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(project.stateBytes)); }
  catch { throw new Error("PDF_PROJECT_412_INVALID_HISTORY"); }
  if (!validatePdfProjectHistory138(state, count)) throw new Error("PDF_PROJECT_412_INVALID_HISTORY");
  return {
    project, history: state,
    file: new File([source.bytes.slice().buffer], source.name, { type: "application/pdf" }),
  };
}

/** Enumerates add-only v2 snapshots; bad/future records remain in place but are not selectable. */
export async function listPdfSnapshots412(): Promise<{
  items: readonly PdfSnapshotSummary412[]; unreadableCount: number;
}> {
  // Opening through the adapter initializes its own object store on a fresh device.
  await storage.get(PREFIX + "inventory");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("PDF_PROJECT_412_STORAGE_BLOCKED"));
  });
  let keys: IDBValidKey[];
  try {
    keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
  const items: PdfSnapshotSummary412[] = [];
  let unreadableCount = 0;
  for (const key of keys) {
    if (typeof key !== "string" || !key.startsWith(PREFIX)) continue;
    try {
      const restored = await loadPdfSnapshot412(key.slice(PREFIX.length));
      if (!restored) continue;
      items.push({ id: restored.project.id, name: restored.file.name, createdAt: restored.project.createdAt });
    } catch { unreadableCount++; }
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return { items, unreadableCount };
}
