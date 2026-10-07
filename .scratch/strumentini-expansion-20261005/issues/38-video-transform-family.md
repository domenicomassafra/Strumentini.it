# 38 — Video transform family

**What to build:** Add local video compression, common-input→MP4 conversion, audio extraction, trim, video→GIF, LUFS/audio-level analysis where proven, and a "video per l'AI" export that creates timestamped contact sheets plus deterministic context metadata without calling an AI service.

**Traces to:** US-EXP-06, US-EXP-08, US-EXP-10; AC-06.1, AC-08.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-07, C-EXP-08

**Constraints:** Heavy processing is lazy, cancellable, and local; output format claims reflect the actual encoder stack; no downloader functionality for third-party platforms is included.

**Blocked by:** 234, 306, 307, 308.

**Status:** blocked

- [ ] Compression exposes target strategy and before→after size/resolution/codec facts.
- [ ] Trim/conversion/audio extraction preserve A/V sync within tested tolerances.
- [ ] Contact-sheet export includes deterministic timestamps and source metadata.
- [ ] File/memory ceilings and unsupported devices fail early with a usable explanation.

**Verification:** Real media corpus, A/V duration-sync checks, output probing, cancellation/memory tests, and genuine iOS/Android acceptance for promoted paths.
