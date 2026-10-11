# 404 — Change scoped CI and cumulative release validation

**What to build:** Affected engine and integration tests run each batch, cumulated release gates before publish

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-404.1: Affected engine and integration tests run each batch, cumulated release gates before publish.
- [ ] AC-404.2: Safety/physical checks cannot be waived by labels.
- [ ] AC-404.3: On the scoped input and failure cases, verify: Synthetic UI/Worker/engine diff pipeline mapping. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Synthetic UI/Worker/engine diff pipeline mapping; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 01 — bounded evidence

Git-aware source change-impact and non-deployment GitHub CI workflow created; eight focused tests PASS; GitHub remote workflow and mandatory physical/security/official-source release gates NOT_RUN.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 follow-up — fail-closed scope mapping, still OPEN

Independent audit identified two holes in the source-change classifier: executable Python/JS ticket validators beneath `.scratch/` were treated as docs-only, while the actual `image-visual/`, `image-resize/` and top-level `Pdf*` tool components were not all mapped to the image/PDF device gates. Regression tests reproduced both false classifications **before** the fix. The path classifier now treats executable ticket generators as CI code (full source regression), and real image/PDF component families as frontend + their engine domain, preserving affected test selection and physical-device `NOT_RUN` gates. `tests/ci-change-impact-404.test.ts`: **10/10 PASS** on the local checkout.

The GitHub branch `main` was read independently via authenticated API and matched local `origin/main` at `d0947cc` before this change. However the updated CI workflow has **not run remotely** and no release candidate or real browser/physical/security gate was approved. `AC-404.1` remains open for cumulative release validation before publication; the scoped test demonstrates correct mapping rather than production readiness. Do not close the ticket, issue a Gold receipt, push or deploy based on this follow-up alone.

**Independent security review follow-up:** the first patch still omitted the actual `src/runtime/ephemeral-file-handoff-337.ts` from the mandatory security-review gate. A test reproduced this omission (RED), then the classifier added this specific cross-window capability protocol to security-sensitive runtime inputs: focused CI tests **11/11 PASS**. This flags the required external security review as `NOT_RUN`; it does not perform that review or declare a release ready.

**2026-10-11 wave 09 security-gate regression:** code review after the #407 hostile ZIP pathname fix found that `src/runtime/file-threat-gate-407.ts` was still classified as generic shared source instead of independently security-reviewed file-parser boundary. Added a RED→GREEN regression and included that exact runtime module in the existing `security-review` gate rule. `vitest run tests/ci-change-impact-404.test.ts --maxWorkers=1`: **12/12 PASS**, unchanged release-readiness fail-closed behavior and review status `NOT_RUN`. The classifier now requests a security review; it does **not** attest that one occurred or close #404.

## 2026-10-11 wave 11 — sensitive local storage, download and sanitization paths (ticket OPEN)

**Reproduced RED:** A sole source edit to `src/workbench/saved-pdf-341.ts` was classified as generic `shared` with only `release-readiness: NOT_RUN`, omitting any independent security review or physical-device gate. The same missing security gate affected local download/opt-in policy and image metadata stripping, where sensitive bytes may be persisted, exported or falsely described as clean. Added a synthetic changed-path test first; it failed before the source patch on `security-review` missing.

**Minimal fix + GREEN:** `scripts/ci-change-impact-404.ts` now adds `security-review: NOT_RUN` for local PDF IndexedDB storage, manual/automatic browser download policy, image metadata scanners/stripper, EXIF tool and file-privacy engine, plus `physical-device: NOT_RUN` for persisted PDF and download browser boundaries. Existing `release-readiness` and `browser-a11y` gates are preserved; no review is marked `PASS` by this path classifier. `tests/ci-change-impact-404.test.ts` exercises seven exact sensitive paths with expected `NOT_RUN` gates. `vitest run tests/ci-change-impact-404.test.ts --maxWorkers=1`: **13/13 PASS** after the fix; `git diff --check` PASS. No CI assertion removed or skipped, no workflow or receipt mutation.

**Remaining:** AC-404.1–3 stay unchecked globally. This test establishes scope selection, **not** independent security attestation, physical iOS/Android measurements, current browser receipts, real rollback or Gold release readiness. No deploy authorization and no false completion.

## 2026-10-11 wave 13 — real byte-processing and consent UI mapped to security review

Fresh source review after the bounded #340/#410 and image opt-in #339 integrations found new sensitive paths missing from the independent security-review gate: `src/runtime/batch-file-410.ts` (untrusted file bytes and GZIP), `src/workbench/session-history-340.ts` (private in-memory byte snapshots), and the actual `ImageVisualTool.tsx` / `PdfTool.tsx` consent-aware UI producers. A new synthetic changed-path regression was **RED before the patch**, showing `release-readiness: NOT_RUN` but no `security-review`; after precisely scoped mapping changes, focused `tests/ci-change-impact-404.test.ts` is **14/14 PASS**. `security-review` is now **required as NOT_RUN**, not certified or waived. No runtime/file transfer code, Gold receipts or release validator was modified; AC-404.1–3 remain OPEN pending independent review and cumulative publication acceptance.
