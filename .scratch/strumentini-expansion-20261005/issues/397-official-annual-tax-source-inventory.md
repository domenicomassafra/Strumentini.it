# 397 — Official annual tax source inventory

**What to build:** Maps official AdE INPS ISTAT rules to source URL snapshot hash and effective range

**Traces to:** OWN-11; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** feasibility

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-397.1: Maps official AdE INPS ISTAT rules to source URL snapshot hash and effective range.
- [ ] AC-397.2: Unsourced or ambiguous scope is a precise gap, not trusted input.
- [ ] AC-397.3: On the scoped input and failure cases, verify: Auditable primary-source ledger and coverage. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Auditable primary-source ledger and coverage; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 worker-8 — offline validator #397, bounded implementation; global NO_GO

**Security review, final supplement:** two further regressions were RED for malformed/null artifact paths, duplicate or untrusted official manifest entries, and for an intermediate artifacts-directory symlink pointing outside the permitted root. Validator now verifies canonical evidence schema (unique artifact identities, authority hostname, SHA, ticket/dataset/check date) before using source metadata; rejects non-string paths BEFORE path.resolve; inspects symlink ancestors as well as leaves; binds each included INPS citation to the exact engine metadata source title/URL and annual evidence SHA. Final new suite 9/9 GREEN; preexisting Italy source pack suite 12/12 GREEN, **21/21 combined**. Validating these security failure cases did not promote any new tax rule; output remains 8 narrow verified, 3 reference-only, 5 gaps and zero digest violations.

**Final static/type and ledger gates:** Astro check exit 0: **2018 files, 0 errors, 0 warnings, 23 nonblocking hints**. Original ticket dashboard validation `npm run tickets:check` **PASS**, 0 stored-status mismatches; no dashboard write/sync was performed. These checks validate the offline audit module and repository integrity, **not** applicability of the missing whole-year fiscal source packs.

**Baseline/scope:** Studio actual HEAD `39e07827`; non-modifying review of `src/engines/italy/`, `src/reference-data/italy/` and `quality/reference-data/italy/`. Exclusive edits: **NEW** `scripts/validator/audit-397.ts`, **NEW** `tests/audit-397.test.ts`, this original ticket. No changes to engines, original evidence/snapshot hashes, other workers' paths, shared sources or generated dashboard. No network calls, credentials, paid dependencies, commit/push/deploy.

**Runnable ledger:** `./node_modules/.bin/tsx scripts/validator/audit-397.ts` prints a full machine-readable JSON ledger from **existing and independently hash-read local files**, with `mode=OFFLINE_PINNED_BYTES_ONLY` and `status=PARTIAL_NO_GO`. Authenticates the whole canonical evidence JSON against its existing hash in `source-packs.ts` **before** using its metadata, validates each PDF/HTML/XLSX/JSON artifact against its own SHA-256, enforces allowlisted path/size and host mapped to official authority, returns source URL, authority, original local path, hash, exact date scope, `checkedHash`, precise gaps and hard validation violations. On manifest or individual artifact hash failure, only the affected rules are not promoted; unknown rules/dates and overlapping scopes fail closed without choosing a nearest/newer rate. Snapshot hashes attest **only vendored bytes**, not live URL reachability or refreshed law.

**Actual audit receipt (zero hash violations in current checkout):** **8 verified narrow rows** — gross national IRPEF 2025/2026 (Normattiva law pins, year-only), IVA **2025-12-13 through 2025-12-31** with explicitly declared exact categories (MEF Art.16 and Table A PDF), 2025 ATECO2007 forfettario **coefficient table only** (Gazzetta/Normattiva), 2026 named INPS Gestione Separata professionals, artigiani/commercianti and agricultural employee **OTD/OTI specific** profiles (official INPS PDF pins), ISTAT current Comuni snapshot **only 2026-02-21** (official XLSX pin). **3 reference-only** official files with `validFrom/validTo=null`: AdE archived bollo-fatture **2024** guide, ISTAT/SITUAS suppressed and foreign event snapshots. None is upgraded to general effective law or historical birth-date validity. **5 explicit ledger gaps**: complete annual fiscal triad, historical ISTAT/birth-date coverage, generic INPS employees, complete current AdE fiscal-year publication, whole-year VAT date eligibility. For 2027 tax rules, the earlier 2025 IVA dates, and every absent code/profile, the strict resolver returns GAP (no reuse of 2026 rates).

**TDD / negative proof:** First `tests/audit-397.test.ts` run **RED** (new audit module absent), then **5/5 GREEN** for source readback, corrupted INPS PDF, corrupted source-pack evidence, expiration/unknown/overlap and coverage. Separate valid threat found during review: manifest hash was verified from one read and the data was parsed from a second read (possible time-of-check/time-of-use swap). Added an independently failing regression (**RED: second-read count 2 vs expected 1**), corrected validator to hash **and parse identical bytes** in one read. Plus over-budget >16 MiB artifact rejection without promoting that one profile; final `vitest run tests/audit-397.test.ts tests/italy-source-packs.test.ts` **PASS 19/19** (7 new + 12 existing). CLI audit returned **8 verified subsets, 3 references, 5 known gaps, 0 violations**, without writing files.

**Unresolved gates/AC honesty:** `AC-397.1` remains **OPEN** globally: a verified **full** year/version AdE tax-rule packet, complete country/year applicability, history and INPS cross-profile rules do not exist in repository as approved/complete source snapshots. `AC-397.2` is verified for the offline resolver (explicit unknown/ambiguous/expired/damaged refusal) but is **not taken as universal production integration**; `AC-397.3` remains **OPEN** for complete officially sourced year-by-year coverage, online rechecks/legal approval, partial/huge/cancel/production/mobile integration. Historical repository `checkedAt` is at most 2026-10-09 for these three evidence manifests. **No current external HTTP URL reachability/status check was performed**, so URLs are canonical pinned metadata, not claimed as reverified online. No blanket Gold/tax/legal certification, rollback/migration/deployment claim. Ticket stays `ready-for-agent`; original AC boxes remain unmodified.

## 2026-10-13 worker-1 — targeted primary-source regression, existing audit retained

**Result: additional tests only; original AC remain OPEN.** Canonical authority continues to be `scripts/validator/audit-397.ts` and original SHA-pinned manifests/engines. Independent regression `tests/tax-source-inventory-397-20261013.test.ts` reads canonical audit results, independently rehashes all eight narrow rule rows and three reference-only sources plus each of the three original evidence manifests, checks precise source-year mappings, tests *each* of the two IVA PDFs separately, the distinct 2026 IRPEF amending law, 2024 AdE archive, current ISTAT workbook and specific INPS agricultural-worker PDF for isolated fail-closed corruption, and verifies 2027 year rollover never falls back to prior rates. New suite **5/5 PASS**, existing `tests/audit-397.test.ts` **9/9 PASS**, `tests/italy-source-packs.test.ts` **12/12 PASS**: **26/26 total**, no modifications of source pins, manifests, calculators, UI, catalog or canonical auditor. The early exploratory `src/data/tax-source-inventory` selector was discarded after review because it had no authenticated runtime consumer; it contributes **no** competing audit authority. This tranche is reviewable local WIP for prime integration; no Git stage/commit/push/deploy by worker.

**Independent official web metadata recheck 2026-10-13 (NOT new vendored fiscal evidence):** INPS original circular 14/2026 remains discoverable at the existing official PDF URL, corroborated by its [official INPS summary](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestioni-artigiani-e-commercianti-i-contributi-per-il-2026.html); ISTAT's [official current municipalities classification](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/) still identifies the 21 February 2026 workbook; AdE's [2026 precompiled declaration documentation](https://infoprecompilata.agenziaentrate.gov.it/portale/redditi-semplificata) is a *declaration edition*, not proof of the full 2026 income-year tax-law pack. No new source file, hash, effective interval or normatively approved wider scope was obtained, and these online index observations do **not** replace the existing pinned local evidence or constitute annual tax certification. Remaining AC-397.1/3, source completeness, annual updates, live legal applicability, integration and real consumer/edge/device evidence stay OPEN. `npm run tickets:check` PASS, 0 stored-status mismatches. Broad Astro check on concurrently dirty checkout exited 1 with **three errors outside #397** in `tests/image-compression-047-20261013-adapter.test.ts` (Buffer used as BlobPart); owner of that worker file must resolve separately. No #397 type error appeared in that run.
