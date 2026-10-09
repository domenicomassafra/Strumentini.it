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
