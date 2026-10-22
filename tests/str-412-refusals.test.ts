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
