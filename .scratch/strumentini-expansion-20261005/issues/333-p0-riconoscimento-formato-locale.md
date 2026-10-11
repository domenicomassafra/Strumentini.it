# 333 — P0 Riconoscimento formato locale

**What to build:** Magic/MIME identificano solo formati realmente supportati.

**Traces to:** OWN-07 OWN-10; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P0; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-333.1: Magic/MIME identificano solo formati realmente supportati.
- [x] AC-333.2: Estensioni false e polyglot non forzano engine errato.
- [x] AC-333.3: On the scoped input and failure cases, verify: Fixture MIME mismatch e zero network. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Fixture MIME mismatch e zero network; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

Bounded candidate detector built in src/runtime/file-detection.ts, 18 focused tests PASS for magic/MIME, ZIP/OOXML, oversized, hostile, cancellation and failures. No user-facing integration or full decoder guarantee by this ticket alone.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 implementation wave 04 — scoped detector and real user path completed

- `src/runtime/file-detection.ts` verifies bounded magic/MIME/signature, canonical extension and observed polyglot ZIP/PDF/JPEG; false binary extensions and incompatible MIME fail closed, unsupported contents never gain a tool route by extension alone. `src/components/home/HomeFileEntry.astro` runs the actual detector on both native input paths; Photos refuses supported non-image types and retains #336 cancel/retry/previous-choice semantics. This is a **candidate detector**, not a full parser proof, AVIF/HEIC guarantee or Gold certification. Full hostile parser/ZIP object graphs remain ticket #407.
- **Native focused tests:** #333 detector/UI + #407 threat gate 33/33 PASS, two genuine failing adversarial regressions (PNG renamed .exe, PDF containing ZIP) were reproduced before correction and pass after source changes.
- **Actual browser acceptance:** `node tests/acceptance-file-format-333.mjs http://127.0.0.1:4977` **PASS** on current local Astro development source + Chrome 390px: real file chooser, supported PNG/PDF, rejected false MIME/extension and observed polyglot, Photos scope, read cancellation/races, no outbound request/upload/page errors; accessible two-picker #336 regression checked. Real iOS/Android file-provider dialogs NOT_RUN, and deep ZIP/PDF parsing belongs to #407, not this preflight claim.
- **Scope:** No cross-device certification, remote request, user file persistence, provider use, publish, deployment, physical pass, or Gold promotion. Every supported result remains a candidate requiring the chosen tool engine's own verification.
