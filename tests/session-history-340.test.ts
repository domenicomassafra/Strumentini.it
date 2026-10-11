import { describe, expect, it, vi } from "vitest";
import { convertTextCase, normalizeWhitespace } from "../src/engines/text-writing";
import { encodeBase64Bytes } from "../src/engines/developer-web/encoding-crypto";
import { createSessionTaskHistory340 } from "../src/workbench/session-history-340";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (value: string) => encoder.encode(value);
const decode = (value: Uint8Array) => decoder.decode(value);

describe("#340 session-only task history", () => {
  it("recovers three real local-engine operations with SHA-256 integrity and independent snapshots", async () => {
    const history = createSessionTaskHistory340();
    const first = history.run({
      toolId: "text-tool", execute: () => encode(normalizeWhitespace({ text: "  abc    " }).output),
    });
    const one = await first.finished;
    expect(one.status).toBe("saved");
    if (one.status !== "saved") return;
    expect(one.receipt.sha256).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

    const second = history.run({
      toolId: "text-tool",
      previous: one.receipt,
      execute: (previous) => encode(convertTextCase({ text: decode(previous!), mode: "upper" }).output),
    });
    const two = await second.finished;
    expect(two.status).toBe("saved");
    if (two.status !== "saved") return;

    const third = history.run({
      toolId: "text-tool",
      previous: two.receipt,
      execute: (previous) => encode(encodeBase64Bytes(previous!)),
    });
    const three = await third.finished;
    expect(three.status).toBe("saved");
    if (three.status !== "saved") return;

    expect(history.list().map(({ id }) => id)).toEqual([three.receipt.id, two.receipt.id, one.receipt.id]);
    const recovered = await history.recover(three.receipt);
    expect(recovered.status).toBe("recovered");
    if (recovered.status !== "recovered") return;
    expect(decode(recovered.bytes)).toBe("QUJD");
    expect(three.receipt.parentSha256).toBe(two.receipt.sha256);
    expect(three.receipt.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    recovered.bytes.fill(0);
    const again = await history.recover(three.receipt);
    expect(again.status === "recovered" ? decode(again.bytes) : again).toBe("QUJD");
    expect(Object.isFrozen(history.list()[0])).toBe(true);
    expect(history.describe().retained).toBe(3);
  });

  it("cancels only the selected pending task; late successes cannot enter history", async () => {
    const history = createSessionTaskHistory340();
    let release!: (value: Uint8Array) => void;
    let observedSignal: AbortSignal | undefined;
    const pending = history.run({ toolId: "example", execute: (_input, signal) => {
      observedSignal = signal;
      return new Promise((resolve) => { release = resolve; });
    } });
    await vi.waitFor(() => expect(observedSignal).toBeDefined());
    const unaffected = await history.run({ toolId: "example", execute: () => encode("good") }).finished;
    expect(unaffected.status).toBe("saved");
    expect(pending.cancel()).toBe(true);
    expect(observedSignal!.aborted).toBe(true);
    release(encode("too late"));
    expect((await pending.finished).status).toBe("cancelled");
    expect((await history.recover({ id: pending.id, sha256: "sha256:" + "0".repeat(64) })).status).toBe("unavailable");
    expect(pending.cancel()).toBe(false);
    expect(history.list()).toHaveLength(1);
    expect(history.describe().active).toBe(0);
  });

  it("prevents stale/tampered proof, missing parents, failed jobs and fake undo", async () => {
    const history = createSessionTaskHistory340();
    const source = await history.run({ toolId: "example", execute: () => encode("protected") }).finished;
    expect(source.status).toBe("saved");
    if (source.status !== "saved") return;
    const forged = { ...source.receipt, sha256: `sha256:${"0".repeat(64)}` };
    expect((await history.recover(forged)).status).toBe("unavailable");
    const sideEffect = vi.fn(() => encode("must not run"));
    const rejected = await history.run({ toolId: "example", previous: forged, execute: sideEffect }).finished;
    expect(rejected.status).toBe("unavailable");
    expect(sideEffect).not.toHaveBeenCalled();
    const failed = await history.run({ toolId: "example", execute: () => { throw new Error("failure"); } }).finished;
    expect(failed.status).toBe("unavailable");
    expect(history.list()).toHaveLength(1);
    expect(history.forget(source.receipt.id)).toBe(true);
    expect(history.forget(source.receipt.id)).toBe(false);
    expect((await history.recover(source.receipt)).status).toBe("unavailable");
    expect(history.describe().undoSupported).toBe(false);
  });

  it("refuses overquota and history-full completions without discarding earlier valid results", async () => {
    const history = createSessionTaskHistory340({ maxResultBytes: 8, maxTotalBytes: 12 });
    const first = await history.run({ toolId: "small", execute: () => encode("first") }).finished;
    const second = await history.run({ toolId: "small", execute: () => encode("second") }).finished;
    expect(first.status).toBe("saved");
    expect(second.status).toBe("saved");
    const third = await history.run({ toolId: "small", execute: () => encode("third") }).finished;
    expect(third).toMatchObject({ status: "unavailable", reason: "quota-exceeded" });
    expect(history.list()).toHaveLength(2);
    expect(history.describe().usedBytes).toBe(11);
    const oversized = await history.run({ toolId: "small", execute: () => new Uint8Array(9) }).finished;
    expect(oversized).toMatchObject({ status: "unavailable", reason: "quota-exceeded" });

    const full = createSessionTaskHistory340({ maxResultBytes: 8, maxTotalBytes: 24 });
    for (let i = 0; i < 3; i++) expect((await full.run({ toolId: "small", execute: () => encode("123") }).finished).status).toBe("saved");
    expect(await full.run({ toolId: "small", execute: () => encode("next") }).finished).toMatchObject({
      status: "unavailable", reason: "history-full",
    });
    expect(full.list()).toHaveLength(3);
  });

  it("reload means a new empty in-memory history with no pretend restoration or storage", async () => {
    const original = createSessionTaskHistory340();
    const saved = await original.run({ toolId: "example", execute: () => encode("not persisted") }).finished;
    expect(saved.status).toBe("saved");
    if (saved.status !== "saved") return;
    const afterReload = createSessionTaskHistory340();
    expect(afterReload.list()).toEqual([]);
    expect(afterReload.describe()).toMatchObject({ scope: "page-memory", reload: "cleared", undoSupported: false });
    expect((await afterReload.recover(saved.receipt)).status).toBe("unavailable");
    original.dispose();
    expect(original.list()).toEqual([]);
    expect((await original.recover(saved.receipt)).status).toBe("unavailable");
  });

  it("fail-closes invalid budgets, concurrent jobs and invalid result payloads", async () => {
    expect(() => createSessionTaskHistory340({ maxTotalBytes: Number.MAX_SAFE_INTEGER })).toThrow();
    expect(() => createSessionTaskHistory340({ maxResultBytes: 0 })).toThrow();
    const history = createSessionTaskHistory340();
    const invalid = await history.run({ toolId: "invalid tool", execute: () => encode("x") }).finished;
    expect(invalid.status).toBe("unavailable");
    const wrongResult = await history.run({ toolId: "safe", execute: () => "not bytes" as unknown as Uint8Array }).finished;
    expect(wrongResult.status).toBe("unavailable");
    const pending: Array<ReturnType<typeof history.run>> = [];
    for (let index = 0; index < 3; index++) pending.push(history.run({
      toolId: "safe", execute: () => new Promise<Uint8Array>(() => undefined),
    }));
    const refused = await history.run({ toolId: "safe", execute: () => encode("blocked") }).finished;
    expect(refused).toMatchObject({ status: "unavailable", reason: "too-many-tasks" });
    for (const task of pending) expect(task.cancel()).toBe(true);
    expect(history.describe().active).toBe(0);
  });
});
