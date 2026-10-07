# 35 — Audio capture/playback utilities

**What to build:** Add browser-native microphone test, voice recorder with pause/playback/download, tone generator, metronome with tap tempo, white/pink/brown noise generator with timer, and browser TTS with available Italian voices/speed/pitch controls.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Permission prompts occur only after user action; recordings remain local; unsupported browser codec/voice capabilities are explained.

**Blocked by:** 229, 303, 304.

**Status:** blocked

- [ ] Mic/recorder permission and denial states are accessible and recoverable.
- [ ] Tone/metronome/noise timing and stop controls remain reliable when the tab changes state within documented browser limits.
- [ ] TTS lists actual browser voices rather than promising unavailable voices.

**Verification:** Media-permission browser tests, generated-audio frequency/timing checks, local-only network assertion, and mobile permission acceptance.
