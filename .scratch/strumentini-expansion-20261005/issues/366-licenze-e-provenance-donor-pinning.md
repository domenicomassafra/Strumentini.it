MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 366 — Licenze e provenance donor pinning

**What to build:** Matrice licenze dirette transitive codec asset e versioni dei candidati

**Traces to:** OWN-14 OWN-15; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** feasibility

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-366.1: Matrice licenze dirette transitive codec asset e versioni dei candidati.
- [ ] AC-366.2: Unknown licenza o source non verificata significa no-adopt.
- [ ] AC-366.3: On the scoped input and failure cases, verify: Primary links, npm metadata, dependency hashes. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Primary links, npm metadata, dependency hashes. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## 2026-10-11 wave 11 — fail-closed audit, ticket remains OPEN

Source-only feasibility delivered in `docs/donor-provenance-366-2026-10-11.md`, `scripts/donor-provenance-366.ts`, and `tests/donor-provenance-366.test.ts`: direct/transitive npm lock metadata, locked versions, registry SRI shape/source, binary/font/vendor asset SHA-256 pins, and negative tests for unknown/mismatched packages and third-party candidates. The **five focused tests passed**. A separate read-only CLI `--check` intentionally returns **NO_GO** (exit 1) on this real checkout: 366 non-dev lockfile entries, 46 checked-in asset records, 8 donor snapshots classified **NO_ADOPT**, including 7 runtime→dev-only lock references and 53 asset license/source/version fields without sufficient evidence. No artifact was installed, redistributed, changed, or adopted, and no credentials were used.

The matrix is **not** legal clearance: registry SRI metadata was not independently checked against downloaded tarballs, real font/OCR/rightsholder origin is not fully attributable, LGPL/MPL/AGPL obligations in the actually distributed binary graph remain to be independently reviewed, and the donor WASM payload/transitive license notices were not independently rehashed. Therefore AC-366.1/.3 remain unchecked for complete origin-chain proof; AC-366.2's fail-closed policy has executable evidence but global adoption/rights gates are still NO_GO. **Status stays `ready-for-agent`**, not `completed`, and there is no release authorization.

## 2026-10-13 native wave4 — previously accepted incompatible transitive lock versions

**New independently reproduced fail-open:** Existing `auditLockedPackages366` checked that each production dependency resolved to an installed lock entry with a plausible version, HTTPS npm tarball path, SHA512-SRI shape and declared license, but **never compared the resolved version against its parent's declared dependency range**. `tests/donor-provenance-366-20261013-transitive-version.test.ts` uses real local `package-lock.json` metadata from installed `@astrojs/compiler-rs@0.4.1` → `@astrojs/compiler-binding@0.4.1` (**exact 0.4.1**) and `@astrojs/internal-helpers@0.11.0` → `@types/hast@3.0.5` (**^3.0.4**). Each test isolates that actual edge with its recorded license and SRI. Changing only the target version and correspondingly well-shaped registry URL to `0.4.2` or `99.0.0` respectively made the original audit return **`VERIFIED_METADATA` with zero failures** for this contradictory graph (both regression tests **RED**; no real package, manifest or lock was changed).

**Narrow fail-closed GREEN:** `scripts/donor-provenance-366.ts` reuses the installed and production-lock-pinned `semver@6.3.1` (ISC) to check the actual resolved lock version against required runtime edges, and against **present** optional runtime edges. Unsupported/non-semver specs cannot silently pass; genuinely absent optional packages remain optional. A mismatched version now emits `TRANSITIVE_VERSION_MISMATCH` or `OPTIONAL_VERSION_MISMATCH` with parent, target, declared range and pinned version, and returns `NO_GO`. No new package, installation, vendored source, new schema, license attribution or rights clearance was introduced.

**Repository-local inventory and evidence:** Full read-only check still reports **`NO_GO`**, 366 non-dev lock entries, 46 assets, 8 candidate donor snapshots all **`NO_ADOPT`**, seven previously known dev-only runtime links and 53 incomplete asset rights/source/version entries; importantly **zero newly introduced incompatible-version flags** on the actually locked production graph. The 485 installed production required/present optional/root ranges checked against the installed semver library were compatible. Focused tests, TypeScript and exact exit codes are recorded in the native worker handoff. Metadata-SRI shape is **not independent tarball digest verification**, package/license declarations are **not verified rights**, and vendor/WASM, physical/distribution obligations plus AC-366.1–3 remain **OPEN**. No release, adoption, Gold, commit, PR or deploy claimed.

## 2026-10-13 native wave4 reviewer P2 follow-up — root direct dependency version mismatch

**Independent RED using actual installed metadata:** `package.json` and `package-lock.json` declare root direct `fflate: "0.8.3"` and an installed `node_modules/fflate@0.8.3` (MIT, registry URL and SHA512-SRI). The checker already compared root manifest and root lock **declaration strings**, but did **not** compare either declaration against the resolved direct target version. The isolated, nonwriting `tests/donor-provenance-366-20261013-root-version.test.ts` copies actual installed metadata and mutates **only in-memory** the resolved version plus well-shaped npm tarball URL to `0.8.4`, retaining the recorded SRI and license; before the fix the audit returned `VERIFIED_METADATA` with **zero failures**. Independent RED also proved that `css-tree` root `^3.2.1` incorrectly accepted a simulated resolved `4.0.0`, and that a matching but unsupported `file:../fflate` declaration in manifest/root lock was silently accepted. The existing canonical root-path check already refused a nested-only install path (`MISSING_DIRECT`); this remained a passing guard.

**Minimal GREEN:** Only `scripts/donor-provenance-366.ts` adds a resolved-version check in its existing root direct dependency loop, reusing the installed, already-pinned `lockedVersionSatisfies` semver helper (no new packages). Missing canonical direct paths still yield `MISSING_DIRECT`; incompatible exact/semver-range targets and unsupported specs now yield `DIRECT_VERSION_MISMATCH <package> (<declared> vs <resolved>)` and `NO_GO`. A real valid exact `fflate@0.8.3`, real valid `css-tree@3.2.1` for `^3.2.1`, and a synthetic within-range `3.2.9` metadata example remain allowed (metadata consistency only; not independently downloaded tarball authenticity).

**Fresh verification:** `vitest run tests/donor-provenance-366.test.ts tests/donor-provenance-366-20261013-transitive-version.test.ts tests/donor-provenance-366-20261013-root-version.test.ts` **PASS 12/12** (8 prior and four new); scoped `tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --types node --skipLibCheck --allowImportingTsExtensions` **exit 0**, `git diff --check` **exit 0**. Actual read-only repository audit still yields **`NO_GO`**, unchanged 366 runtime entries, 46 asset records, eight donors `NO_ADOPT`, seven known runtime→dev-only warnings and 53 unknown/incomplete asset evidence fields; **zero** newly invented runtime/optional/direct version mismatches. No modifications to package/lock, vendor, licenses, CI or other workers; no commit, push, PR update by this scoped worker. Original AC-366.1–3 remain **OPEN** pending independent source-rights, SRI artifact readback, vendor/WASM and distribution obligations; no Gold or release clearance.

## 2026-10-13 native wave4 reviewer P2 follow-up — malformed semver OR alternative (OPEN ticket)

**Reproduced source-bound RED:** Installed, pinned `semver@6.3.1` interprets an empty disjunction branch as an unbounded wildcard: `""`, whitespace, `"||"`, `"1 ||"`, `"^9.0.0 ||"`, and interior empty alternatives could make `lockedVersionSatisfies` accept an incompatible or missing declared range. New `tests/donor-provenance-366-20261013-empty-alternative.test.ts` isolates actual locked root `fflate@0.8.3` and actual `@astrojs/internal-helpers@0.11.0` → `@types/hast@3.0.5`, retaining the original real installed registry URLs, MIT/other lock-declared licenses and sha512-SRI metadata without writing `package.json` or `package-lock.json`. Tests check matched manifest and root-lock declarations, required and present optional edges. Baseline **RED: 3 failed, 1 passed**, because malformed declarations returned `VERIFIED_METADATA` with no failures.

**Minimal fail-closed GREEN:** `scripts/donor-provenance-366.ts` rejects every empty/whitespace-only `||` alternative before applying the existing pinned semver `validRange`/`satisfies` checks. No new dependencies, schema, package/lock rewrite, license assertions or security thresholds. The previous exact `fflate@0.8.3`, caret `css-tree@3.2.1`, root `MISSING_DIRECT`, incompatible nested/optional version and genuinely missing optional rules are preserved; valid `^3.0.4 || ^4.0.0`, `^3 || ^4` and `^0.8.0 || ^0.9.0` ranges continue to pass matching source metadata. New and prior focused Vitest suites, scoped strict TypeScript and repository inventory are rerun as part of this scoped handoff; independent rights, tarball authenticity and physical distribution validation remain outstanding.

**Disposition:** This is an executable malformed-spec safety correction only. All original AC-366.1–3 remain **unchecked / OPEN**; a lock SRI shape is not downloaded tarball checksum authentication, SPDX metadata is not legal clearance, and no donor is approved for adoption, Gold or deploy. The integrator exclusively owns PR updates and delivery.

## 2026-10-13 independent reviewer P1 follow-up — direct production package hidden by dev markers

**Read-only adversarial RED on actual installed metadata:** The real manifest and lock both declare direct runtime `fflate@0.8.3` with a recorded MIT license, npm registry tarball URL, and SHA512-SRI. An isolated in-memory lock with unchanged direct declaration and correct pinned version returned `VERIFIED_METADATA` as expected. Marking the same direct entry `dev: true` while removing its license, or `devOptional: true` while corrupting its SRI, incorrectly returned `VERIFIED_METADATA`, **zero failures and zero audited production rows**. The direct-root version check did not reject these flags, while the global package-inventory loop skipped them. This allowed a declared runtime dependency to disappear from license/source/integrity scrutiny even though its version matched. New `tests/donor-provenance-366-20261013-root-dev-flag.test.ts` reproduced **RED: 3 failed / 1 passed**, without modifying actual package files.

**Scoped GREEN:** The existing canonical root dependency loop in `scripts/donor-provenance-366.ts` now refuses present direct production entries flagged `dev` or `devOptional` with `DEV_ONLY_DIRECT <name> -> node_modules/<name>` and `NO_GO`. It preserves absent-target `MISSING_DIRECT`, incompatible-version refusal and normal production metadata validation, with no changes to installed packages, lock, vendor, rights attestations, certification or deployment. Five focused provenance suites **20/20 PASS**; strict scoped TypeScript **exit 0**. The actual nonwriting `--check` still returns **exit 1 / `NO_GO`**, with 366 production lock entries, 46 asset records, eight donor candidates, 60 existing failures (seven dev-only references) and zero runtime-version mismatches. This is a metadata correctness improvement and does not independently authenticate registry downloads or license rights.

**Separate reviewer finding, addressed in the following scoped follow-up:** Root `optionalDependencies` were absent from the manifest/lock root comparison and direct version loop. An in-memory optional root `fflate: "^99.0.0"` with the present pinned `fflate@0.8.3` incorrectly returned `VERIFIED_METADATA`; present optional roots needed a fail-closed range check while absent optional roots remain optional. Original AC-366.1–3 stay **OPEN** pending full independent attribution, redistribution obligations, vendor/WASM and tarball checks.

## 2026-10-13 reviewer P2 follow-up — root optional dependency version checks

**Authentic metadata RED:** `tests/donor-provenance-366-20261013-optional-root.test.ts` isolates the real `fflate@0.8.3` registry URL, MIT license and installed SHA512-SRI from the production lockfile in an in-memory optional-root graph. A matching root manifest/lock declaration `optionalDependencies: { fflate: "^99.0.0" }` with that **present** incompatible version returned `VERIFIED_METADATA`. Mismatched root optional declarations and malformed dangling-OR specs also escaped source audit. Focused baseline **3 failed / 2 passed**. Both truly missing optional entry and valid `0.8.3` / `^0.8.0` versions correctly passed; no repository metadata was changed by the test.

**Minimal fail-closed GREEN:** `scripts/donor-provenance-366.ts` extends the existing manifest type and root comparison to include `optionalDependencies`, rejects declaration drift as `ROOT_OPTIONAL_DEPENDENCIES_DIFFER`, and checks the same canonical `node_modules/<name>` entry using the existing semver helper when present. An incompatible or malformed present edge yields `ROOT_OPTIONAL_VERSION_MISMATCH`; a present entry marked `dev`/`devOptional` yields `DEV_ONLY_ROOT_OPTIONAL`; an absent optional entry remains permitted. The preceding root direct `DEV_ONLY_DIRECT` P1 guard is retained. The six provenance suites **25/25 PASS** and strict scoped TypeScript **exit 0**. No lockfile, donor, license, vendored bytes or production deployment modified in this scoped task. Existing independent tarball checks, rights review and all original AC-366.1–3 remain **OPEN**; the serial integrator handles PR delivery.

## 2026-10-13 independent peer P2 follow-up — required/present peer provenance (RED → GREEN, AC OPEN)

**Real installed-metadata fail-open:** Draft PR #21 at remote SHA
7bdc1efa3f49c1f1455de3e436781a4a1de6a9f3 verified direct,
transitive and optional version constraints but ignored npm peerDependencies
and peerDependenciesMeta. Real preact-render-to-string@6.7.0 declares a
required preact peer (range >=10 || >=11.0.0-0), with preact@10.29.8
installed. Isolated lock records copying the genuine MIT licenses, registry
tarball URLs and SHA512-SRI were wrongly marked VERIFIED_METADATA with
zero failures after the required peer was removed or its version replaced by
incompatible 1.0.0 and a matching well-shaped registry URL.

**Independent RED before source change:** New
tests/donor-provenance-366-20261013-peer-deps.test.ts uses genuine pinned
package records in in-memory npm lock graphs. The initial focused run
produced **9 failures / 2 passing controls** for missing required, wrong
peer versions, dev/devOptional-hidden peers, optional-present mismatches and
incorrect nested npm resolution. Independent additional cases cover
peerDependenciesMeta optional-absent, present-optional metadata validation,
ancestor shadowing and a scoped npm consumer. No lock, manifest, vendor or
installed dependency was changed.

**Minimal GREEN:** scripts/donor-provenance-366.ts now checks peerDependencies
on every audited production entry. An absent peer is allowed only when
peerDependenciesMeta[name].optional === true; a missing required peer fails
MISSING_PEER. A present incompatible required or optional peer fails
PEER_VERSION_MISMATCH or OPTIONAL_PEER_VERSION_MISMATCH, and one marked dev
or devOptional fails DEV_ONLY_PEER. The existing production metadata audit
still checks license, npm registry origin and SHA512-SRI shape for present
peers. Resolution selects the closest valid ancestor node_modules boundary,
excluding nested directories owned by the consumer, including scoped
packages. The existing pinned semver implementation is reused; direct
production root checks, optional-root checks and all other guards remain.

**Verification and limits:** 13/13 new cases and **38/38** across seven
provenance suites PASS, retaining all preceding 25/25 cases. Strict scoped
TypeScript exit 0 and owned-file diff check PASS. The actual repository
read-only --check still exits 1 with NO_GO; 366 production package rows,
46 pinned assets, 8 donor candidates NO_ADOPT and three newly surfaced
conservative DEV_ONLY_PEER flags for present, devOptional-marked Vite optional
peers. These flags require separate reachability/rights review before any
adoption, rather than automatic clearance. Downloaded tarball authenticity,
legal rights, vendor/WASM, distribution/physical-device and production
acceptance remain NOT_RUN/NO_GO. All original AC-366.1/2/3 remain unchecked,
ticket OPEN; integrator owns commit/push, existing Draft PR #21 and CI.

## 2026-10-13 — worker-9 independent PR #21 review P2: npm `devOptional` optional-peer semantics (RED → GREEN)

**Pinned remote source and real false refusal:** Independent review of exact Draft PR #21 remote SHA `e3d9a58a4243fa593b5cc6b85e9da4a8598016c0` against current `origin/main` (PR merge-base remains older `04fa3d1`) found three `DEV_ONLY_PEER` failures on the actual lock, even though their npm roles are not dev-only. Production Vite@8.3.0 declares explicitly optional peers `@types/node@26.6.2`, `tsx@4.23.15`, and `yaml@2.9.1`; each meets Vite's peer semver range and carries a recorded MIT/MIT/ISC license, registry URL and well-shaped SHA512-SRI. Their lock entries have `devOptional: true` because of the concurrent dev graph. The npm lockfile-v3 specification and Arborist documentation define this marker as **both a dev dependency and an optional dependency of a non-dev dependency**, not necessarily `dev`-only. The prior source unconditionally refused all present `devOptional` peers (including `peerDependenciesMeta.optional === true`). In an isolated authentic-metadata Vite graph these three well-formed *present* optional peers caused `NO_GO`, while deleting all three optional peers resulted in `VERIFIED_METADATA`: a reproducible conservative **P2 false refusal**, not a bypass granting redistribution rights.

**Bounded implementation after prime authorization:** Only `scripts/donor-provenance-366.ts` reuses the existing package version/license/registry/SHA512-shape checks for a present `devOptional` peer declared **explicitly optional** by its production consumer and validates the actual resolved peer version against the declared semver range. Missing optional peers remain allowed. `dev: true` peers, missing required peers, required peers marked `devOptional`, incompatible versions, unsupported specs and malformed license/SRI/registry metadata retain fail-closed behavior. No transitive/dev/root package graph, package lock, npm installation, new dependency, vendor or redistribution policy is rewritten. The package inventory still reports the conservatively counted non-dev rows separately from these conditionally optional peer validations; this is **not** a complete optional artifact distribution audit.

**RED → GREEN proof and caveats:** New `tests/donor-provenance-366-20261013-devoptional-peer.test.ts` has 11 source-bound cases: first **8 RED / 3 passing** against the original pushed source, then **11/11 GREEN** with the narrow correction, including Vite's three concrete optional peers, missing-optional allowances, incompatible present versions, missing license/SRI/source and required/dev-only refusal. Under the prime-approved single-test scope extension the prior `tests/donor-provenance-366-20261013-peer-deps.test.ts` optional-`devOptional` assertion was reconciled with npm semantics, while retaining strict `dev: true` and required peer refusal. All eight focused provenance suites **49/49 PASS**, scoped strict `tsc` exit 0, `git diff --check` PASS. Repository audit remains **NO_GO**, with 366 originally counted non-dev npm entries, 46 pinned asset rows, eight candidate donors **NO_ADOPT**, seven genuine runtime→dev/optional lock references (six `DEV_ONLY_TRANSITIVE`, one `DEV_ONLY_OPTIONAL`) and **53** incomplete asset rights/source/version findings; the three Vite-specific false `DEV_ONLY_PEER` findings are gone. Earlier remote `changed-source` CI was SUCCESS on `e3d9a58a` only; this new uncommitted correction requires the integrator to push a new SHA and rerun it. The original **AC-366.1/2/3 remain OPEN**: npm SRI format does not verify downloaded tarballs, installed manifests do not establish actual redistribution rights, conditional optional-package transitive lineage and vendor/WASM asset rights remain unapproved, and no physical device, adoption, release or Gold evidence was created.

## 2026-10-14 worker-3 — malformed SPDX expression grammar fail-open (RED → GREEN; OPEN)

**New, independently reproduced metadata false attribution:** `scripts/donor-provenance-366.ts` formerly stripped parentheses and merely compared the remaining tokens with its SPDX allowlist. It therefore declared a real pinned package `VERIFIED_METADATA` when only its copied license field was corrupted to malformed syntax, e.g. `MIT(`, `(MIT`, `MIT)`, `MIT()`, `MIT(Apache-2.0)`, `MIT OR (Apache-2.0` or `MIT AND Apache-2.0)`. These are invalid expressions, not an unknown-license rights conclusion. Test `tests/donor-provenance-366-20261014-spdx-grammar.test.ts` clones actual installed `fflate@0.8.3` (MIT) and `@img/sharp-wasm32@0.35.5` (`Apache-2.0 AND LGPL-3.0-or-later AND MIT`) version, npm registry URL and SHA512-SRI from `package-lock.json` into isolated in-memory graphs; it never writes package/lock, downloads anything or uses synthetic accepted license provenance. Initial test **RED: 8 failed, one authentic metadata positive passed**. Malformed donor-candidate license was also silently omitted from `UNKNOWN_LICENSE` failures (candidate decision still `NO_ADOPT`, unchanged).

**Narrow correction and independent GREEN:** `knownSpdx` now requires syntactically complete `AND`/`OR` expressions with balanced, nonempty parentheses and no adjacent identifiers, while retaining the existing limited SPDX identifier allowlist and refusing unsupported exceptions such as `WITH`. Valid actual installed `MIT` and multi-identifier `Apache-2.0 AND LGPL-3.0-or-later AND MIT`, plus a valid nested synthetic expression using already known SPDX IDs, remain `VERIFIED_METADATA` (metadata-only); all seven corrupted real-package cases become `UNKNOWN_LICENSE` and `NO_GO`, and malformed donor candidate records an explicit `UNKNOWN_LICENSE` with `NO_ADOPT`. New 9/9 GREEN; nine focused provenance suites total **58/58 PASS**. No external SPDX parser/package/vendor/rightsholder assertions, adopted donor or source correction was introduced.

**Boundary and blockers:** Existing read-only repository `--check` remains **exit 1 / `NO_GO`** for its pre-existing missing runtime graph provenance and vendored font/OCR/video asset rights/source/version fields. Original **AC-366.1/2/3 remain unchecked** and status `ready-for-agent` unchanged. Source/dependency tarball digest readback, package licenses as legally enforceable permissions, multi-license obligations, vendor/WASM distribution rights and all real deployment/legal acceptance remain **NOT_RUN/NO_GO**. No package/lock/vendor/license rewrite, new installation, purchase, PR, Git mutation, Gold or production clearance; serial Git integration requires an exclusive lease from prime.

## 2026-10-14 cumulative clean integration — SPDX test exact-optional TypeScript correction

The first **clean isolated integration** of sixteen remote fix branches (`e06a3b9d042d430687e21188c8f8c49c6f9c9bc2`, 19 cherry-picked commits) exposed a previously untested source-bound fixture error in global `npm run check`: **one TypeScript diagnostic `ts(2379)`** in `tests/donor-provenance-366-20261014-spdx-grammar.test.ts:66` under `exactOptionalPropertyTypes`, despite the prior narrow standalone suite being green. `installedPackageGraph` had verified real lock metadata are present, but returned an `original` typed as an `Entry` whose `version`, `integrity`, and `resolved` are *optional*; constructing a `Candidate` with explicit `string | undefined` fields violated the strict type contract. The minimal correction returns a checked, concrete string-field snapshot from the fixture helper, after the existing non-empty integrity/version/registry/license guard. No runtime audit/parsing policy, package lock, license source, or acceptance gate changed. The original 9-case SPDX regression suite remains **9/9 PASS** after this correction; the cumulative `npm run check` must be rerun on the updated candidate commit before any CI/release claim. Original AC-366.1/.2/.3 remain OPEN and donor decisions NO_ADOPT.
