import { describe, expect, it } from "vitest";
import { hashBlobInWorker, type HashWorkerPort, type HashWorkerResponse } from "../src/engines/file-hash/worker-client";

const ABC_DIGEST = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const VALID_RESULT = { algorithm: "SHA-256", digestHex: ABC_DIGEST, bytesHashed: 3 } as const;

function portForPackets(...packets: unknown[]): { worker: HashWorkerPort; terminated: () => boolean; posted: () => boolean } {
  let didTerminate = false;
  let didPost = false;
  const worker: HashWorkerPort = {
    onmessage: null,
    onerror: null,
    postMessage() {
      didPost = true;
      queueMicrotask(() => {
        for (const packet of packets) {
          worker.onmessage?.({ data: packet } as MessageEvent<HashWorkerResponse>);
        }
      });
    },
    terminate() { didTerminate = true; },
  };
  return { worker, terminated: () => didTerminate, posted: () => didPost };
}

describe("file hash worker client hostile protocol packets", () => {
  it.each([
    { type: "ready", result: VALID_RESULT },
    { type: "success", result: { ...VALID_RESULT, digestHex: "not-sha256" } },
    { type: "success", result: { ...VALID_RESULT, bytesHashed: 2 } },
    { type: "success", result: { ...VALID_RESULT, algorithm: "SHA-512" } },
    { type: "success" },
    Object.assign(Object.create({ type: "success" }) as object, { result: VALID_RESULT }),
    { type: "success", result: Object.assign(Object.create({ algorithm: "SHA-256" }) as object, { digestHex: ABC_DIGEST, bytesHashed: 3 }) },
    { type: "success", result: Object.assign(Object.create({ digestHex: ABC_DIGEST }) as object, { algorithm: "SHA-256", bytesHashed: 3 }) },
  ])("rejects an invalid or inherited success packet %#", async (packet) => {
    const port = portForPackets(packet);
    await expect(hashBlobInWorker(new Blob(["abc"]), { createWorker: () => port.worker })).rejects.toMatchObject({
      code: "WORKER_FAILURE",
    });
    expect(port.terminated()).toBe(true);
  });

  it("rejects non-finite progress instead of passing it into the UI", async () => {
    const port = portForPackets({ type: "progress", progress: { bytesHashed: 2, totalBytes: 3, fraction: Infinity } });
    const progress: unknown[] = [];
    await expect(hashBlobInWorker(new Blob(["abc"]), {
      createWorker: () => port.worker,
      onProgress: (value) => progress.push(value),
    })).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(progress).toEqual([]);
  });

  it("rejects a forged result for a different requested algorithm", async () => {
    const port = portForPackets({ type: "success", result: VALID_RESULT });
    await expect(hashBlobInWorker(new Blob(["abc"]), { algorithm: "SHA-512", createWorker: () => port.worker })).rejects.toMatchObject({ code: "WORKER_FAILURE" });
  });

  it("rejects decreasing Worker progress after a later chunk already completed", async () => {
    const port = portForPackets(
      { type: "progress", progress: { bytesHashed: 2, totalBytes: 3, fraction: 2 / 3 } },
      { type: "progress", progress: { bytesHashed: 1, totalBytes: 3, fraction: 1 / 3 } },
    );
    const progress: number[] = [];
    await expect(hashBlobInWorker(new Blob(["abc"]), { createWorker: () => port.worker, onProgress(value) { progress.push(value.bytesHashed); } })).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(progress).toEqual([2]);
  });

  it("refuses a success queued after a progress consumer throws", async () => {
    const port = portForPackets();
    const pending = hashBlobInWorker(new Blob(["abc"]), {
      createWorker: () => port.worker,
      onProgress() { throw new Error("render failed"); },
    });
    port.worker.onmessage?.({ data: { type: "progress", progress: { bytesHashed: 3, totalBytes: 3, fraction: 1 } } } as MessageEvent<HashWorkerResponse>);
    port.worker.onmessage?.({ data: { type: "success", result: VALID_RESULT } } as MessageEvent<HashWorkerResponse>);
    await expect(pending).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(port.terminated()).toBe(true);
  });

  it("rejects a worker completion when the signal aborted while creating the worker", async () => {
    const controller = new AbortController();
    const port = portForPackets({ type: "success", result: VALID_RESULT });
    await expect(hashBlobInWorker(new Blob(["abc"]), {
      signal: controller.signal,
      createWorker() {
        controller.abort();
        return port.worker;
      },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(port.posted()).toBe(false);
    expect(port.terminated()).toBe(true);
  });

  it("never forwards progress after a terminal packet", async () => {
    const port = portForPackets(
      { type: "success", result: VALID_RESULT },
      { type: "progress", progress: { bytesHashed: 3, totalBytes: 3, fraction: 1 } },
    );
    const progress: unknown[] = [];
    await expect(hashBlobInWorker(new Blob(["abc"]), {
      createWorker: () => port.worker,
      onProgress: (value) => progress.push(value),
    })).resolves.toEqual(VALID_RESULT);
    expect(progress).toEqual([]);
  });

  it("resolves the exact result of a valid worker response", async () => {
    const port = portForPackets(
      { type: "progress", progress: { bytesHashed: 3, totalBytes: 3, fraction: 1 } },
      { type: "success", result: VALID_RESULT },
    );
    const progress: unknown[] = [];
    await expect(hashBlobInWorker(new Blob(["abc"]), {
      createWorker: () => port.worker,
      onProgress: (value) => progress.push(value),
    })).resolves.toEqual(VALID_RESULT);
    expect(progress).toEqual([{ bytesHashed: 3, totalBytes: 3, fraction: 1 }]);
    expect(port.terminated()).toBe(true);
  });
});
