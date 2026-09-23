# 12 — Privacy-safe falsification telemetry and experiment reporting

**What to build:** Implement only the event taxonomy and opt-in/disclosed longitudinal telemetry needed to test the product thesis. Ordinary deterministic tools must remain fully functional with analytics blocked/off. Add reporting/proof for acquisition source, Workbench return, default reuse, pack/search/handoff behavior, and config portability without collecting work content.

**Traces to:** US-15 / AC-15.1 / AC-15.2 / AC-15.3 / AC-15.4 / EXP-01 / EXP-02 / EXP-03 / EXP-04 / EXP-05 / EXP-06 / DEC-21

**Constraints:** C-04 / C-05 / C-06 / C-14 / C-15 / C-16 / C-20

**Blocked by:** 02 — Local Workbench, Work Profile, and portable configuration; 03 — Deterministic Search, Command Palette, and compact Library; 11 — Generated starter Workbench and curated packs.

**Status:** ready-for-agent

- [ ] Event schema allowlists tool entry source, completion/failure, onboarding completion, workspace add/remove, pack install/remove, profile-default apply/override by field key only, zero-result intent/category code, handoff tool IDs/descriptor, and config export/import.
- [ ] Schema rejects raw input/output, filenames, file bytes, URL values, raw search text, and Work Profile values.
- [ ] Baseline page/performance measurement can use Cloudflare Web Analytics without coupling Tool Runtime to it.
- [ ] Longitudinal custom telemetry is off outside an explicitly disclosed validation cohort and remains a separate adapter/network path from deterministic execution.
- [ ] Blocking the analytics endpoint does not break tool completion, Workbench persistence, onboarding, search, handoff, or export/import.
- [ ] Reporting can derive 7/30-day Workbench return, distinct tools reused, launch-source share, default apply/override, pack behavior, zero-result counts, handoff use, and config portability for the cohort.
- [ ] Experiment documentation ties each derived metric to EXP-01..EXP-06 and states the corresponding narrow/reject signal without claiming market success in advance.

**Verification:** Run schema-negative tests with representative forbidden payloads, browser/network tests with analytics enabled/blocked, an end-to-end synthetic cohort that yields the required derived metrics, and a content-leak inspection confirming no raw work/profile values are emitted.
