# Strumentini.it v1 — Ticket DAG and traceability

> **HISTORICAL / SUPERSEDED — NOT THE CURRENT QUEUE.** This DAG documents the original v1 validation dependency graph. Do not dispatch or resume work from it without reconciling against `/PROJECT-STATUS.md`, `/HANDOFF.md`, `/ROADMAP.md` and the current certification index.

Status: historical local implementation queue
Date: 2026-09-23
Source authorities: PRODUCT-SPEC.md, DESIGN.md, PRODUCT-MARKETING-CONTEXT.md, IMPLEMENTATION-PLAN.md

## Execution rule

Work the dependency frontier only. A ticket is ready when every listed blocker is complete. Every ticket is a vertical, independently verifiable slice; family tickets may proceed in parallel once Ticket 01 establishes the real runtime/build seams.

The September 2026 parallel-enabler wave (archived at Git baseline 7fe2dfd; decisions indexed in `docs/RESEARCH-DECISIONS-2026-10-27.md`) is intentionally outside this historical DAG. It may run concurrently and provide promotion inputs, but it does not block Ticket 01.

## Graph

```
01 Gold tracer: Business Day Calculator
├── 02 Local Workbench / Profile / Portability
│   ├── 04 Client time + math Gold family
│   ├── 05 Campaign URL + naming Gold family
│   └──────────────┐
├── 03 Search / Command / Library
├── 06 CSV parser gate + CSV Cleaner
│   └── 07 CSV expansion + typed handoff ──────┐
├── 08 Text/list + research Gold family ───────┤
├── 09 Image Resize Gold vertical ─────────────┤
└── 10 File Hash/Checksum Gold vertical ───────┤
                                                │
02 + 03 + 04 + 05 + 07 + 08 + 09 + 10 ───────►11 Generated onboarding + packs
                                                │
02 + 03 + 11 ─────────────────────────────────►12 Falsification telemetry
                                                │
12 ────────────────────────────────────────────►13 Release certification + deploy
```

## Tickets

| # | Title | Blocked by | Main proof |
|---:|---|---|---|
| 01 | Gold tracer: Business Day Calculator | — | real manifest→runtime→UI→oracle→Gold→static build |
| 02 | Local Workbench, Work Profile, portable config | 01 | local state/profile/export/import with failure safety |
| 03 | Deterministic Search, Command Palette, Library | 01 | metadata-only discovery, keyboard, no eager tool loads |
| 04 | Client time/business-math Gold family | 01, 02 | T02–T04 + cross-tool default reuse |
| 05 | Campaign URL/naming Gold family | 01, 02 | T05–T07 + URL/naming presets |
| 06 | CSV parser gate + CSV Cleaner | 01 | dependency gate + real local-file T08 |
| 07 | CSV Dedupe/Column Map + typed handoff | 02, 06 | T09–T10 + Cleaner→Dedupe |
| 08 | Text/list/research Gold family | 01 | T11–T13 |
| 09 | Image Resize Gold vertical | 01 | T14 native-first local image |
| 10 | File Hash/Checksum Gold vertical | 01 | T15 known-vector local file proof |
| 11 | Generated onboarding + packs | 02,03,04,05,07,08,09,10 | 4+ distinct real Gold starter sets |
| 12 | Falsification telemetry/reporting | 02,03,11 | content-free disclosed cohort metrics |
| 13 | Release certification + validation deploy | 12 | integrated matrix + Workers Static Assets |

## Current unblocked frontier

Completed software tickets: **01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12 (validator + schema + reporting), 13 (validator)**.

Ticket 09 — Image Resize is implementation-complete but remains **PARTIAL / WAIT_FOR_EXTERNAL** until real iOS Safari and Android Chrome physical-device memory/Files acceptance is recorded. It must not be counted as public Gold before those receipts exist.

**Ticket 11 — Generated onboarding + packs — is implemented and browser-accepted.** The onboarding flow runs end to end against the real build: 4 stages, no blocking modal, an interrupted first task stays usable, and the saved starter set installs into the local Workbench. Proof: `quality/receipts/onboarding/browser-acceptance.json` (11 checks, PASS). The starter set is 10 tools, and every one of them is Gold-certified — verified against the certification index, not asserted.

**Ticket 12 — Falsification telemetry — SHIPPED in the local product surface.** The privacy-safe schema, allowlisted adapter, explicit disclosed-validation-cohort gate, disclosure UI, and a shipped `configureTelemetry` caller now exist. Default posture remains disabled and the fresh browser acceptance observes zero off-origin writes; a validation cohort only enables the adapter when the explicit public cohort flag and endpoint are both present. Proof: `quality/receipts/telemetry/browser-acceptance.json`, PASS.

**Ticket 13 — Release certification + validation deploy — software path complete, release evidence still gated.** `scripts/validate-release.ts` checks tool surface, Cloudflare static assets, public metadata, sitemap/robots, truthful claims, Gold receipt binding, browser evidence, physical-device evidence, and rollback. Canonical/sitemap trailing-slash drift is fixed, all runnable sibling browser acceptances pass, Chrome and Edge pass the fresh matrix, and `wrangler deploy --dry-run` passes. The release gate must still remain closed where evidence does not exist: physical iOS/Android receipts, verified rollback, public production URL, unavailable local browser engines, and the 185 implemented-but-unverified Gold frontier.

There is currently **no unblocked software implementation ticket** in the original v1 gate sense, because Ticket 09's physical acceptance is external. The 200-tool expansion tranche proceeded in parallel and is integrated.

Machine gate: `npm run frontier:v1:require-gold` was the original 15-tool gate. It is now superseded as a *ticket-entry* gate by the 200-tool catalog, but it is retained and still reports honestly. Catalog size today is **200 tools**, not 15: 14 GOLD, 1 PARTIAL (Image Resize, awaiting physical receipts), 185 IMPLEMENTED_UNVERIFIED. The public catalog-size claim counts Gold-certified tools only.

External acceptance frontier:

- **Ticket 09 — Image Resize:** real iOS Safari and Android Chrome physical-device memory threshold + Files/Photos acceptance. Automated/browser implementation remains complete but PARTIAL until both physical receipts pass.

Recent completion evidence:

- Ticket 04 — `3328f7b` + Gold hardening `3e5c323`.
- Ticket 05 — `2f36c28`.
- Ticket 06 — `49cad5a` + lazy-bundle receipt fix `d3d7dca`.
- Ticket 07 — `7914de0`.
- Ticket 11 — onboarding browser acceptance PASS, 11 checks (`quality/receipts/onboarding/browser-acceptance.json`).
- Ticket 12 — telemetry acceptance PASS with default-off locality, disclosure and explicit validation-cohort wiring (`quality/receipts/telemetry/browser-acceptance.json`).
- Ticket 13 — software acceptance matrix is green for every runnable sibling; Chrome/Edge and Cloudflare dry-run pass. Remaining release blockers are evidence/certification boundaries and are not synthesized.

## Acceptance-criteria coverage

Every PRODUCT-SPEC acceptance criterion is covered by at least one ticket:

| Story | Acceptance criteria | Ticket coverage |
|---|---|---|
| US-01 | AC-01.1–AC-01.3 | 01 |
| US-02 | AC-02.1–AC-02.4 | 11 |
| US-03 | AC-03.1–AC-03.4 | 02 |
| US-04 | AC-04.1–AC-04.4 | 03 |
| US-05 | AC-05.1–AC-05.3 | 11 |
| US-06 | AC-06.1–AC-06.3; AC-06.4 | 01,02; 04,05,11 |
| US-07 | AC-07.1–AC-07.3; AC-07.4 | 01,04,05,08; 01,13 |
| US-08 | AC-08.1–AC-08.4 | 07 |
| US-09 | AC-09.1–AC-09.3 | 02 |
| US-10 | AC-10.1; AC-10.2; AC-10.3; AC-10.4 | 06,07; 09; 10; 06,09,10 |
| US-11 | AC-11.1–AC-11.4 | 01,04–10,13 |
| US-12 | AC-12.1–AC-12.2; AC-12.3–AC-12.4 | 01,03; 13 |
| US-13 | AC-13.1–AC-13.4 | 13 |
| US-14 | AC-14.1; AC-14.2; AC-14.3; AC-14.4 | 01,13; 02; 06,09,13; 09,10,13 |
| US-15 | AC-15.1–AC-15.4 | 12 |
| US-16 | AC-16.1–AC-16.2; AC-16.3 | 01,13; 13 |
| US-17 | AC-17.1–AC-17.3 | 13 |

## Experiment coverage

| Experiment | Ticket |
|---|---|
| EXP-01 Starter workspace vs self-browse | 12, using product behavior completed by 11 |
| EXP-02 Work Profile reuse | 12, using 02/04/05/11 |
| EXP-03 Workbench retention | 12 |
| EXP-04 Pack comprehension | 12, using 11 |
| EXP-05 Handoff utility | 12, using 07 |
| EXP-06 File/data speed | 12, using 06/07 |

## Scope integrity

- No ticket restores the historical 40-tool wave.
- No ticket introduces account/sync, ads, generic AI, runtime plugins, PWA/offline marketing, live/regulatory machinery, or broad PDF/OCR/media scope.
- Every tool added to a starter/default surface must already be Gold.
- Parallel enabler outputs are inspected at the point of relevant implementation and promoted only if they replace—not duplicate—the canonical seam.
- Public name/identity selection is outside this DAG.

## DAG integrity

Expected properties:

- acyclic;
- one initial unblocked frontier;
- blockers are functional prerequisites, not cosmetic sequencing;
- after Ticket 01, six slices can proceed independently;
- onboarding depends on real Gold availability;
- telemetry depends on real product behavior;
- release depends on the validation instrumentation and therefore transitively on the full product set.
