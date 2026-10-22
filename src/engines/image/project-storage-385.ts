import {
  normalizeImageTransformState,
  transformPreflight,
  type ImageTransformState,
} from "./transform-workspace";

const DATABASE = "strumentini-image-projects-385";
const STORE = "projects";
const SCHEMA = "image-transform-project";
const MAX_PROJECTS = 8;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_NAME = 120;

export type ImageProjectErrorCode385 =
  | "INVALID_PROJECT" | "UNSUPPORTED_SCHEMA" | "STORAGE_UNAVAILABLE"
  | "STORAGE_FULL" | "PROJECT_CHANGED" | "PROJECT_NOT_FOUND";

export class ImageProjectError385 extends Error {
  constructor(readonly code: ImageProjectErrorCode385) {
    super(code);
    this.name = "ImageProjectError385";
  }
}

export interface ImageProjectReference385 {
  readonly id: string;
  readonly revision: number;
  readonly name: string;
}

export interface ImageProjectOpen385 extends ImageProjectReference385 {
  readonly original: File;
  readonly width: number;
  readonly height: number;
  readonly transform: ImageTransformState;
}

interface StoredProject385 extends ImageProjectReference385 {
  readonly schema: typeof SCHEMA;
  readonly version: 1;
  readonly original: Blob;
  readonly originalName: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly transform: ImageTransformState;
}

function record(value: unknown): StoredProject385 {
  const fail = (): never => { throw new ImageProjectError385("UNSUPPORTED_SCHEMA"); };
  if (!value || typeof value !== "object") return fail();
  const raw = value as Record<string, unknown>;
  if (raw.schema !== SCHEMA || raw.version !== 1) return fail();
  if (typeof raw.id !== "string" || !/^[a-f\d-]{36}$/i.test(raw.id) ||
      !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1 ||
      typeof raw.name !== "string" || raw.name.length === 0 || raw.name.length > MAX_NAME ||
      typeof raw.originalName !== "string" || raw.originalName.length === 0 || raw.originalName.length > 255 ||
      !(raw.original instanceof Blob) || raw.original.size === 0 || raw.original.size > MAX_SOURCE_BYTES ||
      typeof raw.mime !== "string" || !["image/png", "image/jpeg", "image/webp"].includes(raw.mime) ||
      raw.original.type !== raw.mime) return fail();
  const check = transformPreflight(raw.original.size, Number(raw.width) * Number(raw.height));
  if (!Number.isInteger(raw.width) || !Number.isInteger(raw.height) || check.state === "unsupported") return fail();
  let transform: ImageTransformState;
  try {
    transform = normalizeImageTransformState(raw.transform as ImageTransformState, raw.width as number, raw.height as number);
    if (JSON.stringify(transform) !== JSON.stringify(raw.transform)) return fail();
  } catch { return fail(); }
  return { ...(raw as unknown as StoredProject385), transform };
}

function storageError(error: unknown): ImageProjectError385 {
  if (error instanceof ImageProjectError385) return error;
  if (error instanceof DOMException && error.name === "QuotaExceededError") return new ImageProjectError385("STORAGE_FULL");
  return new ImageProjectError385("STORAGE_UNAVAILABLE");
}

async function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new ImageProjectError385("STORAGE_UNAVAILABLE");
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => reject(new ImageProjectError385("STORAGE_UNAVAILABLE"));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function listImageProjects385(): Promise<ImageProjectReference385[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const results = tx.objectStore(STORE).getAll();
      let entries: ImageProjectReference385[] = [];
      let failure: ImageProjectError385 | undefined;
      results.onsuccess = () => {
        try {
          entries = results.result.map((value: unknown) => {
            const item = record(value);
            return { id: item.id, revision: item.revision, name: item.name };
          });
        } catch (error) {
          failure = storageError(error);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(entries);
      tx.onerror = () => reject(failure ?? storageError(tx.error));
      tx.onabort = () => reject(failure ?? storageError(tx.error));
    });
  } finally { db.close(); }
}

export async function openImageProject385(id: string): Promise<ImageProjectOpen385> {
  const db = await database();
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(id);
      let value: unknown;
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(storageError(tx.error));
      tx.onabort = () => reject(storageError(tx.error));
    });
    if (raw === undefined) throw new ImageProjectError385("PROJECT_NOT_FOUND");
    const item = record(raw);
    if (item.id !== id) throw new ImageProjectError385("UNSUPPORTED_SCHEMA");
    return {
      id, revision: item.revision, name: item.name,
      original: new File([item.original], item.originalName, { type: item.mime }),
      width: item.width, height: item.height, transform: item.transform,
    };
  } finally { db.close(); }
}

/** Explicit opt-in only; a single readwrite transaction protects existing bytes. */
export async function saveImageProject385(input: {
  readonly name: string;
  readonly original: File;
  readonly width: number;
  readonly height: number;
  readonly transform: ImageTransformState;
  readonly previous?: ImageProjectReference385;
}): Promise<ImageProjectReference385> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME || !input.original.name || input.original.name.length > 255 ||
      !["image/png", "image/jpeg", "image/webp"].includes(input.original.type) ||
      input.original.size === 0 || input.original.size > MAX_SOURCE_BYTES ||
      transformPreflight(input.original.size, input.width * input.height).state === "unsupported") {
    throw new ImageProjectError385("INVALID_PROJECT");
  }
  let transform: ImageTransformState;
  try { transform = normalizeImageTransformState(input.transform, input.width, input.height); }
  catch { throw new ImageProjectError385("INVALID_PROJECT"); }
  const id = input.previous?.id ?? crypto.randomUUID();
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      let failure: ImageProjectError385 | undefined;
      let saved: ImageProjectReference385 | undefined;
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE, "readwrite"); }
      catch (error) { reject(storageError(error)); return; }
      const store = tx.objectStore(STORE);
      const fail = (code: ImageProjectErrorCode385) => {
        failure = new ImageProjectError385(code);
        tx.abort();
      };
      tx.oncomplete = () => saved ? resolve(saved) : reject(new ImageProjectError385("STORAGE_UNAVAILABLE"));
      tx.onerror = () => reject(failure ?? storageError(tx.error));
      tx.onabort = () => reject(failure ?? storageError(tx.error));
      const found = store.get(id);
      found.onerror = () => fail("STORAGE_UNAVAILABLE");
      found.onsuccess = () => {
        let revision = 1;
        try {
          if (found.result === undefined) {
            if (input.previous !== undefined) { fail("PROJECT_CHANGED"); return; }
          } else {
            const old = record(found.result);
            if (!input.previous || old.revision !== input.previous.revision) { fail("PROJECT_CHANGED"); return; }
            revision = old.revision + 1;
          }
          const item: StoredProject385 = {
            schema: SCHEMA, version: 1, id, revision, name,
            original: input.original.slice(0, input.original.size, input.original.type),
            originalName: input.original.name, mime: input.original.type,
            width: input.width, height: input.height, transform,
          };
          saved = { id, revision, name };
          if (found.result === undefined) {
            const count = store.count();
            count.onsuccess = () => {
              if (count.result >= MAX_PROJECTS) { fail("STORAGE_FULL"); return; }
              try { store.put(item, id); } catch (error) { failure = storageError(error); tx.abort(); }
            };
            count.onerror = () => fail("STORAGE_UNAVAILABLE");
          } else store.put(item, id);
        } catch (error) { failure = storageError(error); tx.abort(); }
      };
    });
  } finally { db.close(); }
}
