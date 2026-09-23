# Prompt2Prompt Response

Status: COMPLETE
Continuation: NONE
Stop-Reason: COMPLETE
Attempt: 1
Response-Covers-Through: dc8cb0d405a871b00772ad5f7930aa498ed920a0
Updated-At: 2026-09-23T18:49:44+02:00
Prompt: tasks/prompt2prompt/20260923-181500-utilityos-parallel-enablers/lane-04-heavy-browser-spikes/04-heavy-browser-pdf-image-wasm-spike.prompt.md
Lane: lane-04-heavy-browser-spikes

## Result

Lane 04 is complete.

The heavy browser stack has been de-risked without touching product/spec/design/ticket ownership and without integrating experimental dependencies into production.

The core conclusion is deliberately capability-specific rather than a universal file-processing SDK:

- **Early Gold-capable substrate**: native browser image primitives for bounded resize/crop/JPEG/WebP, optional `pica` for high-quality resize, `exifr` for bounded metadata inspection, `fflate` for bounded ZIP operations, `qrcode`/`jsQR` when QR is actually promoted by product priority, incremental SHA-256 behind a small adapter (`hash-wasm` is proven by this spike; `@noble/hashes` is the strongest maintained/audited comparison candidate), and `file-type` only as a best-effort signature hint.
- **Heavy Wave C**: PDF mutation/render/text extraction/sanitization, AVIF and other WASM image codecs, libvips-style large/batch image processing, advanced/very-large ZIP, camera QR and multi-format barcode stacks.
- **Rejected defaults**: one giant dependency for every heavy tool; eager PDF.js/WASM loading; `@squoosh/lib` as the new default package; `piexifjs` as production metadata authority; MD5 as the integrity checksum; `CompressionStream` as a ZIP replacement; file signatures as a safety verdict.

Three independent runnable browser spikes now exist and all pass both live Vite observation and production-build Chrome smoke:

1. PDF create/reorder/rotate/split/merge plus independent PDF.js text/metadata/render observation.
2. Image crop/resize, JPEG/WebP, AVIF WASM, worker-backed compression and EXIF read/re-encode observation.
3. ZIP create/inspect, QR encode/decode, 24 MiB incremental SHA-256 with byte progress + cancellation + Web Crypto oracle, and signature detection.

The research matrix assesses **35 distinct library/platform approaches** with exact versions/licenses where applicable, maintenance evidence, worker/browser posture, bundle/WASM implications, mobile/memory risks, cancellation/progress considerations, advisory checks and UtilityOS adoption decisions.

## Changes

Committed in:

`dc8cb0d405a871b00772ad5f7930aa498ed920a0` — `research: de-risk heavy browser tool stack`

Lane-owned research:

- `research/lanes/09-heavy-browser-dependency-spike.md`
  - 35-candidate adoption matrix;
  - exact package versions/licenses and maintenance signals;
  - official-source links;
  - mobile/memory analysis for PDF, image, archive, QR, hashing and signatures;
  - security/advisory analysis;
  - Early Gold vs Heavy Wave C vs reject decisions;
  - proposed deep module seams for downstream production adapters.

Lane-owned isolated spikes:

- `spikes/heavy-browser/pdf-capabilities/`
- `spikes/heavy-browser/image-pipeline/`
- `spikes/heavy-browser/file-pipeline/`
- `spikes/heavy-browser/shared/harness.js`
- `spikes/heavy-browser/scripts/run-browser-observations.mjs`
- `spikes/heavy-browser/scripts/run-production-smoke.mjs`
- `spikes/heavy-browser/scripts/collect-bundle-evidence.mjs`
- `spikes/heavy-browser/package.json`
- `spikes/heavy-browser/package-lock.json`
- `spikes/heavy-browser/README.md`

Lane-owned benchmark/security artifacts:

- `quality/benchmarks/heavy-browser/observed-runtime.json`
- `quality/benchmarks/heavy-browser/production-smoke.json`
- `quality/benchmarks/heavy-browser/bundle-sizes.json`
- `quality/benchmarks/heavy-browser/npm-audit.json`
- `quality/benchmarks/heavy-browser/top-level-dependencies.json`

No third-party source was vendored into production and no product source was modified.

## Verification

Final end-to-end command:

`cd spikes/heavy-browser && npm run bench`

Result: PASS.

Production-build Chrome smoke:

- PDF: PASS; reordered page text exactly 4 → 2 → 1 → 3; four pages preserved through split/merge; first output page rotation 90°; metadata inspection and first-page render passed.
- Image: PASS; synthetic 1600×1200 input → 800×800 crop → 400×400 output; JPEG/WebP output passed; WASM AVIF output passed; injected EXIF was readable before and absent after the tested decode/re-encode path; Chrome did not actually provide native Canvas AVIF and the spike correctly detected the MIME fallback.
- File pipeline: PASS; ZIP three-entry round-trip; exact QR round-trip; 24 MiB SHA-256 completed in 103.7 ms in the final production smoke, emitted 13 byte-progress events, matched Web Crypto on an independent 1 MiB oracle, and observed AbortSignal cancellation; ZIP/PNG signatures were recognized without filenames.

Final production bundle evidence:

- PDF capability build: **2,122,213 raw / 677,643 gzip**; PDF.js worker alone **1,265,413 raw / 373,554 gzip**.
- Image + AVIF build: **7,312,864 raw / 2,348,108 gzip**; the current AVIF build emits two ~3.5 MB WASM variants, which is a hard lazy/Wave-C constraint.
- ZIP + QR + hash + signature build: **252,963 raw / 87,928 gzip**.

Security/dependency verification:

- `npm audit`: **0 vulnerabilities** in the installed spike graph.
- GitHub Advisory Database exact-version queries: **0 matching advisories** for the 29 npm library candidates queried on 2026-09-23; the research explicitly does not equate this with parser safety.
- MuPDF npm package is `AGPL-3.0-or-later` and is rejected from the default permissive shortlist absent an explicit licensing decision.

Quality gates:

- candidate matrix count: **35**, requirement >=20: PASS;
- runnable isolated spike count: **3**, requirement >=3: PASS;
- fixtures: generated synthetic/local only: PASS;
- mobile/memory analysis for every heavy family: PASS;
- exact versions/licenses recorded where applicable: PASS;
- Early Gold / Heavy Wave C / reject recommendations: PASS;
- `git diff --check` before commit: PASS;
- `git diff --check HEAD^ HEAD` after commit: PASS.

## Conflicts or blockers

None for this lane.

The background research workers requested by the research skill did not report back before their runtime deadline. Their failure did not block the lane: the same primary-source work was completed directly using npm registry metadata, official repositories/specifications and GitHub advisory queries.

Concurrent work from the closure/spec/ticket, OSS census, core-engine and Gold-oracle lanes was visible in the shared working tree. It was preserved untouched. The commit was path-scoped to Lane 04 ownership only.

## Residual work

No residual work is required to complete this research/spike lane.

Production promotion remains intentionally downstream and must not infer Gold from this research alone. The production ticket wave still needs:

- a hostile/corrupt legal PDF corpus before choosing the final mutation adapter (`@cantoo/pdf-lib` vs pinned `pdf-lib` or another engine);
- direct `hash-wasm` vs `@noble/hashes` browser/worker comparison before dependency freeze;
- actual iOS Safari and Android Chrome memory thresholds;
- worker termination/cancellation acceptance for PDF, image codecs and streaming archive operations;
- an exact per-format metadata-removal contract instead of a generic privacy promise;
- bundle assertions proving PDF.js and AVIF/WASM are not fetched before the relevant operation is requested;
- cross-browser JPEG/WebP quality fixtures because native Canvas encoder output can vary.

These are production-ticket acceptance requirements, not blockers to this lane's completion.

## Integration notes

Preserve these decisions when reconciling the parallel wave:

- Do not make a universal heavy file SDK a new monolith.
- Keep PDF mutation separate from PDF.js rendering/extraction so a page-reorder tool does not automatically pay the render-worker cost.
- Keep AVIF/WASM behind operation-level dynamic import; the measured bundle is too large for eager tool-route loading, let alone the shell.
- For image limits, use decoded pixel estimates, not compressed file bytes alone; a 12 MP RGBA surface is about 48 MB before temporary/output/codec buffers.
- For PDF limits, use render dimensions/pages as well as document bytes; a 2480×3508 RGBA page is about 34.8 MB before parser/browser overhead.
- Never use whole-archive synchronous unzip on unbounded files; production ZIP must enforce entry-count, uncompressed-byte and compression-ratio ceilings and move heavy work off the main thread.
- Hash directly from the user's `File`/`Blob` stream; do not full-buffer multi-gigabyte input merely to call Web Crypto.
- Treat QR output as inert text; never auto-open/execute a decoded URL.
- Treat file-signature detection as a hint only; matching magic bytes do not prove a file valid or safe.
- Do not claim “all metadata removed” from a decode/re-encode or PDF Info-field clear unless a format-specific corpus proves the exact promise.
- No silent remote/server fallback when a local heavy operation exceeds mobile/device limits.

## Next exact action

Reconcile this dependency/benchmark evidence into the closure lane's ticket DAG, keeping Early Gold image/hash/archive/signature work separate from Heavy Wave C PDF/WASM/advanced-archive tickets.

This response file is intentionally written after commit `dc8cb0d405a871b00772ad5f7930aa498ed920a0` because the Prompt2Prompt contract requires the response file to be the final filesystem action.
