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

**2026-10-09 verified partial primary-source tranche (no status change):** Downloaded and SHA-256-pinned three official documents under `quality/reference-data/italy/artifacts/117-fiscal-annual/`: Normattiva Law 207/2024 original/republication (`6c0ea88f...`, 2025 national gross IRPEF 23% to €28,000 / 35% to €50,000 / 43% above); Normattiva Law 199/2025 consolidated (`5ac25bed...`, from 2026 the second IRPEF rate changes from 35% to 33%); and Agenzia delle Entrate **November 2024** invoice-stamp guide (`d7f16c20...`, Elenco B reference threshold greater than €77.47, €2 indicated stamp, only documented N2.2/N3.6/N4 contexts). Unlike Redditi PF 2026, Law 199/2025 expressly changes the rate for tax year 2026. These source excerpts, intervals, source URLs, exact artifact hashes and remaining gaps live in `quality/reference-data/italy/117-fiscal-annual-evidence.json` (`a09daaeec...`) and the `#117` entry of `src/reference-data/italy/source-packs.ts`. The full pack **still BLOCKED**: the same-year official IVA rate/schedule + forfettario ATECO coefficients, annual tax eligibility and supporting artifacts have **not** been verified and no complete #117 pack is promoted.

The isolated `src/reference-data/italy/fiscal-annual-117.ts` exposes explicit `VERIFIED_IRPEF_SUBSET_ONLY` for 2025/2026 and archived `ARCHIVED_REFERENCE_ONLY` for the 2024 invoice-stamp guide. `src/engines/italy/irpef-national-127.ts` contains a bounded cents-based **national gross IRPEF only** engine, with separate bracket lines and unsupported years rejected; tax credits, deductions and local surtaxes are excluded. `src/engines/italy/invoice-stamp-reference-152.ts` is restricted to a single ordinary 2024 invoice line with a declared absence of special exemptions; all 2025/2026 and mixed/unknown situations return `OUT_OF_SCOPE`, never legal advice. These are isolated candidate cores for #127 and #152, **not** public registered tools or completed tickets. `tests/italy-fiscal-official-subsets-117.test.ts` hash-checks the real legal/agency HTML and tests boundaries, line reconciliation and year refusal; `tests/italy-source-packs.test.ts` continues checking the overall `BLOCKED` state. Other downstream #126 (IVA), #133 (forfettario), #134 (TFR/ISTAT) remain blocked by their respective exact-year source/model requirements; do not infer release from this partial work.
