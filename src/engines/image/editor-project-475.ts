import type { PersistenceAdapter } from "../../persistence/persistence";
import {
  loadEditorProject412,
  newEditorProject412,
  saveEditorProject412,
} from "../../workbench/editor-project-412";
import {
  commitImageProject385,
  createImageProjectHistory385,
  type ImageProjectHistory385,
} from "./project-history-385";
import type { ImageProjectOpen385 } from "./project-storage-385";
import {
  IMAGE_TRANSFORM_HISTORY_LIMIT,
  defaultImageTransformState,
  normalizeImageTransformState,
  type ImageTransformState,
} from "./transform-workspace";

export interface ImageSnapshotReference475 {
  readonly id: string;
  readonly name: string;
  readonly version: 2;
}
export interface ImageSnapshotOpen475 extends ImageSnapshotReference475 {
  readonly original: File;
  readonly width: number;
  readonly height: number;
  readonly history: ImageProjectHistory385;
}
export interface ImageSnapshotInput475 {
  readonly name: string;
  readonly original: File;
  readonly width: number;
  readonly height: number;
  readonly history: ImageProjectHistory385;
}

const KEY_PREFIX = "editor-project/412/v2/";
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateHistory(value: unknown, width: number, height: number): ImageProjectHistory385 {
  if (!isRecord(value) || !Array.isArray(value.past) || !Array.isArray(value.future) ||
    value.past.length > IMAGE_TRANSFORM_HISTORY_LIMIT ||
    value.future.length > IMAGE_TRANSFORM_HISTORY_LIMIT) throw new Error("IMAGE_PROJECT_475_INVALID_HISTORY");
  const validate = (raw: unknown): ImageTransformState => {
    if (!isRecord(raw)) throw new Error("IMAGE_PROJECT_475_INVALID_TRANSFORM");
    try {
      const normalized = normalizeImageTransformState(raw as unknown as ImageTransformState, width, height);
      if (JSON.stringify(raw) !== JSON.stringify(normalized)) throw new Error("IMAGE_PROJECT_475_INVALID_TRANSFORM");
      return normalized;
    } catch { throw new Error("IMAGE_PROJECT_475_INVALID_TRANSFORM"); }
  };
  return {
    initial: validate(value.initial),
    current: validate(value.current),
    past: value.past.map(validate),
    future: value.future.map(validate),
  };
}

function validateInput(input: ImageSnapshotInput475) {
  const name = input.name.trim();
  if (!name || name.length > 120 || !IMAGE_MIMES.has(input.original.type) ||
    input.original.size < 1 || input.original.size > 20 * 1024 * 1024 ||
    !input.original.name || input.original.name.length > 160 ||
    !Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height)) {
    throw new Error("IMAGE_PROJECT_475_INVALID_INPUT");
  }
  const history = validateHistory(input.history, input.width, input.height);
  return { name, history };
}

/** A save always creates a new verified v2 snapshot; old v1 and v2 records remain immutable. */
export async function saveImageSnapshot475(
  storage: PersistenceAdapter, input: ImageSnapshotInput475,
): Promise<ImageSnapshotReference475> {
  const { name, history } = validateInput(input);
  const project = await newEditorProject412({
    kind: "image",
    state: { version: 1, name, width: input.width, height: input.height, history },
    files: [{
      name: input.original.name, mime: input.original.type, role: "source",
      bytes: new Uint8Array(await input.original.arrayBuffer()),
    }],
  });
  const saved = await saveEditorProject412(storage, project, true);
  return { id: saved.id, name, version: 2 };
}

/** Verify state, source asset and transform history before handing anything to the UI. */
export async function loadImageSnapshot475(
  storage: PersistenceAdapter, id: string,
): Promise<ImageSnapshotOpen475 | null> {
  const project = await loadEditorProject412(storage, id);
  if (!project) return null;
  if (project.kind !== "image") throw new Error("IMAGE_PROJECT_475_INVALID_KIND");
  const file = project.files.find((entry) => entry.role === "source");
  if (!file || !IMAGE_MIMES.has(file.mime)) throw new Error("IMAGE_PROJECT_475_INVALID_SOURCE");
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(project.stateBytes)); }
  catch { throw new Error("IMAGE_PROJECT_475_INVALID_STATE"); }
  if (!isRecord(value) || value.version !== 1 || typeof value.name !== "string" ||
    !value.name.trim() || value.name.length > 120 ||
    !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height)) {
    throw new Error("IMAGE_PROJECT_475_UNSUPPORTED_STATE");
  }
  const width = value.width as number;
  const height = value.height as number;
  const history = validateHistory(value.history, width, height);
  return {
    id: project.id, version: 2, name: value.name,
    original: new File([file.bytes.slice().buffer], file.name, { type: file.mime }),
    width, height, history,
  };
}

export async function listImageSnapshots475(storage: PersistenceAdapter): Promise<{
  items: ImageSnapshotReference475[];
  unreadableCount: number;
}> {
  if (!storage.keys) throw new Error("IMAGE_PROJECT_475_INDEX_UNAVAILABLE");
  const keys = await storage.keys(KEY_PREFIX);
  const items: ImageSnapshotReference475[] = [];
  let unreadableCount = 0;
  for (const key of keys) {
    try {
      const project = await loadEditorProject412(storage, key.slice(KEY_PREFIX.length));
      if (project?.kind !== "image") continue;
      const reopened = await loadImageSnapshot475(storage, project.id);
      if (reopened) items.push({ id: reopened.id, name: reopened.name, version: 2 });
    } catch { unreadableCount++; }
  }
  return { items, unreadableCount };
}

/** Legacy #144 is read-only until the user explicitly saves a new v2 snapshot. */
export function openLegacyImage475(project: ImageProjectOpen385): ImageSnapshotOpen475 {
  const history = commitImageProject385(
    createImageProjectHistory385(defaultImageTransformState(project.width, project.height)),
    project.transform,
  );
  return {
    id: project.id, name: project.name, version: 2,
    original: project.original, width: project.width, height: project.height, history,
  };
}
