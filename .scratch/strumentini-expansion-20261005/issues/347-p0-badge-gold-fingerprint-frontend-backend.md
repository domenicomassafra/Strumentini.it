# 347 — P0 Badge Gold fingerprint frontend backend

**What to build:** Badge fonte-bound copre worker/backend e codice rilevante.

**Traces to:** OWN-03; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** cross-cutting

**Priority:** P0; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-347.1: Badge fonte-bound copre worker/backend e codice rilevante.
- [ ] AC-347.2: Worker modificato invalida claim pertinenti.
- [ ] AC-347.3: On the scoped input and failure cases, verify: Simulated worker diff and badge check. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Simulated worker diff and badge check; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 01 — bounded evidence

worker/ API code and D1 migrations included in source fingerprint; four synthetic source-tamper tests PASS and prior source-matching Gold claims stale after backend change. Per-tool scoped receipts/badge identity and release candidate still pending.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 wave 04 — public Gold claims now fail closed; positive reissue still blocked

`src/onboarding/quality.ts` and `scripts/tool-factory/generate-catalog.ts` now require cryptographically bound receipt bytes, canonical source fingerprint including `worker/` implementation **and** D1 migration SQL, uniquely validated per-tool certification and receipt proof before projecting a public Gold badge. `scripts/audit-gold-source-binding-347.ts` emits independent detailed NO_GO diagnostics. Current public catalog: **269 tools, 0 source-verified Gold** rather than continuing to expose 257 stale historical badges. Underlying tools/catalog routes remain present; historical receipts are untouched and never promoted.

New `tests/gold-source-binding-347.test.ts` **7/7 PASS** with Worker/D1/add/delete tampering and stale/missing proof; `tests/onboarding.test.ts` **6/6 PASS** with positive behavior only from explicitly synthetic fixture data. Two identical official generator runs bit-for-bit stable and catalog `--check` PASS. This proves *refusal* of unsafe claims, not current certification of any tool.

**Outstanding #347 gate:** `currentEvidenceSourceFingerprint` currently includes the auto-generated `src/generated/quality.ts`; a positive Gold projection changes that file and would thereby change its own global source hash. A separately designed **non-self-referential, versioned evidence source scope**, fresh bound receipts, and independent positive end-to-end bootstrap/reissue test are required before claiming a complete bidirectional Gold proof system or closing this ticket. Never waive Worker/D1 coverage to obtain a positive badge. Release/deploy/physical evidence remain NO_GO/NOT_RUN.
