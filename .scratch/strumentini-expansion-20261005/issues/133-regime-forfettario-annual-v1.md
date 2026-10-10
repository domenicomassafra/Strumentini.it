# 133 — Regime forfettario annual v1

**What to build:** Implement fatturato→coefficiente→reddito→contributi→imponibile→imposta→netto for bounded supported activity/INPS profiles, with 5%/15% tax eligibility entered explicitly rather than inferred.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 131, 132.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] The complete **nine-row** ATECO2007 coefficient lookup for tax year 2025 is independently loaded from a versioned and source-hash-verified annual pack; unsupported activities fail closed.
- [ ] User must declare 5% eligibility; tool never decides legal eligibility silently.
- [ ] Contribution path is one of the explicitly supported INPS profiles.

**Verification:** Coefficient/rate boundaries and current official-source scenarios.

**2026-10-10 source-backed 2025 subset, ticket still `blocked` for complete INPS profile/eligibility/public UI:** Official Gazzetta Ufficiale Law 145/2018 Annex2 (replacement of Law190/2014 Annex4) PDF page218, SHA256 `19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142`, independently reopened through PDF.js and checked for ATECO2007 group 69–70 coefficient **78%**. Normattiva Law190/2014 2025-12-31 snapshot proves €85,000 prior-year receipts ceiling and 15% / declared conditional 5% substitute-tax scope; D.Lgs.81/2025 snapshot proves use of ATECO2007 until new official coefficients. `src/engines/italy/forfettario-133.ts` now calculates for only 2025, ATECO2007 prefixes 69/70, explicit declared eligibility, prior/current revenue up to €85,000, and **user-declared mandatory 2025 contributions already paid**, using cent-rounded income (78%) → income less paid contributions → 15% or explicitly declared 5% tax → arithmetic cash estimate. It never invents 2025 INPS rates or borrows 2026 contribution profiles; user-entered coefficient overrides, unsupported ATECO/year, higher-revenue/extra-contribution cases fail closed. `tests/italy-forfettario-133.test.ts` tests official PDF SHA and actual page218 text via PDF.js, cents examples and boundary/refusal cases. The ticket's INPS-profile auto-calculation AC and full supported activity/eligibility/UI matrix remain open, so no DONE/Gold/public route claim.

**2026-10-10 original-acceptance expansion, independently RED→GREEN:** Source-verification established the entire Gazzetta Ufficiale 2018 Annex2 page 218 nine-row schedule (40%, 40%, 40%, 54%, 86%, 62%, 40%, 78%, 67%) and `src/reference-data/italy/fiscal-annual-117.ts` now exposes `getVerifiedForfettarioCoefficients117(2025)` with **all nine rows**, exact ATECO2007 section/range prefixes, 2025 effective boundaries, source URL/path/SHA256 and year refusal. `src/engines/italy/forfettario-133.ts` consumes the annual pack instead of hardcoding 69–70; explicit mappings now cover all printed sectors, especially intermediaries **46.1=62%**, wholesaling **46.2–46.9=40%**, ambulant alimentari **47.81=40%**, ambulant altri **47.82 and 47.89=54%**, construction/immobili **41–43/68=86%**, professional sectors **78%**, remaining printed groups (including IT 62) **67%**. The printed separate code groups 47.82 and 47.89 are **not** generalized to the unlisted 47.83–47.88 interval. Parent groups 46 or 47 are rejected as ambiguous; unsupported code/year/ATECO2025 still fail closed. New `tests/italy-forfettario-annex2-full-133.test.ts` extracts the actual Gazzetta page and verifies nine exact row coefficients/source SHA, calculation scenarios and groups/exclusion boundaries; test RED initially 11/12 from absent mapping and became GREEN 13/13 after implementation. **AC1 coefficient table completed; AC2 explicit 5% declaration already complete; AC3 full 2025 supported INPS profile remains BLOCKED** (no deterministic authenticated 2025 contribution computation), along with the full legal eligibility matrix/user-facing route. The earlier progress paragraph is historical and its limited 69/70 scope is superseded by this implementation. Ticket status/dependencies remain unchanged; no Gold/DONE/release claim.
