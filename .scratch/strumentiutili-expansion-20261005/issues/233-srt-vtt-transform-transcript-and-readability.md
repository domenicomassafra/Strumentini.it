# 233 — SRT VTT transform transcript and readability

**What to build:** Add deterministic SRT↔VTT, offset/rescale, clean transcript and configurable reading-rate/overlap diagnostics with exact malformed-cue location.

**Traces to:** US-EXP-06, US-EXP-10; AC-05.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 77 — Bounded large-output preview primitive.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] Cue order/text round-trips under supported conversion.
- [x] Negative-offset policy is explicit.
- [x] Reading thresholds are configuration/source-labelled, not absolute truth.

**Verification:** Round-trip, overlap/time-boundary and 390px editor fixtures.

**Evidence (2026-10-06):** `src/engines/text-writing/subtitles.ts` adds a parser-backed bounded subtitle seam on the existing text-writing engine. The supported subset preserves cue order, timing and Unicode text across SRT↔WebVTT conversion, rejects malformed timing with exact `line`/`cue` diagnostics, rejects unsupported WebVTT cue settings/NOTE/STYLE/REGION blocks, exports a timing-free transcript, reports overlap/out-of-order cues and applies rescale before offset. Negative offsets have two explicit policies: `refuse` fails on the first cue that would start below zero; `clamp` moves that cue start to zero while preserving transformed duration. Reading-speed diagnostics use a configurable characters-per-second threshold; the default is visibly source-labelled from the Netflix Italian Timed Text Style Guide and the UI states that it is a reference threshold rather than universal truth. `SubtitleSrtVttTransformTool.tsx` uses the shared Result v2/output-artifact seams for bounded preview plus complete UTF-8 SRT/VTT/transcript downloads, with manifest contract `LOCAL` / network forbidden. `tests/subtitle-transform.test.ts` passes 10 focused tests covering fixture vectors, SRT↔VTT round-trip, CRLF and decomposed/emoji Unicode preservation, transcript export, clamp/refuse offsets, rescale boundaries/order, overlap/out-of-order diagnostics, configurable/source-labelled reading speed and exact malformed-cue locations. `python3 quality/oracles/validate.py`, scoped manifest compilation, `npx tsc --noEmit`, backlog validation and `git diff --check` pass. Oracle `cand-249`, sources `w3c-webvtt` / `netflix-italian-ttsg` and fixture family `subtitle-transform` record the contract. A 390px Playwright acceptance script is prepared at `scripts/acceptance-subtitle-transform.mjs`, but the shared generated catalog cannot currently be rebuilt because concurrent `redirect-chain-inspector` fails the factory rule requiring a privacy disclosure for non-LOCAL tools; generated catalog therefore does not yet contain this new route, so running that browser gate would not test the 233 implementation truthfully.
