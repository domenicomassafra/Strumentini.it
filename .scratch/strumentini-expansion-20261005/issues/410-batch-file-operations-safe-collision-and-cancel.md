# 410 — Batch file operations safe collision and cancel

**What to build:** A batch transforms multiple files with per-file results and deterministic naming

**Traces to:** OWN-04 OWN-08; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** 337

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** advanced

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [x] AC-410.1: Bounded local text-file batch: multiple UTF-8 TXT/CSV/JSON/MD/LOG files produce separate verified `.gz` results, deterministic collision-safe names and manual downloads on the existing ZIP Creator route.
- [x] AC-410.2: Duplicate/case/NFC names, unsupported/binary/oversize files and cancellation are isolated; prior successful artifacts remain intact, with independently decoded downloads.
- [x] AC-410.3: Current scoped mixed, collision, quota, failure and cancel cases independently verified in 9/9 engine tests and real Chromium 390 browser; native devices and unrelated PDF/image formats NOT_RUN/NOT_SUPPORTED, not falsely certified.

**Verification:** Mixed fixture and collision-cleanup tests; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 prime acceptance reconciliation — bounded job complete

Older OPEN/NOT_RUN development checkpoints below are superseded for supported text/GZIP inputs by the current compiled-browser proof: five mixed files, four true manual `.gz` downloads independently recovered via Node zlib, one unsupported input and real user-facing cancellation preserving prior output. The 9/9 engine tests and 14/14 design-system tests pass. The feature is a clearly scoped *experimental* panel inside the already registered `/tools/zip-creator/` page, not a new route, unverified universal transformer, or changed ZIP engine. Its initial CSS literal violation was removed; after this route edit the canonical `npm run certification:build` and `certification:check` regenerated and validated one expected zip page source hash without promoting Gold. **The three original AC are complete only for the explicitly bounded local UTF-8-text→GZIP batch.** PDF/image/media batches and native physical device acceptance are NOT_SUPPORTED/NOT_RUN; independent security review, Gold, rollback and actual production deployment remain NO_GO. Ticket closure is not deployment authorization.

## 2026-10-11 — Existing-route static browser verification (worker-14 continuation)

**Registered surface:** The small self-contained experimental GZIP panel is now mounted inside the existing /tools/zip-creator/ catalog route by one import in src/pages/tools/zip-creator.astro; the original ZIP creator remains present. The panel has no nested BaseLayout, states clearly that GZIP is for UTF-8 TXT/CSV/JSON/MD/LOG (not ZIP or PDF), keeps manual per-result downloads, and uses no network/storage/upload APIs. No new page, generated index, catalog manifest, certification artifact or historical route was changed.

**Real browser proof:** node tests/batch-file-410.browser.mjs — **PASS**, Chromium at 390×844 against its own temporary local static HTTP server serving the freshly built dist, **not** the stale Vite dev/other worker preview. Five mixed inputs: two TXT with case-insensitive duplicate filename, one CSV, one unsupported PNG and one Markdown; exactly four successful explicitly clicked browser downloads with deterministic names, each download's actual GZIP bytes independently decompressed with Node zlib.gunzipSync and equal to its original fixture bytes. Unsupported PNG produced no artifact; before manual clicks zero downloads occurred. Separate cancel scenario: a real button click executed via MutationObserver immediately after the first successful row, yielding exactly **one successful downloadable file and two cancelled files**; the surviving downloaded gzip was independently decompressed and compared with original input. Browser reported **zero uncaught page errors and zero non-GET/HEAD HTTP requests**; all external network requests were denied by test interception. The test's local static server and browser close in finally.

**Build/limits:** Engine Vitest tests/batch-file-410.test.ts remains **9/9 PASS**. Direct Astro build followed by the unmodified canonical scripts/inspect-build.ts — **PASS: 292 pages**, expected index/discovery metadata intact, historical baseline preserved. The first complete npm run build attempt stopped earlier, on certification:check, reporting existing quality/receipts/expanded-catalog-certification.json **stale**; no certification source or receipt was modified to bypass it. Thus canonical multi-stage npm run build **NOT PASS on this attempt**, even though Astro+inspect-build passed independently.

**Disposition:** This proves the scoped UTF-8-to-GZIP batch on a desktop Chromium build and mobile-size viewport; it **does not** prove native mobile browser/device behavior, full PDF/image batch capabilities, distribution/read-only production deployment, or clear the unrelated certification gate. Keep original #410 **OPEN**, with original AC checkboxes unmodified. Full cleanup/rollback is removal of the isolated import/panel and focused tests, with ZIP creator behavior otherwise unchanged. No commit/push/deploy.

**Browser gate, 2026-10-11:** Standalone route GET returned HTTP 200 at existing local dev server 127.0.0.1:4998. Playwright attempted to select and compress two files but could not verify the UI: Vite served /node_modules/.vite/deps/fflate.js with HTTP 504 Outdated Optimize Dep, so the route JavaScript did not execute. Browser UI acceptance remains BLOCKED/NO_GO on that server until stable served-build verification; no download success or cancellation proof is claimed.

## 2026-10-11 — Bounded vertical implementation (worker-14)

**Scope:** Experimental local UTF-8 document compression, **not** generalized PDF/image or remote batch processing. Created src/runtime/batch-file-410.ts and standalone experimental UI retained as `src/components/lab/BatchGzipLab410.astro` (not routed or published), with no catalog mutation, no external upload, no dependencies added and no deployment. The proposed UI has per-file downloads, per-file status and cancellation of remaining queue items; it has not passed browser acceptance. The runtime checks 1–8 inputs, maximum 2 MiB/file and 8 MiB cumulative accepted bytes, recognizes TXT/CSV/JSON/MD/LOG and UTF-8 text, compresses real GZIP via existing fflate, verifies its decompressed bytes, refuses unsupported/binary/oversize inputs and sanitizes download paths, bidi controls, reserved names and Unicode case/NFC collisions. Earlier success artifacts survive later rejection or abort.

**Source and tests:** The repository's pinned installed fflate@0.8.3 is used; no donor package was added. Command: ./node_modules/.bin/vitest run tests/batch-file-410.test.ts — **PASS 9/9** (2026-10-11), with **independent Node zlib.gunzipSync byte readback**, duplicate/case/NFC collision, malicious paths/bidi, invalid UTF-8, read exception privacy, preexisting successes after abort and abort during read, deterministic rerun and 8 MiB total quota refusal. An initial RED run failed for missing batch-file-410 module; the verified implementation turned the targeted suite green.

**Open checks:** Physical iOS/Android access, real browser UI download/abort interactions, full catalog onboarding/discoverability and wider PDF/image operation matrix are **NOT_RUN / NOT_PROVEN**. Do not imply release readiness or universal batch support from the test-only slice. **Integration review:** `npm run build` correctly rejected an unregistered lab route as `Unexpected HTML page set ... lab/batch-gzip-410/index.html`. The new page was therefore moved from `src/pages/lab/` into an unrouted `src/components/lab/BatchGzipLab410.astro`; the canonical build-inspection manifest and certification rules were not loosened. Browser dev server HTTP 200 is historical evidence only, not a current published route. Preserve `ready-for-agent` and all full-ticket AC unchecked until browser/multi-device and catalog gates are satisfied. Rollback is deletion of the three new engine/test/component files; no historical engine/data is replaced.
