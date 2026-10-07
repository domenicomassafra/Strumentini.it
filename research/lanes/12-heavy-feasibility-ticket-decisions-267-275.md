# Lane 12 — Heavy feasibility ticket decisions 267–275

**Date:** 2026-10-06  
**Scope:** feasibility decisions only; no application dependency is promoted by this lane.  
**Machine-readable receipt:** `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json`

This pass extends the isolated heavy-local laboratory with bounded, locally generated fixtures for CMS/P7M, ZIP/GZIP, animated GIF, a 200-page PDF, a 10-second 720p MP4 and hostile EML/EPUB content. Browser execution continues to abort every non-loopback request before transmission. The new cases pass in system Chrome, system Edge, Playwright Chromium, Firefox and WebKit; physical iOS Safari and Android Chrome remain `NOT_RUN` and are never inferred from desktop evidence.

| Ticket | Decision | Closure | Evidence boundary |
|---:|---|---|---|
| 267 P7M/CMS | **REFUSE production promotion** | complete | `pkijs@3.4.1` / BSD-3-Clause parses real CMS SignedData bytes, extracts embedded payload and certificate subject, and rejects corrupt/non-SignedData fixtures across all five desktop engines. Trust-chain validity is explicitly `NOT_EVALUATED`; no validity claim is made. |
| 268 image codecs/SVG | **REFUSE production promotion** | complete | Native JPEG/PNG and animated-GIF decode evidence is useful; AVIF/WebP encode behavior is not uniform, SVG optimization has no browser-native path, HEIC remains a `libheif-js@1.23.5` spike. The required real-iPhone HEIC fixture and physical-mobile codec/memory receipts remain promotion prerequisites. |
| 269 advanced PDF | **REFUSE production promotion** | complete | `@cantoo/pdf-lib@2.11.1` mutation and `pdfjs-dist@6.4.299` render/text paths pass a 200-page desktop case, including PDF.js render cancellation. Fidelity-sensitive encryption/redaction/repair/PDF-A/rich-conversion are explicit refusals; physical-mobile memory remains a promotion prerequisite. |
| 270 Office/spreadsheet | **REFUSE production promotion** | complete | DOCX semantic extraction/generation/preview are measured as separate spikes; XLSX and PPTX candidates remain security-denied, faithful Office rendering is refused, and physical-mobile/full-fidelity evidence remains an explicit prerequisite for any future reopening. |
| 271 OCR | **REFUSE production promotion** | complete | Tesseract.js 7.0.0 with the local Italian language asset recognizes the Italian corpus in all desktop engines with no external requests. Production promotion is refused until genuine mobile and complete WASM/native-memory evidence exists; searchable-PDF composition remains separate. |
| 272 archive codecs | **REFUSE production promotion** | complete | `fflate@0.8.3` / MIT round-trips ZIP/GZIP locally, rejects the corrupt fixtures and is small (~12.4 KB gzip lazy), but the hostile archive exposes `../escape.txt`, the corpus reaches >200× ZIP and >300× GZIP expansion, and the sync API needs a worker/streaming cancellation wrapper. 7z and RAR are independently refused because no approved local codec was proven. |
| 273 audio | **REFUSE production promotion** | complete | Web Audio DSP and Mediabunny inspection remain separate from codec availability. Current ffmpeg.wasm core remains license-denied; physical iOS/Android behavior remains NOT_RUN and gates any positive promotion. |
| 274 video/media | **REFUSE production promotion** | complete | Mediabunny/MP4Box inspection is measured separately from transcoding; a 10-second 1280×720 H.264/AAC file is inspected locally. Broad transcoding remains refused/capability-gated; physical mobile memory/cancellation remains a promotion prerequisite. |
| 275 EML/MSG/EPUB | **REFUSE** | complete | No approved parser is present. Hostile EML/EPUB fixtures containing script/remote-resource references are detected as inert bytes without rendering or external resolution; MSG has only an invalid compound-file-signature fixture and receives no semantic parser claim. |

## New local candidates

`pkijs@3.4.1` is installed only inside `spikes/heavy-local-feasibility/`. Its local package metadata reports BSD-3-Clause. The measured lazy browser payload for the PKIjs/ASN.1 path is about 81.6 KB gzip. The P7M fixture is a genuine DER CMS SignedData file generated locally with OpenSSL from synthetic payload and an ephemeral self-signed fixture certificate. This proves envelope parsing, payload extraction and certificate metadata only; it does not prove signer identity, certificate-chain trust, revocation, timestamp validity or legal signature status.

`fflate@0.8.3` is likewise isolated to the spike package and reports MIT. Its measured lazy browser payload is about 12.4 KB gzip. The adversarial archive fixture demonstrates why the codec itself is insufficient as a production extractor: it exposes a parent-traversal name verbatim. Any future reopening must reject unsafe normalized paths, cap entry count and expanded bytes/ratio, and own synchronous work in a terminable worker or bounded streaming layer.

## Mobile and memory boundary

The desktop harness records JS-heap checkpoints where Chromium exposes `performance.memory`. Those numbers exclude WASM linear memory, decoded native surfaces, GPU allocations and full process RSS. Firefox/WebKit do not expose an equivalent measurement to this harness. The receipt therefore records physical iOS Safari and Android Chrome as `NOT_RUN`; completed feasibility tickets use those absences to refuse production promotion rather than converting desktop evidence into a mobile PASS.

Ticket 100 preflight and ticket 101 shared worker/cancellation runtime are complete, so the former generic runtime prerequisites are no longer blockers. Tickets 268, 269, 273 and 274 now close as **REFUSE production promotion** decisions with complete per-capability matrices. The machine-readable umbrella therefore reports `READY_FOR_REVIEW` with no feasibility-decision blockers; physical iOS/Android receipts and the real-iPhone HEIC fixture remain prerequisites only for future positive promotion.
