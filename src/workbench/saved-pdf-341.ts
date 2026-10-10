import type { OutputArtifactDescriptor } from "../runtime/output-artifact";

/** #341: deliberately separate from account favorites and generic Workbench state. */
export const SAVED_PDF_DB_341 = "strumentini-optin-pdf-341";
const STORE = "pdf";
export const SAVED_PDF_MAX_FILE_341 = 8 * 1024 * 1024;
export const SAVED_PDF_MAX_TOTAL_341 = 24 * 1024 * 1024;
export const SAVED_PDF_MAX_COUNT_341 = 5;

export interface SavedPdfSummary341 {
  readonly id: string;
  readonly name: string;
  readonly byteLength: number;
  readonly createdAt: string;
}

interface SavedPdfRecord341 extends SavedPdfSummary341 {
  readonly schemaVersion: 1;
  readonly mime: "application/pdf";
  readonly sha256: string;
  readonly bytes: Uint8Array;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_NAME = /^[^\\/\u0000-\u001f\u007f]{1,160}\.pdf$/iu;

function errorCode(message: string): Error { return new Error(`SAVED_PDF_341_${message}`); }
function beginsWithPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 20 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45
    && new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.length - 256))).includes("%%EOF");
}

export function maySavePdf341(artifact: OutputArtifactDescriptor | null | undefined): artifact is OutputArtifactDescriptor {
  return artifact !== null && artifact !== undefined
    && artifact.kind === "pdf" && artifact.mime === "application/pdf"
    && artifact.download.ready && artifact.verification.state === "verified"
    && artifact.verification.verifiedMime === "application/pdf"
    && artifact.bytes instanceof Uint8Array && artifact.byteLength === artifact.bytes.byteLength
    && artifact.byteLength > 0 && artifact.byteLength <= SAVED_PDF_MAX_FILE_341
    && SAFE_NAME.test(artifact.name) && beginsWithPdf(artifact.bytes);
}

function isSavedPdfRecord341(value: unknown): value is SavedPdfRecord341 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const r = value as Partial<SavedPdfRecord341>;
  return r.schemaVersion === 1 && r.mime === "application/pdf"
    && typeof r.id === "string" && UUID.test(r.id) && typeof r.name === "string" && SAFE_NAME.test(r.name)
    && Number.isSafeInteger(r.byteLength) && (r.byteLength ?? 0) > 0 && (r.byteLength ?? Infinity) <= SAVED_PDF_MAX_FILE_341
    && typeof r.sha256 === "string" && SHA256.test(r.sha256)
    && typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt))
    && r.bytes instanceof Uint8Array && r.bytes.byteLength === r.byteLength && beginsWithPdf(r.bytes);
}

async function checksum(bytes: Uint8Array): Promise<string> {
  if (typeof crypto?.subtle?.digest !== "function") throw errorCode("HASH_UNAVAILABLE");
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return [...result].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(errorCode("STORAGE_UNAVAILABLE")); return; }
    const request = indexedDB.open(SAVED_PDF_DB_341, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(errorCode("STORAGE_DENIED"));
    request.onblocked = () => reject(errorCode("STORAGE_BLOCKED"));
  });
}

async function readAllRecords(): Promise<readonly SavedPdfRecord341[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      let records: readonly SavedPdfRecord341[] = [];
      request.onsuccess = () => {
        const raw: unknown[] = request.result;
        if (raw.length > SAVED_PDF_MAX_COUNT_341 || raw.some((item) => !isSavedPdfRecord341(item))) {
          tx.abort(); reject(errorCode("CORRUPT_RECORDS")); return;
        }
        records = raw as SavedPdfRecord341[];
      };
      tx.oncomplete = () => resolve(records);
      tx.onerror = () => reject(errorCode("READ_FAILED"));
      tx.onabort = () => reject(errorCode("READ_ABORTED"));
    });
  } finally { db.close(); }
}

/** Metadata for explicit local UI. No readback bytes exposed in the list. */
export async function listSavedPdfs341(): Promise<readonly SavedPdfSummary341[]> {
  return (await readAllRecords())
    .map(({ id, name, byteLength, createdAt }) => ({ id, name, byteLength, createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** No overwrite or eviction. Count and byte quota are checked in the same IDB transaction as put. */
export async function savePdf341(artifact: OutputArtifactDescriptor): Promise<SavedPdfSummary341> {
  if (!maySavePdf341(artifact)) throw errorCode("UNVERIFIED_OR_OVERSIZE");
  const record: SavedPdfRecord341 = {
    schemaVersion: 1, id: crypto.randomUUID(), name: artifact.name,
    mime: "application/pdf", byteLength: artifact.byteLength,
    bytes: artifact.bytes.slice(), sha256: await checksum(artifact.bytes),
    createdAt: new Date().toISOString(),
  };
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const raw: unknown[] = request.result;
        if (raw.length >= SAVED_PDF_MAX_COUNT_341 || raw.some((item) => !isSavedPdfRecord341(item)) ||
          raw.reduce((sum: number, item: unknown) => sum + (item as SavedPdfRecord341).byteLength, record.byteLength) > SAVED_PDF_MAX_TOTAL_341) {
          tx.abort(); reject(errorCode("QUOTA_OR_CORRUPT_RECORDS")); return;
        }
        store.add(record);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(errorCode("STORAGE_DENIED"));
      tx.onabort = () => reject(errorCode("QUOTA_OR_STORAGE_DENIED"));
    });
    // Verify exact persisted byte checksum before claiming success.
    const reopened = await loadSavedPdf341(record.id);
    if (reopened === null || reopened.name !== record.name || reopened.size !== record.byteLength) throw errorCode("READBACK_FAILED");
    return { id: record.id, name: record.name, byteLength: record.byteLength, createdAt: record.createdAt };
  } finally { db.close(); }
}

/** Exact bytes only; a failed hash check never returns an untrusted File. */
export async function loadSavedPdf341(id: string): Promise<File | null> {
  if (!UUID.test(id)) return null;
  const db = await openDatabase();
  let raw: unknown;
  try {
    raw = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => { raw = req.result; };
      tx.oncomplete = () => resolve(raw);
      tx.onerror = () => reject(errorCode("READ_FAILED"));
    });
  } finally { db.close(); }
  if (raw === undefined) return null;
  if (!isSavedPdfRecord341(raw)) throw errorCode("CORRUPT_RECORD");
  if ((await checksum(raw.bytes)) !== raw.sha256) throw errorCode("HASH_MISMATCH");
  return new File([raw.bytes.slice().buffer], raw.name, { type: "application/pdf" });
}

/** Deletes only this exact saved item after a user-initiated action. */
export async function deleteSavedPdf341(id: string): Promise<void> {
  if (!UUID.test(id)) throw errorCode("UNSAFE_ID");
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(errorCode("DELETE_FAILED"));
    });
  } finally { db.close(); }
}
