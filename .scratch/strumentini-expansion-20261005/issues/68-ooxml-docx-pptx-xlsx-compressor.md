# 68 — DOCX/PPTX/XLSX OOXML compressor

**What to build:** Add local file-size reducers for modern Office OOXML packages by inspecting the ZIP package, recompressing/resizing embedded raster media when chosen, rebuilding with real DEFLATE compression, and preserving the editable document/presentation/workbook structure.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Modern `.docx/.pptx/.xlsx` only unless legacy formats get a separate proven parser; macro-enabled packages are refused or preserved without unsafe mutation until explicitly audited; no claim that text/XML itself can always shrink materially.

**Blocked by:** 225, 264.

**Status:** completed

- [x] DOCX/PPTX/XLSX analysis shows package size by media/XML/fonts/other **before** modification, with actual ZIP compressed/expanded bytes and container overhead.
- [x] Conservative/balanced/compact profiles optimize supported embedded JPG/PNG and explicitly MIME-declared static WebP **only with separate loss consent**; optional resize requires explicit consent and a dimension cap, with all relationships intact. Unsupported, animated, unrecognized or unavailable codecs fail closed/skip.
- [x] Output OOXML packages reopen in independent parsers and preserve document/slide/sheet counts, charts, shapes, relationships, editable XML and font/style/theme parts byte-identically.
- [x] Result shows actual source/result bytes, **net ZIP** savings percentage, media changed/skipped, fidelity warning and compressed ZIP group deltas.

**Verification:** Real OOXML corpus with images/tables/charts/fonts/links, ZIP/relationship validation, independent reopen tests, visual/semantic spot checks and mobile-memory receipt.

## 2026-10-09 bounded implementation and verification — not Gold

**Reuse, no duplicate public tool:** Existing `/tools/ooxml-media-compression/` from completed #264 is extended; no second route, no PDF/#266 code. `src/engines/ooxml/compression-groups.ts` computes actual ZIP grouped bytes using the safe central-directory parser's per-entry compressed and expanded lengths. Categories: **media, XML/relationships, font payloads, other**, plus container overhead = actual ZIP file bytes − sum of compressed member sizes. Before/after group deltas are shown on the page. They are not fictitious savings inferred from uncompressed image sizes: net savedBytes uses original package minus final rebuilt package, and returns an unchanged byte-identical original when rebuild would not save bytes.

**Profiles / fidelity:** `conservative` JPEG 0.85, `balanced` JPEG 0.72 and `compact` JPEG 0.55; PNG is re-encoded only with decoded RGBA parity when not resized. **All three profiles require explicit separately unchecked consent for JPEG/WebP loss and image resize**, with 32–4096-pixel maximum dimension for approved resize. Retain JPEG/PNG/WebP MIME and Office content-type references, no cross-format replacement. WebP only if an existing static `.webp` part is actually declared `image/webp` and the local browser produces valid WebP; refuse/skip WebP encoder fallback-to-PNG, static body mismatch, APNG/animated WebP frames, vectors, fonts and unsupported media. External relationships remain inert and never fetched. Limits stay as established by #264 (20 MiB source; ZIP expansion limits; 16 media, 8 MiB individual, 12M decoded pixels); no promise of pixel fidelity after approved JPEG/WebP loss or resize.

**Genuine advanced corpus:** `tests/ooxml-68-generate-corpus.py` derives real DOCX from python-docx (image parts, linked text, heading, editable table, Liberation Serif font style); PPTX from python-pptx (image shapes, editable PowerPoint chart, text); XLSX from xlsxwriter (two real embedded images, worksheet hyperlinks, editable column chart, font style). Actual input binaries at `tests/ooxml-68-corpus/complex.{docx,pptx,xlsx}`. `tests/ooxml-68-independent-reopen.py` uses **separate Python ZIP parser + python-docx/python-pptx and XLSX XML + relationships**; all original non-media bytes (including every `.rels`, XML chart, font style, drawing, text, images references) are byte-identical in output. The test confirms ZIP CRC, expected shapes/tables/charts and pre/post member identity. Font-style metadata are tested; arbitrary externally embedded font blobs are unmodified by design, but this corpus does not provide an independently licensed actual embedded-font binary.

**Targeted acceptance and actual browser artifact:** `tests/ooxml-68.test.ts` validates math for all groups, overhead accounting, loss permissions, bounded quality profile defaults, WebP opt-in, explicit resize, animated PNG/WebP refusal and package XML/relationships. `tests/ooxml-68.browser.mjs` uses the **real built Astro public UI** in Chromium desktop with 390×844 viewport: upload, verify ZIP groups shown **before** clicking run, choose 3 profiles and separate JPEG/resize approvals, download 3 actual OOXML files, verify smaller net size, verify XML/relationship byte equality and use independent Python reopen. Additional no-consent conservative case confirms **0% truthful net savings and byte-for-byte original download** rather than fabricating output size savings. 67/67 interactive checks PASS, no offsite network access and no browser page errors. Artifacts, SHA-256, screenshot, profile/consent and per-document test evidence in `tests/ooxml-68-receipts/browser-68.json`.

| Test document | Profile / consents | Original → downloaded | Net saving | Independent reopen |
| --- | --- | --- | --- | --- |
| DOCX with images, table, heading, font style and hyperlink | Conservative, JPEG approved, resize off | 201,209 → 87,929 B | **56.30%** | PASS |
| PPTX with images, editable chart and text | Balanced, JPEG approved, resize off | 198,595 → 76,226 B | **61.62%** | PASS |
| XLSX with images, editable chart, formatted cells and hyperlink | Compact, JPEG approved, resize max 160 px | 171,698 → 25,863 B | **84.94%** | PASS |

**Memory evidence and honest remaining limits:** The receipt captures **actual CDP point-in-time JSHeapUsedSize/JSHeapTotalSize** snapshots around each run in headless **desktop Chromium with a mobile-sized 390×844 viewport**. These are not peak RAM/peak heap readings nor a physical iOS/Android test. Independent visual/layout side-by-side comparisons in desktop Microsoft Office/LibreOffice and physical mobile memory/thermal acceptance remain **NOT_RUN**. Therefore **all four functional checkboxes are proven at bounded local/browser acceptance scope**, but the broader verification including *physical mobile-memory and native Office renderer visual parity* is **PENDING**. Do not grant Gold or call the broader certification fully complete on these receipts alone.
