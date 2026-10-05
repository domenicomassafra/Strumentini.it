# 18 — Close CalcolaTutto 13/13 parity

**What to build:** Add a machine-readable parity test/report proving every one of the 13 CalcolaTutto jobs captured on 2026-10-05 is either implemented as a new route or explicitly satisfied by an upgraded existing route, including Base64, color conversion, and percentage/IVA presentation parity.

**Traces to:** US-EXP-02; AC-02.1, AC-02.2; DEC-EXP-01, DEC-EXP-07; C-EXP-01, C-EXP-03, C-EXP-06

**Constraints:** Parity means the user job and result quality, not cloning competitor wording or implementation; no duplicate route solely to claim parity.

**Blocked by:** 06, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17.

**Status:** blocked

- [ ] Report contains exactly 13 named source jobs with route/status/evidence mapping.
- [ ] Base64 and color-converter upgraded results are explicitly checked, not assumed.
- [ ] No row is `missing`, `todo`, or backed only by prose.

**Verification:** CI parity gate fails on any missing/mismatched row and links each row to a passing route-level acceptance scenario.

