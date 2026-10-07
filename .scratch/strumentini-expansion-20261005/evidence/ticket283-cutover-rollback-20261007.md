# Ticket 283 — production cutover, rollback and restore evidence — 2026-10-07

This receipt records the observed Strumentini.it production exercises. The earlier sections preserve the original cutover and oracle-hardening cycles; the latest release authority is the 2026-10-08 `2af6e8c` cycle at the end of this file.

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
- D1 remained on the pre-migration account resource, UUID `b172e08e-3a81-41dd-87d4-c8c4859b7274`.

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

## Follow-up: fully integrated release `eb1ccfb`

The later oracle-hardening work was frozen, fully refreshed and committed as clean revision `eb1ccfbfa3eec168407e8ff036048481fa87e86f`, source fingerprint `61b7fc66df515e762f205771cf8821b4193f824e2b3d62576775bddd306f14e6`. Before production mutation, the repository had 257 Gold / 2 Partial / 0 Implemented Unverified, `npm test` passed 1,091/1,091 tests, Astro check reported 0 errors / 0 warnings, the 279-page build and inspection passed, and `npm run deploy:check` passed including Wrangler dry-run.

- Deploy version: `a38c668c-750e-44df-97aa-7977863c8768`.
- Deploy id: `50155b65-e0ae-4053-85c3-6b747b6f4850`.
- Version tag: `git-eb1ccfb`.
- Traffic: 100%.
- Live HTTP 200 after deploy and after restore: `/`, `/strumenti/`, `/tools/password-strength-estimator/`, `/tools/xml-formatter-validator/`, `/tools/fatturapa-reader/`, `/tools/ris-bibtex-converter/`, `/robots.txt`, `/sitemap.xml`, `/api/auth/session`.
- `/api/auth/google/config`: expected fail-closed HTTP 503 while `GOOGLE_CLIENT_ID` is absent.
- `www` password-strength path/query: HTTP 308 to the equivalent apex path/query.
- Chromium, Firefox and WebKit: PASS with zero page errors or request failures on apex, directory, password-strength and XML routes.
- Byte identity after restore: home SHA-256 `5cdaad28669ec1953969e68a2f1caa9d7bc26b8d1f863d620d0f7ee167a741fa`; password-strength SHA-256 `0ca00f99231de50d0d9b0ff8fe789300f3f555ae42f0ea71ba49829821972548`; XML formatter SHA-256 `38a6d1d47fbd8eb81f205e8409fdabb78468d1540b3f6f0037186fb9277668d0`. Each live response matched its local `dist` file exactly.

### Follow-up rollback and restore

A real rollback deployed previous known-good version `e0acf436-18ae-444a-be53-898072fbe37e` at 100% as deployment `a5162926-99c1-4081-af1a-50be9ea01888`. The password-strength behavior provided an application-level sentinel: before rollback the live result contained both `composizione non aggiunge né sottrae punti` and `Non normalizza Unicode`; under rollback both sentinels were absent. Apex, directory, password and XML static routes remained HTTP 200. Direct curl during rollback confirmed `/api/auth/session` HTTP 200 with `{"user":null}` and Google config HTTP 503 fail-closed. `wrangler versions view` confirmed both versions in that historical cycle retained the same pre-migration D1 UUID `b172e08e-3a81-41dd-87d4-c8c4859b7274` and `TURNSTILE_SECRET` binding.

Restore deployment `37201dab-8bdf-402a-8f53-f89b8ec7c2f5` returned version `a38c668c-750e-44df-97aa-7977863c8768` to 100%. Final HTTP smoke, Chromium/Firefox/WebKit smoke, both password sentinels and all three byte-identity checks passed again.

## Evidence boundary

### 2026-10-08 — complete Strumentini identity and D1 cutover

- Git revision: `2af6e8c4030c880780e5b151b4ae3f070b28b219`.
- Evidence source fingerprint: `2c38b13c93d65e40d24730c76c0e766fee5a764dd214dd007d17e2a064fafeeb`.
- Worker version: `7e974054-1e52-4b1b-a41e-daadeece0232`.
- Deploy id: `8cd7da0c-68bd-402d-b549-d51e9928a174`.
- Rollback version: `a38c668c-750e-44df-97aa-7977863c8768`.
- Rollback deployment id: `23426f6a-4f2e-4c3a-8190-efa4890fe294`.
- Restore deployment id: `97993e35-f30c-46d1-a201-b0aa8e883793`.
- Production D1 after restore: `strumentini-auth`, UUID `3351c8bf-31fc-4716-9d92-2b07c4d8fd2a`.
- New-release password page SHA-256: `0f43e4e1339ee52493bfecbcbeaea5b5411cd7a0214b3e2a431e5a798589c538`.
- Rollback password page SHA-256: `0ca00f99231de50d0d9b0ff8fe789300f3f555ae42f0ea71ba49829821972548`.

Before deploy, the candidate passed 1,091/1,091 tests, Astro check with 0 errors / 0 warnings, 279-page build inspection, deploy dry-run, auth acceptance 130/130, browser-performance matrix, certification 257 Gold / 2 Partial / 0 Implemented Unverified, audit with 0 vulnerabilities, and the 327-ticket backlog validator. Live deploy returned HTTP 200 for apex, directory, password-strength, XML formatter and auth session; Google config remained expected fail-closed HTTP 503. Homepage and password-strength HTML matched local `dist` byte-for-byte, and Chromium/Firefox/WebKit smoke passed with zero page/request errors.

The rollback changed both the password-page hash and the D1 binding back to the previous known-good release while auth session stayed HTTP 200. Restore returned the current page hash and `strumentini-auth` binding. After successful restore, the superseded D1 resource was permanently deleted. A final `/api/auth/session` request still returned HTTP 200 with `{"user":null}`.

The latest production release and rollback proof in this receipt apply only to clean revision `2af6e8c4030c880780e5b151b4ae3f070b28b219` / source fingerprint `2c38b13c93d65e40d24730c76c0e766fee5a764dd214dd007d17e2a064fafeeb`. Future source changes need their own frozen-source deploy, rollback and restore evidence and must not inherit this proof automatically.
