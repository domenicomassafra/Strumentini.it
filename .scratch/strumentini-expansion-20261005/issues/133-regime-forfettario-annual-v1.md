# 133 — Regime forfettario annual v1

**What to build:** Implement fatturato→coefficiente→reddito→contributi→imponibile→imposta→netto for bounded supported activity/INPS profiles, with 5%/15% tax eligibility entered explicitly rather than inferred.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 131, 132.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Coefficient lookup is versioned and source-backed.
- [ ] User must declare 5% eligibility; tool never decides legal eligibility silently.
- [ ] Contribution path is one of the explicitly supported INPS profiles.

**Verification:** Coefficient/rate boundaries and current official-source scenarios.

**2026-10-10 source-backed 2025 subset, ticket still `blocked` for complete INPS profile/eligibility/public UI:** Official Gazzetta Ufficiale Law 145/2018 Annex2 (replacement of Law190/2014 Annex4) PDF page218, SHA256 `19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142`, independently reopened through PDF.js and checked for ATECO2007 group 69–70 coefficient **78%**. Normattiva Law190/2014 2025-12-31 snapshot proves €85,000 prior-year receipts ceiling and 15% / declared conditional 5% substitute-tax scope; D.Lgs.81/2025 snapshot proves use of ATECO2007 until new official coefficients. `src/engines/italy/forfettario-133.ts` now calculates for only 2025, ATECO2007 prefixes 69/70, explicit declared eligibility, prior/current revenue up to €85,000, and **user-declared mandatory 2025 contributions already paid**, using cent-rounded income (78%) → income less paid contributions → 15% or explicitly declared 5% tax → arithmetic cash estimate. It never invents 2025 INPS rates or borrows 2026 contribution profiles; user-entered coefficient overrides, unsupported ATECO/year, higher-revenue/extra-contribution cases fail closed. `tests/italy-forfettario-133.test.ts` tests official PDF SHA and actual page218 text via PDF.js, cents examples and boundary/refusal cases. The ticket's INPS-profile auto-calculation AC and full supported activity/eligibility/UI matrix remain open, so no DONE/Gold/public route claim.
