# 313 — SVG to raster and PDF export

**What to build:** Add SVG→PNG/JPG/WebP/PDF with explicit dimensions/scale/background and safe SVG parsing, keeping this separate from SVG optimization and never claiming raster→SVG vectorization.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 209, 103, 269.

**Status:** ready-for-agent

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] Raster export dimensions and background are explicit in the same image-format-conversion UI.
- [x] External/script refs follow a fail-closed SVG allowlist, tested against a malicious-reference corpus.
- [x] Raster-backed PDF is labeled as a JPEG image embedded in PDF, **not** vectorization.

**Verification:** SVG corpus, output signatures/pixels and malicious-reference cases.

## 2026-10-08 implementation checkpoint — PARTIAL, not Gold

- **Integration:** existing `/tools/image-format-conversion/` page (no new public route); the `image-format-conversion` runtime dispatches only SVG-named/typed files to `src/engines/image/svg-export.ts`. Existing JPEG/PNG/WebP/AVIF/GIF/HEIC paths remain untouched.
- **Fail-closed SVG subset:** bounded 1 MiB UTF-8 XML and 1,000 DOM nodes / 16 nesting levels, parsed with browser `DOMParser` and inspected recursively. Permits static basic shapes/paths/text and a finite attribute/value whitelist. Rejects scripts, event handlers, style elements and attributes, CSS/url() paint, external/internal href/use/image, DTD/entities, processing instructions, foreignObject, filters, animations, namespaced attributes and unsupported markup. The sanitized document is serialized and decoded **only as a local Blob URL in image context**, never inserted as live SVG DOM; the Blob URL is revoked on all paths. Chromium `createImageBitmap(svgBlob)` is not assumed to work; HTMLImageElement.decode is used on the prevalidated Blob.
- **Raster controls:** caller explicitly chooses base viewport width/height in pixels, a 0.1–4 scale and either transparent PNG/WebP or opaque hex background. Max 8192 per side and 16 million output pixels; JPEG and PDF require opaque background. Output signature/header/dimensions/browser re-decode checked for PNG/JPEG/WebP; downloaded PDF contains a single actual embedded JPEG XObject with `/DCTDecode`, a raster-only page, byte-correct PDF xref and output signature/EOF checks. **No PDF engine files changed; no SVG paths or text are preserved as vectors.**
- **Evidence:** `tests/svg-313-safe.svg` is a real local SVG (red rectangle, blue circle, transparent negative space). `tests/svg-313.test.ts` covers non-browser input/size policy. `tests/svg-313.browser.mjs` uses a real 390 px Chromium page and downloads four actual exports, verifying signatures, PNG dimensions/pixels/alpha, JPEG chosen background, PDF raster structure and reopening, and rejecting hostile SVG payloads while confirming zero offsite requests. Verified only Chromium on this development machine; Firefox/WebKit and real physical/mobile remain **NOT_RUN**, not Gold.
- **Certification scope:** the existing parent `image-format-conversion` tool may display its previous Gold badge for the pre-existing raster inputs. **The new SVG conversion mode is NOT covered by that Gold receipt** and is clearly labeled experimental/Partial in its UI. Parent catalog copy and certification boundary require a separate owner-approved update before claiming SVG Gold or publishing a broader certified input capability; no receipts/oracle identities have been altered in this sprint.
- **Still open:** broader SVG rendering and browser compatibility (gradients, advanced typography, external fonts and all unsupported tags are intentionally refused), independent PDF visual fidelity/device corpus and per-mode certification. Retain ticket #313 as open/Partial until those sources and gates exist.
