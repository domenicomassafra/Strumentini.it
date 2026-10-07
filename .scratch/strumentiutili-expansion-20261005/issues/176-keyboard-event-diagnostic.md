# 176 — Keyboard event diagnostic

**What to build:** Add a local keyboard-event inspector showing key/code/location/modifiers/repeat/composition while providing a clear stop/reset and not hijacking browser/system shortcuts.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → code-typescript → qa-browser

- [x] Inspector captures only while its test surface is active.
- [x] Keyboard-only users can exit/reset without trapped focus.
- [x] Sensitive typed content is not persisted/telemetried.

**Verification:** Browser keyboard matrix including modifiers/composition and focus exit.

**Evidence (2026-10-06):** `/tools/keyboard-event-diagnostic/` uses one focusable labelled test region and records key, code, location, modifiers, repeat and composition state only while that region is active. History is capped at 12 entries in component memory and reset is explicit. `tests/browser-diagnostics.test.ts` covers normalization and the history bound. `quality/receipts/browser-diagnostics/acceptance.json` dispatches real browser KeyboardEvents, proves modifier/repeat/composition output, `defaultPrevented=false` for a browser-style Meta+L chord, normal Tab focus exit, storage unchanged before/after, zero external requests, explicit reset and 390px usability.
