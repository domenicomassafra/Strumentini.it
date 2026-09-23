# 07 — CSV Dedupe, Column Map, and typed handoff

**What to build:** Deepen the proven table module with CSV Dedupe and CSV Column Map/Reorder, then implement the first required typed handoff from CSV Cleaner to CSV Dedupe with an explicit payload preview. Preserve independent focused routes while reusing one parsed table representation and engine.

**Traces to:** US-08 / AC-08.1 / AC-08.2 / AC-08.3 / AC-08.4 / US-10 / AC-10.1 / US-11 / AC-11.1 / AC-11.4 / T09 / T10

**Constraints:** C-04 / C-05 / C-06 / C-09 / C-10 / C-11 / C-12 / C-13 / C-20 / C-21

**Blocked by:** 02 — Local Workbench, Work Profile, and portable configuration; 06 — CSV parser gate and CSV Cleaner Gold vertical.

**Status:** ready-for-agent

- [ ] CSV Dedupe supports explicit whole-row/key-column rules, stable deterministic output, idempotence where applicable, and duplicate-header/empty-key edge fixtures.
- [ ] CSV Column Map/Reorder previews output schema/order, preserves row data under declared rules, and handles missing/duplicate column names explicitly.
- [ ] Table tools reuse one deep parsed-table engine; manifests remain independently searchable/openable and do not import each other.
- [ ] Handoff compatibility is derived from emitted/accepted table descriptors, never direct imports.
- [ ] CSV Cleaner completion can propose CSV Dedupe; the proposal shows row count/payload description and transfers only after explicit user action.
- [ ] Incompatible/lossy descriptors are rejected or disclosed before transfer and no task history is implicitly persisted by handoff.
- [ ] Both new tools and the required Cleaner→Dedupe flow pass Gold/browser/mobile/keyboard acceptance.

**Verification:** Run table dedupe/schema fixtures and properties, a module-dependency check proving no direct tool imports, browser acceptance for Cleaner→Dedupe payload preview/confirm/cancel, incompatible handoff tests, and Gold certification for T09/T10.
