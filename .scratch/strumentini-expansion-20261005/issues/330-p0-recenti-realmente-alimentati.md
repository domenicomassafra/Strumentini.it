# 330 — P0 Recenti realmente alimentati

**What to build:** Operazione reale aggiorna recenti ID e ora.

**Traces to:** OWN-09 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P0; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/recent-after-result-390.png; real tool success did not call noteToolUse in observed user path. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-330.1: Operazione reale aggiorna recenti ID e ora.
- [ ] AC-330.2: Nessuna persistenza di file/risultati sensibili; IndexedDB negato gestito.
- [ ] AC-330.3: On the scoped input and failure cases, verify: Tool result→preferiti→reload. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Tool result→preferiti→reload; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Local UTM and PDF successes feed IndexedDB tool ID/time/count; failures, duplicate PDF submission, storage denial and reload tested in real Chromium; custom renderers beyond shared hook/PdfTool not yet covered. Original AC remains open.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 wave 04 — four additional real custom operation producers

`VcfViewerCsvExportTool`, `CsvDedupeTool`, `TimezoneOverlapTool`, and `ImageResizeTool` now record completed tool IDs, timestamps and use-count via the existing private metadata-only #330 workbench hook **only after actual output success**; cancelled, invalid, duplicated or stale operations do not record completions. `tests/acceptance-recent-custom-330.mjs` exercised real local Chrome routes VCF → CSV dedupe → timezone overlap → image resize, negative controls, duplicate clicks, private file/input sentinel absent from IndexedDB and requests, area `/preferiti/` and reload, plus storage-getter denial with usable tool and explicit warning; PASS, no external data write. Existing 3 focused unit tests PASS. Other bespoke tool result renderers have not been comprehensively inventoried, so this is a verified four-family implementation tranche, NOT universal ticket closure, Gold, or cross-device attestation.

## 2026-10-11 wave 08 — additional standalone success producers, original ticket OPEN

The shared `useToolOperation` already records only current successful runs; this tranche adds the existing metadata-only `recordCompletedTool` hook to independent producers in `CsvCleanerTool`, `CsvColumnMapTool`, `FileHashTool`, `FilePrivacyTool` (covering its distinct operation IDs), `CampaignNameTool`, `PasswordStrengthEstimatorTool`, `PasswordPinPassphraseGeneratorTool` and `PrintablePdfTool`. Only the canonical tool ID is passed: no password, generated secret, filename, CSV cell, checksum, output bytes or document content. Failed producer runs do not record completion. Asynchronous CSV cleaner, mapper, hash and file-privacy paths now suppress duplicate concurrent submissions and stale completions after cancel, reset or relevant schema changes; `CampaignNameTool` invalidates an obsolete generation on field/preset changes. File-privacy inputs are disabled while processing so a result cannot be presented as if it belongs to a different current selection.

**Fresh browser proof:** `node tests/acceptance-recent-bespoke-330.mjs http://127.0.0.1:4978` **PASS** on local Chrome at 390px for seven real producer routes: password-strength-estimator, password-pin-passphrase-generator, campaign-name, csv-cleaner, csv-column-map, file-hash, filename-sanitizer (a FilePrivacy operation). It checks invalid operations do not populate history, duplicate synchronous submit causes just one count for tested asynchronous producers, only `{toolId,lastUsedAt,useCount}` survives in the actual IndexedDB state, no private input/secret leaks into recent records or POST/external requests, and `/preferiti/` reload retains the seven IDs. The previously covered four custom renderers and shared operation-hook paths are unchanged. `./node_modules/.bin/astro check` reported 0 errors / 0 warnings / 22 pre-existing hints over 1,995 files. No dependency, receipt or production state changed.

**Residual/not proved:** `PrintablePdfTool` has the same completion hook after local PDF.js preview verification, but the exploratory real Chrome producer run did not reach a displayed verified PDF within 60 seconds; its browser success path is **NOT_PASS**, not part of the seven-route green check. Other bespoke video, image, PDF, OCR and auxiliary renderers need the same caller-by-caller success/cancel/privacy audit before AC-330.1 can be declared universal. IndexedDB-denied recovery has prior browser proof in `tests/acceptance-recent-custom-330.mjs`; native physical iOS/Android and screen-reader coverage remain NOT_RUN. Original AC-330.1/2/3 are not globally checked, issue stays OPEN; no Gold, dashboard rewrite, push or deploy.

## 2026-10-11 P1 review fix — FilePrivacy result invalidated on edits

`FilePrivacyTool.tsx` now clears the previously completed result and its associated copy/download/retry actions on **every** input edit: primary/before/after file selections, pasted text and expected checksums, names and rename pattern, references, optional hashing, recipient confirmation and sensitive-content confirmation. Input edits continue to update their original state without changing the asynchronous execution path or recording a new Recenti entry. `node tests/acceptance-file-privacy-stale-330.mjs http://127.0.0.1:4978` **PASS** in local Chrome: `filename-sanitizer` real successful output first appears, then editing its input removes the old result and actions, returns the result panel to idle and leaves Recenti `useCount` at 1. Source audit confirms each of the 11 edit handlers calls the common invalidation helper. This is a targeted regression proof for the filename route; the remaining controls have source-level coverage but are **not** separately browser-attested. #330 remains OPEN with its earlier physical and renderer coverage gaps.

## 2026-10-11 video-family source-success tranche — partial AC, OPEN

At source HEAD `bd919ac3`, the only registered public video-family ID is `video-inspector`, on `/tools/video-inspector/`: the child panels for decoded PNG frame, GIF, WAV, video MP4 transform and contact-sheet ZIP do not have separate catalog IDs. None of these bespoke consumers calls the shared `useToolOperation`; previous code had no Recenti success hook. Six video UI modules now call existing `recordCompletedTool("video-inspector")` **only after actual current successful output**, covering seven distinct operations: real MP4 inspection, successful theoretical bitrate plan, decoded frame, verified GIF, verified WAV, successfully encoded MP4 with computed compression receipt, and contact sheet PNG+ZIP. Existing abort/in-flight/generation protection prevents cancellation and obsolete async worker completions from counting. Contact-sheet additionally checks current abort-controller identity. Changing the frame timestamp while busy now aborts/invalidates its current generation instead of publishing an obsolete frame. Mere media load, capability probe, camera activation, failure, cancellation and selecting a new file do **not** record. Every recorder call passes only canonical tool ID; the existing store maintains timestamp/useCount.

**Red→green browser:** New `tests/recent-video-330.browser.mjs` on isolated local Astro `http://127.0.0.1:4987` first **FAILED** before the source patch after a real inspected MP4 because IndexedDB Recenti was empty. With patch, Chrome at 390px **PASS**, proving five different real output pathways (MP4 inspection, bitrate budget, PNG frame, animated GIF, WAV extraction), invalid MP4 and frame-refusal not counted, duplicate synchronous inspection click counted once, explicit GIF cancellation counted zero, only `{toolId,lastUsedAt,useCount}` persisted (no filename/payload), `/preferiti/` and reload show the video tool, no POST/offsite requests or browser page errors. Contact sheet on this run returned `VIDEO_CONTACT_TIMESTAMP_UNVERIFIED` and correctly did **not** count or expose an output; positive #308 browser success for this new hook is **NOT_PASS** in this run. Video MP4 conversion hook is present after actual verified encode and computed receipt but has **no fresh browser-success proof** in this tranche; do not claim that path PASS. Seven targeted Vitest files **29/29 PASS**, `astro check` 1,997 files **0 errors, 0 warnings, 22 existing hints**, scoped `git diff --check` PASS. No paid/provider access, upload, deployment, dashboard mutation or newly invented video tool ID. Remaining original AC-330.1 coverage across unrelated bespoke renderer families, browser outcomes for two video paths and physical mobile/storage denial still open; ticket status unchanged.
