# 120 — CAP to Comune source feasibility decision

**What to build:** Research and record an IMPLEMENT or REFUSE decision for CAP↔Comune using maintainable authoritative/licensable data; do not infer postal coverage from municipality codes.

**Traces to:** US-EXP-07; AC-07.1; DEC-EXP-07

**Constraints:** C-EXP-02, C-EXP-06; primary sources only for the decision; no scraped opaque dataset.

**Blocked by:** None — ticket 07 is complete; feasibility is decided from the admissible evidence lane.

**Status:** completed

**Suggested skills:** research-primary-sources → plan-tickets

- [x] Candidate source ownership/licence/update cadence is documented: no admissible nationwide candidate with those properties is proven by the repository-vendored primary-source evidence.
- [x] Ambiguous many-to-many CAP relationships are an explicit IMPLEMENT requirement; no mapping model is shipped under the refused decision.
- [x] If no maintainable source exists, the route stays REFUSED with reason.

**Verification:** Primary-source evidence note and reproducible sample checks.

**Evidence (2026-10-06):** \`src/reference-data/italy/source-packs.ts\` records decision version \`120-feasibility-2026-10-06.1\` as \`REFUSED\`, with source-change reopen policy. \`quality/reference-data/italy/120-cap-comune-feasibility-evidence.json\` records the allowed repository evidence search, required ownership/licence/update/ambiguity properties and refusal rationale; its SHA-256 is pinned in the decision record and verified by \`tests/italy-source-packs.test.ts\`. No authoritative nationwide mapping is proven within the allowed evidence, so CAP coverage is not inferred from municipality/Belfiore codes and no opaque scraped dataset is substituted. Reopen only when an authoritative/licensable/versioned nationwide source is vendored or an approved repository fetch pipeline can reproduce it.
