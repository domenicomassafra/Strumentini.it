# 305 — Exact video frame extraction and webcam test

**What to build:** Add frame-at-timestamp extraction using the approved inspector/decode path plus a separate webcam permission/test surface, both with explicit browser precision/permission limits.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 232, 274.

**Status:** completed — browser-supported local frame-at-time preview and opt-in webcam test (NOT frame-exact guarantee or physical camera certification)

**Suggested skills:** security-audit → code-tdd → qa-browser

- [x] Frame output reports requested timestamp and actual presentation timestamp **only if** requestVideoFrameCallback supplies it, otherwise labels actual time/precision **unknown**.
- [x] Webcam permission requested only after explicit click and controlled browser denial, grant and track-ended revocation test recovers.
- [x] No camera/frame content is uploaded (local Blob URLs and 0 external browser requests proven).

**Verification:** Known-frame video corpus plus webcam permission/no-network browser flow.

**2026-10-08 bounded implementation acceptance:** Integrated `VideoFramesAndCamera305` into the existing `/tools/video-inspector` route, no new unverified public catalog entry. `src/engines/video/frame-extract-305.ts` bounds local decoding to 50 MiB input file, 0–3600s video, max 8M pixels/output PNG only; validates requested time within the file duration, uses a local `HTMLVideoElement` seek, reports browser frame presentation mediaTime only if available (otherwise **unknown**, never claims sample-perfect extraction), creates locally downloadable PNG, and aborts/clears stale results. Camera `getUserMedia({video:true,audio:false})` is invoked exclusively by the user activation button, no auto permission prompt and no recorder. Denied camera can be retried; permission/device revocation (`MediaStreamTrack.ended`) and explicit stop release tracks and allow retry; pending permission results are discarded if the user cancels/navigates away. `tests/video-frame-305.test.ts`: 3/3 negative and positive range/pixel budget tests PASS. `tests/video-frame-305-red-green.mp4`: reproducible FFmpeg 2-second 64×48 H.264 fixture, known red first second, green second. `tests/video-frame-camera-305.browser.mjs` on rebuilt static site in **desktop Chromium 390×844**: **27/27 browser checks PASS**, real downloaded PNGs from requested `0.25s` and `1.50s` decode to red/green center pixels, out-of-duration request refused with no stale result, camera permission grant/deny/revoke/stop exercised via a **mock MediaStream**, no POST/offsite requests, zero browser script errors and no viewport overflow. `npm run build` 282 pages PASS with catalog 262; `npm run check` 0 errors/0 warnings. **Not a physical webcam permission proof, measured frame accuracy on all browsers, actual iOS/Android device test, codec decoder guarantee, or Gold claim.** Future physical-device and broader cross-engine QA remain separate release work, rather than secretly assumed by this bounded functional completion.
