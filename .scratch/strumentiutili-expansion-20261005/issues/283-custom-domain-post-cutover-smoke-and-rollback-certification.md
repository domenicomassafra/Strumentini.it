# 283 — Custom-domain post-cutover smoke and rollback certification

**What to build:** After an authorized Strumentini.it activation/cutover, run HTTPS/TLS, canonical/redirect, assets, all-browser smoke, rollback rehearsal and restore validation on `strumentini.it` itself.

**Traces to:** US-EXP-09; AC-09.1

**Constraints:** C-EXP-02; execute only after separately authorized DNS/cutover action.

**Blocked by:** the Strumentini.it cutover itself is proven, but the legacy `https://strumentiutili.it/` origin still serves the older Vercel site instead of redirecting to Strumentini.it. This leaves a real legacy-domain split-brain until that transition is completed and rechecked.

**Status:** blocked — final Strumentini.it build and rollback/restore are certified; legacy Vercel split-brain remains

**Suggested skills:** deploy-ship → qa-browser

- [x] Custom domain serves the same certified build fingerprint as target Worker.
- [ ] Canonical/redirect/asset behavior has no legacy Vercel split-brain.
- [x] Rollback and restore both have observed smoke evidence.

**Verification:** On 2026-10-07 clean revision `6480e9b581220a72927679818a4e8388b5acdb04` / source fingerprint `2d54b4312e0e6f50d85b125c2f88458a142512543e4123cecc68fccd639bbe92` was deployed to Strumentini.it as Worker version `e0acf436-18ae-444a-be53-898072fbe37e`. The live domain returned 200 for the apex, `/strumenti/`, `image-resize`, the new `fatturapa-reader` route and RIS/BibTeX; canonical/OG/robots/sitemap all use `https://strumentini.it`, and `www` preserves path/query while redirecting 308 to the apex. Chromium, Firefox and WebKit live-domain smoke passed. The live homepage and FatturaPA HTML were byte-identical to the local `dist` artifact. A real rollback to previous version `d89ba4c5-2108-4dc8-b611-4e0adda9aaed` moved the FatturaPA sentinel from 200 back to 404 while the apex stayed healthy; the current version was then restored at 100% and the final smoke returned 200 again. `/api/auth/session` returns 200 against the existing D1 binding and `/api/auth/google/config` remains the expected 503 fail-closed response. Versionable evidence is in `evidence/ticket283-cutover-rollback-20261007.md`; local machine-readable release receipts are also stored under `quality/receipts/release/`. A final read-only check still finds `https://strumentiutili.it/` served independently by Vercel with the older site, so only the legacy-domain transition remains open. The exact procedure is in `docs/12-cloudflare-custom-domain-cutover.md`.
