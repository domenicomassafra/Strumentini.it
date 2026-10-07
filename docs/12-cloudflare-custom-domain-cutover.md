# Strumentini.it — Cloudflare custom-domain activation and cutover runbook

Status: Strumentini.it activation, final build deployment, live smoke and rollback/restore certification completed on 2026-10-07 for clean revision `6480e9b` / source fingerprint `2d54b431…`. The remaining transition item is the legacy `strumentiutili.it` Vercel origin, which still serves the older site instead of redirecting to Strumentini.it.

Brand/domain update: 2026-10-07. `Strumentini.it` is the canonical public brand and origin. Public DNS is delegated to Cloudflare, apex HTTPS is live, `www` redirects to the equivalent apex path, the 259-tool build is live, and deploy → rollback → restore has been observed against the production domain. Ticket 283 remains open only because the old `strumentiutili.it` Vercel site has not yet been replaced by the intended legacy-domain redirect.

## 1. Infrastructure identities that stay stable

Current production identities:

| Resource | Identifier |
|---|---|
| Public brand | `Strumentini.it` |
| Canonical target origin | `https://strumentini.it/` |
| Cloudflare Worker | `strumentini` |
| D1 auth database | `strumentiutili-auth` |
| D1 UUID | `b172e08e-3a81-41dd-87d4-c8c4859b7274` |
| Public Worker origin | `https://strumentini.it/` custom domain; checked `workers.dev` hostnames are not a production authority |
| Current Worker secret state | `TURNSTILE_SECRET` present; `GOOGLE_CLIENT_ID` absent |

The D1 name is an intentional legacy identifier and remains bound to the production Worker. The current Wrangler target is `strumentini`; the database remains `strumentiutili-auth`, preserving the existing auth data and migrations.

The static build treats `https://strumentini.it` as its default canonical origin. The final clean `6480e9b` artifact is live on that custom domain and has been matched byte-for-byte on representative pages after restore.

## 2. Legacy production snapshot retained as provenance

The following values were captured for `strumentiutili.it` on 2026-10-05 before the rebrand. They are historical rollback evidence and must not be copied blindly into the new zone.

| Item | Observed value on 2026-10-05 |
|---|---|
| Apex nameservers | ns1.vercel-dns.com, ns2.vercel-dns.com |
| Apex A | 64.29.17.65, 216.198.79.65 |
| www A | 216.198.79.1, 64.29.17.65 |
| Apex AAAA | none observed |
| MX | 10 mx1.improvmx.com, 20 mx2.improvmx.com |
| TXT | Google site verification; v=spf1 include:spf.improvmx.com ~all |
| CAA | Let's Encrypt, Google Trust Services, Sectigo |
| _dmarc TXT | none observed |
| Apex HTTPS | 200, server: Vercel |
| www HTTPS | 307 to `https://strumentiutili.it/`, then Vercel 200 |
| TLS certificate | `*.strumentiutili.it` + `strumentiutili.it`, Let's Encrypt; expires 2026-11-23 |

The repository's Cloudflare target at that capture was Worker `strumentiutili-it`, serving `./dist` through Workers Static Assets with `AUTH_DB` bound to the existing D1 database. The latest deployment observed in that capture was version `21a6d04e-7637-445a-a133-de84a4bcf51f`, created 2026-10-05T12:00:30Z.

Re-capture both domains immediately before any release action. The values above document the old environment; they are not permanent configuration.

## 3. Cutover invariants

- `https://strumentini.it/` is the canonical public origin after activation.
- `https://www.strumentini.it/` redirects once to the apex.
- Worker `strumentiutili-it` continues to serve the same static artifact and account API.
- D1 binding `AUTH_DB` continues to point at the existing `strumentiutili-auth` database and its current data.
- The built `dist/` remains provider-portable.
- Turnstile allows the Strumentini.it hostname before password auth is considered healthy; Google Identity origin configuration is required only if `GOOGLE_CLIENT_ID` is enabled.
- The legacy `strumentiutili.it` origin remains available as rollback/transition infrastructure until the new domain passes smoke checks.
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
npx wrangler d1 info strumentiutili-auth --json
npx wrangler secret list --name strumentiutili-it

dig +noall +answer strumentini.it NS
dig +noall +answer strumentini.it SOA
dig +noall +answer strumentini.it A
dig +noall +answer strumentini.it AAAA
dig +noall +answer strumentini.it MX
dig +noall +answer strumentini.it TXT
dig +noall +answer strumentini.it CAA
dig +noall +answer _dmarc.strumentini.it TXT

dig +noall +answer strumentiutili.it NS
dig +noall +answer strumentiutili.it A
dig +noall +answer www.strumentiutili.it A
curl -sSIL https://strumentiutili.it/
~~~

Stop if the source revision, release gates, Worker deployment, DNS state, or legacy rollback origin is not understood. Never replace a whole zone from a stale snapshot.

## 6. Prepare the Cloudflare zone

1. Add `strumentini.it` to the same Cloudflare account that owns Worker `strumentiutili-it`.
2. Record the Cloudflare-assigned authoritative nameservers.
3. Configure only the DNS records required for Strumentini.it. Re-create mail, SPF, verification, DMARC or CAA records from current requirements, not by copying the old zone unexamined.
4. Keep Worker `strumentiutili-it`, D1 `strumentiutili-auth`, and binding `AUTH_DB` unchanged.
5. At Dynadot, set the domain's nameservers to the two Cloudflare-assigned nameservers. For this newly registered `.it` domain, wait until NIC.it clears `inactive / dnsHold` and recursive `dig NS strumentini.it` returns the Cloudflare nameservers before the production deploy.
6. Configure Cloudflare SSL/TLS for the apex and `www`.
7. Add `strumentini.it` (and `www.strumentini.it` if the widget requires it) to the Turnstile hostname allowlist before enabling password auth there.
8. `GOOGLE_CLIENT_ID` is currently absent, so Google sign-in remains hidden. If it is enabled later, add `https://strumentini.it` to the Google Web OAuth client's authorized JavaScript origins before setting the Worker secret.
9. Configure a proxied `www` record plus a Cloudflare redirect that returns 308 to the same path on `https://strumentini.it`, preserving the query string.

Do not redirect or retire `strumentiutili.it` during preparation. It is the immediate rollback origin until the new domain is proven.

## 7. Final release action

Execute this section only as part of the authorized production release.

1. Re-run sections 4 and 5 and archive the evidence.
2. Record the exact current Worker version with `npx wrangler deployments status --name strumentiutili-it`.
3. Run `npx wrangler deploy`. The repository's `wrangler.jsonc` declares `strumentini.it` as a `custom_domain`, so this deploy updates the existing Worker and attaches the apex route without renaming the Worker or D1 database.
4. Record the resulting Worker version with `npx wrangler deployments status --name strumentiutili-it`.
5. Confirm the `www` redirect is active.
6. Wait until authoritative and recursive DNS agree on the Cloudflare delegation and the edge certificate is valid.
7. Run the smoke gate below before changing the legacy domain.

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

## 9. Legacy-domain transition

Only after the Strumentini smoke gate passes should `strumentiutili.it` stop being a standalone canonical site.

The preferred transition is a permanent redirect from the old apex and `www` to the equivalent `https://strumentini.it/` path, while keeping enough of the old hosting configuration available for immediate rollback during the observation window. Capture redirect behavior and search/discovery metadata as release evidence.

Do not destroy the old Vercel project, old-domain DNS evidence, or Cloudflare deployment history as part of the first Strumentini release.

## 10. Rollback

The primary application rollback keeps DNS, TLS and the D1 binding intact. Use the exact pre-deploy Worker version recorded in section 7:

~~~sh
npx wrangler rollback PREVIOUS_VERSION_ID --name strumentiutili-it --message "Rollback Strumentini.it production"
~~~

Re-run the section 8 smoke gate and confirm the apex serves the previous known-good version while `AUTH_DB` still points to the same D1 UUID.

If the Worker version is healthy but the Strumentini custom-domain attachment itself fails before the legacy domain has been redirected, remove or disable only the new Worker custom-domain mapping and leave the old production origin serving traffic.

If the legacy redirect has already been enabled, restore the last verified `strumentiutili.it` origin from the fresh pre-cutover capture, then remove or disable the failing Strumentini route as needed. Keep `AUTH_DB` pointed at the same D1 database throughout; DNS rollback must never fork account data.

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
- legacy-domain redirect result, if enabled;
- rollback check result or a documented reason it was not invoked.

The Strumentini.it production cutover evidence now exists for clean revision `6480e9b` / source `2d54b431…`: live multi-browser smoke, byte identity, auth/D1 smoke, real rollback and restore were observed. The broader domain migration is still incomplete only because the legacy `strumentiutili.it` Vercel origin remains independently reachable instead of redirecting to Strumentini.it.
