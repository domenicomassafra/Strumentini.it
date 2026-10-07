# 274 — Video codec and media-processing feasibility spike

**What to build:** Choose or refuse local video inspect/transcode dependencies with codec/container matrix, licensing, worker/SIMD/thread assumptions, bundle/runtime/memory and genuine mobile evidence.

**Traces to:** US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; no remote transcoding fallback.

**Blocked by:** None for the feasibility decision. Ticket 100 preflight and ticket 101 shared worker/cancellation runtime are complete; representative physical mobile evidence remains a promotion prerequisite.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] Inspection and transcoding are separately costed/decided.
- [x] Common MP4 path is not assumed available until proven.
- [x] Representative desktop duration/resolution and cancellation seams are measured; production promotion is refused until physical-mobile memory/cancellation evidence exists.

**Verification:** Video corpus benchmark and IMPLEMENT/SPIKE/REFUSE matrix.

**Evidence (2026-10-07 re-evaluation):** decision is **REFUSE video/media production promotion from this feasibility lane**. mediabunny@1.61.3 remains the primary inspection/container spike and mp4box@2.4.1 the smaller MP4-specific alternate; general ffmpeg.wasm transcoding remains refused because the official core is outside repository licence policy, while exact WebCodecs paths stay capability-gated. A generated 10-second 1280×720 H.264/AAC MP4 is inspected successfully in all five desktop engines, Input.dispose() is exercised as the candidate lifecycle seam, and ticket 101 now supplies the shared terminable worker/resource-ceiling runtime for future integration. Chromium JS-heap observation still excludes native/GPU/process memory, and genuine iOS/Android evidence remains absent; therefore no positive media path is promoted.
