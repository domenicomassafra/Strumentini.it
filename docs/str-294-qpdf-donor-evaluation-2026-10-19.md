# STR-294 — pdfstudio/qpdf WASM evaluation (19 October 2026)

**Decision: NO-GO for switching the public `pdf-compression-lite` route today.** The donor has measurable structural compression benefits and its PDF.js readback matches the source on the tested corpus. It also expands several smaller inputs, and the release/provenance guard [#126](https://github.com/domenicomassafra/strumentini-it/issues/126) remains open. The current route and original local input handling remain unchanged. This is a donor spike, not a deployed feature or legal clearance.

## Existing donor and alternatives

| Candidate | Origin/version/license | Assessment |
| --- | --- | --- |
| [fayazara/pdfstudio](https://github.com/fayazara/pdfstudio/releases/tag/v0.4.0) | npm `0.4.0`, Apache-2.0, tag object `8839e020e361354e4305990ef7cb8dab2d6fd2db`, released July 2026; existing vendored WASM | Preferred *conditional* reuse; API `compress({ objectStreams: true, compressionLevel: 9 })`; no JPEG resampling promise |
| [qpdf/qpdf](https://github.com/qpdf/qpdf) | CLI `12.4.2` September 2026, Apache-2.0 | Independent command-line reference, not a browser drop-in; CLI version does not identify WASM build |
| [pdf-lib](https://github.com/Hopding/pdf-lib/issues/1657) | MIT, `1.17.1` November 2021 | No comparable qpdf structural recompression established; copying pages/forms has separate parity risks |
| [pikepdf](https://github.com/pikepdf/pikepdf) | MPL-2.0 | Server/Python alternative; copyleft review needed, not adopted |

The donor already lives in `src/engines/pdf/vendor/pdfstudio/`; no additional package was added. Registry download `npm pack pdfstudio@0.4.0` from `https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz` yielded SHA-256 `4b8481ce55b5f29373baf1a4a10361d7facdd5ec074b7c7daf101431d931c97a`, identical to the historical pin. The registry metadata SRI is `sha512-yFHlp/VHxKmrYxYA45ACkh24c4mCBa/Al3EmajnlBnN9FzfynZz63sR2do2kBH34XoTAQSXy+ywijAcq0DUcSQ==`. Vendored `qpdf.wasm` SHA-256 `48a6044e2b5abb32295fa1682e26f20338181bb2423b2ab6e8456b7c4a8c9756` remains unchanged. The tarball contains `package/LICENSE` but no independent QPDF, zlib or libjpeg NOTICE files. Embedded build revision, rights chain and notices are unproven; see the unchanged, hash-pinned vendor `PROVENANCE.md` and #126. This report is intentionally separate from the historical vendor file, which is guarded by #366 as `LOCAL_AUTHORED`.

## Local compression measurements

Reproduce with `node --import tsx scripts/bench-pdf-qpdf-294.ts`. Inputs are existing committed fixtures plus previously archived official documents (FatturaPA, INPS and Gazzetta Ufficiale), without uploading any bytes. `legacy` is the existing tool route, `qpdf` is the donor WASM `compress()` operation. The readback oracle is **independent PDF.js**, comparing page count, geometry, extracted text, display annotation fields and available form values. All 11 readbacks matched; this is **not** pixel equivalence, cryptographic signature validity, full embedded file verification or a proof for every PDF variant.

| PDF | Original | Legacy | qpdf | qpdf vs original |
| --- | ---: | ---: | ---: | ---: |
| 2-page text | 907 | 969 | 871 | -36 |
| JPEG 1-page | 1,161 | 1,161 | 1,330 | +169 |
| Annotated | 684 | 642 | 820 | +136 |
| Hidden widget form | 865 | 566 | 1,013 | +148 |
| Fake signed ByteRange attack fixture | 771 | 642 | 889 | +118 |
| Hybrid xref/ObjStm | 1,335 | 900 | 999 | -336 |
| Mixed raster/text | 598,519 | 598,505 | 598,208 | -311 |
| Gazzetta Ufficiale annex | 8,194,837 | PDF_LIMIT | 7,651,986 | -542,851 |
| FatturaPA V1.4 official | 798,873 | 5,883,403 | 673,003 | -125,870 |
| INPS circular 43/2026 | 141,146 | MALFORMED_PDF | 103,749 | -37,397 |
| INPS circular 8/2026 | 275,584 | MALFORMED_PDF | 141,632 | -133,952 |

11/11 candidate PDFs reopened with equal bounded semantic snapshots; all 11 input SHA-256 hashes were unchanged after the operation. The smallest candidate increased size on four fixtures (while the existing legacy path did not), so blindly replacing the route would regress byte savings. Some old parser rejections on public PDFs indicate a useful future capability gain, but do not waive the guardrails.

Encrypted input check: `toolkit.lock()` generated an AES-256 password-protected two-page PDF; invoking `toolkit.compress(locked)` **without credentials** raised the typed `PdfPasswordError` (`invalid password`) and generated no output. A future adapter must map that failure to a safe refusal without leaking donor command-line diagnostics. Authenticated re-compression and preservation of genuine digital signatures are outside this spike and remain unapproved.

## Browser and outstanding gates

`STR294_ORIGIN=http://127.0.0.1:18694 node tests/pdf-qpdf-294.browser.mjs` against local Astro dev after `npm run catalog:build`: Chromium produced **871 bytes** from the 907-byte fixture both on the page and in a dedicated module Worker (twice). Already initialized page and Worker continued working after network was switched offline. A fresh page also worked under a simulated same-origin CSP with `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` and `worker-src 'self'`. Zero remote requests, zero uncaught page errors. Worker termination prevented result delivery. Chromium reported 16–17 MB main-thread JS heap during the small-file pass; **this excludes native WASM/Worker memory and does not prove a full memory budget**. Test CSP is simulated on a local development server, not a production header audit.

**Release conditions not met:** verify the real qpdf/zlib/libjpeg source and redistribution notices via #126, enforce typed encrypted-PDF refusal at the adapter boundary and genuine digital-signature preservation/refusal (a fake ByteRange is not a real signed document), and wire a cancellable worker into the product route with a bounded peak memory policy. Only then consider choosing the smaller validated output or retaining the legacy path for regressions. No scan/JPEG recompression is claimed by this donor.

**Rollback:** `src/tools/pdf-compression-lite/module.ts` and the current PDF mutation engine were not changed, so the existing implementation remains the active consumer and rollback requires no intervention. No production deploy, asset replacement or upload took place.
