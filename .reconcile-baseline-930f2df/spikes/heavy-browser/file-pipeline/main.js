import { strToU8, unzipSync, zipSync } from "fflate";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { createSHA256 } from "hash-wasm";
import { fileTypeFromBuffer } from "file-type";
import { assert, fail, finish, heapUsed, now, sha256Hex } from "../shared/harness.js";

async function incrementalSha256(blob, { signal, onProgress }) {
  const hasher = await createSHA256();
  const reader = blob.stream().getReader();
  let processed = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Operation aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      processed += value.byteLength;
      onProgress?.(processed, blob.size);
    }
  } finally {
    if (signal?.aborted) await reader.cancel().catch(() => {});
  }
  return hasher.digest();
}

function makeLargeFixture(megabytes = 24) {
  const chunk = new Uint8Array(1024 * 1024);
  for (let i = 0; i < chunk.length; i += 1) chunk[i] = (i * 31 + 17) & 0xff;
  return new Blob(Array.from({ length: megabytes }, () => chunk), { type: "application/octet-stream" });
}

async function run() {
  const heapBefore = heapUsed();
  const zipStart = now();
  const fixture = {
    "README.txt": strToU8("UtilityOS synthetic ZIP fixture\n"),
    "data/items.csv": strToU8("id,name\n1,alpha\n2,beta\n"),
    "nested/note.json": strToU8('{"synthetic":true,"lane":4}')
  };
  const zipBytes = zipSync(fixture, { level: 6 });
  const unzipped = unzipSync(zipBytes);
  const zipMs = now() - zipStart;
  assert(Object.keys(unzipped).length === 3, "ZIP inspection returns all three entries");
  assert(new TextDecoder().decode(unzipped["README.txt"]).startsWith("UtilityOS"), "ZIP round-trip preserves content");

  const qrStart = now();
  const payload = "utilityos://synthetic/lane-04?fixture=qr";
  const canvas = document.querySelector("#qr");
  await QRCode.toCanvas(canvas, payload, { errorCorrectionLevel: "M", width: 256, margin: 2 });
  const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height);
  const qrMs = now() - qrStart;
  assert(decoded?.data === payload, "QR decoder recovers exact payload");

  const hashFixture = makeLargeFixture(24);
  const hashStart = now();
  let progressEvents = 0;
  const incrementalDigest = await incrementalSha256(hashFixture, { onProgress: () => { progressEvents += 1; } });
  const hashMs = now() - hashStart;
  assert(progressEvents > 1, "incremental hash emitted multiple progress steps");

  const oracleBlob = makeLargeFixture(1);
  const oracleBytes = await oracleBlob.arrayBuffer();
  const oracleDigest = await sha256Hex(oracleBytes);
  const incrementalOracleDigest = await incrementalSha256(oracleBlob, {});
  assert(oracleDigest === incrementalOracleDigest, "incremental SHA-256 agrees with Web Crypto on 1 MiB oracle fixture");

  const abortController = new AbortController();
  let abortObserved = false;
  try {
    await incrementalSha256(makeLargeFixture(8), {
      signal: abortController.signal,
      onProgress(processed) { if (processed >= 1024 * 1024) abortController.abort(); },
    });
  } catch (error) {
    abortObserved = error?.name === "AbortError";
  }
  assert(abortObserved, "hashing honors AbortSignal at a chunk boundary");

  const signatureStart = now();
  const zipType = await fileTypeFromBuffer(zipBytes);
  const pngBytes = new Uint8Array(await new Promise((resolve, reject) => canvas.toBlob(async (blob) => blob ? resolve(await blob.arrayBuffer()) : reject(new Error("PNG encode failed")), "image/png")));
  const pngType = await fileTypeFromBuffer(pngBytes);
  const signatureMs = now() - signatureStart;
  assert(zipType?.mime === "application/zip", "signature detection recognizes ZIP independently of extension");
  assert(pngType?.mime === "image/png", "signature detection recognizes PNG independently of extension");

  const heapAfter = heapUsed();
  finish({
    ok: true,
    capability: "file-pipeline",
    libraries: { fflate: "0.8.3", qrcode: "1.5.4", jsqr: "1.4.0", "hash-wasm": "4.12.0", "file-type": "22.1.1" },
    zip: { bytes: zipBytes.byteLength, entries: Object.keys(unzipped).sort(), timingMs: zipMs },
    qr: { payload, decoded: decoded?.data ?? null, timingMs: qrMs },
    hash: { bytes: hashFixture.size, sha256: incrementalDigest, timingMs: hashMs, progressEvents, oracle1MiBMatched: true, abortObserved },
    signatures: { zip: zipType, png: pngType, timingMs: signatureMs },
    heap: { before: heapBefore, after: heapAfter, delta: heapBefore != null && heapAfter != null ? heapAfter - heapBefore : null },
  });
}

run().catch(fail);
