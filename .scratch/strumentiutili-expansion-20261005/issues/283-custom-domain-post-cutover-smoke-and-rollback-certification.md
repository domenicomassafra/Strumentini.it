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

**Verification:** On 2026-10-07 the latest clean revision `eb1ccfbfa3eec168407e8ff036048481fa87e86f` / source fingerprint `61b7fc66df515e762f205771cf8821b4193f824e2b3d62576775bddd306f14e6` was deployed to Strumentini.it as Worker version `a38c668c-750e-44df-97aa-7977863c8768` (deployment `50155b65-e0ae-4053-85c3-6b747b6f4850`). The live domain returned 200 for the apex, `/strumenti/`, password-strength, XML formatter, FatturaPA, RIS/BibTeX, robots, sitemap and auth session; `www` preserved path/query with a 308 redirect to the apex. Chromium, Firefox and WebKit live smoke passed with zero page/request errors, and the homepage, password-strength and XML HTML were byte-identical to local `dist`. A real rollback deployment `a5162926-99c1-4081-af1a-50be9ea01888` moved traffic to previous known-good version `e0acf436-18ae-444a-be53-898072fbe37e`; the new password-strength composition/Unicode sentinels both disappeared while the static site stayed healthy, `/api/auth/session` returned 200 via curl and Google config remained the expected fail-closed 503. Restore deployment `37201dab-8bdf-402a-8f53-f89b8ec7c2f5` returned `a38c668c…` to 100%; final Chromium/Firefox/WebKit smoke, sentinels and byte identity passed again. Versionable evidence is in `evidence/ticket283-cutover-rollback-20261007.md`; local machine-readable release receipts are also stored under `quality/receipts/release/`. A fresh read-only check still finds `https://strumentiutili.it/` served independently by Vercel with the older site, so only the legacy-domain transition remains open. The exact procedure is in `docs/12-cloudflare-custom-domain-cutover.md`.
