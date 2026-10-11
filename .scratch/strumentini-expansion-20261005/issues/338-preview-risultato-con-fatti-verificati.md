# 338 — Preview risultato con fatti verificati

**What to build:** Anteprima e metriche sono derivate dall'output.

**Traces to:** OWN-03 OWN-08; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-338.1: Anteprima e metriche sono derivate dall'output.
- [x] AC-338.2: Preview fallita non fa perdere bytes né inventa precisione.
- [x] AC-338.3: On the scoped input and failure cases, verify: Independent PDF/CSV/PNG reopen. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Independent PDF/CSV/PNG reopen; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

`src/runtime/output-facts-338.ts` and PDF result UI show only bounded output-byte PDF page count/version/dimensions/rotation or PNG IHDR+CRC facts; unavailable preview leaves verified download untouched. 7 focused tests, 20 tests with #337/PdfResult, independent pdfjs/Sharp oracles PASS. Real Chromium PDF Merge generated artifact → factual 2-page UI + download preserved. CSV preview and visual/pixel fidelity outside proof, ticket remains open.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 05 — closure of scoped PDF/PNG/CSV output facts

The independent output bytes checks in `scripts/verify-output-consumers-408.ts` reopened true PDF with pdfjs-dist, PNG via sharp and RFC4180 CSV via separate decoder (alongside DOCX/XLSX/WAV); #408 source-local six-family consumer verification and adversarial negative fixtures PASS. `src/runtime/output-facts-338.ts` preserves the prior PDF page metadata and strict PNG chunk/CRC inspector and now independently inspects RFC4180 CSV with quoted delimiters, doubled quotes, newline-in-cell, strict UTF-8 and bounds. `CsvTableResultV2.tsx` shows output-derived CSV rows/columns only when verified and structurally reread. `PdfTool.tsx` now exhaustively handles CSV/PDF/PNG facts union. Negative tests check malformed/ragged/budget-limit CSV and unverified/preview-unavailable output without changing the verified downloadable artifact. `tests/output-facts-338.test.ts` 9 PASS and actual `tests/acceptance-csv-output-facts-338.mjs` Chrome **PASS**, including real CSV dedupe producer, multiline/quoted input, displayed two data rows by two columns, downloaded CSV independently reopened from browser path, duplicate removed, no upload/page errors. Initial dev-server HTTP 504 for Vite stale optimized dependency prevented Preact hydration, cured by controlled dev restart; subsequent actual browser result PASS. Not a visual pixel equivalence, Office playback, native physical mobile or production deployment proof; release remains NO-GO.
