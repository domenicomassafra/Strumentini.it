# Strumentini.it — implementation wave 01

**State: implemented local slices, not a release.** Base commit `4c9f4b5`. This run begins implementation of the 424-ticket owner-aligned backlog, rather than repeating the planning/grilling. It uses the existing Astro/Preact/local browser stack and four native Chat On Steroids workers with disjoint write sets. All original/refusal history remains binding. This document records evidence from the present wave, **not** a claim that the 140 pending tickets have been completed.

## Implemented code and local observations

| Ticket | Concrete slice | Evidence boundary / remaining criterion |
|---|---|---|
| #328 | Turnstile explicit onload registered before deferred script, render visible tab, expire/error/timeout/reset and missing-token fail-closed; register/login client paths | Isolated real Chromium fixture: 35 browser assertions for #328/#329 together; existing local D1 Worker `acceptance:auth` 130 assertions. External real Cloudflare Siteverify staging and physical Safari remain NOT_RUN. |
| #329 | Accessible form error/focus, keyboard tab Home/End, secondary text contrast | Measured Chromium light 6.08:1 and dark 8.35:1; need physical device and all responsive/a11y acceptance before global closure. |
| #330 | `noteToolUse` after real successful shared operation/PDF output only, serialized IndexedDB recent ID/time/count, live/reload, storage-denied warning; lazy record hook | Real Chromium UTM/PDF success/error/cancel/double-run/IndexedDB denied. Custom tool renderers outside shared seam remain to be audited. No filenames/contents stored. |
| #331 | Corrected privacy/account/local vs remote favorites, temporary bytes/results, delete-browser distinction, source-bound certification copy in Risorse/Impostazioni/Accesso | Source copy and type validation; live account claims require staging observation; no remote document storage introduced. |
| #333 | Bounded candidate detector for PDF/PNG/JPEG/GIF/WebP, ZIP and OOXML with magic/MIME, container directory, cap, hostile/mismatch/cancel refusals | 18 focused cases. This is a safe *candidate classification*, not complete decoding, advanced content security or mobile physical proof. |
| #334/#335 | Home file picker and drag/drop to select only catalog-verifiable LOCAL/network-forbidden recommended routes, preserving search, no file upload/autorun | Real Chromium at 320/390/768/1024/1440; valid PDF/PNG/GIF, unknown CSV and spoofed/multi-file refusal. **Result does not yet transfer the file to the destination**: user must reselect. #337 is future. |
| #343 | Versioned local configuration JSON export/import, strict 256 KiB known-ID/schema guards, preview+confirm, transaction compare-and-set IndexedDB, verified reset | 7 focused tests and real Chromium import/cancel/reload/reset/denied/stale preview. No account sync or cross-device file archive. |
| #346 | Explicit opt-in before validation telemetry even with build endpoint; revocation and denied-storage off; corrected matured D7/D30 and repeated successful-tool semantics | Telemetry focused tests and source privacy checks; no real consent cohort or production longitudinal measurement claimed. |
| #347 | Backend/Worker/D1 migrations incorporated in current source evidence fingerprint | Synthetic tamper tests prove worker/migration modifications mark former Gold stale; current receipt model remains global, not per-tool scoped. No receipts rewritten. |
| #404 | Git change-impact source CI script and safe workflow PR/main, malformed/missing history fails closed, explicit NOT_RUN release/security/physical gates | 8 focused tests and local read-only classifier. Remote GitHub Actions have not run; CI success cannot waive external release gates. |

## Execution boundaries and security

- No new package installed, external vendor/engine, server-file conversion, proprietary model switch, secrets, real user document upload or production Worker/D1 migration. No push or deployment.
- The existing #237 irreversible PDF redaction remains **security HOLD**; #115/#117 fiscal/administrative source year remains incomplete; #277/#278/#280/#281 real iOS/Android device receipts are not replaced by Chromium mobile widths; #352 design direction and #414 commercial license are still owner choices.
- The previous 284 administratively completed tickets include 17 REFUSED, which remain **not shipped**. All 140 originally open issues remain open until all their own acceptance criteria are independently proven; this wave does not mass-close them.

## Follow-up execution order

1. Finish #337 typed file/result reuse, then extend #334/#335 through user-visible file-to-next-tool without automatic upload; cover CSV and other formats with independent source-bound detection and typed refusals.
2. Complete every custom-tool success hook under #330 and independently reopen real outputs (#338/#408); test phone Files/Photos/Share on actual iOS/Android hardware (#336/#362).
3. Stage real Turnstile Siteverify and account session with authorized isolated secrets, then mature shared QA #347/#405 without artificial Gold promotion; run remote CI after a separately approved push.
4. Prepare the three **actual** owner-selectable UX prototypes (#351), with #352 remaining pending. Research fiscal official sources (#397) and donor license/quality (#366–371) in parallel before opening high-risk implementations.

## Verification ledger

- New focused tests: 47/47 across #330/#333/#346/#347 and telemetry regression; #343 7/7 and #404 8/8 on their own focused runs. Real Chrome acceptance #328/#329 35 assertions, local Worker+D1 auth 130, real Chrome #330 success/fail/denied and #334 five viewport file-selection paths, real Chrome #343 V2 import/reload/reset. A desktop browser at 320px does **not** equal a physical mobile receipt.
- First full `npm test`: 238/239 files, **1,836/1,837 tests PASS**; a legacy #218 scan-to-JPEG test reached default 5-second timeout under the parallel test run. Independent re-run of `tests/pdf-scan-image-aware-218.test.ts` completed **9/9 PASS**, including the previously timed-out case in 2.56s. This is a runtime timing failure, not a record of a wholly green first suite.
- Second full `npm test` with the earlier parallel agent processes finished: **239/239 files, 1,837/1,837 tests PASS** in 18.53 seconds. Keep the earlier timeout visible for future flakiness tracking; no test threshold or original engine logic was changed to force a green result.
- Subsequent `npm run check`: **PASS** with 0 errors, 0 warnings, 22 existing test hints across 1,961 files; catalogs 269/269, format coverage and certification check passed.
- Subsequent `npm run build`: **PASS**, 291 static pages; `scripts/inspect-build.ts` PASS, 290 unique metadata pages, 284 sitemap entries and expected lazy assets. The existing bundler warning for #237 duplicate static/dynamic import remains; it is not an authorization to publish redaction.
- Git source/diff/ticket generated views verified before selective commit. Non-writing release validator currently has historical source/physical/rollback blockers; no receipts were promoted or rewritten.
