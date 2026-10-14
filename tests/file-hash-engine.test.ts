import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FileHashError,
  SUPPORTED_HASH_ALGORITHMS,
  hashBlobIncremental,
  hashBlobWithWebCrypto,
  parseExpectedChecksum,
} from "../src/engines/file-hash/index";
import { hashBlobInWorker, type HashWorkerPort, type HashWorkerResponse } from "../src/engines/file-hash/worker-client";

const knownAnswers = JSON.parse(
  readFileSync(new URL("../quality/fixtures/sha2-known-answers/vectors.json", import.meta.url), "utf8"),
) as { vectors: Array<{ algorithm: string; input_utf8: string; digest_hex: string }> };

const chunkFixture = JSON.parse(
  readFileSync(new URL("../quality/fixtures/file-hash/vectors.json", import.meta.url), "utf8"),
) as { artifact_utf8: string; sha256: string; chunk_sizes: number[] };

describe("file-hash engine seam", () => {
  it("supports only the Gold-verified SHA-256 algorithm", () => {
    expect(SUPPORTED_HASH_ALGORITHMS).toEqual(["SHA-256"]);
  });

  it("matches published SHA-256 known-answer vectors", async () => {
    for (const vector of knownAnswers.vectors.filter((item) => item.algorithm === "SHA-256")) {
      const blob = new Blob([new TextEncoder().encode(vector.input_utf8)]);
      await expect(hashBlobIncremental(blob)).resolves.toMatchObject({
        algorithm: "SHA-256",
        digestHex: vector.digest_hex,
        bytesHashed: blob.size,
      });
    }
  });

  it("is invariant to the internal chunk size", async () => {
    const blob = new Blob([new TextEncoder().encode(chunkFixture.artifact_utf8)]);
    for (const chunkSize of chunkFixture.chunk_sizes) {
      await expect(hashBlobIncremental(blob, { chunkSize })).resolves.toMatchObject({ digestHex: chunkFixture.sha256 });
    }
  });

  it("agrees with the bounded independent Web Crypto oracle", async () => {
    const blob = new Blob(["Strumentini.it independent oracle"]);
    const [incremental, oracle] = await Promise.all([
      hashBlobIncremental(blob, { chunkSize: 7 }),
      hashBlobWithWebCrypto(blob, { maxBytes: 1024 }),
    ]);
    expect(incremental.digestHex).toBe(oracle);
  });

  it("normalizes only surrounding whitespace and hex case in expected checksums", () => {
    expect(parseExpectedChecksum(`  ${chunkFixture.sha256.toUpperCase()}\n`)).toBe(chunkFixture.sha256);
    for (const malformed of [
      `sha256:${chunkFixture.sha256}`,
      chunkFixture.sha256.replace(/(.{8})/gu, "$1 ").trim(),
      chunkFixture.sha256.slice(0, -1),
      `${chunkFixture.sha256} artifact.bin`,
      "not-a-checksum",
    ]) {
      expect(() => parseExpectedChecksum(malformed)).toThrow(FileHashError);
      try {
        parseExpectedChecksum(malformed);
      } catch (error) {
        expect((error as FileHashError).code).toBe("MALFORMED_CHECKSUM");
      }
    }
  });

  it("never resolves success after cancellation", async () => {
    const controller = new AbortController();
    const blob = new Blob([new Uint8Array(1024 * 1024)]);
    const result = hashBlobIncremental(blob, {
      chunkSize: 1024,
      signal: controller.signal,
      onProgress(progress) {
        if (progress.bytesHashed > 0) controller.abort();
      },
    });
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("normalizes bounded read failures", async () => {
    const brokenBlob = {
      size: 3,
      slice() {
        return { arrayBuffer: async () => { throw new Error("device read failed"); } };
      },
    } as unknown as Blob;
    await expect(hashBlobIncremental(brokenBlob)).rejects.toMatchObject({ code: "READ_FAILURE" });
  });

  it("rejects unsupported algorithms before hashing", async () => {
    await expect(hashBlobIncremental(new Blob(["abc"]), { algorithm: "SHA-512" })).rejects.toMatchObject({
      code: "UNSUPPORTED_ALGORITHM",
    });
  });

  it("normalizes worker failures and terminates the worker", async () => {
    let terminated = false;
    const worker: HashWorkerPort = {
      onmessage: null,
      onerror: null,
      postMessage() {
        queueMicrotask(() => worker.onerror?.({ message: "worker exploded" } as ErrorEvent));
      },
      terminate() { terminated = true; },
    };
    await expect(hashBlobInWorker(new Blob(["abc"]), { createWorker: () => worker })).rejects.toMatchObject({
      code: "WORKER_FAILURE",
    });
    expect(terminated).toBe(true);
  });

  it("discards queued progress and stale success after an explicit cancellation", async () => {
    const controller = new AbortController();
    let terminated = 0;
    let progressNotifications = 0;
    const worker: HashWorkerPort = {
      onmessage: null,
      onerror: null,
      postMessage() { /* A real Worker can queue messages before it terminates. */ },
      terminate() { terminated += 1; },
    };
    const pending = hashBlobInWorker(new Blob(["private"]), {
      signal: controller.signal,
      createWorker: () => worker,
      onProgress() { progressNotifications += 1; },
    });
    // Capture the callback already queued on the main-thread message loop.
    const queuedHandler = worker.onmessage;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    const queued = queuedHandler as ((event: MessageEvent) => void) | null;
    queued?.({ data: { type: "progress", progress: { bytesHashed: 1, totalBytes: 1, fraction: 1 } } } as MessageEvent);
    queued?.({ data: { type: "success", result: { algorithm: "SHA-256", digestHex: "0".repeat(64), bytesHashed: 1 } } } as MessageEvent);
    expect(progressNotifications).toBe(0);
    expect(terminated).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it.each([
    ["unknown worker message", { type: "unexpected", result: { algorithm: "SHA-256", digestHex: "a".repeat(64), bytesHashed: 3 } }],
    ["forged success digest", { type: "success", result: { algorithm: "SHA-256", digestHex: "Z".repeat(64), bytesHashed: 3 } }],
    ["forged success count", { type: "success", result: { algorithm: "SHA-256", digestHex: "a".repeat(64), bytesHashed: 900 } }],
  ])("fails closed on %s rather than certifying an unverified checksum", async (_description, forged) => {
    let ended = 0;
    const worker: HashWorkerPort = { onmessage: null, onerror: null, postMessage() {}, terminate() { ended += 1; } };
    const pending = hashBlobInWorker(new Blob(["abc"]), { createWorker: () => worker });
    worker.onmessage?.({ data: forged } as MessageEvent<HashWorkerResponse>);
    await expect(pending).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(ended).toBe(1);
  });

  it("rejects worker progress exceeding source bytes instead of publishing a false 100%", async () => {
    let publishedProgress = 0;
    const worker: HashWorkerPort = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
    const pending = hashBlobInWorker(new Blob(["abc"]), {
      createWorker: () => worker,
      onProgress() { publishedProgress += 1; },
    });
    worker.onmessage?.({ data: { type: "progress", progress: { bytesHashed: 10, totalBytes: 3, fraction: 4 } } } as MessageEvent<HashWorkerResponse>);
    // A known-good success would otherwise have settled the old fail-open
    // worker path; the malformed progress must have failed the job first.
    worker.onmessage?.({ data: { type: "success", result: { algorithm: "SHA-256", digestHex: "a".repeat(64), bytesHashed: 3 } } } as MessageEvent<HashWorkerResponse>);
    await expect(pending).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(publishedProgress).toBe(0);
  });

  it("normalizes synchronous worker startup failures", async () => {
    await expect(
      hashBlobInWorker(new Blob(["abc"]), {
        createWorker() {
          throw new Error("workers unavailable");
        },
      }),
    ).rejects.toMatchObject({ code: "WORKER_FAILURE" });
  });
});
