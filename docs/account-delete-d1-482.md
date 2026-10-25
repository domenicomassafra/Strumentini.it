# #482 — account DELETE result, local Workerd/D1

## Diagnosis (2026-10-25)

The regression runs the public Worker HTTP handler against the existing isolated
Workerd/D1/PasswordKdf runner. Registration, a second login and a favorite succeed.
DELETE with the correct password removes the account, both sessions and favorites,
but returns **401** without Set-Cookie. The subsequent session and login checks
confirm the deletion actually committed. The unmodified helper reports success
only when D1 `meta.changes === 1`.

A temporary minimal probe removed passwords/KDF, favorites and the second
session: one Google-only user and one live session still reproduce the error.
Instrumenting only the result of the actual DELETE measured **meta.changes = 2**,
HTTP401, no cookie, and zero remaining user/session rows (50 ms test body).
Removing the sole session would also remove authorization, so this is the
minimal authorized deletion. The larger public regression took 35,254 ms on
Mac Studio under resource guard; the two failing assertions were status204/401
and the absent clear-cookie. These are local samples, not production latency.

Ranked alternatives were a stale/revoked authorization (would retain the user)
and an exception/routing failure (would return500 or a successful DB result).
The committed deletion and measured metadata exclude both for this symptom.
The installed Miniflare D1 driver calculates metadata from the difference of
SQLite total_changes() before/after the query, which includes foreign-key
cascade actions. Node SQLite statement.run().changes counts only direct changes;
that seam did not reveal the D1 response bug. No driver was modified.

## Fix and security boundary

Keep the DELETE WHERE clause unchanged, including all four credential fields,
user/session ownership and live-session expiry. Add SQL RETURNING id and use
D1 first() to read the deleted primary key. RETURNING describes only the direct
user deletion, not its cascades; a nonmatching authorization returns no row.
There is no read-then-write gap and no inference from a database-wide counter.
PBKDF2 600,000, stored format, admission limits, private-client timeout and
fail-closed behavior are unchanged. No migration, remote database or deploy.
The existing #348 read-only source inventory is rebound to the reviewed
worker/db.ts and auth-client.ts bytes. Regression rejects loss of credential/expiry guards; routes,
quota thresholds and serverMode=NO_GO remain unchanged. This inventory is not a
release receipt or production security authorization.

## Existing mechanisms and sources

No package or copied third-party implementation was needed: native SQLite
RETURNING and the already installed D1 prepared-statement first() API express
the required result. The application-owned gap was interpreting the aggregate
metadata as an exact user-row result.

Read on 2026-10-25:

- [D1 return objects](https://developers.cloudflare.com/d1/worker-api/return-object/)
  (updated 2026-04-21): changes is the number of changes to the database.
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
  (updated 2026-06-22): first() returns the first result row, or null.
- [SQLite RETURNING](https://www.sqlite.org/lang_returning.html)
  (updated 2025-05-31): only directly modified rows, not foreign keys/triggers;
  all modifications occur before result rows are emitted.
- [SQLite total_changes](https://www.sqlite.org/c3ref/total_changes.html): includes
  foreign-key actions; unlike statement-local changes(). SQLite is public domain.
- Existing runner donor: @cloudflare/vitest-plugin1.4.4 and nested
  miniflare5.20261012.1-beta, upstream commit
  [e7f9e4e99b0674b5e83999fd61cd096831611f4f](https://github.com/cloudflare/workers-sdk/tree/e7f9e4e99b0674b5e83999fd61cd096831611f4f),
  miniflare tag7d749334e95c19d09f18c92a250a4f7a13e47276. Installed package license
  MIT; monorepo root Apache-2.0. See existing docs/donor-cloudflare-vitest-285.md.
  Inspected installed workers/d1/database.worker.js; no source patches or new
  dependencies, copyleft adoption or assets.
- Power-user [workers-sdk#16142](https://github.com/cloudflare/workers-sdk/issues/16142)
  (follow-up 2026-10-17) asks about multi-statement atomic CAS guards and notes
  post-commit metadata cannot enforce dependent writes. It has no maintainer
  contract answer; this fix does not rely on that disputed batch mechanism.
- [Official test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)
  (updated 2026-10-10) support both exports.default.fetch() and the exported
  fetch handler with env/createExecutionContext(). Tests use those public seams;
  race timing is controlled only at the private KDF service boundary while the
  real DO still derives the original bytes. No sleeps or mocked D1/SQL.

## Verification and limits

### Legal, privacy and copyright review (2026-10-25)

EU GDPR [Article 17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
provides a qualified right to erasure, subject to its conditions and exceptions.
For this endpoint, a successful authenticated deletion must give an accurate
response and revoke the account's server-side access. The fixed atomic DELETE
removes the `users` row and cascades through `sessions`, `favorites`, and the
`favorite_sync_*` tables under the existing foreign keys; HTTP204 and the
expired session cookie now agree with that observable state. Unauthorized,
expired, revoked or stale-credential callers retain the account. The regression
uses invented identities and isolated local D1, never real personal data.

This change creates no additional collection, sharing, subprocessors, packages,
third-party assets or copyright-bearing code. The already installed Cloudflare
test package's MIT and workers-sdk Apache-2.0 licensing are recorded above;
SQLite's public-domain status is documented by upstream. This endpoint test
does **not** independently establish erasure from backups, logs, remote
production infrastructure or users' local browser storage. `login_attempts`
is a separate time-window/IP-scope abuse-prevention table without a `user_id`
foreign key; its existing pruning behavior is unchanged. Accordingly, this
review approves the narrowly scoped fix and does not assert universal GDPR
compliance or additional deletion guarantees.

Run npm run test:workerd for the regression and independent authorization
negative cases, then npm run acceptance:auth for the compiled Wrangler/HTTP
consumer. Both use synthetic local bindings only. Guard invocation on Studio:

The owner clarified that a confirmed deletion must also return the browser to
the homepage. `src/pages/impostazioni.astro` navigates to `/` only when the
client has received HTTP204. HTTP401 leaves the form available and now shows
its error in the correct sibling element; HTTP200 (for instance an unexpected
static fallback) also remains on the form with an error. Run
`node tests/account-delete-navigation-482.browser.mjs` after the build for
the compiled Chromium/browser-route regression (401, 200 and 204), with
synthetic account responses and no real account creation.

~~~sh
ssh macstudio 'export PATH=/opt/homebrew/opt/node/bin:$PATH; cd /Users/domenico/Code/.worktrees/Strumentini.it/strumentini-it-482 && python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- npm run test:workerd'
~~~

The positive test covers204, exact clear-cookie, both sessions becoming anonymous,
favorites denied, login401 and cascade cleanup. Negative race tests retain real
D1 state and observe the public session/favorite API, not just a boolean from a
helper. Local bindings do not certify remote D1, edge distribution, physical
devices or production release admission; #80/#162 remain separate.
