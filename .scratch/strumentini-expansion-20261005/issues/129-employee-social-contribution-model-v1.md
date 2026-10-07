# 129 — Employee social-contribution model v1

**What to build:** Implement one explicitly bounded employee contribution profile from versioned official sources as a reusable salary-calculation primitive rather than burying it in the net-salary UI.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the explicitly bounded 2026 agricultural-worker OTD/OTI profile. General/cross-sector employee modeling remains unsupported.

**Status:** completed

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] Supported employment profile/limits are explicit.
- [x] Contribution base/rates/thresholds are shown in breakdown.
- [x] Unsupported employee coverage returns an explicit fail-closed availability state rather than borrowing autonomous/Gestione Separata values.

**Verification:** Independent 2026 profile examples and threshold cases.

**Progress (2026-10-07):** The pinned INPS Circular 43/2026 directly supports the general agricultural-employer OTD/OTI FPLD profile at 30.50% total, with 8.84% worker share, and the part-time €58.13 × 6/39 = €8.94 minimum formula. The pinned official INPS employee page directly reports the €58.13 daily minimum, €56,224 annual threshold for the additional 1%, and €122,295 annual base maximum. The reusable v1 derives the employer share as 21.66% = 30.50% − 8.84%, accepts an already determined FPLD contribution base, and fails closed above €56,224 instead of attempting the additional-1% path. The €122,295 figure is reference-only and is not applied by v1. General/cross-sector employees, industrial agricultural employers, special reductions, NASpI, INAIL, LOAgri, and salary/net-pay construction remain unsupported. Ticket evidence is pinned at `quality/reference-data/italy/129-employee-agricultural-calculator-evidence.json` (SHA-256 `9784a82d6093bf83a10341778a5d8901124b6b37b74cc913421e6cd7a0e6482a`), bound to source-pack SHA-256 `144c00d1377760268abcdf47e88f6680b422570d190f6c3ecee3547fb640ad73` and fixture SHA-256 `e96133f490360617e3b2fc1432d4fd7afae786bde158bb0f5a06a64214c1deb6`.
