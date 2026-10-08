# 313 — SVG to raster and PDF export

**What to build:** Add SVG→PNG/JPG/WebP/PDF with explicit dimensions/scale/background and safe SVG parsing, keeping this separate from SVG optimization and never claiming raster→SVG vectorization.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 209, 103, 269.

**Status:** completed — **bounded static SVG subset only** (browser codec capability-gated; **not Gold**)

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] Raster export dimensions and background are explicit in the same image-format-conversion UI.
- [x] External/script refs follow a fail-closed SVG allowlist, tested against a malicious-reference corpus.
- [x] Raster-backed PDF is labeled as a JPEG image embedded in PDF, **not** vectorization.

**Verification:** SVG corpus, output signatures/pixels and malicious-reference cases.

## 2026-10-08 implementation checkpoint — PARTIAL, not Gold

- **Integration:** existing `/tools/image-format-conversion/` page (no new public route); the `image-format-conversion` runtime dispatches only SVG-named/typed files to `src/engines/image/svg-export.ts`. Existing JPEG/PNG/WebP/AVIF/GIF/HEIC paths remain untouched.
- **Fail-closed SVG subset:** bounded 1 MiB UTF-8 XML and 1,000 DOM nodes / 16 nesting levels, parsed with browser `DOMParser` and inspected recursively. Permits static basic shapes/paths/text and a finite attribute/value whitelist. Rejects scripts, event handlers, style elements and attributes, CSS/url() paint, external/internal href/use/image, DTD/entities, processing instructions, foreignObject, filters, animations, namespaced attributes and unsupported markup. The sanitized document is serialized and decoded **only as a local Blob URL in image context**, never inserted as live SVG DOM; the Blob URL is revoked on all paths. Chromium `createImageBitmap(svgBlob)` is not assumed to work; HTMLImageElement.decode is used on the prevalidated Blob.
- **Raster controls:** caller explicitly chooses base viewport width/height in pixels, a 0.1–4 scale and either transparent PNG/WebP or opaque hex background. Max 8192 per side and 16 million output pixels; JPEG and PDF require opaque background. Output signature/header/dimensions/browser re-decode checked for PNG/JPEG/WebP; downloaded PDF contains a single actual embedded JPEG XObject with `/DCTDecode`, a raster-only page, byte-correct PDF xref and output signature/EOF checks. **No PDF engine files changed; no SVG paths or text are preserved as vectors.**
- **Evidence:** `tests/svg-313-safe.svg` is a real local SVG (red rectangle, blue circle, transparent negative space). `tests/svg-313.test.ts` covers non-browser input/size policy. `tests/svg-313.browser.mjs` uses a real 390 px desktop browser viewport and checks actual downloads, output signatures, PNG dimensions/pixels/alpha, JPEG chosen background, PDF raster structure and PDF.js reopen, 13 hostile SVG payloads rejected, and zero offsite requests. Cross-engine outcomes are below; physical devices and real mobile Safari/Firefox remain **NOT_RUN**, not Gold.
- **Certification scope:** the existing parent `image-format-conversion` tool may display its previous Gold badge for the pre-existing raster inputs. **The new SVG conversion mode is NOT covered by that Gold receipt** and is clearly labeled experimental/Partial in its UI. Parent catalog copy and certification boundary require a separate owner-approved update before claiming SVG Gold or publishing a broader certified input capability; no receipts/oracle identities have been altered in this sprint.
- **Outside the completed bounded scope:** arbitrary/advanced SVG syntax (gradients, filters, CSS, advanced typography, external fonts and other unsupported tags intentionally fail closed), independent PDF visual-fidelity/device corpus, real mobile/hardware measurements and per-mode Gold certification. These are **not certified or claimed by #313** and require separately scoped future work. The new SVG mode retains experimental/Partial **certification status**, despite the bounded implementation ticket being completed.

## 2026-10-08 cross-engine desktop acceptance — behavior PASS 3/3; format matrix explicitly limited

The same *built public image-format-conversion route*, local SVG source `tests/svg-313-safe.svg`, actual downloads, independent PDF.js reopen, 13 hostile SVGs and zero external requests were tested **one Playwright browser at a time**, not concurrently:

| Playwright desktop engine | Acceptance checks | PNG | JPEG | WebP | PDF raster (PDF.js reopen) | Hostile SVG / external requests |
| --- | ---: | --- | --- | --- | --- | --- |
| Chromium 153.0.8010.12 | **44/44 PASS** | verified downloaded | verified downloaded | verified downloaded | verified downloaded | 13 rejected / 0 requests |
| Firefox 155.0 | **44/44 PASS** | verified downloaded | verified downloaded | verified downloaded | verified downloaded | 13 rejected / 0 requests |
| WebKit 26.6 (desktop Playwright) | **44/44 PASS of expected-safe behavior** | verified downloaded | verified downloaded | **NOT SUPPORTED — fail-closed refusal, no download** | verified downloaded | 13 rejected / 0 requests |

**WebKit WebP is a demonstrated limitation, not a successful WebP export.** In that engine, `HTMLCanvasElement.toBlob('image/webp')`, `toDataURL('image/webp')` and `OffscreenCanvas.convertToBlob({type:'image/webp'})` return **PNG** instead of WebP. The SVG engine now raises the explicit `WEBP_ENCODER_UNAVAILABLE` error when output format verification catches this mismatch; the app offers **no** PNG mislabeled as WebP and **no** downloadable result for that attempt. The acceptance counts this **expected, safe refusal**, rather than fabricating cross-browser WebP support. WebP remains fully tested as a real output on Chromium and Firefox desktop. A local WebP encoder is *not* included in this scope.

**Independent replay / receipts:**

```sh
# Run after an Astro static build, sequentially; never concurrent browsers.
STRUMENTINI_SVG_BROWSER=chromium node tests/svg-313.browser.mjs
STRUMENTINI_SVG_BROWSER=firefox node tests/svg-313.browser.mjs
STRUMENTINI_SVG_BROWSER=webkit node tests/svg-313.browser.mjs
```

Each successful run creates `tests/svg-313-receipts/{chromium,firefox,webkit}.json` with engine version, 390×844 desktop-emulated viewport, per-output observed MIME/result, downloaded byte counts and SHA-256, hostile rejection/network/page-error counts, PNG pixel evidence and WebP capability, plus `tests/svg-313-receipts/{engine}-png-result.png` as the actual Result-v2 screenshot. The WebKit receipt records its WebP **`EXPECTED_REJECTED_UNSUPPORTED_ENCODER`** outcome separately from the three **`VERIFIED_DOWNLOAD`** outputs. No physical device, unrestricted SVG capability, or Gold certification has been demonstrated; do not roll this acceptance into the parent's unrelated historical Gold receipt.
