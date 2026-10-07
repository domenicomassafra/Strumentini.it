# 283 — Custom-domain post-cutover smoke and rollback certification

**What to build:** After an authorized Strumentini.it activation/cutover, run HTTPS/TLS, canonical/redirect, assets, all-browser smoke, rollback rehearsal and restore validation on `strumentini.it` itself.

**Traces to:** US-EXP-09; AC-09.1

**Constraints:** C-EXP-02; execute only after separately authorized DNS/cutover action.

**Blocked by:** none.

**Status:** completed — Strumentini.it build, live smoke, rollback and restore are certified

**Suggested skills:** deploy-ship → qa-browser

- [x] Custom domain serves the same certified build fingerprint as target Worker.
- [x] Canonical/redirect/asset behavior is correct on the Strumentini.it apex and `www`.
- [x] Rollback and restore both have observed smoke evidence.

**Verification:** On 2026-10-08 clean revision `2af6e8c4030c880780e5b151b4ae3f070b28b219` / source fingerprint `2c38b13c93d65e40d24730c76c0e766fee5a764dd214dd007d17e2a064fafeeb` was deployed to Strumentini.it as Worker version `7e974054-1e52-4b1b-a41e-daadeece0232` (deployment `8cd7da0c-68bd-402d-b549-d51e9928a174`) with `AUTH_DB` bound to `strumentini-auth`. Apex, directory, password-strength, XML formatter and auth session returned HTTP 200; Google config remained the expected fail-closed 503. Chromium, Firefox and WebKit smoke passed with zero page/request errors, and representative live HTML was byte-identical to local `dist`. A real rollback deployment `23426f6a-4f2e-4c3a-8190-efa4890fe294` moved traffic to previous known-good version `a38c668c-750e-44df-97aa-7977863c8768`; the password page reverted to its previous SHA-256 and the D1 binding reverted to its previous UUID while auth session stayed HTTP 200. Restore deployment `97993e35-f30c-46d1-a201-b0aa8e883793` returned `7e974054…` and `strumentini-auth` to 100%; the current page hash and auth smoke returned. The superseded D1 resource was then permanently deleted and post-delete auth smoke remained HTTP 200. Versionable evidence is in `evidence/ticket283-cutover-rollback-20261007.md`; machine-readable release receipts are stored under `quality/receipts/release/`. No unrelated external domain is part of this ticket or of the Strumentini.it rollback path.
