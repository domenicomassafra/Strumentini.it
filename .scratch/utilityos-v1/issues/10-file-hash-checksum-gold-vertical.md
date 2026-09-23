# 10 — File Hash / Checksum Verifier Gold vertical

**What to build:** Implement local file hashing and checksum verification as a focused Gold tool. Use Web Crypto for bounded independent oracle/small-input checks, but for large files compare the heavy-spike-proven `hash-wasm` path against `@noble/hashes` behind one lazy incremental worker seam and hash directly from the user's File/Blob stream.

**Traces to:** US-10 / AC-10.3 / AC-10.4 / US-11 / AC-11.1 / AC-11.4 / US-14 / AC-14.4 / T15

**Constraints:** C-03 / C-04 / C-05 / C-06 / C-09 / C-11 / C-12 / C-13 / C-15 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** ready-for-agent

- [ ] Use the completed heavy-browser/donor evidence to compare `hash-wasm` and `@noble/hashes` for exact version/license/security, worker/browser support, bundle cost, throughput, progress, cancellation, and memory; inspect oracle output too if complete.
- [ ] Supported algorithms are explicitly enumerated and verified against published known-answer vectors.
- [ ] The same file hash is invariant to internal chunk size in the incremental path and checksum comparison normalizes only documented representation differences.
- [ ] File contents never leave the browser and analytics receives no filename/hash value/file content.
- [ ] Large-file preflight/progress/cancel behavior is truthful; cancellation cannot produce a success receipt.
- [ ] The incremental path reads bounded chunks from File/Blob streaming and never full-buffers a multi-gigabyte input merely to call Web Crypto.
- [ ] Corrupt/read failure, unsupported algorithm, malformed expected checksum, and worker failure are normalized and recoverable.
- [ ] The tool reaches Gold with mobile file selection, browser compatibility, and lazy dependency/worker proof if a non-native implementation is adopted.

**Verification:** Run published hash vectors, chunk-size invariance fixtures, malformed checksum cases, large-file/cancel/failure injection, LOCAL browser-network/content telemetry inspection, mobile file flow, dependency/bundle gate if applicable, and Gold certification.
