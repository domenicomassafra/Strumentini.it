# 12 — Privacy-safe falsification telemetry and experiment reporting

**What to build:** Implement only the event taxonomy and opt-in/disclosed longitudinal telemetry needed to test the product thesis. Ordinary deterministic tools must remain fully functional with analytics blocked/off. Add reporting/proof for acquisition source, Workbench return, default reuse, pack/search/handoff behavior, and config portability without collecting work content.

**Traces to:** US-15 / AC-15.1 / AC-15.2 / AC-15.3 / AC-15.4 / EXP-01 / EXP-02 / EXP-03 / EXP-04 / EXP-05 / EXP-06 / DEC-21

**Constraints:** C-04 / C-05 / C-06 / C-14 / C-15 / C-16 / C-20

**Blocked by:** 02 — Local Workbench, Work Profile, and portable configuration; 03 — Deterministic Search, Command Palette, and compact Library; 11 — Generated starter Workbench and curated packs.

**Status:** implemented; one explicit blocked-endpoint full-flow acceptance remains

- [x] Event schema allowlists tool entry source, completion/failure, onboarding completion, workspace add/remove, pack install/remove, profile-default apply/override by field key only, zero-result intent/category code, handoff tool IDs/descriptor, and config export/import.
- [x] Schema rejects raw input/output, filenames, file bytes, URL values, raw search text, and Work Profile values.
- [x] Baseline page/performance measurement can use Cloudflare Web Analytics without coupling Tool Runtime to it.
- [x] Longitudinal custom telemetry is off outside an explicitly disclosed validation cohort and remains a separate adapter/network path from deterministic execution.
- [ ] Blocking the analytics endpoint does not break tool completion, Workbench persistence, onboarding, search, handoff, or export/import. **Adapter-level blocked/rejected transport behavior and tool completion are proved; one browser run with an enabled-but-aborted endpoint across every named product flow is still outstanding.**
- [x] Reporting can derive 7/30-day Workbench return, distinct tools reused, launch-source share, default apply/override, pack behavior, zero-result counts, handoff use, and config portability for the cohort.
- [x] Experiment documentation ties each derived metric to EXP-01..EXP-06 and states the corresponding narrow/reject signal without claiming market success in advance.

## Implementation evidence — 2026-09-27

- `tests/telemetry.test.ts` covers allowlisted events, forbidden payloads, explicit cohort gating, blocked transport isolation, content-free runtime events, and all derived EXP-01..EXP-06 metrics.
- `scripts/acceptance-telemetry.mjs` passes default-off posture, shipped disclosure, wired `configureTelemetry`, explicit `disclosed: true`, and local-first network inspection.
- `src/components/analytics/CloudflareWebAnalytics.astro` is an optional aggregate page/performance seam keyed only by `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`; it imports neither Tool Runtime nor the longitudinal telemetry adapter.

**Verification:** Run schema-negative tests with representative forbidden payloads, browser/network tests with analytics enabled/blocked, an end-to-end synthetic cohort that yields the required derived metrics, and a content-leak inspection confirming no raw work/profile values are emitted.
