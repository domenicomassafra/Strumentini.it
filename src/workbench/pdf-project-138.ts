import { PDFDocument } from "pdf-lib";
import { openSavedPdfDatabase341 } from "./saved-pdf-341";
import { PDF_LIMITS } from "../engines/pdf/types";
import { validatePdfProjectHistory138, type PdfProjectHistory138 } from "../engines/pdf/project-history-138";

const STORE = "projects";
export const PDF_PROJECT_MAX_COUNT_138 = 3;
export const PDF_PROJECT_MAX_TOTAL_138 = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const HASH = /^[a-f0-9]{64}$/u;
const SAFE_NAME = /^[^\\/\u0000-\u001f\u007f]{1,160}\.pdf$/iu;

export interface PdfProjectSummary138 {
  readonly id: string;
  readonly name: string;
  readonly byteLength: number;
  readonly createdAt: string;
}
interface PdfProjectRecord138 extends PdfProjectSummary138 {
  readonly schemaVersion: 1;
  readonly mime: "application/pdf";
  readonly pages: number;
  readonly sha256: string;
  readonly historySha256: string;
  readonly bytes: Uint8Array;
  readonly history: PdfProjectHistory138;
}
export interface PdfProject138 {
  readonly file: File;
  readonly history: PdfProjectHistory138;
  readonly summary: PdfProjectSummary138;
}
function fail(code: string): Error { return new Error("PDF_PROJECT_138_" + code); }
function structurallyValid(value: unknown): value is PdfProjectRecord138 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Partial<PdfProjectRecord138>;
  return r.schemaVersion === 1 && r.mime === "application/pdf" &&
    typeof r.id === "string" && UUID.test(r.id) && typeof r.name === "string" && SAFE_NAME.test(r.name) &&
    Number.isSafeInteger(r.byteLength) && (r.byteLength ?? 0) >= 8 && (r.byteLength ?? Infinity) <= PDF_LIMITS.maxBytes &&
    Number.isSafeInteger(r.pages) && (r.pages ?? 0) >= 1 && (r.pages ?? Infinity) <= PDF_LIMITS.maxPages &&
    typeof r.sha256 === "string" && HASH.test(r.sha256) &&
    typeof r.historySha256 === "string" && HASH.test(r.historySha256) &&
    typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt)) &&
    r.bytes instanceof Uint8Array && r.bytes.byteLength === r.byteLength &&
    r.bytes[0] === 37 && r.bytes[1] === 80 && r.bytes[2] === 68 && r.bytes[3] === 70 && r.bytes[4] === 45 &&
    validatePdfProjectHistory138(r.history, r.pages ?? 0);
}
async function hash(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw fail("HASH_UNAVAILABLE");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return Array.from(digest, (x) => x.toString(16).padStart(2, "0")).join("");
}
function historyBytes(history: PdfProjectHistory138): Uint8Array {
  const encoded = JSON.stringify({ version: history.version, index: history.index,
    states: history.states.map((entry) => ({
      order: [...entry.order], selected: [...entry.selected], mode: entry.mode,
    })) });
  return new TextEncoder().encode(encoded);
}
async function matchesHashes(record: PdfProjectRecord138): Promise<boolean> {
  return (await hash(record.bytes)) === record.sha256 &&
    (await hash(historyBytes(record.history))) === record.historySha256;
}
async function readPdfCount(bytes: Uint8Array): Promise<number> {
  try {
    const pdf = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
    const count = pdf.getPageCount();
    if (!Number.isInteger(count) || count < 1 || count > PDF_LIMITS.maxPages) throw fail("PAGE_LIMIT");
    return count;
  } catch { throw fail("UNSUPPORTED_PDF"); }
}
function summary(r: PdfProjectRecord138): PdfProjectSummary138 {
  return { id: r.id, name: r.name, createdAt: r.createdAt, byteLength: r.byteLength };
}
async function allRecords(): Promise<{ records: readonly unknown[]; exceeded: boolean }> {
  const db = await openSavedPdfDatabase341();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      let records: unknown[] = [];
      const request = tx.objectStore(STORE).getAll(undefined, PDF_PROJECT_MAX_COUNT_138 + 1);
      request.onsuccess = () => { records = request.result; };
      tx.oncomplete = () => resolve({
        records: records.slice(0, PDF_PROJECT_MAX_COUNT_138), exceeded: records.length > PDF_PROJECT_MAX_COUNT_138,
      });
      tx.onerror = () => reject(fail("READ_FAILED"));
      tx.onabort = () => reject(fail("READ_ABORTED"));
    });
  } finally { db.close(); }
}
export async function inspectPdfProjects138(): Promise<{
  items: readonly PdfProjectSummary138[]; unreadableCount: number; limitExceeded: boolean;
}> {
  const { records, exceeded } = await allRecords();
  const items: PdfProjectSummary138[] = [];
  let unreadableCount = 0;
  let used = 0;
  let limitExceeded = exceeded;
  for (const value of records) {
    if (!structurallyValid(value)) { unreadableCount++; continue; }
    if (used + value.byteLength > PDF_PROJECT_MAX_TOTAL_138) { limitExceeded = true; continue; }
    used += value.byteLength;
    if (!(await matchesHashes(value))) { unreadableCount++; continue; }
    items.push(summary(value));
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return { items, unreadableCount, limitExceeded };
}
/** A save is an append-only, explicit project snapshot; never evicts or overwrites user files. */
export async function savePdfProject138(file: File, history: PdfProjectHistory138): Promise<PdfProjectSummary138> {
  if (!(file instanceof File) || !SAFE_NAME.test(file.name) || file.size < 8 || file.size > PDF_LIMITS.maxBytes) {
    throw fail("INVALID_FILE_OR_SIZE");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages = await readPdfCount(bytes);
  if (!validatePdfProjectHistory138(history, pages)) throw fail("INVALID_HISTORY");
  const record: PdfProjectRecord138 = {
    id: crypto.randomUUID(), schemaVersion: 1, mime: "application/pdf",
    name: file.name, createdAt: new Date().toISOString(), byteLength: bytes.byteLength,
    pages, bytes: bytes.slice(), sha256: await hash(bytes),
    historySha256: await hash(historyBytes(history)),
    history: { version: 1, index: history.index,
      states: history.states.map((edit) => ({
        order: [...edit.order], selected: [...edit.selected], mode: edit.mode,
      })) },
  };
  const db = await openSavedPdfDatabase341();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.getAll(undefined, PDF_PROJECT_MAX_COUNT_138 + 1);
      request.onsuccess = () => {
        const rows: unknown[] = request.result;
        if (rows.length >= PDF_PROJECT_MAX_COUNT_138 || rows.some((r) => !structurallyValid(r)) ||
            rows.reduce<number>((n, r) => n + (r as PdfProjectRecord138).byteLength, bytes.byteLength) > PDF_PROJECT_MAX_TOTAL_138) {
          tx.abort();
          return;
        }
        store.add(record);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(fail("WRITE_FAILED"));
      tx.onabort = () => reject(fail("QUOTA_OR_CORRUPT_RECORD"));
    });
  } finally { db.close(); }
  const loaded = await loadPdfProject138(record.id);
  if (!loaded || loaded.file.size !== record.byteLength || loaded.history.index !== record.history.index) {
    throw fail("READBACK_FAILED");
  }
  return summary(record);
}
/** Unknown versions, checksum failures and invalid PDF page counts refuse restore without writes. */
export async function loadPdfProject138(id: string): Promise<PdfProject138 | null> {
  if (!UUID.test(id)) throw fail("INVALID_ID");
  const db = await openSavedPdfDatabase341();
  let found: unknown;
  try {
    found = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => { found = request.result; };
      tx.oncomplete = () => resolve(found);
      tx.onerror = () => reject(fail("READ_FAILED"));
      tx.onabort = () => reject(fail("READ_ABORTED"));
    });
  } finally { db.close(); }
  if (found === undefined) return null;
  if (!structurallyValid(found) || !(await matchesHashes(found))) throw fail("CORRUPT_OR_FUTURE_VERSION");
  if (await readPdfCount(found.bytes) !== found.pages) throw fail("PAGE_COUNT_MISMATCH");
  return {
    file: new File([found.bytes.slice().buffer], found.name, { type: "application/pdf" }),
    history: { version: 1, index: found.history.index, states: found.history.states.map((s) => ({
      order: [...s.order], selected: [...s.selected], mode: s.mode,
    })) },
    summary: summary(found),
  };
}
