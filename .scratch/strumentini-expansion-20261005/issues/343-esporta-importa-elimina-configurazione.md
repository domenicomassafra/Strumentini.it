# 343 — Esporta importa elimina configurazione

**What to build:** Config favorita/recenti versionata fa roundtrip.

**Traces to:** OWN-09 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 330

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-343.1: Config favorita/recenti versionata fa roundtrip.
- [x] AC-343.2: Import maligno e vecchio schema falliscono chiaro.
- [x] AC-343.3: On the scoped input and failure cases, verify: Malformed/duplicates/reset. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Malformed/duplicates/reset; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Local V2 settings export/import preview+confirm and transactional IndexedDB comparison; real Chromium persist/reload/reset and 7 focused tests PASS. Cross-device/account/physical outcomes not proven.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-13 — original bounded AC343.1–3 closed with real current browser and fail-closed deletion proof

**Scope and genuine defect:** The original ticket requires a versioned local favourites/Recenti configuration roundtrip, clear rejection of old/malicious JSON, and malformed/duplicate/reset handling. Its historical 2026-10-11 Chromium slice already verified schema v2 source in part, but overlooked a real reset failure: `src/components/account/workbench-store.ts` ignored a selectively thrown `Storage.removeItem` exception, then claimed full local deletion although `strumentini:auto-download:v1=enabled` remained present. New real native Chrome390 RED: reset button caused a successful page reload rather than displaying the required incomplete-deletion warning under a selectively denied key. This is a reproducible user-consent/privacy correctness defect, not an unproven generic case.

**Minimal RED→GREEN production fix:** `sweep()` now returns a boolean and checks all `strumentini:*` keys remaining after best-effort removal; a removal exception, a silent no-op or a still-present key fails closed. `clearDeviceData()` preserves best-effort removal from both local and session storage independently but never reports `persisted:true` if either sweep fails. Existing IndexedDB record and voluntary PDF archive deletion checks stay in force. The settings page's existing incomplete-reset warning is reused without code change. No new keys, schema migration, storage permissions, server/account writes or automatic download consent policy changes.

**Exact main/source acceptance:** Branch based on canonical `main` `75744d89c2a8cd2cb3ab2f2cb9702b2d067dfedc`; `tests/config-import-343-20261013-real-ui.browser.mjs` serves the real freshly rebuilt static Astro 293-page output on loopback, executes **Chrome390 and WebKit390 PASS**: genuine `/tools/utm-builder/` completion and actual IndexedDB Recenti → real downloaded `strumentini-config-v2.json` byte-readback, clean v2 schema and absence of private UTM input → UI rejection with no mutation for old schema v1, `__proto__` and duplicate IDs → explicit double-confirm clear → real v2 preview+confirm import and reload with restored canonical ID/time/useCount. The independent negative injects `Storage.removeItem` `SecurityError` for only the opt-in key, verifies unrelated deletable key removed, opt-in remains and the existing Italian incomplete-reset warning is visible; this check was **RED before source fix / GREEN after** in native Chrome/WebKit. Both tests observe zero outside-origin/POST requests and no uncaught browser errors. Existing `tests/config-import-343.test.ts` checks seven cases, plus `tests/workbench-state.test.ts` seven and `tests/download-policy-339.test.ts` five: **19/19 Vitest PASS**. `npm run build` and its canonical catalog/certification/inspect-build: 293 pages PASS. No data is uploaded to a provider.

**Adjacent PDF archive confirmation:** The exact same new Chrome/WebKit settings flow additionally creates the separate real `strumentini-optin-pdf-341` IndexedDB archive with nonempty private bytes before reset and verifies `indexedDB.databases()` no longer lists it **only after the confirmed reset navigation**. The older unmodified #331 browser harness briefly produced a false red because it inspected databases immediately after the second click without awaiting the asynchronous deletion; a read-only timing-only disposable clone waiting for actual navigation reproduced #331 PASS including the separately denied-deletion scenario. The #331 source/test were not altered or bypassed, and the strengthened #343 real browser test now validates this adjacent accepted behavior independently in both browser engines.

**Acceptance and excluded assertions:** Marked original **AC-343.1/.2/.3 complete** for the explicit source/browser scope; status `completed`. The broader physical-device iOS/Android, screen reader/OS storage persistence outside tested contexts, account-cloud sync, all-catalog workflows, Gold, rollback deployment and production launch remain **NOT_RUN/NO_GO** and are not silently approved. Ticket completion is separate from release and independent physical acceptance.
