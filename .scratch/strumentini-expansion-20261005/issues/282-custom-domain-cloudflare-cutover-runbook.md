# 282 — Strumentini.it Cloudflare custom-domain cutover runbook

**What to build:** Prepare a concrete reversible activation of the newly purchased Strumentini.it domain on the certified Cloudflare Worker/custom-domain path, including registrar/DNS state, TLS, retained Worker/D1 resources, smoke checks and rollback steps; do not execute DNS or deployment changes in this ticket.

**Traces to:** US-EXP-09; AC-09.1

**Constraints:** C-EXP-02; ops/runbook only; preserve current production until separately authorized.

**Blocked by:** None — planning can start immediately.

**Status:** completed

**Suggested skills:** deploy-ship → security-audit → qa-browser

- [x] Current registrar/DNS/custom-domain state is captured before any change.
- [x] Cutover and rollback steps are exact and reversible in `docs/12-cloudflare-custom-domain-cutover.md`.
- [x] No DNS mutation/deploy switch occurred while preparing the runbook.

**Verification:** 2026-10-06 capture shows NIC.it `inactive / dnsHold`, DNS `NXDOMAIN`, and no HTTPS endpoint for `strumentini.it`. Cloudflare auth, existing Worker deployment history, D1 binding and `wrangler deploy --dry-run` were verified read-only. The runbook records the activation sequence, target DNS state, smoke gate and rollback commands.
