# STR-411 — Media progress/cancel: provenance and reuse (2026-10-20)

Source baseline: `7b687d9a` (Strumentini.it owner code). The existing
`mp4-inspection.ts`, `timeline-worker-231.ts`, `wav-worker-234.ts`,
`file-privacy` and browser media consumers are reused and extended. The
change adds no third-party dependency and copies no external source code.

| Option | Source / license | Decision |
| --- | --- | --- |
| Browser `Blob.slice()` and `FileReader.readAsArrayBuffer()` with `FileReader.abort()` | [MDN FileReader.abort](https://developer.mozilla.org/en-US/docs/Web/API/FileReader/abort), [Blob.slice](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice); standard built-in Web APIs, documentation reviewed 2026-10-20 | Adopt: count only completed local slices; explicitly abort the in-flight browser read and reject short reads. |
| Browser `Worker.terminate()` | [MDN Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate); built-in Web API | Reuse existing dedicated workers; terminate on signal, exception and timeout. Report completed PCM frames emitted by the worker. |
| `BaseAudioContext.decodeAudioData()` | [MDN API](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData); built-in Web API | Reuse existing browser decoder: requires *complete* media data, has no AbortSignal argument and no trustworthy incremental decode percentage. Bound time, close context and discard late result; never display invented decode progress. |
| `SubtleCrypto.digest()` | [MDN API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest); built-in Web API | Reuse existing SHA-256 manifest. Native digest is promise-based, with no cancellation API. Abort/timeout rejects the consumer immediately and discards the eventual value. |
| Existing `fflate` dependency | [101arrowz/fflate](https://github.com/101arrowz/fflate), package `0.8.3`, MIT, already pinned in `package.json` | Keep the repository's established `createZip` and `inspectZip` validation; no alternative ZIP/codec implementation added. |

The browser can pause work on a background tab or reject an unsupported AAC
codec. Recovery is shown without claiming a successful export. Byte progress
covers local reads; frame progress covers synchronous worker writes and
verified contact-sheet captures. No ETA or percentage is fabricated for
browser-managed decode, SHA-256, PNG encoding or ZIP packing.

Resource limits remain enforced by their existing engines: WAV PCM16 12 MiB
per source / 24 MiB combined, AAC-in-MP4 12 MiB / 60 s, MP4 contact sheet 50
MiB, and worker WAV output bounds. Physical iOS Safari / Android Chrome memory
and cancellation claims remain `NOT_RUN` while [#124](https://github.com/domenicomassafra/strumentini-it/issues/124)
remains open; a desktop 390 px viewport is not a physical device receipt.
