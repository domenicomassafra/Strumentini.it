# Strumentini.it — checkpoint operativo, 2026-10-08 (due subagenti)

This records verified implementation, NOT production deployment, physical-device certification, or a grant to close tickets without acceptance. Refer to the living `CURRENT-TICKET-DASHBOARD.md` and `.json` for the current queue, not older handoff counts.

## Repository and independently produced commits

Starting repository checkpoint `bc11d07ba7642ee02d6ad7b52d75364be30d90a0` (clean local/remote main).

1. Prime `ff86195` — #59 parser-backed, explicit CSS/HTML readable formatting modes, stable fixtures, truthful action buttons and raw downloads. 18/18 downloads verified in Chromium, Firefox and WebKit. SVG optimization NOT implemented or certified.
2. PDF worker `5d90d70` — #218/#236 new browser acceptance over real generated PNG/JPEG/WebP, selected page ranges and ZIP byte parity; text and pixel parity of *structural* PDF output on bounded synthetic vectors/JPEG corpus. WebKit WebP encoding explicitly refused if unavailable. 69/69 cross-engine browser checks PASS, **after** rebuilding main's static output.
3. Video worker `f41de41` — #232 local Preact MP4 inspector and theoretical bitrate planner with stale-result reset, abort, no fabricated FPS/CFR/VFR/video per-stream rate and only bounded container `moov` parsing. Local Chromium route/browser acceptance 16/16 PASS with synthetic FFmpeg MP4 and no suspicious transcoder or external requests.
4. Video worker `9493131` — #232 registered as a **260th** LOCAL tool with real manifest/module, Italian copy, `cand-260` oracle (medium confidence, unresolved VFR/physical/codec gaps), `ffprobe-local-reference` source metadata, synthetic fixture family/vector inventory and Result-v2 owner. **No new Gold receipt fabricated.** Registration tests and factory pass.
5. PDF worker `79592a5` — #236 reproducible 200-page test with 390×844 *desktop* headless Chromium viewport; two browser PASS runs. 200 downloaded PNG files verified from an actual ZIP (96×72), 52,020-byte synthetic PDF input, 239,385-byte ZIP, total rendering 4,399 and 5,833 ms; sampled main-thread JS heap peaks 7,805,532 and 7,521,552 bytes; cancellation after 9 and 5 pages encoded, 636 and 524 ms, no download/late result. Does NOT cover native/GPU/worker memory, iOS/Android devices or realistic full-page scan geometry.

Prime post-integration fixes: TS discriminated union in `src/tools/video-inspector/module.ts`, loader non-null test assertion, precise h1 browser selector, and updated Gold-**receipt** versus Gold-**release** tests (`tests/certification-index.test.ts`, `tests/expanded-local-certification.test.ts`, `tests/functional-audit-tranche-292.test.ts`). Historical receipts remain preserved and release safety stays fail-closed.

## Source-bound quality snapshot

- Catalog: **260 tools**, 280 statically built pages. Sources/fixtures/copy and generator aligned, `npm run catalog:build` PASS.
- Certification status: **257 historical GOLD receipts**, **2 PARTIAL** (`image-resize`, `microphone-recorder`), **1 IMPLEMENTED_UNVERIFIED** (`video-inspector`). The initial 260-tool index blocked 256 old Gold receipts because the added `cand-260` changed the oracle registry SHA-256; this regression was resolved by `src/quality/oracle-append-only.ts`: it reconstructs the original 259-entry registry byte-for-byte and accepts a historical receipt ONLY when its original SHA-256 actually matches the reconstructed preimage, with all referenced oracle IDs present in that prefix. Any edit to historic entries/metadata, a fake hash, or an oracle not yet present in the old registry remains blocked. The old SHA `62dd5a3bfcc7f7b35282396110c3123c3b43be5430fd9e0ef3168c178059ebe7` was independently reproduced; **257 Gold now remain release-eligible, 3 tools remain blocked**. This preserves existing receipts and does not invent Gold for the inspector or physical-device proof for the two Partial tools.
- Audit original 200: **200 records, 199 verified, 1 explicit refusal, final gate PASS**, unchanged.
- Ticket dashboard: **327 total; 246 completed, including 18 explicit refusals; 81 OPEN; 20 assignable; DAG-ready 28; 53 dependency-blocked, 2 official-source, 5 device, 1 capability; no stored label mismatches**. New work **does not** automatically close #59/#218/#232/#236.
- Build/quality specific checks: Astro **0 errors / 0 warnings** across **1,694** files; static build **280 pages**, inspector build gate PASS; actual video browser **16/16 PASS**; PDF browser **69/69 PASS**; CSS/HTML raw download browser **18/18 PASS**; PDF desktop viewport performance test **two PASS runs**.
- **Final integrated `npm test -- --maxWorkers=4`: 1,197/1,197 PASS, 153/153 test files** at the integrated source, including certification/index guardrails and the source-bound release blockers. Test execution: `/tmp/str-260-global-final2.log`. Astro check: `/tmp/str-260-astro-check2.log`; build: `/tmp/str-260-build2.log`; video browser: `/tmp/str-260-video-browser3.log`; PDF browser: `/tmp/str-pdf-merge-browser.log`; developer downloads: `/tmp/str-59-browser-robust.log`. These machine-local `/tmp` logs are not durable receipts or a production release certificate.

## Remaining critical work

- **#232 OPEN:** physical camera/HEVC/VFR and multistream cases, real format/codec support matrix, current-source Gold/release verification and mobile acceptance. This new inspector computes a theoretical rate, not compression.
- **#218 OPEN:** implement *actual* image-aware recompression/downsample, full text/vector/visual parity, scan+mixed-content corpora and mobile validation; structural-only output says image XObjects touched=0.
- **#236 OPEN:** broader real-device memory proof on Android and iOS, larger scan PDFs, decoder/native/GPU/worker memory; desktop 390 px viewport alone does not prove any physical-device acceptance.
- **#59 OPEN:** independent safe SVG optimizer and adversarial security/semantics acceptance; do not silently claim SVG feature is implemented.
- Fiscal dependency chain **#117 → #127 → #128 → #130 → #062 → #066 → #045 → #046** remains official-source blocked; never invent an Italian tax/INPS source pack.
- Explicit refusal #242/#320 persists, parent #053 remains capability blocked.
- Release remains **BLOCKED** pending **fresh, source-bound receipts**, actual physical mobile evidence and candidate rollback. **No production deploy was requested or performed.** Keep separate branch worktrees; do not force-remove untracked local dependencies.
