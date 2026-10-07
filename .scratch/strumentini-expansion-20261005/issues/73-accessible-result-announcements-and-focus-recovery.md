# 73 — Accessible result announcements and focus recovery

**What to build:** Define one shared accessibility contract for result announcements, focus placement, retry/recovery and non-color state cues without re-announcing an entire large result on every update.

**Traces to:** US-EXP-01; AC-01.3

**Constraints:** C-EXP-04, C-EXP-09; WCAG 2.2 AA floor from DESIGN.md.

**Blocked by:** 72 — Result operation state model with partial and warning.

**Status:** completed

**Suggested skills:** inclusive-design → interaction-design → qa-browser

- [x] Running/success/warning/partial/error have distinct accessible semantics.
- [x] Error/retry focus is deterministic and keyboard usable.
- [x] Large results announce concise state rather than full payload.

**Verification:** 390px keyboard, 200% zoom, reduced-motion and accessibility-tree browser fixtures.

**Evidence:** ResultAccessibility plus browser gates prove distinct non-color state cues, concise live announcements, deterministic error/retry focus, keyboard use, reduced motion, 390px and 200% zoom.
