# 230 — Audio transcode compress and target bitrate size

**What to build:** Implement only the accepted local codec/container subset with bitrate/sample-rate/channel controls and duration-based target-size budgeting behind lazy worker execution.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 273.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] **REFUSED for production implementation:** ticket 273 refuses the available ffmpeg/lame baselines and keeps WebCodecs codec support capability-gated rather than approving a production transcode matrix.
- [x] No production UI advertises an unapproved codec/container or presents a target-size estimate as measured output bytes.
- [x] No transcode worker/output is promoted until an accepted codec path can prove termination/resource release and independent decode.

**Verification:** Closed as a refusal downstream of ticket 273. Reopen when an approved codec/container subset satisfies the worker, decode and promotion evidence declared by the feasibility gate.
