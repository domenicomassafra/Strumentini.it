# 303 — Tone metronome and noise generator

**What to build:** Add browser-native tone, metronome with tap tempo, and white/pink/brown noise modes with reliable stop/timer controls and explicit browser-background limitations.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] Web Audio context/source creation occurs only inside the explicit `Avvia` click; stop clears timers, stops the active source and closes the context, with cleanup on unmount.
- [x] The UI states the browser scheduling/background limitation; duration uses an absolute deadline and rechecks it on `visibilitychange` rather than pretending background timers are reliable.
- [x] Tone is bounded to 20–20,000 Hz, metronome to 30–300 BPM, output level to 0–0.2 and duration to at most one hour; white/pink/brown sample generation is bounded to [-1,1].

**Verification:** `tests/browser-audio-utilities.test.ts` covers bounds, injected-source noise and tap-tempo timing. Final browser acceptance exercises gesture start, stop and visibility/deadline recovery with mocked Web Audio nodes.
