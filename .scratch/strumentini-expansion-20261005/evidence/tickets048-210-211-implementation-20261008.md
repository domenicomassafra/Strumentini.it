# Image target / mixed batch integration — 2026-10-08

Scope: tickets **210**, **211** and integration **048**, implemented on the existing `/tools/image-compression/` route. This is a **code/desktop-browser acceptance record**, not a production release or a physical-device certificate.

## Reproducible checks

- `npm test`: **135/135 test files, 1,100/1,100 tests passed** (includes new 210/211 unit regressions).
- `npm run check`: **0 errors, 0 warnings, 16 non-blocking deprecated-matcher hints**.
- `npm run build`: **279 built pages**, build inspection PASS.
- `npm run acceptance:image-target-size`: **30/30 browser assertions PASS** (Chromium, Firefox, WebKit; 390px responsive viewport). Tests actual downloaded image bytes for impossible/possible KiB target, MiB conversion, mixed JPEG/PNG/corrupt input, failed-file isolation, ZIP output reopening, and signature consistency. No off-origin file-content traffic.
- The archive writer runs a serial queue of at most **8 files / 80 MiB**, checks actual Blob MIME, and verifies ZIP central-directory filenames and stored lengths before offering download.

## Intentionally unproven

- No physical iOS Safari or Android Chrome acceptance is claimed.
- No advanced JPEG/WebP codec controls, PNG lossless/palette optimization, or SVG minifier were promoted from the refused feasibility paths 268/207/208/209.
- This source edit changes the global certification fingerprint. The existing Gold, browser-matrix and rollback receipts target the previous source and must be regenerated from fresh independent evidence before a release. Do **not** rewrite receipt source fingerprints as a shortcut.
- `npx tsx scripts/validate-release.ts` returned `BLOCKED` on the dirty working tree with stale global Gold/browser/rollback receipts and the pre-existing missing physical Android/iOS image-resize receipts. Release authorization was not granted; Cloudflare production was not mutated.

The last verified production release stays at Worker version `7e974054-1e52-4b1b-a41e-daadeece0232` from source fingerprint `2c38b13c93d65e40d24730c76c0e766fee5a764dd214dd007d17e2a064fafeeb`. Ticket closure here is **implementation completion**, not a Gold receipt or a production release.
