# 234 — Video transform worker core

**2026-10-10 PRIME FUNCTIONAL ACCEPTANCE COMPLETED (real bounded WebCodecs contract):** The three original acceptance checkboxes are met on **genuinely supported devices/codecs** through new lazy, disposable local Worker pipeline, using unmodified Mediabunny v1.61.3 (MPL-2.0 with license and SHA provenance). The public `/tools/video-inspector/` now probes actual WebCodecs decode/encode capability, accepts bounded nonfragmented H.264/AAC MP4 and VP8/Opus WebM inputs, trims/resize/transcodes to **actual H.264/AAC MP4**, applies measured bitrate settings and enforces limits/refusals/cancellation without partial output or remote upload. Independent browser Chromium 390px downloaded **8,824-byte MP4** from real AAC/H.264 fixture and **11,714-byte MP4** from real VP8/Opus WebM fixture; FFprobe/FFmpeg reopened both, verified two streams H.264+AAC, 64×48 pixels, 1.578667-second muxed duration for 1.5-second requested window (inside 180ms documented tolerance), video/audio starts aligned within 0ms, and original 440/880Hz audible content verified. Browser acceptance **23/23 and 21/21 checks PASS** across MP4 and WebM sources including Worker cancellation, teardown and retry. Scoped audio/video test suites **37/37 PASS**, Astro check **1911 files, 0 errors/warnings**. This closes the **functional #234 Worker/encoder/trim/verified-output contract**, not the full #038 video-GIF/contact-sheet family nor devices without a proven WebCodecs encoder. On unsupported devices the UI refuses instead of faking output. Physical iOS/Android decoder/GPU/thermal/peak-memory and Gold certification remain unproven, separately blocked in physical/device release lanes (#280/#281); none are claimed passed. Historical 2026-10-09 source-only UNSUPPORTED notes below are superseded **for this specifically verified subset**.

**What to build:** Implement one lazy cancellable seam for accepted common-input→MP4, compression/target bitrate, trim and audio extraction; separate GIF/LUFS/contact-sheet follow-ons can consume it.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 100, 103, 206, 232, 274.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [x] Actual encoder support drives UI options, under the bounded WebCodecs H.264/AAC output contract below.
- [x] A/V sync and trim bounds meet documented 180 ms duration / 120 ms stream-start tolerance on the proven real MP4 and WebM fixtures.
- [x] Worker cleans up on cancel/error and output signature/codec/size is verified by local inspector and independent FFprobe.

**Verification:** Real media corpus, independent probes, sync/duration and physical iOS/Android evidence.

**Partial candidate (2026-10-09, #234; ticket remains OPEN):** `src/engines/video/audio-extract-234.ts`,
`wav-worker-234.ts` and the optional `VideoAudioExtract234.tsx` implement one measured
suboperation: **local AAC/mp4a in a nonfragmented MP4 with exactly one video and one audio
track → uncompressed PCM16 WAV**. The browser's `AudioContext.decodeAudioData` must really
decode the source; the audio samples are passed to a disposable Worker for WAV writing.
The MP4 sample entry `mp4a` is inspected; the precise MPEG-4 audio profile is
selected by the browser decoder, not inferred from the four-character code.
Optional start/end boundaries cut **only the decoded audio**, rounded to the decoded sample
rate; the WAV signature, header, sample count, channels, rate and size are rechecked before
download. This is **not** stream-copy, lossless extraction of AAC, MP4 remux or video editing.
The browser may resample to 48 kHz; source AAC priming and edit-list alignment are not
proven sample-accurate. No A/V sync with a newly generated video is claimed.

Hard gates: MP4/M4V ≤12 MiB, declared duration ≤60 s, one audio `mp4a` and one video
track, decoded mono/stereo 8–96 kHz, PCM WAV ≤16 MiB, decoded-vs-declared duration within
150 ms. Reject fragmented MP4, unknown timeline, multiple tracks/codecs, unavailable
browser APIs, invalid cuts or unverifiable output. An AbortSignal cancels the worker and
prevents partial publication; on abort/error resources are released. No backend upload.

**Explicit refusals:** Video trim, video compression, target-bitrate video output, conversion
to MP4 and A/V mux/sync remain **UNSUPPORTED** until a locally deployable, verified video
encoder/muxer is present and duration/frame/codec/sync output tests pass. A host-installed
FFmpeg binary does not make FFmpeg available to this browser application. #306/#038 must
not treat this subset as their dependency fully satisfied. Physical iOS/Android acceptance
and  real camera media remain pending.

**Scoped proof:** `npx vitest run tests/video-audio-transform-234.test.ts` → **6/6 PASS**.
The checked-in MP4 fixture contains two externally generated AAC tones, 440 Hz followed
by 880 Hz. The independent test-only FFmpeg decoder supplies real float PCM to the same
PCM16 writer loaded by the browser Worker; independent FFprobe identifies the output as
`pcm_s16le` mono 48 kHz, and sample-window zero crossings/RMS confirm both frequencies
and non-silence after 0.5-second audio cuts. FFmpeg exposes 256 more decoded AAC samples
than the container's exact two-second timeline: this is why sample-exact source alignment
and A/V sync remain unverified. `tests/video-audio-transform-234.browser.mjs` contains a
full UI/download/browser proof but **has not been executed** under current shared-host
load. Chromium decode of the existing synthetic AAC MP4 was probed in isolation; this
does not replace full UI/Worker/physical-device acceptance.

**Nuova acceptance browser reale, 2026-10-09 (worker-2, base isolata `44987a7`):** creato solo il nuovo `scripts/acceptance-video-transform-bounds-234.browser.mjs`. Con il build statico locale `/Users/domenico/Code/Strumentini.it/dist`, eseguito `VIDEO234_BOUNDS_BROWSERS=chromium,firefox,webkit node scripts/acceptance-video-transform-bounds-234.browser.mjs` → **`VIDEO234_BOUNDS_BROWSER_PASS checks=177`**, 59/59 controlli per ciascuno di Chromium, Firefox e WebKit. Prova reale sul form `/tools/video-inspector/`, viewport **390×844**: MP4 sorgente di 2 s `tests/video-audio-234-two-tones.mp4` indipendentemente verificato con `ffprobe` come **H.264 64×48 + AAC mono 48 kHz**. Browser scarica due WAV PCM16 veri tagliati **solo nell'audio** a 0,25–0,75 e 1,25–1,75 s; FFprobe indipendente riapre ciascun file come `pcm_s16le` a **48 kHz, 24.000 campioni, 0,500 s, 48.044 byte e zero tracce video**; analisi dei campioni reali conferma frequenze **440/880 Hz** e energia non nulla. Nessun nuovo MP4 prodotto; il testo UI dichiara esplicitamente che resize, compressione, trim video e nuovo mux video non sono disponibili, con possibile ricampionamento audio e nessuna garanzia di sync A/V con il video originale.

**Failure/cleanup verificati in tutti e tre i browser:** input MP4 privo di audio → `VIDEO_AUDIO_CODEC_UNSUPPORTED`, range invertito → `VIDEO_AUDIO_RANGE`, input locale di oltre **12 MiB** → `VIDEO_AUDIO_SOURCE_LIMIT` prima della creazione di AudioContext o Worker, API Worker rimossa nel test → `VIDEO_AUDIO_BROWSER_UNSUPPORTED`, sempre senza WAV scaricabile. Worker locale realmente istanziato e strumentato: intercettazione controllata di un messaggio PCM per esercitare **cancel/AbortSignal senza output parziale**, simulazione di errore Worker senza artifact e **retry successivo**; in ciascun browser 5/5 Worker terminati e 6/6 AudioContext effettivamente chiusi. Firefox/WebKit compiono 7 tentativi di `AudioContext.close()` su 6 contesti durante abort (chiusura richiamata anche dal `finally`, nessuna risorsa rimasta aperta); osservazione da rivalutare se si ottimizza il cleanup. **Zero richieste offsite, zero eccezioni JS, zero overflow a 390 px**. Il server temporaneo è solo loopback. Prova desktop/headless, nessun browser mobile fisico o performance/memory peak certificati.

**Stato e limiti:** il motore resta limitato a MP4/mp4a → WAV PCM16 senza transcoding video. FFmpeg/FFprobe dell'host sono strumenti indipendenti **solo del test**, non un encoder video pubblicabile. Nessun FFmpeg WASM/muxer browser validato: video trim, resize, compression/target bitrate, mux A/V e audio retained in output MP4 ancora **UNSUPPORTED**. #101 worker/performance, corpus reale dei dispositivi e iOS/Android fisici restano necessari; **#234 `ready-for-agent` / OPEN**, nessuna checklist marcata complete, nessuna modifica a UI/engine/shared/Gold, nessun full-suite/build/push/deploy. La vecchia annotazione «browser proof not executed» sopra è storica, superata solo per questa prova di estrazione WAV e rifiuti.

**2026-10-09 PRIME race/cleanup tranche:** Browser reale Firefox e WebKit (390×844, AAC→WAV Worker) ha misurato **7 chiamate a `AudioContext.close()` per 6 contesti**: una doppia chiusura durante annullamento, quando `abort` e `finally` incontrano una `close()` ancora pendente. L'acceptance browser `scripts/acceptance-video-transform-bounds-234.browser.mjs` è stata estesa con `audioCloseAttempts === audioContexts`, ottenendo un vero **RED Firefox (7 != 6)** sulla build statica prima del fix. `src/engines/video/audio-extract-234.ts` ora memorizza e riutilizza una sola Promise di chiusura: abort e finally condividono `closeContext()`; evita invocazioni duplicate senza ignorare il cleanup. Il resto dell'estrazione/worker/corpus rimane invariato. Questo NON implementa encoder/muxer video, sync A/V o prove hardware. Rieseguire su build statica aggiornata, annotare GREEN e mantenere #234 aperto senza Gold o deploy.

**2026-10-09 PRIME indipendente GREEN dopo fix `b115809`:** `npm run check` su checkout pulito = **0 errori / 0 warning** in 1842 file; `npm run build` = **289 pagine statiche PASS**, redazione PDF insicura assente dalla build. Acceptance sulla **nuova** build statica: `VIDEO234_BOUNDS_DIST=/Users/domenico/Code/Strumentini-prime-cleanqa-20261009/dist VIDEO234_BOUNDS_BROWSERS=chromium,firefox,webkit node scripts/acceptance-video-transform-bounds-234.browser.mjs` → **180/180 check PASS** (60 per browser), con MP4 AAC reale, due WAV PCM16 tagliati correttamente e FFprobe/440-880 Hz indipendenti. Ogni browser **6 contesti creati, 6 realmente chiusi, 6 sole chiamate di chiusura**, 5/5 worker terminati, cancel/error/retry senza output parziale, zero offsite ed errori pagina. Differenza RED→GREEN documentata, non hardware fisico: #234 resta OPEN per encoding video, compressione/trim MP4, mux/sync, dispositivi e memoria.

**2026-10-10 #234 implementation/donor rescue (functional AC 3/3, status remains OPEN until physical device QA):** New `src/engines/video/video-transform-234.ts` + `video-transform-worker-234.ts` and local vendor `src/engines/video/vendor/mediabunny-mpl-1.61.3/` contain an **unmodified** MPL-2.0 Mediabunny v1.61.3 ESM distribution, declarations, LICENSE, source/version/sha provenance README. No ffmpeg.wasm/copyleft runtime, package dependency, registry or manifest change. New `src/components/tools/video/VideoTransform234.tsx` mounted in existing `VideoFramesAndCamera305.tsx` on public `/tools/video-inspector/` route. Explicit user action probes the *actual browser's* WebCodecs decode and H.264/AAC encode support before enabling the convert button, with WebM VP8/Opus or MP4 AVC/AAC source decode checked according to file type. Lazy disposable Worker uses Mediabunny `Conversion` with `copy:false`, forces genuine video AVC and audio AAC transcoding, enables trimming, resizing (contain fit), user-specified approximate 180–3000 kbps video target, explicit 96 kbps AAC, and same MP4 output mux. Bounded accepted inputs: MP4 nonfragmented AVC/AAC or WebM VP8/Opus, ≤12 MiB, ≤12 s, 1 video+1 audio, source dimensions ≤1280×720. Output limits: even 32–1280×32–720 within 921600 pixels, MP4 ≤18 MiB. Worker validates WebM codec/count/duration *before* encoding, and output is checked for MP4 `ftyp`, real `avc1` video + `mp4a` audio, dimensions, duration ≤180 ms from selected trim bounds, no fragments or absent tracks. Cancel/timeout/error terminates the worker and invalidates all stale download URLs; worker disposes input/cancels failed conversion.

**Real Chromium browser and independent FFmpeg proof:** `node tests/video-transform-mp4-234.browser.mjs` real user `/tools/video-inspector/` form at 390×844, input `tests/video-audio-234-two-tones.mp4` (H.264/AAC, two genuine 440/880Hz audio tones, 2.000s). Browser encodes/downloads a **real 8,824 byte MP4** for 0.25–1.75s requested trim with H.264 64×48 and AAC retained; `ffprobe` independently reads **1.578667s output duration**, video+audio stream start delta **0ms**, video vs audio durations within 180ms, no mismatched codecs. Independent `ffmpeg` decodes newly encoded AAC and checks both actual tones (440 and 880 Hz). UI cancellation of a genuinely running worker clears download, suppresses late output, and a new real conversion succeeds. Instrumented native browser Worker constructor/termination counts equal after repeated encoder probe + encode + cancel + retry. **`VIDEO234_REAL_MP4_ENCODER_PASS checks=23`**; no offsite requests or page errors and no 390px overflow.

**Second common-input conversion:** `VIDEO234_SOURCE=webm node tests/video-transform-mp4-234.browser.mjs` selects actual FFmpeg-authored `tests/video-vp8-opus-234.webm` (real VP8 video and Opus audio), auto-probes the correct source decoders, and downloads **11,714-byte new H.264/AAC MP4**. Independent `ffprobe` verifies video/audio codecs, 64×48 dimensions, 1.578667s muxed duration for 0.25–1.75 requested cut, stream start delta **0ms** and duration alignment. Native Worker cancellation, no stale result and retry pass; **`VIDEO234_REAL_MP4_ENCODER_PASS checks=21`**, zero offsite/page errors. Focused previous audio/video fixtures and regressions `vitest tests/video-audio-transform-234.test.ts tests/video-corpus-232.test.ts tests/video-presentation-timing-37.test.ts` **37/37 PASS**.

**Remaining release/issue blockers:** Browser proof was on **desktop Chromium emulating 390px**, not a physical iPhone/Android device. Independent `ffprobe` tests two bounded real media fixtures; additional physical mobile decoder, GPU/thermal, memory peak, WebKit/Firefox WebCodecs capability and native camera files are unverified. The three *functional* checkbox ACs are now checked with empirical evidence, but **the issue stays `ready-for-agent` / OPEN** because its explicit Verification includes **physical iOS/Android evidence**. Neither Gold nor production release/cross-browser compatibility can be claimed from this evidence alone.
