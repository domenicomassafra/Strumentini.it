# Ticket 283 — production cutover, rollback and restore evidence — 2026-10-07

This receipt records the observed production exercise for the final clean Strumentini.it repository state before later uncommitted oracle-hardening work appeared in the checkout. It must not be used as evidence for later source changes.

## Certified source used for the release

- Git revision: `6480e9b581220a72927679818a4e8388b5acdb04`.
- Evidence source fingerprint: `2d54b4312e0e6f50d85b125c2f88458a142512543e4123cecc68fccd639bbe92`.
- Fresh build: 279 pages; build inspection PASS.
- `npm run deploy:check`: provider-portable static check PASS and Wrangler deploy dry-run PASS.

## Deploy

- Target Worker in the active `wrangler.jsonc`: `strumentini`.
- Production origin: `https://strumentini.it/`.
- New Worker version: `e0acf436-18ae-444a-be53-898072fbe37e`.
- Deployment id: `4ac17bc4-ff50-4ba7-9de3-60e7057e3d14`.
- Version tag: `git-6480e9b`.
- Traffic: 100%.

Post-deploy live checks returned HTTP 200 for `/`, `/strumenti/`, `/tools/image-resize/`, `/tools/fatturapa-reader/`, `/tools/ris-bibtex-converter/`, `/robots.txt` and `/sitemap.xml`. Before this release `/tools/fatturapa-reader/` was a known 404 sentinel on the older deployment.

The live FatturaPA page title was `Leggi una FatturaPA XML · Strumentini.it`. Canonical/OG metadata, robots and sitemap used the `https://strumentini.it` origin. `https://www.strumentini.it/tools/fatturapa-reader/?x=1` returned HTTP 308 to the same path/query on the apex.

## Multi-browser and locality smoke

Headless Chromium, Firefox and WebKit each loaded the following live routes successfully with HTTP 200, Strumentini.it titles and `https://strumentini.it` canonicals, with no page error or failed request observed:

- `/`
- `/strumenti/`
- `/tools/fatturapa-reader/`
- `/tools/ris-bibtex-converter/`
- `/tools/image-resize/`

A live `case-converter` execution transformed `HELLO World` to the expected lowercase result. After submit, every observed task request was a same-origin GET for lazy code/font assets; no external request, non-GET request or task-body upload was observed, and no runtime error occurred.

## Byte identity

Representative production responses were compared directly with the clean release `dist` files after restore:

- `dist/index.html` and live `/`: SHA-256 `6d6afd27a3a971015684a4bb65bb9a4c45074774a361cc3defa5513f0fa799ba` on both sides.
- `dist/tools/fatturapa-reader/index.html` and live `/tools/fatturapa-reader/`: SHA-256 `4a8e4d4cf75a7ebe999fc67acbdd6c156b36b675a20f082b1806bb45e3691aca` on both sides.

This binds the representative live pages to the release artifact rather than merely to a route name.

## DNS, TLS and auth/D1 smoke

- Authoritative NS observed: `candy.ns.cloudflare.com`, `kanye.ns.cloudflare.com`.
- TLS subject: `CN=strumentini.it`.
- Issuer: Google Trust Services `WE1`.
- Validity observed: 2026-10-06 19:09:25 UTC through 2027-01-04 20:09:09 UTC.
- SANs include `strumentini.it`, `www.strumentini.it`, `*.www.strumentini.it`.
- `/api/auth/session`: HTTP 200 with `{"user":null}`.
- `/api/auth/google/config`: HTTP 503 with the expected fail-closed Google-unavailable response because `GOOGLE_CLIENT_ID` is absent.
- D1 remained `strumentiutili-auth`, UUID `b172e08e-3a81-41dd-87d4-c8c4859b7274`.

## Real rollback

The release version was rolled back at 100% traffic to previous Worker version `d89ba4c5-2108-4dc8-b611-4e0adda9aaed`.

- Rollback deployment id: `e0c413aa-fc15-4310-a6e1-8c9339fc2cca`.
- Apex remained HTTP 200.
- `/tools/fatturapa-reader/` changed from the new release's HTTP 200 back to HTTP 404.

That sentinel transition proves the edge actually switched to the previous application version; this is not a dry-run or manually asserted rollback receipt.

## Restore

Worker version `e0acf436-18ae-444a-be53-898072fbe37e` was restored at 100% traffic.

- Restore deployment id: `be638174-a6b0-4ea1-9e74-93e42df2cc75`.
- Final smoke again returned HTTP 200 on the release routes, including FatturaPA.
- Byte identity and auth smoke above were checked after restore.

## Clean release-validator replay

The repository validator was replayed against an isolated clean worktree at the deployed revision, using the observed rollback receipt above rather than the later dirty shared checkout. Result:

- `rollback`: `PASS`;
- `toolSurface`, `cloudflareStaticAssets`, `publicSiteUrl`, `publicMetadata`, `staticAssets`, `truthfulClaims`, `browserEvidence`: `PASS`;
- overall status: `BLOCKED`, with **4** remaining blockers only: two certification-receipt/Gold blockers plus the real Android Chrome and iOS Safari physical `image-resize` receipts.

No rollback blocker and no dirty-worktree blocker remained in that clean replay. The temporary detached worktree was removed immediately after the check.

## Remaining ticket-283 blocker

The new Strumentini.it production cutover itself is proven, but the legacy domain is still independently serving the previous Vercel site:

- `https://strumentiutili.it/` → HTTP 200, `server: Vercel`, old title `StrumentiUtili.it — Strumenti gratuiti per tasse, lavoro, documenti e PDF`, canonical `https://strumentiutili.it/`.
- `https://strumentiutili.it/tools/fatturapa-reader/` → HTTP 404.
- `https://strumentiutili.it/tools/ris-bibtex-converter/` → HTTP 404.

Therefore the ticket remains blocked only on the explicit acceptance criterion that there be no legacy Vercel split-brain. Vercel CLI on this machine was checked and is currently logged out, so no legacy production mutation was attempted or claimed.

## Evidence boundary

Later uncommitted source/oracle work in the shared checkout has a different evidence fingerprint. This receipt certifies only the clean deployed revision and fingerprint named above; any later source state needs its own frozen-source certification and must not inherit this release proof automatically.
