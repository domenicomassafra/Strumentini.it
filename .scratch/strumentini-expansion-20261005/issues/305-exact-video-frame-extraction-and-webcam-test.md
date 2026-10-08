# 305 — Exact video frame extraction and webcam test

**What to build:** Add frame-at-timestamp extraction using the approved inspector/decode path plus a separate webcam permission/test surface, both with explicit browser precision/permission limits.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 232, 274.

**Status:** ready-for-agent

**Suggested skills:** security-audit → code-tdd → qa-browser

- [ ] Frame output reports requested vs actual decoded timestamp precision.
- [ ] Webcam permission is requested only by explicit action and recovers from deny/revoke.
- [ ] No camera/frame content is uploaded.

**Verification:** Known-frame video corpus plus webcam permission/no-network browser flow.
