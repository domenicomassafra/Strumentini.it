import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FileHashError,
  SUPPORTED_HASH_ALGORITHMS,
  hashBlobIncremental,
  hashBlobWithWebCrypto,
  parseExpectedChecksum,
} from "../src/engines/file-hash/index";
import { hashBlobInWorker, type HashWorkerPort } from "../src/engines/file-hash/worker-client";

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
    const blob = new Blob(["StrumentiUtili.it independent oracle"]);
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
