# #285 — Cloudflare Workers Vitest runtime donor (local tests only)

Adopted `@cloudflare/vitest-plugin@1.4.4` as a **devDependency**, pinned in
`package.json` and npm lockfile v3. Source: [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk),
annotated Git tag [`@cloudflare/vitest-plugin@1.4.4`](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare%2Fvitest-plugin%401.4.4),
tag object `3c0928c57f82352e2502c68cb8610e7f70de7c6f`, peeled Git commit
`e7f9e4e99b0674b5e83999fd61cd096831611f4f` (checked via GitHub Git API, 2026-10-19).
The npm package declares **MIT** in its manifest; the monorepo root declares
**Apache-2.0**. The npm tarball does not include a separate license file;
the package declaration is the direct-license evidence, and the upstream source
is linked above. No copyleft component was newly introduced by this change.

Exact artifact: `https://registry.npmjs.org/@cloudflare/vitest-plugin/-/vitest-plugin-1.4.4.tgz`.
SHA-256 of downloaded tarball: `59a0493615a6676c465cc25d823dacf56e0bd9504af2ac0934e3b6dd3f17b947`.
The registry, lockfile `node_modules/@cloudflare/vitest-plugin` and independent
SHA-512 download computation agree on SRI:
`sha512-nXNIlPiLvYFx/AH4/Bb/yntVkeloYcf1+tBi3l6Gp3TDCDtLxXAugrUtO7eTOWbHP6UIx5f9npy05OrACbZ5wg==`.
The plugin peer range `vitest: ^4.1.0 || ^5.0.0` includes this repo's `5.0.1`.

Direct dependencies: `cjs-module-lexer@1.2.3` MIT, `esbuild@0.28.2` MIT,
`zod@4.6.5` MIT (already present), `miniflare@5.20261012.1-beta` MIT,
`wrangler@4.151.1` MIT OR Apache-2.0 (nested test-only copy). The 11 new
lockfile nodes are the plugin, `cjs-module-lexer`, nested Miniflare, Undici
(MIT), Wrangler, workerd (Apache-2.0), and five platform-specific workerd
binaries (Apache-2.0). Every new lockfile node records a registry URL, version,
license field and `integrity`; workerd binaries are optional per platform.
No production dependency or vendored runtime asset was added. This documents
declared licenses, exact downloaded bytes and upstream identity for #126;
it does not resolve #126's separate, pre-existing asset provenance findings.

Test entrypoint: `npm run test:workerd`. The separate
`vitest.workerd.config.ts` runs `worker/index.ts` in local workerd via the
official plugin. All bindings are Miniflare-local: isolated D1, SQLite-backed
`PASSWORD_KDF`, local rate limits and synthetic ASSETS; production Wrangler
IDs, API keys, D1 and remote bindings are never loaded. The plugin's
`readD1Migrations`/`applyD1Migrations` apply the production SQL schema to
an empty local database on each test. Tests cover real auth/DO PBKDF2,
status, headers, cookies, CSRF, favorites/sync, logout and D1 transactional
rollback. Tests block global outbound fetch. Node Vitest fixtures in
`tests/auth-worker.test.ts`, `tests/auth-csrf-328.test.ts`,
`tests/password-kdf-328.test.ts` and `tests/favorite-sync-332.test.ts`
are retained for their independent seams.

Limitations: Miniflare/workerd emulates local bindings and rate counters;
it does not prove edge distribution, Turnstile/Google third-party behavior,
remote D1 availability, production quotas or provider-side rollback. Storage
is isolated per test file by the plugin and reset explicitly before every
test here. Cloudflare upstream [PR #15693](https://github.com/cloudflare/workers-sdk/pull/15693)
(failed-runtime cleanup) remained **open** on 2026-10-19; no reliance on
automatic cleanup after a failed runtime. Staging validation and real
deployment/rollback remain owned by [#162](https://github.com/domenicomassafra/strumentini-it/issues/162).
This test adoption performs **no deployment**.
