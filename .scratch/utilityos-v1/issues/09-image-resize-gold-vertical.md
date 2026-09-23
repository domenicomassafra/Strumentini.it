# 09 — Native-first Image Resize Gold vertical

**What to build:** Implement Image Resize as a browser-local Gold tool using the completed heavy-browser evidence: bounded native Canvas/ImageBitmap JPEG/WebP first, optional `pica` only if measured quality warrants it, and no AVIF/WASM in the first Gold route. Preserve explicit pixel/memory limits and cancellation.

**Traces to:** US-10 / AC-10.2 / AC-10.4 / US-11 / AC-11.1 / AC-11.4 / US-14 / AC-14.3 / AC-14.4 / DEC-13 / DEC-15 / T14

**Constraints:** C-03 / C-04 / C-05 / C-06 / C-09 / C-11 / C-12 / C-13 / C-15 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** partial-wait-for-physical-acceptance

- [x] Begin from the completed heavy-browser/donor evidence and record exactly which observed native behavior/fixtures are promoted; inspect the oracle lane too if it is complete by implementation time.
- [x] The tool accepts ordinary local image input and uses createImageBitmap/canvas or another justified native path before adding codec/WASM dependencies.
- [x] Output validation independently checks declared dimensions, decodability, and MIME/signature expectations rather than trusting the encoder call.
- [x] Orientation/metadata policy is explicit; the tool does not imply metadata removal or perfect privacy unless tested behavior proves it.
- [x] Soft/hard dimension/file-size guidance prevents known unsafe mobile allocations; unsupported capability/input returns a normalized recoverable error.
- [ ] Memory preflight is based on decoded pixel dimensions/surfaces rather than compressed file bytes alone, and actual iOS Safari/Android Chrome thresholds are measured before Gold publication. **Automated decoded-pixel preflight PASS; physical iOS Safari + Android Chrome thresholds remain.**
- [x] Perceptible processing has truthful state and meaningful cancellation; cancellation and worker/runtime failure never surface success/infinite progress.
- [ ] Mobile Files/Photos flow works without drag/drop dependency and the tool reaches Gold across the declared browser matrix. **Files/Photos input + 390×844 viewport PASS in Chrome/Edge automation; physical iOS Safari + Android Chrome acceptance remains.**

**Verification:** Run synthetic image fixtures with independent decoded-dimension/signature checks, corrupt/unsupported/large-image failure cases, cancellation/worker failure injection where applicable, representative mobile-memory acceptance, LOCAL network assertion, bundle-lazy-load inspection, and Gold certification.

Implementation receipts live under `quality/receipts/image-resize/`. Automated certification is intentionally PARTIAL until valid physical-device receipts with measured thresholds exist for iOS Safari and Android Chrome.

## Physical acceptance recorder

The physical gate is executable but intentionally cannot self-certify without an observed device run:

1. `npm run acceptance:image-resize:physical:serve` builds and exposes `/tools/image-resize/` on the local LAN.
2. On the physical device, choose a real image through Files/Photos, complete a resize, open the downloaded result, confirm no crash/reload and usable mobile layout, and note the source/output dimensions shown by the tool.
3. Optionally validate the command first by appending `--dry-run` (no receipt is written). Then record the observation with `npm run acceptance:image-resize:physical:record -- --target ios-safari|android-chrome --device "..." --browser "..." --source WIDTHxHEIGHT --output WIDTHxHEIGHT --files-photos-pass --resize-pass --download-pass --no-crash-pass --layout-pass`.
4. Re-run `npm run gold:image-resize`. Gold remains impossible until both validated target receipts exist.

The recorder computes source pixels and the current engine's estimated decoded working set from the observed dimensions; it rejects browser/target mismatches, dimensions beyond current policy, missing explicit PASS observations, and internally inconsistent receipts. It does not synthesize physical evidence.
