# Ticket 283 — Strumentini.it live-domain recheck — 2026-10-07

This is observational evidence from read-only DNS/TLS/HTTP checks. It is not a rollback receipt and does not certify the final build.

## DNS and TLS

- `strumentini.it` A: `188.114.96.7`, `188.114.97.7`.
- `strumentini.it` AAAA: `2a06:98c1:3120::7`, `2a06:98c1:3121::7`.
- Authoritative nameservers: `candy.ns.cloudflare.com`, `kanye.ns.cloudflare.com`.
- TLS certificate subject: `CN=strumentini.it`; SANs include `strumentini.it`, `www.strumentini.it`, `*.www.strumentini.it`.
- Certificate validity observed: 2026-10-06 19:09:25 UTC through 2027-01-04 20:09:09 UTC.

## HTTP smoke

- `https://strumentini.it/` → 200.
- `https://strumentini.it/strumenti/` → 200.
- `https://strumentini.it/categorie/` → 200.
- `https://strumentini.it/cerca/` → 200.
- `https://strumentini.it/risorse/` → 200.
- `https://strumentini.it/preferiti/` → 200.
- `https://strumentini.it/impostazioni/` → 200.
- `https://strumentini.it/accedi/` → 200.
- `https://strumentini.it/onboarding/` → 200.
- `https://strumentini.it/tools/image-resize/` → 200.
- `https://strumentini.it/robots.txt` → 200.
- `https://strumentini.it/sitemap.xml` → 200.
- `https://strumentini.it/favicon.svg` → 200.
- `https://strumentini.it/og-image.png` → 200.
- `https://www.strumentini.it/` → 308 to `https://strumentini.it/`.
- `https://strumentini.it/api/auth/google/config` → 503 with the expected fail-closed Google-auth-unavailable response.

The apex homepage and `https://strumentiutili-it.massafradomenico4.workers.dev/` were fetched during the same recheck and both hashed to:

`932b3a4792d6f1590866c917b76573b00478f20982deaf041ac0aceb5822fa69`

This proves the custom domain is currently serving the same deployed homepage bytes as the Worker origin checked here. It does not prove those bytes are the final repository build or the certified source fingerprint.

## Rebrand/canonical mismatch still live

The live HTML still contains `StrumentiUtili.it` metadata and uses `https://strumentiutili.it/` as canonical/OG origin. `robots.txt` advertises `https://strumentiutili.it/sitemap.xml`, and `sitemap.xml` contains `https://strumentiutili.it/...` locations.

The current repository source has already moved its public brand/canonical defaults to `Strumentini.it` / `https://strumentini.it`; no `StrumentiUtili.it`, `Strumenti Utili`, or `https://strumentiutili.it` public-brand match is present under `src`, `public`, `astro.config.mjs` or `worker` in the 2026-10-07 local grep. Therefore the observed mismatch is a deployment/cutover gap rather than a current-source branding gap.

## Remaining acceptance boundary

No DNS mutation, deploy, rollback, restore, Turnstile mutation or WAF mutation was performed. Ticket 283 still requires the final Strumentini.it build on the custom domain, multi-browser live-domain smoke, and observed rollback/restore evidence before it can close.
