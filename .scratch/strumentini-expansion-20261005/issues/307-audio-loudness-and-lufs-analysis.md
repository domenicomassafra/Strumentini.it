# 307 — Audio loudness and LUFS analysis

**What to build:** Add offline loudness analysis only if the approved DSP path can implement a documented standard profile; result is analysis, not automatic broadcast compliance certification.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 273 — Audio codec and DSP feasibility spike.

**Status:** completed

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] Measurement mode/standard assumptions are named.
- [x] Integrated/peak values are reproducible on fixture signals.
- [x] No compliance claim is made without full required measurement context.

**Verification:** Reference audio signals and independent expected ranges.

**Cross-engine acceptance extension (2026-10-08):** The same real synthesized WAV fixture was decoded and measured from the built static site on **desktop Chromium, Firefox and WebKit** at a 390×844 viewport. All three independently reported **−23.01 LUFS**, exactly the expected 48 kHz 997 Hz/−20 dBFS mono reference; zero offsite requests and no viewport overflow (`npm run acceptance:audio-loudness`, `/tmp/str307-matrix.log`). This remains desktop automation, **not physical iOS/Android acceptance or broadcast Gold**.

**2026-10-08 completion evidence (bounded v1):** `src/engines/browser-audio/loudness-307.ts` implements documented ITU-R BS.1770-5 48 kHz K-weighting and the EBU Tech 3341 400ms/75%-overlap two-pass absolute −70 LUFS and relative −10 LU gating, strictly for mono/stereo 48 kHz PCM and 0.4–60 seconds. It reports integrated/momentary/short-term LUFS and **sample peak dBFS, not true peak**; silent readings remain unknown/null, unsupported layouts/NaNs/out-of-bounds values fail closed. It does NOT claim full EBU Mode compliance, true peak, loudness range, other channel topologies, physical-device coverage or broadcast suitability. The shared `audio-generator` screen adds opt-in local file decoding with 20 MiB preflight; no new public route or transcode download is introduced. `tests/audio-loudness-307.test.ts`: 5/5 PASS, including the independent ITU BS.1770 reference 997 Hz full-scale mono sine −3.01 LUFS and -20 dBFS at −23.01 LUFS, stereo energy +3.01 LU, gate/silence and rejection. `npm run acceptance:audio-loudness`: desktop Chromium headless 390×844 on freshly built static site, real generated 4s WAV file input, **−23.01 LUFS measured against −23.01 LUFS reference, zero offsite requests, no overflow, PASS**. `npm run check`: zero errors, build: 280 pages PASS. Official references: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/ and https://tech.ebu.ch/publications/tech3341/. This narrowly scoped measurement feature's implementation acceptance is complete; **no new Gold/physical certification or release permission is implied**.
