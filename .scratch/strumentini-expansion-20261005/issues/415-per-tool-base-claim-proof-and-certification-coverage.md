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

## 2026-10-12 — Next wave: source-bound fixture families and symlink refusal (worker-25)

**Distinct reproduced failure:** The #415 audit required exact receipt SHA-256, live per-route `identities.manifestSha256`, current Git revision/global source fingerprint and the declared fixture-family **names**, but never independently bound `identities["fixture:<family>:sha256"]` to the actual family fixture bytes. Adversarial synthetic receipts with a valid SHA-256, revision, source fingerprint and live manifest digest still passed `probeReceipt415` while claiming a **withdrawn previous fixture version**; missing/duplicate or unbound fixture-family identities also passed. New isolated regression first showed **RED, 2/2 fail as expected** (actual `true` where `false` was required). This does not imply a deployed forged receipt: all live Gold candidates remain empty.

**Correction:** In current on-disk audit, every projected candidate now obtains the declared family's current path from `quality/fixtures/index.json`, re-reads its actual bytes, computes SHA-256 and requires exact `identities["fixture:<family>:sha256"]` equality for every family, with duplicate/missing families and files rejected. `safeRead` also resolves the canonical filesystem target and rejects symlink escapes outside the checkout. The existing exported standalone manifest-probe use remains backward compatible without a fixture map; **the actual #415 current-proof audit always supplies one**. These are byte/source checks, not independent proof of fixture correctness, rights ownership, physical devices or engine outcomes. No Gold receipt, generated index, oracle, fixture or public release was modified.

**Verification:** `tests/per-tool-proof-next-415.test.ts` covers withdrawn-vs-current fixture digests, duplicate/unbound identities, actual temporary fixture-file replacement/removal and an outside-root symlink. **GREEN 11/11** across new and preceding #415 tests (4 new, 7 prior); strict standalone TypeScript PASS. Live source-local inventory still **269/269 traced, 0 VERIFIED, 269 PENDING, 0 missing sources, 0 registry binding gaps, 226 runtime limit attestations pending**. Full original AC-415.1/.2/.3 remain **unchecked**, ticket **OPEN / release NO_GO** until independent source-bound route/engine/limits/negative/cancel/large/device evidence and release authority are established. The production Gold generator is separately scoped and was not strengthened by this audit-only wave.

**Additional repository checks:** `astro check` PASS (**2030 files, 0 errors, 0 warnings, 23 hints**); `npm run tickets:check` PASS (**0 stored-status mismatches**); `git diff --check` PASS. Changes left uncommitted for prime review; concurrent #336/#370/#404 worker files were untouched.

## 2026-10-13 wave4 — live oracle-registry identity binding (worker-4; partial, OPEN)

**Independently reproduced NEW false VERIFIED:** The wave13/15/next receipt probe already independently bound receipt SHA, current revision and global source fingerprint, the per-tool manifest SHA, fixture-family hashes and tool-owned receipt filename. However, the declared `identities.oracleRegistrySha256` was not checked against the actual bytes of `quality/oracles/registry.json`. A validly hashed candidate for the real `business-day` catalog declaration, using its *current* local manifest and family fixture bytes and the checkout's actual revision/source fingerprint, was accepted despite claiming the SHA-256 of a withdrawn oracle-registry file. The withdrawn file was an actual temporary JSON registry whose `cand-083` oracle strategy was changed; its SHA was recomputed from its physical bytes. This is a concrete **receipt-probe false positive** with an adversarial fixture, not evidence that a deployed user saw an unearned verified badge. The canonical current oracle registry at this checkpoint hashes to `76db0055bbc035345189bdf4c1b4de295c5e5b430597df9bb69dcfaeedd24b2` (verify again before reuse).

**RED → GREEN:** New `tests/per-tool-proof-415-20261013-oracle-binding.test.ts` first failed: stale oracle identity returned `true` when `false` was required (**Vitest exit 1**, expected false/received true). Minimal amendment to `scripts/audit-per-tool-proof-415.ts`: the actual audit reads the oracle registry once, parses its entries and independently SHA-256-hashes those *same bytes*, then passes that current digest to `probeReceipt415` for every projected candidate. With this binding present, the probe rejects missing, stale or unequal oracle-registry identities; the valid current identity still passes. The optional field preserves previously supported standalone manifest-only probes, but **the full on-disk current-proof audit always supplies it**. No oracle/fixture files, generator, index, Gold receipts, release gate, manifests or producer code were changed.

**Fresh checks:** New negative+positive test GREEN; all **12/12** tests across four `tests/per-tool-proof*` suites PASS (`--testTimeout=20000`), including the existing full local 269-route inventory and previous stale/borrowed-path/fixture and symlink regressions. Scoped strict TypeScript compilation of the auditor and new test PASS (exit 0). `tsx scripts/audit-per-tool-proof-415.ts` read-only output: **269 tools, 0 VERIFIED / 269 PENDING**, zero missing source files, zero registry gaps and 226 runtime-limit attestations pending (exit 0). Full repository `tsc --noEmit` is currently **NOT PASS** due four unowned diagnostics in concurrent `tests/pdf-redaction-406-20261013-hybrid-single-revision.test.ts` (TS18048/TS2345); these were not changed or masked. No physical/device, Gold, consumer/negative/huge/cancel-per-route, production or rollback proof was added.

**Disposition:** Original AC-415.1/.2/.3 remain **unchecked**, status remains `ready-for-agent` / **OPEN**. This is a single bounded proof-gate correction, not certification of 269 routes, independent source truth/engine behavior or a signed release receipt. No staging, commit, push, PR, deploy or ticket-dashboard mutation by worker-4; other workers' files were untouched.

## 2026-10-13 native follow-up — oracle entry ritirata, falso VERIFIED (P2; OPEN)

**Difetto preesistente, indipendente dal precedente hash del registro:** Il percorso corrente `auditCurrentProofMap415` confrontava l'hash del *file* `quality/oracles/registry.json`, SHA del receipt, revision e fingerprint globali, SHA del manifest, fixture bytes e dichiarazioni del catalogo, senza richiedere che il singolo `oracleEntryId` esistesse nelle entry effettive del registro. Inoltre `createProofMap415` poteva proiettare contemporaneamente `currentProof: VERIFIED` e `registryBinding: PENDING_REGISTRY_OR_FIXTURE` se riceveva un candidato già accettato da una verifica più debole.

**RED reale su fonti originali:** nuovo `tests/per-tool-proof-415-20261013-oracle-membership.test.ts` legge il vero registro locale con 269 entry, la dichiarazione catalogo `business-day` → `cand-083`, il manifest corrente, `quality/fixtures/index.json` e le sue fixture fisiche, il Git revision e il fingerprint di sorgente attuali. Ricostruisce un candidato receipt coerente con **SHA-256 calcolati dai file reali**, lo sottopone al `probeReceipt415` esistente (PASS) e verifica il controllo positivo per l'entry registrata. Simula poi la rimozione della reale `cand-083` dalla membership del registro senza modificare nessun file di produzione; una copia JSON **fisica temporanea** del registro senza `cand-083` viene riletta e il receipt viene ri-hashato con il nuovo SHA del registro, così il precedente probe continua a dare PASS pur senza membership oracle. L'originale `createProofMap415` ritornava ancora `VERIFIED` pur indicando `PENDING_REGISTRY_OR_FIXTURE`. Primo test: **Vitest exit 1**, expected `currentProof:"PENDING"`, received `"VERIFIED"`, `currentReceipt:"quality/receipts/business-day.gold.json"` indebitamente conservato.

**Correzione fail-closed:** Solo `scripts/audit-per-tool-proof-415.ts` ora calcola un'unica volta gli ID dalle entry del **registro realmente letto** e scarta dall'audit corrente qualunque candidato il cui `tool.gold.oracleEntryId` non vi esista; inoltre `createProofMap415` ammette `VERIFIED` e relativo path soltanto se il binding oracle **e** famiglie fixture è `REGISTERED`. Rimangono invariati API, algoritmi di hash, fingerprint, receipt storici, registry stesso, catalog, source/fixture/producer/release gates e nessuna dichiarazione Gold aggiunta.

**GREEN e limiti:** `node_modules/.bin/vitest run tests/per-tool-proof-415-20261013-oracle-membership.test.ts tests/per-tool-proof-415-20261013-oracle-binding.test.ts tests/per-tool-proof-next-415.test.ts tests/per-tool-proof-wave15-415.test.ts tests/per-tool-proof-415.test.ts --testTimeout=20000` → **13/13 PASS**. `node_modules/.bin/tsx scripts/audit-per-tool-proof-415.ts` → **269 tool, 0 VERIFIED, 269 PENDING, 0 sourceErrors, 226 runtimeLimitsPending, 0 registryBindingsPending**, senza Gold promossi. Check TypeScript limitato con `tsc --ignoreConfig --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2023 --types node --allowImportingTsExtensions --lib es2023,dom` sui soli due file modificati **PASS** (il primo tentativo, senza `--ignoreConfig`, era rifiutato dal compilatore per TS5112, non un errore sorgente). Questo è un test di assenza di falsa certificazione su catalogo e sorgenti reali, **non un receipt Gold ufficiale** né un controllo su release live. Originali AC-415.1–3 **OPEN**, 269 attuali `PENDING`, senza prove fisiche/performance/negative/huge/cancel per ogni route, approvazione di Gold o deploy. Tutti gli altri file e gli altri worker esclusi dal perimetro, nessun Git stage/commit/push/PR o CI.

## 2026-10-13 — independent PR #15 second pass: missing route page falsely VERIFIED (P2, RED → GREEN)

**Exact reviewed source:** Draft PR #15 remote SHA c0f879a912d5a1419e21d29fc5d227a31e67a83a against origin/main 402774b32a3d8cb6d2f2cbe836734ea1c655a4fa (old PR merge base 04fa3d1); old remote SHA changed-source CI was SUCCESS. A current receipt with authentic exact manifest SHA-256, current oracle-registry bytes and membership, physical fixture-family SHA-256, revision and global source fingerprint could still yield currentProof: VERIFIED when the source route page was absent. auditCurrentProofMap415 calculated source.pagePresent but failed to gate current candidates on it; createProofMap415 projected VERIFIED and sourceErrors: 1 concurrently. This is a latent P2 false-positive source-proof projection, not an actually released Gold receipt.

**True RED with real catalog identities:** New tests/per-tool-proof-415-20261013-page-presence.test.ts reads the live business-day catalog declaration (cand-083), its actual manifest and page, the real current oracle registry and business-days fixture-family byte hashes, current revision and source fingerprint. A synthetic receipt exists only in memory and passes the independently source-hashed receipt probe. The old map returned verified: 1 even with pagePresent: false and sourceErrors: 1; the first isolated native Vitest run was RED 1/1. Neither production files nor actual Gold/registry/index sources were altered for this adversarial test.

**Minimal GREEN:** scripts/audit-per-tool-proof-415.ts now gates positive currentProof on source.manifestPresent AND source.pagePresent, in addition to unchanged accepted current receipt and REGISTERED oracle/fixture binding. Missing either source means PENDING and null currentReceipt; with both present the separately verified synthetic candidate still passes. The new test is GREEN, all original five per-tool-proof suites remain GREEN (14/14 focused proof tests). Scoped strict TypeScript PASS; actual no-write CLI remains 269 tools, zero VERIFIED, 269 PENDING, zero sourceErrors, 226 runtime limit attestations pending, zero registry binding gaps. Original AC-415.1/2/3 remain OPEN and physical, rights, full per-tool independence, large/cancel and Gold/release proof are NOT_RUN/NO_GO.

**Derived historical index pending serial integration:** The new test is automatically included in the business-day historical testFiles projection generated by scripts/build-certification-index.ts. The wider proof-plus-certification run was 17/18 PASS: only tests/certification-index.test.ts:212 failed because quality/receipts/expanded-catalog-certification.json does not yet list the new test. The read-only --check for that index likewise flags STALE. This derived index is outside the worker's permitted edit paths: prime must refresh it separately, re-run full tests, push a new PR SHA and check CI. Worker-9 did not touch the index, receipts, registry, fixtures, generated catalog, donor or vendor bytes, and performed no Git stage/commit/checkout/push or PR comment.
