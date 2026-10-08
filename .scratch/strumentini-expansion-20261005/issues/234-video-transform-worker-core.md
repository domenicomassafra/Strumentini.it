# 234 — Video transform worker core

**What to build:** Implement one lazy cancellable seam for accepted common-input→MP4, compression/target bitrate, trim and audio extraction; separate GIF/LUFS/contact-sheet follow-ons can consume it.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 232, 274.

**Status:** ready-for-agent

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Actual encoder support drives UI options.
- [ ] A/V sync and trim bounds meet documented tolerance.
- [ ] Worker cleans up on cancel/error and output signature/codec/size is verified.

**Verification:** Real media corpus, independent probes, sync/duration and physical iOS/Android evidence.
