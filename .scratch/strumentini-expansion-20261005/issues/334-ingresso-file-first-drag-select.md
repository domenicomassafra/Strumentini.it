# 334 — Ingresso file-first drag/select

**What to build:** File porta a scelta operazione senza auto-run.

**Traces to:** OWN-07 OWN-16; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 333

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-334.1: File porta a scelta operazione senza auto-run.
- [x] AC-334.2: Drag interrotto e keyboard conservano controllo.
- [x] AC-334.3: On the scoped input and failure cases, verify: Home→file→tool 320-1440. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Home→file→tool 320-1440; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 wave 05 — verified real file-first workflow

`src/components/home/HomeFileEntry.astro` already provides real keyboard-focusable file/photo pickers, bounded local format inspection, accessible status and only manifest/published-page-compatible manual operation links, and native HTML drag/drop. Reverified the **built static output** with NEW `tests/acceptance-file-first-334.mjs`: Chrome 320/390/768/1024/1440 px PASS, no horizontal overflow, both picker touch targets >=44px; real file input PDF generates route suggestions without output/autorun; interrupted drag removes drag highlight but preserves previous valid choices; an actual browser `DragEvent` with `DataTransfer` PNG switches only to image routes; reset clears all suggestions; PDF operation link navigates to the actual tool with no file input pre-populated and no result fabricated. No POST, off-origin request, or page error in the tested journey.

**Closure scope:** This confirms AC-334 navigation/control behavior at five tested viewports. The file is deliberately **not** automatically transferred or processed between pages; reselect/execute is user-controlled. The test uses Chrome desktop browser widths and is **not** a physical iPhone/Android Photos/Files receipt (#336 remains open); full parser safety remains #407, all-provider/format suggestions #335. No Gold promotion, release, deployment or uploaded data.

## 2026-10-11 implementation wave 01 — bounded evidence

Home picker/drag/drop and compatible links wired using bounded #333 detection, browser Chromium 5 viewports and valid/refused file classes tested; target tool requires file reselect, no typed byte transfer until #337; original AC remains open.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.
