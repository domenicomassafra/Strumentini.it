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

The live HTML uses `Strumentini.it` metadata and `https://strumentini.it/` as canonical/OG origin. `robots.txt` advertises `https://strumentini.it/sitemap.xml`, and `sitemap.xml` contains `https://strumentini.it/...` locations.

## Remaining acceptance boundary

No DNS mutation, deploy, rollback, restore, Turnstile mutation or WAF mutation was performed during this early read-only recheck. The later release exercise recorded in `ticket283-cutover-rollback-20261007.md` completed the custom-domain, multi-browser, rollback and restore acceptance and closed ticket 283.
