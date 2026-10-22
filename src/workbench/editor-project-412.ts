import { unzipSync, zipSync } from "fflate";
import type { PersistenceAdapter } from "../persistence/persistence";

/** Portable projects are opt-in snapshots; migration never mutates the input record. */
export const EDITOR_PROJECT_SCHEMA_412 = "strumentini-editor-project";
export const EDITOR_PROJECT_VERSION_412 = 2;
const PREFIX = "editor-project/412/v2/";
const MAX_FILE = 32 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const MAX_FILES = 12;
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/iu;
const HASH = /^[a-f\d]{64}$/iu;
const SAFE_NAME = /^[^\\/\u0000-\u001f\u007f]{1,160}$/u;
const FORMATS = { pdf: "pdf-history-v1", image: "image-transform-v1" } as const;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/bmp"]);

export type EditorProjectKind412 = keyof typeof FORMATS;
export interface EditorProjectFile412 {
  readonly name: string;
  readonly mime: string;
  readonly role: "source" | "attachment";
  readonly bytes: Uint8Array;
  readonly sha256: string;
}
export interface EditorProject412 {
  readonly schema: typeof EDITOR_PROJECT_SCHEMA_412;
  readonly version: typeof EDITOR_PROJECT_VERSION_412;
  readonly id: string;
  readonly kind: EditorProjectKind412;
  readonly createdAt: string;
  readonly stateFormat: "pdf-history-v1" | "image-transform-v1";
  readonly stateBytes: Uint8Array;
  readonly stateSha256: string;
  readonly files: readonly EditorProjectFile412[];
}
export interface NewEditorProject412 {
  readonly kind: EditorProjectKind412;
  readonly state: unknown;
  readonly files: readonly Pick<EditorProjectFile412, "name" | "mime" | "role" | "bytes">[];
}

function reject(code: string): never { throw new Error(`EDITOR_PROJECT_412_${code}`); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}
function validFile(kind: EditorProjectKind412, file: unknown): file is EditorProjectFile412 {
  if (!object(file) || typeof file.name !== "string" || !SAFE_NAME.test(file.name) ||
      !["source", "attachment"].includes(String(file.role)) ||
      !(file.bytes instanceof Uint8Array) || file.bytes.byteLength < 1 || file.bytes.byteLength > MAX_FILE ||
      typeof file.sha256 !== "string" || !HASH.test(file.sha256)) return false;
  if (typeof file.mime !== "string") return false;
  if (file.mime === "application/pdf") {
    return (kind === "pdf" || file.role === "attachment") && /\.pdf$/iu.test(file.name) &&
      file.bytes.length >= 20 && file.bytes[0] === 37 && file.bytes[1] === 80 &&
      file.bytes[2] === 68 && file.bytes[3] === 70 && file.bytes[4] === 45 &&
      new TextDecoder("ascii").decode(file.bytes.subarray(-256)).includes("%%EOF");
  }
  return (kind === "image" || file.role === "attachment") && IMAGE_MIMES.has(file.mime);
}
function structure(raw: unknown): raw is EditorProject412 {
  if (!object(raw) || raw.schema !== EDITOR_PROJECT_SCHEMA_412 || raw.version !== 2 ||
      typeof raw.id !== "string" || !UUID.test(raw.id) || !validDate(raw.createdAt) ||
      (raw.kind !== "pdf" && raw.kind !== "image") || raw.stateFormat !== FORMATS[raw.kind] ||
      !(raw.stateBytes instanceof Uint8Array) || raw.stateBytes.byteLength < 2 ||
      raw.stateBytes.byteLength > MAX_FILE || typeof raw.stateSha256 !== "string" ||
      !HASH.test(raw.stateSha256) || !Array.isArray(raw.files) ||
      raw.files.length < 1 || raw.files.length > MAX_FILES) return false;
  let sources = 0;
  let total = raw.stateBytes.byteLength;
  for (const file of raw.files) {
    if (!validFile(raw.kind, file)) return false;
    if (file.role === "source") sources++;
    total += file.bytes.byteLength;
    if (total > MAX_TOTAL) return false;
  }
  return sources === 1;
}
async function hash(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) reject("HASH_UNAVAILABLE");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return Array.from(digest, (part) => part.toString(16).padStart(2, "0")).join("");
}
function stateValue(bytes: Uint8Array): unknown {
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!object(value)) reject("INVALID_STATE");
    return value;
  } catch { return reject("INVALID_STATE"); }
}

/** Read and verify all bytes before the editor is allowed to consume the snapshot. */
export async function openEditorProject412(raw: unknown): Promise<EditorProject412> {
  if (!structure(raw)) reject("UNSUPPORTED_SCHEMA_OR_MISSING_FILES");
  if (await hash(raw.stateBytes) !== raw.stateSha256) reject("STATE_HASH_MISMATCH");
  stateValue(raw.stateBytes);
  for (const file of raw.files) {
    if (await hash(file.bytes) !== file.sha256) reject("FILE_HASH_MISMATCH");
  }
  return structuredClone(raw);
}

export async function newEditorProject412(input: NewEditorProject412): Promise<EditorProject412> {
  if (input.kind !== "pdf" && input.kind !== "image") reject("UNSUPPORTED_KIND");
  const stateBytes = new TextEncoder().encode(JSON.stringify(input.state));
  const files = await Promise.all(input.files.map(async (file) => ({
    ...file, bytes: file.bytes.slice(), sha256: await hash(file.bytes),
  })));
  return openEditorProject412({
    schema: EDITOR_PROJECT_SCHEMA_412, version: 2, id: crypto.randomUUID(),
    createdAt: new Date().toISOString(), kind: input.kind, stateFormat: FORMATS[input.kind],
    stateBytes, stateSha256: await hash(stateBytes), files,
  });
}

/** The PDF #138 v1 record remains available as backup; no in-place IDB upgrade. */
export async function migratePdfProject138To412(raw: unknown): Promise<EditorProject412> {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.mime !== "application/pdf" ||
      typeof raw.id !== "string" || !UUID.test(raw.id) || !validDate(raw.createdAt) ||
      typeof raw.name !== "string" || !(raw.bytes instanceof Uint8Array) ||
      raw.byteLength !== raw.bytes.byteLength || typeof raw.sha256 !== "string" ||
      !HASH.test(raw.sha256) || typeof raw.historySha256 !== "string" ||
      !HASH.test(raw.historySha256) || !object(raw.history) ||
      raw.history.version !== 1 || !Array.isArray(raw.history.states) ||
      !Number.isSafeInteger(raw.history.index) || (raw.history.index as number) < 0 ||
      (raw.history.index as number) >= raw.history.states.length ||
      !Number.isSafeInteger(raw.pages) || (raw.pages as number) < 1) reject("INVALID_LEGACY_PDF");
  const history = raw.history;
  const states = (history.states as unknown[]).map((entry) => {
    if (!object(entry) || !Array.isArray(entry.order) || !Array.isArray(entry.selected) ||
        typeof entry.mode !== "string") reject("INVALID_LEGACY_PDF");
    return { order: [...entry.order], selected: [...entry.selected], mode: entry.mode };
  });
  const stateBytes = new TextEncoder().encode(JSON.stringify({
    version: 1, index: history.index, states,
  }));
  if (await hash(raw.bytes) !== raw.sha256 || await hash(stateBytes) !== raw.historySha256) {
    reject("INVALID_LEGACY_HASH");
  }
  const migrated = await newEditorProject412({
    kind: "pdf",
    state: { version: 1, index: history.index, states },
    files: [{ name: raw.name, mime: "application/pdf", role: "source", bytes: raw.bytes }],
  });
  return { ...migrated, id: raw.id, createdAt: raw.createdAt };
}

/** Only an explicit caller action persists. Existing snapshots are never overwritten. */
export async function saveEditorProject412(
  storage: PersistenceAdapter, candidate: unknown, optIn: boolean,
): Promise<EditorProject412> {
  if (!optIn) reject("CONSENT_REQUIRED");
  const project = await openEditorProject412(candidate);
  const key = PREFIX + project.id;
  if (!storage.add) reject("ATOMIC_INSERT_UNAVAILABLE");
  if ((await storage.get<unknown>(key)) !== undefined) reject("ALREADY_EXISTS");
  try { await storage.add(key, project); }
  catch { return reject("INSERT_REJECTED"); }
  const verified = await loadEditorProject412(storage, project.id);
  if (verified === null) reject("READBACK_MISSING");
  return verified;
}

export async function loadEditorProject412(
  storage: PersistenceAdapter, id: string,
): Promise<EditorProject412 | null> {
  if (!UUID.test(id)) reject("INVALID_ID");
  const raw = await storage.get<unknown>(PREFIX + id);
  return raw === undefined ? null : openEditorProject412(raw);
}

/** A portable ZIP uses the existing fflate dependency and includes original source bytes. */
export async function exportEditorProject412(raw: unknown): Promise<Uint8Array> {
  const project = await openEditorProject412(raw);
  const manifest = {
    ...project, stateBytes: undefined, files: project.files.map(({ bytes: _bytes, ...file }, i) => ({
      ...file, path: `files/${i}`,
    })),
  };
  const entries: Record<string, Uint8Array> = {
    "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)),
    "state.json": project.stateBytes,
  };
  project.files.forEach((file, i) => { entries[`files/${i}`] = file.bytes; });
  return zipSync(entries, { level: 0 });
}

export async function importEditorProject412(zip: Uint8Array): Promise<EditorProject412> {
  if (!(zip instanceof Uint8Array) || zip.byteLength > MAX_TOTAL + 1024 * 1024) reject("ARCHIVE_TOO_LARGE");
  let count = 0;
  let total = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, { filter(entry) {
      count++;
      total += entry.originalSize;
      if (count > MAX_FILES + 2 || total > MAX_TOTAL + 1024 * 1024) reject("ARCHIVE_LIMIT");
      return true;
    } });
  } catch { return reject("INVALID_ARCHIVE"); }
  const manifestBytes = entries["manifest.json"];
  const stateBytes = entries["state.json"];
  if (!manifestBytes || !stateBytes || manifestBytes.byteLength > 32 * 1024) reject("INVALID_MANIFEST");
  let manifest: unknown;
  try { manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)); }
  catch { return reject("INVALID_MANIFEST"); }
  if (!object(manifest) || !Array.isArray(manifest.files)) reject("INVALID_MANIFEST");
  const files = manifest.files.map((value: unknown, i: number) => {
    if (!object(value) || value.path !== `files/${i}`) reject("INVALID_MANIFEST");
    return { ...value, bytes: entries[`files/${i}`] };
  });
  if (Object.keys(entries).length !== files.length + 2) reject("EXTRA_ARCHIVE_FILES");
  return openEditorProject412({ ...manifest, files, stateBytes });
}
