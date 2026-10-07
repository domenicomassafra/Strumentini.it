# 304 — Browser text-to-speech Italian controls

**What to build:** Add browser SpeechSynthesis utility listing actually available voices with Italian filtering, rate/pitch controls and honest unsupported/voice-unavailable states.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → code-tdd → qa-browser

- [x] Voices come exclusively from `speechSynthesis.getVoices()` / `voiceschanged`; Italian `it-*` voices are filtered when present and the actual runtime list is shown when none are available.
- [x] Every new utterance and voice change cancels the previous speech first; explicit stop uses `speechSynthesis.cancel()` and unsupported/error/end states remain recoverable.
- [x] Copy states that Strumentini sends no text to its own network and that SpeechSynthesis is a browser/OS boundary whose underlying local/remote implementation is platform-controlled.

**Verification:** `tests/browser-audio-utilities.test.ts` covers runtime Italian filtering and control bounds. Final browser acceptance uses a SpeechSynthesis mock plus a supported-browser smoke where the capability exists.
