# Ticket 10 — File hash dependency gate

Date: 2026-09-23
Decision: **`hash-wasm` 4.12.0 for production incremental SHA-256**. **`@noble/hashes` 2.4.0 was evaluation-only** and was removed from the shared package files after integration.

## Scope and authorities

This gate compares the two packages already pinned for evaluation. It does not add or edit package files. Evidence comes from:

- `docs/RESEARCH-DECISIONS-2026-10-27.md` (historical browser/donor decisions and immutable Git provenance);
- `quality/fixtures/sha2-known-answers/vectors.json` and `quality/fixtures/file-hash/vectors.json`;
- `quality/oracles/registry.json` entry `cand-161`;
- `quality/receipts/file-hash/browser-acceptance.json`.

## Exact comparison

| Criterion | `hash-wasm` 4.12.0 | `@noble/hashes` 2.4.0 |
|---|---|---|
| License | MIT | MIT |
| Dependency posture | zero runtime package deps; WASM-backed | zero runtime package deps; pure ESM/JS |
| Maintenance evidence | quiet; npm/repo release 2024-11 | active; npm 2026-08, repo pushed 2026-09-08 |
| Security evidence | exact-version GitHub Advisory query reported 0 matches in donor/heavy-spike evidence; spike npm audit green | exact-version GitHub Advisory query reported 0 matches; upstream README records an independent Cure53 audit for core scope |
| Browser support | observed in Chrome; production path runs inside a module Worker | browser-capable ESM; browser benchmark passes |
| Worker support | **observed production acceptance**; worker is created lazily on first hash | no browser-worker blocker identified, but not selected/production-accepted |
| Incremental interface | `createSHA256().init/update/digest` | `sha256.create().update().digest` |
| Progress | exact bytes-read progress emitted after each bounded chunk | would require the same caller-owned byte progress |
| Cancellation | production worker termination + abort rejection observed; success cannot be emitted afterward | would require caller/worker termination at chunk boundaries |
| Browser benchmark, 64 MiB | **242.2 MiB/s**, 264.2 ms hash time | **51.6 MiB/s**, 1239.7 ms hash time |
| Candidate lazy transfer | 18,305 B transfer / 18,005 B decoded | 5,780 B transfer / 5,480 B decoded |
| Directional JS heap delta | +342,026 B | +627,918 B |
| Full-file buffering | not required; production reads 1 MiB slices | not required with the same adapter design |

`performance.memory` measures JS heap only and does not account for WASM linear memory, so the heap deltas are directional rather than a total-memory claim. The production memory invariant is architectural: the user's `File`/`Blob` is read as bounded slices, only one chunk is materialized at a time, the hash state remains incremental, and cancellation terminates the worker.

## Production decision

Select `hash-wasm` despite the ~12.5 KiB candidate-transfer premium because the measured Chrome throughput is roughly 4.7× higher, the digest agrees exactly with the evaluated `@noble/hashes` implementation, published SHA-256 vectors and bounded Web Crypto, and the selected implementation has direct production worker/cancel/locality acceptance. The evaluation comparator was removed after this decision; it does not justify a second production hash implementation.

The product supports **SHA-256 only** in this Gold vertical. SHA-512 has a published fixture but is intentionally not exposed because the current product job is integrity/checksum verification, SHA-256 is the declared baseline, and expanding algorithms would add UI/support surface without a demonstrated need.

## Oracle and privacy boundary

Web Crypto `subtle.digest` is retained only as an independent bounded oracle with a 1 MiB maximum. It is never used for large-file production hashing because the API consumes the supplied buffer and has no incremental SHA-256 state interface.

No filename, digest or file content is sent to telemetry or a network service. Browser acceptance observed zero external requests and zero private task values in request metadata after file selection.
