import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, FDBObjectStore } from "fake-indexeddb";
import {
  openImageProject385,
  saveImageProject385,
} from "../src/engines/image/project-storage-385";
import { defaultImageTransformState } from "../src/engines/image/transform-workspace";

const dbName = "strumentini-image-projects-385";
const initial = defaultImageTransformState(2, 1);
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function input() {
  return { name: "Demo", original: new File([bytes], "original.png", { type: "image/png" }), width: 2, height: 1, transform: initial };
}

async function replaceRaw(id: string, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(value, id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

async function rawValue(id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("projects", "readonly");
      const lookup = tx.objectStore("projects").get(id);
      let value: unknown;
      lookup.onsuccess = () => { value = lookup.result; };
      tx.oncomplete = () => { db.close(); resolve(value); };
    };
    request.onerror = () => reject(request.error);
  });
}

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("STR-385 refusal and original preservation", () => {
  it("persists only after the caller opts in, reopens exact original bytes and state", async () => {
    expect(await new Promise<number>((resolve) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("projects");
      request.onsuccess = () => { const db = request.result; const tx = db.transaction("projects", "readonly"); const count = tx.objectStore("projects").count(); count.onsuccess = () => { db.close(); resolve(count.result); }; };
    })).toBe(0);
    const saved = await saveImageProject385({ ...input(), transform: { ...initial, rotate: 180 } });
    const opened = await openImageProject385(saved.id);
    expect(opened.revision).toBe(1);
    expect(opened.transform.rotate).toBe(180);
    expect([...new Uint8Array(await opened.original.arrayBuffer())]).toEqual([...bytes]);
    const updated = await saveImageProject385({ ...input(), previous: saved, transform: { ...initial, brightness: 25 } });
    expect((await openImageProject385(updated.id)).transform.brightness).toBe(25);
    expect(updated.revision).toBe(2);
  });

  it("refuses old or corrupt schema without overwriting stored bytes", async () => {
    const saved = await saveImageProject385(input());
    const old = { schema: "image-transform-project", version: 0, name: "Vecchio", revision: 1 };
    await replaceRaw(saved.id, old);
    await expect(openImageProject385(saved.id)).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEMA" });
    await expect(saveImageProject385({ ...input(), previous: saved })).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEMA" });
    expect(await rawValue(saved.id)).toEqual(old);
    const corrupt = { schema: "image-transform-project", version: 1, original: "not-a-blob" };
    await replaceRaw(saved.id, corrupt);
    await expect(saveImageProject385({ ...input(), previous: saved })).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEMA" });
    expect(await rawValue(saved.id)).toEqual(corrupt);
  });

  it("refuses stale revisions and full quota without replacing the prior project", async () => {
    const saved = await saveImageProject385(input());
    const next = await saveImageProject385({ ...input(), previous: saved, transform: { ...initial, contrast: 20 } });
    await expect(saveImageProject385({ ...input(), previous: saved })).rejects.toMatchObject({ code: "PROJECT_CHANGED" });
    const before = await rawValue(saved.id);
    vi.spyOn(FDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await expect(saveImageProject385({ ...input(), previous: next, transform: { ...initial, brightness: 30 } })).rejects.toMatchObject({ code: "STORAGE_FULL" });
    expect(await rawValue(saved.id)).toEqual(before);
    expect((await openImageProject385(saved.id)).transform.contrast).toBe(20);
  });

  it("rejects invalid state and oversized input before touching saved data", async () => {
    const saved = await saveImageProject385(input());
    const before = await rawValue(saved.id);
    await expect(saveImageProject385({ ...input(), previous: saved, transform: { ...initial, crop: { x: 99, y: 0, width: 1, height: 1 } } })).rejects.toMatchObject({ code: "INVALID_PROJECT" });
    await expect(saveImageProject385({ ...input(), previous: saved, original: new File([new Uint8Array(21 * 1024 * 1024)], "big.png", { type: "image/png" }) })).rejects.toMatchObject({ code: "INVALID_PROJECT" });
    expect(await rawValue(saved.id)).toEqual(before);
  });
});
