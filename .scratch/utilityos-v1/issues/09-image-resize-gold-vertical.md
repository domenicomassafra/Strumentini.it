# 09 — Native-first Image Resize Gold vertical

**What to build:** Implement Image Resize as a browser-local Gold tool using the completed heavy-browser evidence: bounded native Canvas/ImageBitmap JPEG/WebP first, optional `pica` only if measured quality warrants it, and no AVIF/WASM in the first Gold route. Preserve explicit pixel/memory limits and cancellation.

**Traces to:** US-10 / AC-10.2 / AC-10.4 / US-11 / AC-11.1 / AC-11.4 / US-14 / AC-14.3 / AC-14.4 / DEC-13 / DEC-15 / T14

**Constraints:** C-03 / C-04 / C-05 / C-06 / C-09 / C-11 / C-12 / C-13 / C-15 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** ready-for-agent

- [ ] Begin from the completed heavy-browser/donor evidence and record exactly which observed native behavior/fixtures are promoted; inspect the oracle lane too if it is complete by implementation time.
- [ ] The tool accepts ordinary local image input and uses createImageBitmap/canvas or another justified native path before adding codec/WASM dependencies.
- [ ] Output validation independently checks declared dimensions, decodability, and MIME/signature expectations rather than trusting the encoder call.
- [ ] Orientation/metadata policy is explicit; the tool does not imply metadata removal or perfect privacy unless tested behavior proves it.
- [ ] Soft/hard dimension/file-size guidance prevents known unsafe mobile allocations; unsupported capability/input returns a normalized recoverable error.
- [ ] Memory preflight is based on decoded pixel dimensions/surfaces rather than compressed file bytes alone, and actual iOS Safari/Android Chrome thresholds are measured before Gold publication.
- [ ] Perceptible processing has truthful state and meaningful cancellation; cancellation and worker/runtime failure never surface success/infinite progress.
- [ ] Mobile Files/Photos flow works without drag/drop dependency and the tool reaches Gold across the declared browser matrix.

**Verification:** Run synthetic image fixtures with independent decoded-dimension/signature checks, corrupt/unsupported/large-image failure cases, cancellation/worker failure injection where applicable, representative mobile-memory acceptance, LOCAL network assertion, bundle-lazy-load inspection, and Gold certification.
