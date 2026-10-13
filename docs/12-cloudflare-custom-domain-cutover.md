# Strumentini.it — Cloudflare custom-domain activation and cutover runbook

Status: Strumentini.it activation, current build deployment, live smoke and rollback/restore certification completed on 2026-10-08 for clean revision `2af6e8c` / source fingerprint `2c38b13c…`. Ticket 283 is complete.

Brand/domain update: 2026-10-07. `Strumentini.it` is the canonical public brand and origin. Public DNS is delegated to Cloudflare, apex HTTPS is live, `www` redirects to the equivalent apex path, the 259-tool build is live, and deploy → rollback → restore has been observed against the production domain.

## 1. Infrastructure identities that stay stable

Current production identities:

| Resource | Identifier |
|---|---|
| Public brand | `Strumentini.it` |
| Canonical target origin | `https://strumentini.it/` |
| Cloudflare Worker | `strumentini` |
| D1 auth database | `strumentini-auth` |
| D1 UUID | `3351c8bf-31fc-4716-9d92-2b07c4d8fd2a` |
| Public Worker origin | `https://strumentini.it/` custom domain; checked `workers.dev` hostnames are not a production authority |
| Current Worker secret state | `TURNSTILE_SECRET` present; `GOOGLE_CLIENT_ID` absent |

The current Wrangler target is `strumentini`. Production `AUTH_DB` is `strumentini-auth`, created in EEUR and populated from a verified export of the pre-rebrand account database. That source database contained no users, sessions, favourites or login-attempt rows; both migrations were preserved. The binding migration completed a real deploy → rollback → restore cycle, after which the superseded D1 resource was deleted. Post-delete auth-session smoke remained healthy.

The static build treats `https://strumentini.it` as its default canonical origin. The current clean `2af6e8c` artifact is live on that custom domain and has been matched byte-for-byte on representative pages after restore.

## 2. Current production authority

Only Strumentini.it is part of this product's domain model. Current production authority is Cloudflare DNS + Worker `strumentini` + the existing `AUTH_DB` D1 binding. Unrelated third-party domains are not rollback infrastructure, migration dependencies or release gates for this project.

## 3. Cutover invariants

- `https://strumentini.it/` is the canonical public origin after activation.
- `https://www.strumentini.it/` redirects once to the apex.
- Worker `strumentini` continues to serve the same static artifact and account API.
- D1 binding `AUTH_DB` continues to point at the existing `strumentini-auth` database and its current data.
- The built `dist/` remains provider-portable.
- Turnstile allows the Strumentini.it hostname before password auth is considered healthy; Google Identity origin configuration is required only if `GOOGLE_CLIENT_ID` is enabled.
- DNS records for mail, verification and certificate policy are copied to Strumentini.it only when they are actually required for the new domain and have been re-verified with the owner; an old-zone snapshot is not authority for a new zone.

## 4. Activation gate for Strumentini.it — PASSED 2026-10-07

The gate below is retained as a pre-release recheck. On 2026-10-07 it passed: recursive DNS returns the Cloudflare nameservers and apex A/AAAA records, TLS is valid, apex HTTPS returns 200 and `www` redirects to the apex.

Capture the state:

~~~sh
dig +noall +answer strumentini.it NS
dig +noall +answer strumentini.it SOA
dig +noall +answer strumentini.it A
dig +noall +answer strumentini.it AAAA
dig +noall +answer www.strumentini.it A
dig +noall +answer www.strumentini.it CNAME
dig +noall +answer strumentini.it MX
dig +noall +answer strumentini.it TXT
dig +noall +answer strumentini.it CAA
dig +noall +answer _dmarc.strumentini.it TXT
~~~

The activation gate passes only when the registry/registrar hold is cleared and authoritative DNS can be delegated normally. That condition is currently satisfied; re-record the authoritative answers immediately before the final deployment so the release receipt reflects the current state.

## 5. Pre-cutover capture

Run from the repository after the activation gate passes:

~~~sh
git rev-parse HEAD
npm run release:validate:require-ready
npm run deploy:check
npx wrangler deployments list
npx wrangler d1 info strumentini-auth --json
npx wrangler secret list --name strumentini

dig +noall +answer strumentini.it NS
dig +noall +answer strumentini.it SOA
dig +noall +answer strumentini.it A
dig +noall +answer strumentini.it AAAA
dig +noall +answer strumentini.it MX
dig +noall +answer strumentini.it TXT
dig +noall +answer strumentini.it CAA
dig +noall +answer _dmarc.strumentini.it TXT

~~~

Stop if the source revision, release gates, Worker deployment or DNS state is not understood. Never replace a whole zone from a stale snapshot.

## 6. Prepare the Cloudflare zone

1. Add `strumentini.it` to the same Cloudflare account that owns Worker `strumentini`.
2. Record the Cloudflare-assigned authoritative nameservers.
3. Configure only the DNS records required for Strumentini.it. Re-create mail, SPF, verification, DMARC or CAA records from current requirements, not by copying the old zone unexamined.
4. Keep Worker `strumentini`, D1 `strumentini-auth`, and binding `AUTH_DB` unchanged.
5. At Dynadot, set the domain's nameservers to the two Cloudflare-assigned nameservers. For this newly registered `.it` domain, wait until NIC.it clears `inactive / dnsHold` and recursive `dig NS strumentini.it` returns the Cloudflare nameservers before the production deploy.
6. Configure Cloudflare SSL/TLS for the apex and `www`.
7. Add `strumentini.it` (and `www.strumentini.it` if the widget requires it) to the Turnstile hostname allowlist before enabling password auth there.
8. `GOOGLE_CLIENT_ID` is currently absent, so Google sign-in remains hidden. If it is enabled later, add `https://strumentini.it` to the Google Web OAuth client's authorized JavaScript origins before setting the Worker secret.
9. Configure a proxied `www` record plus a Cloudflare redirect that returns 308 to the same path on `https://strumentini.it`, preserving the query string.

Do not mutate unrelated domains during preparation. Strumentini.it rollback is version-based through Cloudflare Worker deployments.

## 7. Final release action

Execute this section only as part of the authorized production release.

1. Re-run sections 4 and 5 and archive the evidence.
2. Record the exact current Worker version with `npx wrangler deployments status --name strumentini`.
3. Use the repository's **guarded, opt-in** source-controlled entrypoint instead of a bare Wrangler deploy: `npm run deploy:production:guarded -- --expected-sha=<full-current-origin-main-sha>`. It checks local and remote `main` against the exact committed SHA, clean worktree, cumulative tests/build, static Cloudflare dry-run and the **read-only `--require-ready` validator** before invoking Wrangler. A missing/stale Gold receipt, physical device, security, browser or rollback gate blocks publication. This is a recommended operational guard, **not an enforced Cloudflare account policy**: direct `npx wrangler deploy`, Wrangler version promotion, the dashboard, or another machine could still bypass it. Such bypasses are **NOT approved** and cannot be claimed prevented until provider-side restricted production deployment authority and independently observed authorization gates exist. The repository's `wrangler.jsonc` declares `strumentini.it` as a `custom_domain`, so the guarded deploy updates the existing Worker and attaches the apex route while preserving its D1 database.
4. Record the resulting Worker version with `npx wrangler deployments status --name strumentini`.
5. Confirm the `www` redirect is active.
6. Wait until authoritative and recursive DNS agree on the Cloudflare delegation and the edge certificate is valid.
7. Run the smoke gate below before declaring the release complete.

## 8. Smoke gate

~~~sh
dig +short NS strumentini.it
curl -sSIL https://strumentini.it/
curl -sSIL https://www.strumentini.it/
curl -sS https://strumentini.it/robots.txt
curl -sS https://strumentini.it/sitemap.xml
curl -sS -i https://strumentini.it/api/auth/session
~~~

Verify all of the following against the same deployed source revision:

- apex returns HTTPS 200 from the intended Cloudflare path;
- `www` redirects once to the apex;
- certificate SAN covers the required Strumentini hostnames;
- canonical, Open Graph URL, sitemap and robots references use `https://strumentini.it`;
- `/`, `/strumenti/`, a representative tool route and `/404.html` render correctly;
- static assets have the expected content types and cache behavior;
- `/api/auth/session` reaches the Worker and existing D1 binding without a 5xx;
- Turnstile accepts the new hostname;
- Google sign-in is shown only if the OAuth client is configured for the new origin;
- an ordinary local-only tool makes no new application network request;
- there is no redirect loop.

## 9. Canonical-domain rule

Strumentini.it is the only public domain in scope for this product. Do not add unrelated external domains as redirect, rollback, SEO or migration dependencies. Application rollback uses the previous known-good Cloudflare Worker version, not a second domain.

## 10. Rollback

The primary application rollback keeps DNS, TLS and the D1 binding intact. Use the exact pre-deploy Worker version recorded in section 7:

~~~sh
npx wrangler rollback PREVIOUS_VERSION_ID --name strumentini --message "Rollback Strumentini.it production"
~~~

Re-run the section 8 smoke gate and confirm the apex serves the previous known-good version while `AUTH_DB` still points to the same D1 UUID.

If the Worker version is healthy but the Strumentini custom-domain attachment itself fails, repair or remove only that custom-domain mapping while preserving the same `AUTH_DB` binding and deployment history.

If the new zone itself is wrong, correct or roll back only Strumentini.it delegation. Do not modify the old domain's mail/DNS records as a side effect.

## 11. Completion evidence

Attach to the release receipt:

- source revision and certified build fingerprint;
- proof that the Strumentini NIC/DNS hold cleared;
- authoritative NS and relevant pre/post DNS answers for Strumentini.it;
- selected Worker deployment version;
- apex and `www` response headers;
- TLS subject/SAN/issuer/validity;
- canonical/robots/sitemap checks for the new origin;
- auth smoke showing the existing D1 binding still works;
- Turnstile and Google-origin configuration evidence where enabled;
- representative browser acceptance output;
- rollback check result or a documented reason it was not invoked.

The Strumentini.it production cutover evidence is current for clean revision `2af6e8c` / source `2c38b13c…`: live multi-browser smoke, byte identity, auth/D1 smoke, real rollback to `a38c668c…`, password-page hash and D1-binding reversion, restore to `7e974054…`, and post-retirement auth smoke were observed.
