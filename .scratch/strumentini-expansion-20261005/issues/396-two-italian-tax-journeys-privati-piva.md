# 396 — Two Italian tax journeys privati PIVA

**What to build:** Separate tax routes for worker/employee and partita IVA with year and assumptions

**Traces to:** OWN-11; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** base

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-396.1: Separate tax routes for worker/employee and partita IVA with year and assumptions.
- [ ] AC-396.2: No case-specific legal advice or unsourced values.
- [ ] AC-396.3: On the scoped input and failure cases, verify: Anonymous customer journeys for each supported year. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Anonymous customer journeys for each supported year; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 — Two anonymous, year-scoped catalog-route journeys (worker-14)

**Status: bounded implementation delivered, original AC-396.1–3 OPEN / unchecked.** No new public route, catalog manifest, generated index, source-year ledger, registration account, service/API endpoint, official tariff or Gold receipt was added. On HEAD 39e0782713b23e67e5deecdc1565d777f9ef431b the existing catalog had no dedicated IRPEF/forfettario route, so two clearly separate supplementary panels were integrated into existing registered routes: src/pages/tools/codice-fiscale.astro (privati/dipendenti: national gross IRPEF informational calculator, not code-fiscale attribution) and src/pages/tools/partita-iva-validator.astro (Partita IVA: 2025 forfettario model, **not** official company existence, legal/regime eligibility or validation). Both are client-side only; existing primary tools remain intact. Each page visibly links to the other, identifies exactly which distinct tax-year subset is supported, and shows assumptions/refusal messages without personalized tax advice.

**Official source scope read-only:** Reused existing source-bound engine calculateNationalGrossIrpef127 with 2025/2026 verified national brackets (does NOT infer net payslip, deductions, credits, surtaxes, contributions or personal liability) and existing calculateForfettario133 with 2025-only official nine-row ATECO2007 Annex2 map, explicit user-declared eligibility, an explicit already-paid verified mandatory-contributions amount and standard/startup self-declaration. No 2026 forfettario rate/coefficient or ATECO2025 equivalence was invented. Checked local source snapshot SHA-256s against their read-only pinned src/reference-data/italy/fiscal-annual-117.ts declarations: Normattiva 207/2024 6c0ea88f...2517b5, Normattiva 199/2025 5ac25bed...078f85, Gazzetta Annex2 19e50742...bbd142, Normattiva law190 b84353f1...fbfb, D.Lgs.81/2025 0ea7d51d...9c5669 — all matched local byte hashes at test time. This is **not** independent certification of the #397 ledger or proof of every official-year condition.

**Browser TDD RED→GREEN:** New tests/tax-journeys-396.browser.mjs first failed against the existing static build because the anonymous private journey was genuinely missing (data-tax396=privati: 0, expected 1). After implementation, rebuilt real static pages and ran independent Playwright Chromium at 390x844 against its own local static server. **PASS**: input EUR 40,000 already-taxable national income yields EUR 10,640 gross IRPEF for tax year 2025 and EUR 10,400 for 2026; switching years clears stale output before recomputation; unsupported 2024 and negative income explicitly refuse with no answer. Partita IVA test with ATECO2007 62.01.00, 2025 prior-year receipts EUR 20,000, current receipts EUR 30,000, independently user-confirmed paid mandatory contributions EUR 1,000, declared standard 15% gives **EUR 2,865** modeled substitute tax (67% coefficient, EUR 19,100 modeled tax base). Unsupported 2026, unconfirmed eligibility, unlisted ATECO 47.83.00 and startup 5% without additional confirmation all **refuse** and clear stale output. The test observes **zero HTTP POST/PUT/uploads, zero offsite requests and zero browser page errors**; no form data is persisted. Viewport test is **not physical mobile acceptance**.

**Compatibility evidence:** Direct Astro build followed by unchanged scripts/inspect-build.ts **PASS**, 292 pages, expected public route set and historical discovery baseline preserved; 25/25 existing scoped annual-source and forfettario source-acceptance Vitest tests **PASS**. No changes to #397 ledger (worker-8 read-only), or #329/#330/#339/#394/#404/#406/#407, no Gold promotion, commit/push/deploy.

**Explicit NO_GO:** Entire annual INPS/AdE/ISTAT source inventory #397 not independently attested here; no all-years 2026 forfettario source, no employee net-salary calculation (the employee/privati route only models already-taxable **national gross IRPEF**), no automated legal-regime eligibility or case-specific tax advice. Actual physical iOS/Android/browser matrix, full tax circumstances, future-year refresh and external policy review NOT_RUN. **Do not close or claim complete Italian tax advice from these bounded 2025/2026 anonymous journeys.**

**Concurrent global check caveat:** Astro check on 2018 files returned 2 errors, both in worker-8-owned tests/audit-397.test.ts: attempted imports of validOfficialEvidence397 and inspectOfficialSnapshotPath397 missing from scripts/validator/audit-397. There were 0 warnings and 23 unrelated hints. This does NOT constitute a global Astro PASS; the #396 route build/inspect and browser verification independently passed, and no #397 source/test/ledger file was changed.
