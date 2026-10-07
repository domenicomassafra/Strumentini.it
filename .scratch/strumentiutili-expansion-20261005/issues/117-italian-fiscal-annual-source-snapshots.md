# 117 — Italian fiscal annual source snapshots

**What to build:** Create annual source snapshots for the tax rules used by IVA, IRPEF and forfettario calculations, with exact authority, effective interval, checked date and boundary metadata rather than constants embedded in calculators.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1; DEC-EXP-04

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** A complete publication-specific official artifact set for one tax year covering IVA, national IRPEF and forfettario is not pinned. Ticket 07 is complete.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-typescript → code-tdd

- [ ] Each annual rule pack has identifiable taxYear/effective dates and source links.
- [ ] Brackets/rates/coefficients can be loaded independently by fixtures.
- [ ] Unsupported year never reuses latest values silently.

**Verification:** Source snapshot/hash plus bracket/rate boundary loader tests.

**Progress (2026-10-07 recheck):** The pinned Agenzia delle Entrate checks remain Redditi PF 2026 Quadro RN and Quadro LM. The official Quadro RN material explicitly computes IRPEF for tax year 2025, so the year in the form name cannot be reused as a tax-year-2026 rule identity. The evidence-record SHA-256 is `c74a976222a220b7cd1aa1d4c9f4d1df6086327788b3b01ae6457969c78e4126`, matching `source-packs.ts`, and the focused Italy source-pack tests pass. No complete publication-specific artifact set for IVA + IRPEF + forfettario is pinned for one tax year; `source-packs.ts` therefore keeps ticket 117 `BLOCKED`, and rates, brackets, thresholds and coefficients remain deliberately unpopulated.
