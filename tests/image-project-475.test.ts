import { describe, expect, it } from "vitest";
import { createMemoryPersistence } from "../src/persistence/persistence";
import { newEditorProject412, saveEditorProject412 } from "../src/workbench/editor-project-412";
import { createImageProjectHistory385, commitImageProject385, undoImageProject385 } from "../src/engines/image/project-history-385";
import { defaultImageTransformState } from "../src/engines/image/transform-workspace";
import { listImageSnapshots475, loadImageSnapshot475, openLegacyImage475, saveImageSnapshot475 } from "../src/engines/image/editor-project-475";

const original = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+r5k8AAAAASUVORK5CYII=", "base64"));
const freshHistory = () => createImageProjectHistory385(defaultImageTransformState(1, 1));

describe("STR-412 image editor v2 save and restore", () => {
  it("restores original bytes and undo/redo after reload from shared persistence", async () => {
    const storage = createMemoryPersistence();
    const start = freshHistory();
    const edited = commitImageProject385(start, { ...start.current, rotate: 90 });
    const history = undoImageProject385(edited);
    const file = new File([original], "origin.png", { type: "image/png" });
    const saved = await saveImageSnapshot475(storage, { name: "Rotazione", original: file, width: 1, height: 1, history });
    const reopened = await loadImageSnapshot475(storage, saved.id);
    expect(reopened?.name).toBe("Rotazione");
    expect(new Uint8Array(await reopened!.original.arrayBuffer())).toEqual(original);
    expect(reopened?.history).toEqual(history);
    expect(reopened?.history.future[0]?.rotate).toBe(90);
    expect(await listImageSnapshots475(storage)).toEqual({ items: [saved], unreadableCount: 0 });
    const second = await saveImageSnapshot475(storage, { name: "Nuova versione", original: file, width: 1, height: 1, history: edited });
    expect(second.id).not.toBe(saved.id);
    const preserved = await loadImageSnapshot475(storage, saved.id);
    expect(preserved?.history).toEqual(history);
    expect(new Uint8Array(await preserved!.original.arrayBuffer())).toEqual(original);
  });

  it("opens v1 image projects without editing the legacy record and saves a separate v2 copy", async () => {
    const storage = createMemoryPersistence();
    const transform = { ...freshHistory().current, rotate: 180 as const };
    const legacy = {
      id: "11111111-1111-4111-8111-111111111111", revision: 3, name: "Old work",
      original: new File([original], "legacy.png", { type: "image/png" }),
      width: 1, height: 1, transform,
    };
    const before = { ...legacy, originalBytes: new Uint8Array(await legacy.original.arrayBuffer()) };
    const opened = openLegacyImage475(legacy);
    expect(opened.history.current.rotate).toBe(180);
    expect(opened.history.past).toHaveLength(1);
    const saved = await saveImageSnapshot475(storage, opened);
    expect(saved.id).not.toBe(legacy.id);
    expect(await loadImageSnapshot475(storage, saved.id)).toMatchObject({ name: "Old work", history: opened.history });
    expect(legacy.id).toBe(before.id);
    expect(legacy.revision).toBe(before.revision);
    expect(new Uint8Array(await legacy.original.arrayBuffer())).toEqual(before.originalBytes);
  });

  it("refuses invalid state and absent source without replacing prior snapshots", async () => {
    const storage = createMemoryPersistence();
    const file = new File([original], "origin.png", { type: "image/png" });
    const first = await saveImageSnapshot475(storage, { name: "Intatto", original: file, width: 1, height: 1, history: freshHistory() });
    const before = await loadImageSnapshot475(storage, first.id);
    await expect(saveImageSnapshot475(storage, { name: "", original: file, width: 1, height: 1, history: freshHistory() })).rejects.toThrow();
    const forged = await newEditorProject412({ kind: "image", state: { version: 42, name: "Future", width: 1, height: 1, history: freshHistory() }, files: [{ name: file.name, mime: file.type, role: "source", bytes: original }] });
    await saveEditorProject412(storage, forged, true);
    await expect(loadImageSnapshot475(storage, forged.id)).rejects.toThrow();
    const after = await loadImageSnapshot475(storage, first.id);
    expect(after?.history).toEqual(before?.history);
    expect(new Uint8Array(await after!.original.arrayBuffer())).toEqual(original);
  });
});
