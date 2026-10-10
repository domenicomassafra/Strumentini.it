# 126 — IVA add and scorporo with versioned presets

**What to build:** Add IVA calculation/scorporo using user-selectable sourced year/rate presets plus explicit custom rate, showing imponibile, IVA and totale with reproducible rounding.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 125.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd

- [ ] Preset rates link to version/year source metadata.
- [ ] Add↔scorporo round-trip follows documented rounding policy.
- [ ] Custom rate is visibly user-supplied, not sourced preset.

**Verification:** Preset snapshot, cent rounding and round-trip fixtures.

**2026-10-10 candidate source/engine tranche; remains `blocked` pending #117/year-scoped legal eligibility:** `src/engines/italy/vat-126.ts` implements actual client-side `add` and `scorporo` in integer euro cents using BigInt exact arithmetic for a **user-supplied** decimal percentage (0–100%, up to four fractional digits, Italian decimal comma allowed). `HALF_UP_AT_FINAL_CENT` policy: add rounds VAT and sets gross=net+VAT; scorporo rounds net from total and sets VAT=gross−net, so inversion can differ by at most one cent in the supported rates/fixtures. Returned result labels origin `USER_SUPPLIED`, never an officially approved transaction rate. `getVatPreset126(year,id)` explicitly refuses **all** current official presets (`VAT126_UNSOURCED_PRESET`) until full D.P.R. 633/1972 article16/Table A item/period applicability is archived. `tests/italy-vat-126.test.ts` covers exact arithmetic, half cent, 1-cent boundaries, non-surjective round-trip, 100%/0%, out-of-range, year/rate preset rejection; no public UI, no rate classifier. Existing #125 is completed; remaining blocker is the unsourced official-preset AC.

**2026-10-10 additional provenance audit:** The official Italian tax-documentation portal exposes D.P.R. 633/1972 article 16 (ordinary 22% from 01/10/2013) and a long multi-version Table A. However, the live `executePrintArticolo.do` PDF for Table A was independently fetched and reopened and contained *only a one-page header*, not the item-by-item effective-date applicability necessary for an authoritative **tax year 2025** reduced-rate transaction classifier. No specific 2025 rate row was invented. Therefore official presets still **0 certified**, and the custom-rate calculation remains the genuinely implemented and tested product subset. Preset AC and full year/source/date accuracy remain blocked. The full source URL/effective-date capture and legal annex item classifier belong upstream #117; do not silently certify 22/10/5/4 merely from current-rate descriptions.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #398.

**Next actionable AC:** Preset rates link to version/year source metadata.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
