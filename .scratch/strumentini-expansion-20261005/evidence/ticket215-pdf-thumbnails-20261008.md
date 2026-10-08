# Ticket 215 — PDF thumbnails acceptance (2026-10-08)

- Implementation: `src/engines/pdf/thumbnails.ts`, `src/components/tools/pdf/PdfThumbnailPicker.tsx` and original PDF mutation-field wiring in `PdfTool.tsx`.
- On-demand PDF.js loading after explicit user click; four page thumbnails at a time, <176×208px each, sequential renders, cleanup on page abort, worker close, Blob URL revocation on window change/unmount. PDF byte size and page count respect the existing `PDF_LIMITS`.
- Browser acceptance: `npm run acceptance:pdf-thumbnails` **21/21 PASS** in Chromium, Firefox, WebKit. Real generated 200-page fixture rendered at page 1–4 and 198–200 (never all 200), explicit rotation selection via Space key, malformed-document state, per-window teardown/Blob URL reclamation, no offsite task-content traffic, 390px layout.
- Compatibility: `npm run acceptance:pdf` **20 existing PDF tools PASS**, including cancel, keyboard/mobile/lazy-load evidence.
- Unit: `npm test` **1104/1104 PASS**, 137 test files.
- Astro: `npm run check` **0 errors**, 16 deprecated matcher hints.
- Static build: `npm run build` **279 pages**, inspection PASS.
- `npm run deploy:check` **PASS**, Wrangler dry-run D1 and Assets bindings coherent.
- This is **not** the physical iOS Safari/Android Chrome release receipt and does not supersede the source-fingerprint-bound Gold/browser/rollback gates for a public deployment.
