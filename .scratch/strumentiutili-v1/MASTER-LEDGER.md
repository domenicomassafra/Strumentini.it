# StrumentiUtili.it master ledger

> **HISTORICAL / SUPERSEDED — DO NOT RESUME AS AN ACTIVE RUN.** This ledger records a 2026-09-23 coordination checkpoint. Its HEAD, Gold counts, worker states, "current ticket" and authority labels are historical. Current execution truth lives in `/PROJECT-STATUS.md`, `/HANDOFF.md`, `/ROADMAP.md` and `/quality/receipts/expanded-catalog-certification.json`.

Timestamp: 2026-09-23T21:39:07Z
Historical authority at the time: branch `main`
Project: StrumentiUtili.it; Personal Workbench validation build

## Repository checkpoint

- HEAD: `987ca8b042a30f99d1343a71409787a0d7cfad79` (`chore: fail close v1 gold frontier`)
- Worktree: clean at checkpoint
- Worktrees: one primary worktree only
- Stashes: none
- Origin/remote: to be checked at each release gate
- Current phase: Phase 0 reconciliation

## Mission state

- Current catalog: **200 tools** (not 15 — the 15-tool figure predates the Tool Factory v2 expansion and is obsolete)
- Gold: 14
- Partial: 1 (Image Resize)
- Implemented but not yet Gold-certified: 185
- Gold frontier: **14/200**; all 200 are oracle-bound, fixture-bound, and locally declared
- `readyForTicket11` is moot: Ticket 11 shipped and is browser-accepted
- Active blocker: Ticket 09 physical Image Resize acceptance
- External/manual classification: iOS Safari physical receipt missing; Android Chrome physical receipt missing
- No physical receipt may be synthesized
- Ticket 12 and Ticket 13 are built and instrumented, not blocked-pending-implementation

## Canonical authorities

- Product: `PRODUCT-SPEC.md`
- Design: `DESIGN.md`
- Implementation: `IMPLEMENTATION-PLAN.md`
- DAG: `.scratch/strumentiutili-v1/TICKET-DAG.md`
- Current ticket: `.scratch/strumentiutili-v1/issues/09-image-resize-gold-vertical.md`
- Gold frontier: `quality/receipts/v1-gold-frontier.json`
- Image receipt: `quality/receipts/image-resize/certification.json`
- Dependency decision: `research/implementation/10-hash-dependency-gate.md`

## Active coordinator task

- Task: reconcile, verify, and prepare the continuous ten-worker delivery wave
- Owner: coordinator/prime, serial integrator
- Ownership rule: one authority per lane; no concurrent edits to the same authority
- Orca runtime: ready and reachable; version-matched orchestration guide loaded
- Run ID: `run_669abe2d8ed2`
- Coordinator state: Phase 0 baseline passed; Orca runtime restarted and W2–W10 were recovered as fresh Dispatch attempts in their existing worktrees
- Runtime recovery: Orca runtime `9604fe54-738f-4acd-beee-1bea6be00715` is ready; prior external terminals are missing/abandoned, not silently treated as success
- Model gate: default `--agent opencode` was rejected because it selected `opencode-go/DeepSeek V4 Flash`; stopped, released, and cleaned. Explicit terminal `opencode --model opencode/space-bunny-free --agent build` is verified as `Space Bunny Free / OpenCode Zen Native`.
- W1 settlement: succeeded in `ctx_fafe19155562`; report/diff consumed; worktree removed. W1 found stale generated-catalog/receipt provenance risks, evaluation-only `@noble/hashes` and `csv-parse` gate consumers, and confirmed Ticket 09 remains external.

## Initial wave ownership

| Slot | Lane | Ownership | Status | Acceptance |
|---:|---|---|---|---|
| W1 | Reconciliation auditor | read-only repo/ticket/dependency/receipt audit | succeeded; cleaned | fresh discrepancy report consumed |
| W2 | Design-system authority | canonical tokens and shared design authority | active `ctx_bef36ba2f0d4`; partial diff preserved | no duplicate token authority; relevant checks |
| W3 | App shell/navigation | shell and one mobile-nav authority | active `ctx_eca67ba8926f`; partial diff preserved | desktop/mobile/keyboard shell proof |
| W4 | Shared tool UI | tool chrome vocabulary and representative migration | active `ctx_95eb51c4b337`; clean retry | no duplicated chrome; relevant tests/build |
| W5 | Workbench/Library UX | workbench/library density and states | active `ctx_55a35369faec`; partial diff preserved | no local nav authority; relevant UX tests |
| W6 | Accessibility | concrete a11y audit/fixes | active `ctx_9ee0ca8f659b`; partial diff preserved | keyboard/semantics/zoom evidence |
| W7 | Browser/performance | cross-browser and bundle/lazy-load evidence | active `ctx_4531b66251da`; clean retry | fresh acceptance evidence |
| W8 | Tool Factory v2 | factory/schema/scaffold/gates on disjoint paths | active `ctx_99901a5b8dd9`; clean retry | factory tests and generated-catalog safety |
| W9 | 200-candidate research | read-only current qualification matrix | active `ctx_727035e004e8`; clean retry | disposition matrix with evidence |
| W10 | Next simple family | non-colliding fixtures/oracle/ticket or implementation | active `ctx_67d9835aa003`; partial diff preserved | bounded vertical proof |

## Dependency and acceptance frontier

- Ticket 09 implementation: complete; physical iOS Safari and Android Chrome acceptance is EXTERNAL until real devices are available.
- Ticket 11: **shipped.** No longer blocked; browser-accepted with 11 passing checks.
- Ticket 12: **built, not shipped.** The blocker is a wiring defect, not a missing ticket: no caller invokes `configureTelemetry`, the disclosed-cohort flag is never passed, and no disclosure surface renders. Recorded in `quality/receipts/telemetry/browser-acceptance.json`.
- Ticket 13: **validator shipped, release still FAIL by design.** The remaining gaps are external evidence, not missing code: two physical-device receipts, a verified rollback receipt, and a bound browser matrix. The canonical public origin is now `https://strumentiutili.it`.
- Production hash: `hash-wasm` 4.12.0; `@noble/hashes` 2.4.0 is evaluation-only and awaits coordinator cleanup verification.
- Gold before default/public count; anonymous/local/deterministic-first remains mandatory.

## Integrated commits observed

- `987ca8b` — v1 Gold frontier fail-close checkpoint
- Prior completed software slices are recorded in `.scratch/strumentiutili-v1/TICKET-DAG.md` and the repository history.

## Verification log

Fresh commands are appended only after their output is read. Historical PASS values are not treated as current proof.

- 2026-09-23T23:39Z — `npm test`: PASS, 22 files / 97 tests.
- 2026-09-23T23:40Z — `npm run check`: PASS, 0 errors / 0 warnings / 0 hints.
- 2026-09-23T23:40Z — `npm run build`: PASS, 17 static pages; build inspection PASS.
- 2026-09-23T23:40Z — `npm run catalog:check`: PASS, catalog current.
- 2026-09-23T23:40Z — `npm run frontier:v1`: reports 14/15, `image-resize=PARTIAL`.
- 2026-09-23T23:40Z — `npm run gold:business-day`: PASS.
- 2026-09-23T23:40Z — `npm run gold:sabotage`: PASS.
- 2026-09-23T23:40Z — `npm run gold:image-resize`: automated PASS, physical receipts missing.
- 2026-09-23T23:40Z — `npm run frontier:v1:require-gold`: expected FAIL, confirms Ticket 11 gate remains closed.
- 2026-09-23T23:40Z — `npm audit`: PASS, 0 vulnerabilities.
- 2026-09-23T23:40Z — `npm run acceptance:browser`: PASS, no task-content network requests and lazy action check.
- 2026-09-23T21:42Z — Orca runtime `ready`, app/runtime reachable, version `1.4.206`; coordinator Run `run_669abe2d8ed2` created.

## Worker settlement log

| Task | Dispatch | Worker/model | Worktree | Report/diff consumed | Verification | Settlement | Cleanup |
|---|---|---|---|---|---|---|---|
| W1 | `ctx_fafe19155562` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w1-space-bunny` | report and empty diff read | Gold/dependency/ticket audit verified | succeeded | worktree removed; external terminal had exited |
| W2 | `ctx_bef36ba2f0d4` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w2-design-system` | pending | pending | active | pending |
| W3 | `ctx_eca67ba8926f` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w3-shell` | pending | pending | active | pending |
| W4 | `ctx_95eb51c4b337` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w4-tool-ui` | pending | pending | active | pending |
| W5 | `ctx_55a35369faec` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w5-workbench` | pending | pending | active | pending |
| W6 | `ctx_9ee0ca8f659b` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w6-a11y` | pending | pending | active | pending |
| W7 | `ctx_4531b66251da` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w7-browser` | pending | pending | active | pending |
| W8 | `ctx_99901a5b8dd9` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w8-factory` | pending | pending | active | pending |
| W9 | `ctx_727035e004e8` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w9-candidates` | pending | pending | active | pending |
| W10 | `ctx_67d9835aa003` | OpenCode Zen Native / Space Bunny Free | `strumentiutili-w10-simple` | pending | pending | active | pending |

## Cleanup log

- Primary worktree clean at checkpoint.
- No extra worktrees, branches, or stashes observed at checkpoint.
- Every future worker must be consumed, settled, released, and its absorbed worktree/branch cleaned in the same cycle.

## Definition of done

V1 is not done until the canonical Gold frontier, onboarding/packs, telemetry, release/deploy, real browser/device/privacy/accessibility evidence, clean main, and zero stale workers/worktrees/branches are all proven.

## Reconciliation update — 2026-09-24

- Main revision: `1127286` (`docs: qualify 200 tool candidates`), with subsequent validation-only receipts committed separately where applicable.
- Integrated work: shell/navigation authority, Workbench/Library UX, shared tool operation vocabulary, canonical design tokens, accessibility primitives, Tool Factory v2, browser-performance acceptance, and 200/200 candidate dispositions.
- Worktree cleanup: all nine StrumentiUtili.it worker worktrees and their branches removed; only the main worktree remains.
- Integrated verification: 27 test files / 121 tests PASS; `astro check` PASS with 0 errors, 0 warnings, 0 hints; 17-page static build PASS; browser acceptance PASS with zero task-content network requests; Workbench acceptance PASS; Cloudflare deploy dry-run PASS.
- Performance receipt: Chrome and Edge observed PASS with lazy engine gate PASS and long-task gate PASS. Firefox, WebKit, and Chromium executables are unavailable on the local runner. The total JS artifact delta against the historical six-asset baseline is reported as REGRESSION and requires deliberate baseline/cost reduction before release certification.
- Gold frontier: 14/15; Image Resize remains PARTIAL solely because physical iOS Safari and Android Chrome Files/Photos boundary receipts are absent. No receipt was synthesized.
- Dependency decision: `hash-wasm` 4.12.0 remains the production incremental hash; the evaluation-only `@noble/hashes` and `csv-parse` dependencies were removed after integration.
- Owner correction: the mission target is **200 public tools implemented**, not only 200 researched candidates. The qualification matrix is now an implementation queue, not a completion claim.
- Previous expansion blocker was interpreted too narrowly: the 15-tool v1 gate remains preserved as a compatibility milestone, but it no longer prevents a separate 200-tool expansion tranche. Every final catalog entry must have a real route, implementation, tests, and quality receipt; generated placeholders are prohibited.
- Next executable frontier: complete physical Image Resize acceptance and coordinator worktree settlement; the 200-tool candidate queue is integrated as 200 catalog routes.

## Expansion reconciliation — 2026-09-24

- Canonical catalog now contains 200 tool routes/manifests, generated through Tool Factory v2.
- The legacy catalog compiler, evaluation-only dependency gates/receipts, and unreferenced helper barrels were removed; quality fixtures and oracles remain.
- Registered external worktrees are not repository debris: active or dirty worktrees remain preserved for coordinator settlement.

## W6 checkpoint — 2026-09-27 (tickets, release proof, receipts)

Lane: `quality/**`, `scripts/**`, `.scratch/**`, `wrangler.jsonc`, `package.json`. No visual files touched.

**Corrections to previously false ledger state**

- The "15 tools" and "tickets 11/12/13 at 0 percent" claims were wrong and are corrected above. The catalog has been 200 tools since the Tool Factory v2 expansion; tickets 11, 12, and 13 all have real, existing implementations.
- All 14 Gold certifiers computed `currentRevision` but never wrote it into the receipt, which is what produced `GOLD_RECEIPT_UNBOUND`. Every Gold receipt is now revision-bound; that finding is cleared.
- The browser matrix receipt carried a hardcoded `freshAcceptance` array of historical verdicts, including a stale "51 JS assets / 200776 B" build claim. The matrix now executes each sibling acceptance script and records its real exit status, so the receipt cannot launder a stale PASS.

**Build repair (pre-existing defect routed to W6)**

`src/generated/quality.ts` had no producer in any wired npm script — its only generator, `scripts/build-catalog.ts`, was orphaned against the deleted `src/catalog` compiler, so a fresh checkout could not build and `npm run build` failed. `scripts/tool-factory/generate-catalog.ts` now emits the quality index alongside catalog and loaders, and `--check` fails on staleness. Verified by deleting `src/generated/` and running `npm run build`: 204 pages, no manual step. This is the established repo pattern (generated output is gitignored and rebuilt), so committing the artifact would have been the wrong fix.

**New acceptance proof**

- `npm run acceptance:onboarding` — PASS, 11 checks. Proves Ticket 11 against the real build: no blocking modal, first task uninterrupted, starter set bounded to 10 tools, every starter tool Gold-verified against the certification index, profile default actually reused downstream, zero off-origin requests, 390px clean.
- `npm run acceptance:telemetry` — runs, exits 1, and records 3 real blockers. It is intentionally red: `configureTelemetry` has no shipped caller, the disclosed-cohort flag is never passed, and no disclosure surface renders.

**Deliberately not fabricated**

The two physical-device receipts and the rollback receipt remain EXTERNAL and are not synthesized. `validate-release` therefore still reports FAIL, which is the correct output.

**Open and needing an owner outside this lane**

- Telemetry wiring and its disclosure surface need `src/telemetry/**` and a shell/layout surface, which W6 does not own. Asked the coordinator; unanswered as of this checkpoint.
- `tests/design-system.test.ts` was re-owned to derive its contract from `design/WORLD.md` instead of a hardcoded list. It is currently RED (14 failures) because `src/styles/global.css` still ships the old English token vocabulary (`--canvas`, `--text`, `--ink` aliases) rather than the ledger palette (`--carta`, `--inchiostro`, `--rossa`). The guard is proven real: a single drifted token value fails both the exact-value assertion and the contrast floor (observed 2.27:1 against a 4.5:1 requirement). The CSS migration is the fix and it belongs to whoever owns `src/styles/**`.

**Release validator outcome after the W6 checkpoint (read, not assumed)**

`GOLD_RECEIPT_UNBOUND` is now cleared: 0 occurrences, all 15 Gold receipts bound to `155c4cd`. Overall status remains FAIL, which is correct. Remaining findings group into exactly four root causes:

1. **External, never to be fabricated** — `PHYSICAL_DEVICE_EVIDENCE_MISSING` (iOS Safari, Android Chrome) and `ROLLBACK_UNPROVEN`. These stay EXTERNAL.
2. **Gold frontier** — `GOLD_RECEIPT_MISSING` (185 tools implemented but not yet certified) and `GOLD_RECEIPT_NOT_GOLD` (Image Resize, PARTIAL pending physical receipts). This is the real 14/200 frontier, not a documentation error.
3. **Browser evidence** — `BROWSER_ENGINE_UNPROVEN` for firefox/webkit/chromium (executables unavailable on this runner) and `BROWSER_ACCEPTANCE_BLOCKED` for the two acceptance scripts that are honestly red: `acceptance-telemetry` (the wiring defect) and `acceptance-search-library` (the pending `data-request-tool` hook owned by W4). Chrome and Edge both PASS.
4. **New defect found by W6, owned outside this lane** — with `SITE_URL` set, 202 `METADATA_CANONICAL_MISMATCH` and 202 `SITEMAP_MISSING_URL`/`SITEMAP_UNEXPECTED_URL` remain. The build emits trailing-slash-free discovery URLs (`https://…/tools/business-day`) because `src/seo/public-discovery.ts::normalizeDiscoveryPath` strips trailing slashes, while `scripts/validate-release.ts:154` expects trailing slashes and `astro.config.mjs` sets `trailingSlash: "always"`. Either the SEO helper or the validator expectation is wrong. This is a genuine contract mismatch between two live seams, not a stale receipt, and it needs whoever owns `src/seo/**` and `src/layouts/**`. W6 did not edit across that ownership boundary.

## Coordinator consolidation — 2026-09-27

- All six registered redesign worktrees were audited for unique dirty state, preserved as commits, and merged into `main`.
- The design-system merge conflict was reconciled against the live ledger token sheet and `design/WORLD.md`; dead `--radius-full` / `--radius` tokens were removed rather than weakening the guard.
- Ticket 12 blockers are closed: a shipped telemetry bootstrap calls `configureTelemetry`, renders disclosure, requires the explicit validation cohort, and remains default-off with zero off-origin requests. Fresh telemetry acceptance: PASS.
- The W6 canonical/sitemap mismatch is closed: discovery URLs now use the same trailing-slash contract as Astro. Public-discovery tests pass.
- Search/Library and Onboarding acceptance were made locale-stable with semantic hooks; both pass against the built product.
- Cross-family acceptance passes all 10 representative families, including 390px mobile, accessibility, runtime errors, hydration and task-content network privacy.
- A real mobile regression found by that matrix was fixed: the desktop doubled selector specificity prevented the gutter from collapsing below 900px. The mobile rule now matches that specificity.
- The fresh browser matrix records Chrome PASS and Edge PASS; Playwright Chromium/Firefox/WebKit are UNAVAILABLE on this host rather than reported as failures. Every runnable sibling acceptance is PASS.
- Current software gates: `npm test` 316/316 PASS; `npm run check` 0 errors/warnings/hints; static build 204 pages PASS; `wrangler deploy --dry-run` PASS.
- Remaining boundaries are not synthesized: physical iOS Safari + Android Chrome Image Resize evidence, verified rollback evidence, a real public production URL, browser engines unavailable on this host, and Gold certification for 185 implemented-but-unverified catalog tools.
