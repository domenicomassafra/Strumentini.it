# 11 — Generated starter Workbench and curated packs

**What to build:** Once the full 15-tool set is genuinely Gold, implement the four-stage deterministic onboarding and curated pack/starter resolution so at least four work contexts produce editable 10–15-tool Workbenches with visible structured reasons. Never recommend a non-Gold placeholder.

**Traces to:** US-02 / AC-02.1 / AC-02.2 / AC-02.3 / AC-02.4 / US-05 / AC-05.1 / AC-05.2 / AC-05.3 / US-06 / AC-06.4 / DEC-02 / DEC-04 / DEC-05 / DEC-06 / DEC-19

**Constraints:** C-02 / C-03 / C-05 / C-07 / C-11 / C-13 / C-16 / C-19 / C-20 / C-21 / C-22

**Blocked by:** 02 — Local Workbench, Work Profile, and portable configuration; 03 — Deterministic Search, Command Palette, and compact Library; 04 — Client time and business-math Gold family; 05 — Campaign URL and naming Gold family; 07 — CSV Dedupe, Column Map, and typed handoff; 08 — Text/list and research-reference Gold family; 09 — Native-first Image Resize Gold vertical; 10 — File Hash / Checksum Verifier Gold vertical.

**Status:** implemented-fail-closed; full 15-Gold validation remains blocked on Ticket 09 physical evidence

- [x] Promise screen offers Set up my tools and Skip/Browse Library; no account gate or feature-tour carousel is introduced.
- [x] Setup has at most four substantive stages: work context, recurring jobs, safe defaults, starter-set review.
- [x] Recommendation rules consume structured role/job/tool metadata only and filter candidates to current Gold eligibility.
- [x] At least Client Work, Campaign Ops, Data Cleanup, and Research Evidence contexts generate 10–15-tool sets; every pair has a symmetric membership difference of at least four tools and every recommendation has one visible reason.
- [x] Starter review supports remove/add/search before acceptance and persists only the accepted set/defaults.
- [x] Pack detail shows audience/job, count, reasons, installed count, checklist, and Add recommended; a pack never duplicates tool implementation.
- [x] A tool remains manually removable after pack installation without corrupting pack or Workbench state.
- [x] Cross-tool acceptance demonstrates the same Work Profile mechanism benefiting at least three tools across at least two engine families.
- [ ] Mobile onboarding preserves task hierarchy and all selection/accept actions are keyboard/touch accessible. **Current browser acceptance proves the resulting Workbench at 390 px; a complete 390 px traversal of all onboarding stages is still outstanding.**

**Verification:** Run deterministic recommendation fixtures for four+ contexts, an exact pairwise symmetric-difference >=4 assertion, a guard that rejects non-Gold recommendations/unresolved pack IDs, browser acceptance for skip/setup/review/edit/install/remove, Work Profile cross-tool proof, and 390 px/keyboard accessibility acceptance.

## Readiness gate

Ticket 11 must not start while any validation-set tool is non-Gold. `npm run frontier:v1` writes the current 15-tool certification frontier to `quality/receipts/v1-gold-frontier.json`; `npm run frontier:v1:require-gold` is the fail-closed implementation gate and must exit successfully before this ticket changes to in-progress.

As of 2026-09-23, 14/15 tools are Gold. Image Resize remains PARTIAL solely because the required real iOS Safari and Android Chrome boundary/Files acceptance receipts are absent. No onboarding/pack implementation should silently substitute that PARTIAL tool or advertise a 15-Gold set early.

## Implementation evidence — 2026-09-27

- Deterministic starter fixtures cover the four primary contexts, 10-tool bounded sets, pairwise symmetric difference >=4, visible reasons, and fail-closed Gold filtering.
- The Workbench now exposes pack details with audience/task context, installed counts, per-tool reasons/checklist, and an explicit Add recommended action.
- Pack identity and tool membership are deliberately decoupled: removing a tool after pack installation does not corrupt the pack; removing the pack does not remove manually retained tools.
- `scripts/acceptance-workbench.mjs` passes pack install/customize/remove against persisted IndexedDB state.
- Work Profile reuse is covered across Business Day (`date-time`) plus Timezone Overlap / Rate Converter / Margin-Markup (`client-time-math`).
