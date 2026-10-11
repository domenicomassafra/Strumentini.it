# 415 — Per-tool base claim proof and certification coverage

**What to build:** Every catalog route maps declared job limit receipt and independent evidence or pending

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** 408

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-415.1: Every catalog route maps declared job limit receipt and independent evidence or pending.
- [ ] AC-415.2: Missing current receipt never displayed verified.
- [ ] AC-415.3: On the scoped input and failure cases, verify: 269 tool traceability and reproducible proof sample. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** 269 tool traceability and reproducible proof sample; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 — Wave 13: current per-route manifest source binding (worker-14)

Documented in docs/PER-TOOL-PROOF-415-WAVE13.md, baseline HEAD cb575662. Found and reproduced a **concrete false VERIFIED** in the receipt probe: even with correct receipt SHA-256/revision/global source fingerprint, the receipt could hold a **stale identities.manifestSha256** not matching the current route's actual manifest bytes. New adversarial synthetic receipts and distinct manifest fixtures proved **RED** (accepted stale source) then **GREEN** after adding independent digest-to-receipt equality and fail-closed missing digest behavior. This is a narrow proof-validator fix; release and receipt producers unchanged.

Scoped Vitest **5/5 PASS**; strict TS es2023 **PASS**. Independently checked **two local real outputs**, no user data: SHA-256 checksum manifest of known.txt + rows.csv against Node crypto, and 219-byte zip-creator output read back using fflate unzipSync, each extracted byte-for-byte matching originals. Actual ZIP SHA-256: 9266d22459e2fa3fb36d46102dd0dbd1c3599d21961854dc32e80341bd46e4ad. Repeated read-only inventory: **269/269 traced, 43 handoff limits, 226 runtime-limit attestations pending, 269 PENDING / 0 VERIFIED**. No generated catalog, certificate or receipt changed; no publish/deploy/commit.

**Disposition:** Original acceptance criteria remain **unchecked** and ticket **OPEN**: this proves one missing receipt-source condition and two local engine samples, **not** 269 independent runtime-job/limit receipts, each route's negative/huge/cancel behavior, full source/engine identities, browser+physical-device results, or a production Gold rollout.

**Retry under shared-host load:** One later Vitest run exceeded the default 5 s timeout during the 269-file read-only audit; identical tests with CLI-only --testTimeout=20000 passed **5/5**, and scoped strict TS passed. No assertions or repository default test timeout were weakened.

## 2026-10-11 wave 06 — read-only per-tool proof map (slice, NOT closure)

Nuovo `scripts/audit-per-tool-proof-415.ts` inventario `--json` read-only dei 269 ID/route con jobs, input, limiti handoff espliciti o `PENDING_RUNTIME_LIMIT_ATTESTATION`, source manifest/page/module e SHA di tracciabilità, oracolo/famiglie fixture registrati, receipt storico **non** confuso con receipt Gold corrente e filtro corrente source-wide/hash-byte/revision/provenienza. `tests/per-tool-proof-415.test.ts` copre 269/269, ID duplicati, route falsificate, assenza jobs e receipt alterati/stale; campione indipendente PDF/PNG/CSV/DOCX/XLSX/WAV `scripts/verify-output-consumers-408.ts` 6/6 `PASS_LOCAL` di formato. Risultato reale: **269/269 mappati**, 269 riferimenti a registro presenti, 43 limiti handoff dichiarati, 226 privi di limite handoff nel manifest, **0 Gold correnti / 269 PENDING**. Vedi `docs/PER-TOOL-PROOF-415-2026-10-11.md`.

**AC-415.1/.3 non chiuse:** mancano ancora prova e limiti runtime source-bound per ciascun tool e casi per-route negativi/timeout/partial/cancel, oltre a supporto per positività receipt (#347). Gli oracoli di formato non certificano ogni singola route. `AC-415.2` soddisfatto localmente per la negazione (missing/stale non diventano Verified). **Ticket resta OPEN**, senza promozione Gold, push o release.

## 2026-10-11 — Wave 15: refuse valid receipt bytes under another tool's filename (worker-8)

**Ownership and baseline:** HEAD `39e07827`; worker exclusively edited `scripts/audit-per-tool-proof-415.ts`, added `tests/per-tool-proof-wave15-415.test.ts` and updated this original ticket. All other working-tree edits belong to concurrent workers; no change to generated Gold quality index, manifest, catalog, receipt/fixture, or historical evidence.

**Actual new false-positive / adversarial RED:** existing `probeReceipt415` authenticated the receipt's body SHA-256, current per-route manifest SHA-256, revision, global source fingerprint, schema, identity and canonical receipt content, **but only checked the path against a generic JSON filename regex**. A synthetic *internally consistent* `business-day` Gold receipt (not stored or published) was accepted under `quality/receipts/table-ops/csv-dedupe.gold.json` although that leaf identifies a **different tool**. This precise falsification is independent of the previous wave's stale-manifest source-binding fix. New focused test recorded RED: expected `false`, got `true`.

**Minimal GREEN:** receipt probe now requires a safe canonical tool-id slug and that the Gold receipt file basename is exactly `<toolId>.gold.json`, whether at `quality/receipts/` root or within a family grouping. Valid canonical tool-owned paths still pass; alternate-tool leaf paths or malformed/mis-cased suffixes fail closed. Existing receipt SHA, per-manifest SHA, global source fingerprint, revision, canonical release validator and all other gates remain unchanged. This accepts no actual candidate; it is a **potential fail-open proof-validation bug** demonstrated using synthetic fixtures, not evidence that deployed users saw a forged Gold badge.

**Verified:** `vitest run tests/per-tool-proof-wave15-415.test.ts tests/per-tool-proof-415.test.ts --testTimeout=20000` **7/7 PASS** (2 new + 5 existing), including live read-only 269-route map. `tsx scripts/audit-per-tool-proof-415.ts --json` run on current checkout: **269/269 traced, 0 current VERIFIED, 269 PENDING, 0 missing source files, 226 pending runtime limit attestations, 0 registry binding gaps**. `git diff --check` for in-scope tracked files PASS. No source/receipt or historical Gold statuses promoted.

**Original AC/status:** remains `ready-for-agent` with AC-415.1/2/3 globally **unchecked**. Missing physical/independent per-tool negative, cancel, huge and partial tests and valid current receipts remain release NO_GO. No full-269 Gold certification, deploy, commit, push, dashboard mutation, or source fingerprint regeneration by this worker.

**Final repository validation:** `astro check` exit 0 (**2019 files, 0 errors, 0 warnings, 23 nonblocking hints**) and `npm run tickets:check` PASS (**0 stored-status mismatches**). These checks verify the source/test overlay; they do not upgrade historical Gold to CURRENT.
