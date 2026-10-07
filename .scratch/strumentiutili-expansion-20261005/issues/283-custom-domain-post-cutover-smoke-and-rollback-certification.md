# 283 — Custom-domain post-cutover smoke and rollback certification

**What to build:** After an authorized Strumentini.it activation/cutover, run HTTPS/TLS, canonical/redirect, assets, all-browser smoke, rollback rehearsal and restore validation on `strumentini.it` itself.

**Traces to:** US-EXP-09; AC-09.1

**Constraints:** C-EXP-02; execute only after separately authorized DNS/cutover action.

**Blocked by:** DNS/TLS activation is complete, but the live custom domain still serves the pre-rebrand deployment whose canonical/OG/robots/sitemap URLs point at `https://strumentiutili.it`. The final Strumentini.it build has not been observed on the custom domain, and rollback/restore plus multi-browser smoke have not been certified against that final build.

**Status:** blocked — domain active; final build/canonical and rollback certification pending

**Suggested skills:** deploy-ship → qa-browser

- [ ] Custom domain serves the same certified build fingerprint as target Worker.
- [ ] Canonical/redirect/asset behavior has no legacy Vercel split-brain.
- [ ] Rollback and restore both have observed smoke evidence.

**Verification:** The 2026-10-07 live recheck proves public Cloudflare DNS (A/AAAA and `candy.ns.cloudflare.com` + `kanye.ns.cloudflare.com`), a valid TLS certificate for `strumentini.it`/`www.strumentini.it`, HTTP 200 across the core public route smoke (`/`, `/strumenti/`, `/categorie/`, `/cerca/`, `/risorse/`, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`, `/tools/image-resize/`, `robots.txt`, `sitemap.xml`, favicon and OG image), and `www` → apex HTTP 308. The apex homepage is byte-identical to the current `workers.dev` deployment (SHA-256 `932b3a4792d6f1590866c917b76573b00478f20982deaf041ac0aceb5822fa69`), but that deployment still emits `StrumentiUtili.it` branding and `https://strumentiutili.it` canonical/OG/robots/sitemap URLs. `/api/auth/google/config` remains the expected 503 fail-closed response. See `evidence/ticket283-domain-recheck-20261007.md`. Ticket 283 stays open until the final Strumentini.it build is actually deployed and the live-domain multi-browser plus rollback/restore receipts are observed. The exact smoke and rollback procedure is in `docs/12-cloudflare-custom-domain-cutover.md`.
