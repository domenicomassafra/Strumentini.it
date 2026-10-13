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
