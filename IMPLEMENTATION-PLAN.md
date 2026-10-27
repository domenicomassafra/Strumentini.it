> **OWNER-ALIGNED PLANNING NOTICE (2026-10-10):** 2026-10-10: this is historical first-validation architecture and is NOT the current implementation scheduler. Current ticket authority is GitHub Issues; this 2026-10-10 plan is historical. Planning includes no app changes/deploy.

---

# Strumentini.it — Canonical Implementation Plan

> **Historical first-validation plan.** This document records the original 15-Gold validation architecture and ticket model from 2026-09-23. It is no longer the live execution authority. For current work use `PROJECT-STATUS.md`, `HANDOFF.md`, `ROADMAP.md` and `quality/receipts/expanded-catalog-certification.json`.

Status: historical implementation authority for the first validation build; **this file does not describe the current execution frontier**
Date: 2026-09-23
Inputs: PRODUCT-SPEC.md, DESIGN.md, PRODUCT-MARKETING-CONTEXT.md, lane-05 architecture/test seams, platform decision spike, Tool Factory quality standard.

## 1. Implementation objective

Build the smallest technically credible product that can test whether a personal utility Workbench earns repeat use beyond individual public tools.

The implementation must prove, in order:

1. one real tool can travel through manifest → catalog → lazy registry → runtime → Work Profile → UI → independent oracle → Gold receipt;
2. local Workbench state and portable configuration work without an account;
3. Search/Library discover tools without eager-loading them;
4. the first 15 Gold tools share a small number of deep engines rather than becoming 15 mini-apps;
5. a typed handoff works;
6. four+ work contexts can generate useful, explainable 10–15-tool starter sets;
7. the product can measure the falsification questions without collecting work content;
8. the result passes mobile, accessibility, privacy, performance, and deployment acceptance.

Do not build the old Wave A 40 before these questions have evidence.

## 2. Frozen platform choices

These choices resolve the owner-decision list from lane 05 for the first validation build.

| Concern | Decision |
|---|---|
| Hosting | Cloudflare Workers Static Assets by default; provider-portable static `dist/` is mandatory |
| Page/build shell | Astro static-first |
| Interactive UI | Preact islands/components |
| Language | strict TypeScript |
| Browser floor | current + previous major Chrome/Edge/Firefox/Safari; current + previous iOS Safari |
| Ordinary file input | File/Blob + normal picker + drag/drop enhancement + browser download |
| File System Access | progressive enhancement only; never required |
| Structured local state | IndexedDB behind a versioned persistence interface |
| OPFS | scratch/cache only when justified |
| Heavy work | Web Worker + AbortSignal; lazy WASM only per capability |
| Manifest validation | build time |
| Schema library | Zod in compiler/trust boundaries, not every tool |
| CSV | Papa Parse vs `csv-parse`; pin only the adversarial-corpus winner |
| Account/sync | absent from first validation build |
| PWA/offline promise | absent from first validation build |
| Ads | absent |
| Baseline analytics | Cloudflare Web Analytics |
| Longitudinal product analytics | disclosed validation cohort only; minimal custom events, Analytics Engine candidate |

Astro's existing Vite-based build machinery is sufficient; do not create a second bespoke bundler layer unless a concrete worker/WASM emission problem proves it necessary.

## 3. Architecture

```
                              BUILD TIME

  tool specs + pack specs + docs
               │
               ▼
      ┌──────────────────┐
      │ Catalog Compiler │
      └────────┬─────────┘
               │ validates
               ├──────────────► compact search/catalog metadata
               ├──────────────► route + dynamic-import map
               ├──────────────► pack/work-context indexes
               ├──────────────► privacy/dependency/oracle policy
               └──────────────► Gold eligibility/receipts

                               RUNTIME

  static Astro page ──hydrates──► Preact Workbench/tool island
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
             Tool Registry      Work Profile        Local State
                 │ lazy              │                  │
                 ▼                   │                  │
             Tool Runtime ◄──────────┘                  │
                 │                                      │
                 ▼                                      │
             Deep Engine                                │
                 │                                      │
                 ▼                                      │
              Result ───── typed handoff ────────────────┘
```

Ordinary tool execution stops at the browser. The only first-build network surfaces are static asset delivery, aggregate Web Analytics, and—only when an explicit validation cohort is enabled—a separate minimal event collector.

## 4. Deep modules and seams

Use lane-05 language deliberately: modules should be deep; tests observe behavior through agreed interfaces.

### Catalog Compiler

Conceptual interface:

```ts
compileCatalog(toolSpecs, packSpecs) -> CatalogArtifacts | CatalogErrors
```

It owns cross-tool invariants and generated registries. Authors do not hand-maintain duplicate route/search/pack/import tables.

### Tool Registry

```ts
list(filter?) -> ToolSummary[]
get(toolId) -> ToolSummary | NotFound
load(toolId, signal?) -> Promise<ToolModule>
```

Metadata access never imports implementation code. Load resolves only the requested tool.

### Tool Runtime

```ts
preflight(toolId, inputContext) -> PreflightResult
run(toolId, input, context, signal) -> Promise<ToolRunResult>
```

It hides manifest/input validation, profile default resolution, capability checks, lazy engine/dependency loading, worker/progress/cancel transport, normalized errors, and content-free event emission.

### Work Profile

```ts
resolveDefaults(toolManifest, explicitValues) -> ResolvedDefaults
```

Every resolved field carries provenance: explicit, profile, tool-default, or system-derived. A tool never receives the whole profile.

### Pack/Starter Resolver

```ts
recommendStarter(workContext, recurringJobs, availableGoldTools) -> StarterRecommendation[]
```

Reasons come from structured tags/rules. Recommendations are filtered to currently Gold/available tools and remain editable.

### Search

```ts
search(query, context) -> RankedToolHit[]
```

Search consumes generated metadata only. V1 is deterministic and supports names, aliases, verbs/jobs, pack/role tags, categories, and input types.

### Context Handoff

```ts
proposeHandoff(sourceResult, targetTool) -> HandoffProposal | Incompatible
```

Payload descriptors are typed: text, lines, file/bytes, table, JSON-like object, URL, image, date/time, numeric quantity. Conversions are registered and loss-aware.

### Local Persistence

Expose named, versioned namespaces rather than raw IndexedDB handles. Tool input/output remains ephemeral unless an explicit saved feature owns it.

### Analytics Adapter

Default product behavior must tolerate a no-op/blocked analytics adapter. The custom cohort adapter accepts only the approved event schema and rejects content-bearing fields.

## 5. Approved TDD seams

Lane-05 S1–S10 are accepted with one v1 scope revision:

- **S1 Catalog compilation** — active.
- **S2 Registry/lazy load** — active.
- **S3 Tool runtime execution** — active.
- **S4 Work Profile resolution** — active.
- **S5 Pack/starter resolution** — active.
- **S6 Context handoff** — active.
- **S7 Local persistence** — active.
- **S8 Optional sync** — **deferred; no implementation in v1**. Preserve no speculative adapter solely for imagined sync.
- **S9 Capability preflight/heavy execution** — active where the first set needs it.
- **S10 User-facing Gold acceptance** — active.

Tests target these public behavior seams. Do not test private helper layout. Expected values come from published standards, hand-worked literals, independent decoders/parsers, or other external oracles—not from the implementation under test.

Each implementation ticket uses vertical red → green cycles. Do not write an imagined horizontal test suite for future tools before the first slice teaches the interface.

## 6. First Gold set mapped to engines

| Tools | Engine/module |
|---|---|
| T01 Business Day, T02 Timezone Overlap | Date/time |
| T03 Rate Converter, T04 Margin/Markup | Client-work math |
| T05 UTM Builder, T06 Tracking Cleaner, T07 Campaign Name Builder | URL/campaign |
| T08 CSV Cleaner, T09 CSV Dedupe, T10 CSV Column Map/Reorder | Table |
| T11 List Compare/Dedupe, T12 Text Diff | Text/list |
| T13 DOI/ISBN Normalizer | Research-reference |
| T14 Image Resize | Native-first image |
| T15 File Hash/Checksum | File/crypto |

The unit of reuse is the engine plus declarative operation manifest, not a shared mega-component and not direct tool-to-tool imports.

## 7. Tracer-bullet implementation order

### Slice A — Gold tracer: Business Day Calculator

Build the minimal deployable shell and one real tool all the way through:

```
static route
  → manifest compile
  → generated metadata/import
  → lazy registry
  → runtime
  → date/time engine
  → Work Profile workweek/date defaults
  → rendered operation/result
  → independent fixtures
  → Gold receipt
```

The Business Day Calculator initially uses explicit workweek rules and user-entered excluded dates only. It does **not** fetch a holiday service.

This slice also establishes:

- strict TS/build;
- one public crawlable tool route;
- one Preact operation island;
- normalized result/error envelope;
- content-free runtime event seam;
- bundle/lazy-load measurement;
- minimal a11y/browser acceptance;
- Cloudflare Static Assets-compatible output.

### Slice B — Local Workbench, profile, and portability

Using T01 as the real tool:

- Your Tools;
- Recent without raw task content;
- add/remove/reorder;
- versioned IndexedDB state;
- visible profile default provenance;
- current-task override;
- storage failure behavior;
- versioned config export/import with preview/rollback-on-invalid.

No account UI.

### Slice C — Search and Library

Implement generated search metadata, command palette, compact Library, installed/recent ranking, deterministic zero-result behavior, and URL-addressable filters without eager tool imports.

### Slices D–J — Engine/tool families

After the tracer interface is real, build tools in independent family slices:

- client time/math: T02–T04;
- campaign URL/naming: T05–T07;
- CSV first vertical T08 after parser gate;
- table expansion/handoff T09–T10;
- text/list/research T11–T13;
- image T14;
- checksum T15.

Each tool is Gold within its own slice. “Later final QA” is not permission to merge Bronze behavior into the default starter set.

### Slice K — Packs and generated onboarding

Only once enough Gold tools exist to populate real starter sets:

- deterministic work-context/job rules;
- 10–15 Gold recommendations;
- visible reasons;
- pre-accept edit/search;
- preview/install packs;
- at least four visibly different work contexts.

Do not recommend placeholder tools.

### Slice L — Falsification telemetry

Freeze an event schema tied only to PRODUCT-SPEC experiments. Implement opt-in/disclosed cohort telemetry if needed for longitudinal metrics. Tool behavior remains fully functional when it is disabled or blocked.

### Slice M — Release certification and deploy

Run the full first-set regression, browser/mobile/accessibility/privacy/bundle matrix, generate final Gold index/receipts, build static discovery surfaces, and deploy a validation build to Workers Static Assets.

## 8. Dependency strategy

### Native by default

Use:

- URL / URLSearchParams;
- Intl;
- Temporal only if supported by the chosen browser floor or with an explicitly justified strategy—do not assume it;
- crypto.randomUUID when needed;
- Web Crypto for supported digest operations;
- TextEncoder/TextDecoder;
- AbortController/AbortSignal;
- Blob/File/Streams;
- IndexedDB;
- createImageBitmap/canvas for basic image resize/encode where the acceptance matrix passes.

### First-scope dependency gate

The only clearly expected first-set parser dependency is CSV.

Before adopting Papa Parse, `csv-parse`, or another candidate:

1. inspect the completed donor census and any completed oracle output;
2. pin exact version;
3. record license and source;
4. verify maintenance/security posture;
5. run adversarial CSV corpus:
   - quoted delimiters/newlines;
   - escaped quotes;
   - BOM;
   - CRLF/LF;
   - empty trailing cells;
   - ragged rows;
   - duplicate/odd headers;
   - malformed quotes;
   - UTF-8 accents/Unicode;
   - large streaming input;
   - cancellation;
6. measure lazy bundle cost;
7. prove worker compatibility if used.

Do not introduce YAML, Markdown, QR, PDF, archive, OCR, or heavy codec dependencies merely because earlier Wave A listed them.

### Available parallel-enabler evidence

All four parallel enabler lanes completed while this closure was being assembled:

- `docs/RESEARCH-DECISIONS-2026-10-27.md`: indexed historical donor census decisions (123 candidates; 3 ADOPT / 28 SPIKE / 86 REFERENCE_ONLY / 6 AVOID) with full evidence recoverable from the pinned Git history. Refer to current donor-provenance docs for actual dependency decisions.
- `spikes/core-engines/` and its README: ten framework-neutral, zero-runtime-dependency TypeScript engine families with 38 historical passing checks; retain bounded semantics and independent current tests.
- `quality/oracles/` + `quality/fixtures/`: the maintained fail-closed oracle authority; the 200-candidate/44-family September figures are historical. Production Gold must consume current independent vectors through public behavior seams.
- `spikes/heavy-local-feasibility/` and `docs/RESEARCH-DECISIONS-2026-10-27.md`: executable heavy-browser evidence, historical native Canvas/ImageBitmap and incremental hashing decisions, and explicit mobile/cancellation/rights limitations.

Production integration must **promote behavior and independent fixtures first**, not copy the spike folder structure wholesale. In particular:

- Ticket 01 should reuse/promote the proven business-day and profile-default semantics instead of independently reinventing them.
- Ticket 01 should bind the first production Gold receipt to `quality/oracles/registry.json` and `quality/fixtures/index.json`; subsequent tools inherit that one certification authority.
- Tickets 04, 05, and 08 should begin by mapping their production seams to the proven engine behavior and only replace an algorithm where product-scale acceptance requires it.
- Ticket 10 may reuse the non-streaming hash behavior for small inputs but still needs a separate large-file incremental strategy.
- Ticket 09 should start from the heavy-browser image evidence: preflight decoded pixel memory, use native Canvas/ImageBitmap first, and keep AVIF/WASM out of the first Gold route.
- Ticket 10 should compare the proven `hash-wasm` path against `@noble/hashes` behind one incremental worker interface and hash directly from File/Blob streams.
- CSV remains intentionally unimplemented by the core/heavy spikes and retains its focused parser gate.

### Parallel enabler promotion rule

The 20260923-181500 lanes may finish before a related implementation ticket starts. The implementing agent must inspect those results and may promote tested code/fixtures/dependencies only when:

- the output path is lane-owned and complete;
- provenance/license/security are acceptable;
- the interface matches or can replace the planned seam rather than adding a duplicate layer;
- tests remain independent and bite;
- production code is rewritten/integrated cleanly rather than treating a spike directory as the runtime authority.

Their completion is not required for the Gold tracer to start.

## 9. Manifest contract

Each tool manifest must define enough structured truth to power build, search, runtime, packs, trust, and certification:

```
stable id + name + short task
category
verbs / aliases / keywords
input descriptors / output descriptors
pack and role tags
maintenance class
privacy/runtime class
capabilities
profile fields consumed
offline declaration (no v1 marketing promise)
lazy dependencies
edge/error declarations
handoff accepts/emits
oracle/acceptance references
version
```

Compiler invariants fail the build for duplicate IDs/routes, unresolved pack tool IDs, LOCAL tools with sanctioned network capability, missing Gold oracle metadata, incompatible handoff declarations, or public/default tools lacking required acceptance metadata.

## 10. Quality and Gold pipeline

```
manifest compile/validate
        ↓
public-seam tests
        ↓
independent-oracle fixtures
        ↓
privacy + capability policy
        ↓
dependency/license gate
        ↓
bundle/lazy-load checks
        ↓
browser accessibility acceptance
        ↓
desktop/mobile matrix
        ↓
heavy/offline failure tests where declared
        ↓
Gold receipt
        ↓
starter/default eligibility
```

Gold receipt must bind to relevant implementation/manifest/oracle versions so changes invalidate stale certification.

Sabotage proof is required for nontrivial guardrails: demonstrate that representative manifest/privacy/oracle tests fail when the protected invariant is intentionally broken.

## 11. Performance budgets

First implementation records real baselines rather than inventing a huge framework budget.

Hard behavioral gates:

- simple normal input produces no >50 ms main-thread long task in the reference acceptance scenario;
- initial shell does not eagerly include first-set tool implementations;
- opening tool A does not fetch unrelated engine B;
- worker/WASM/dependency chunks are lazy;
- catalog metadata growth is measured separately from tool code;
- static discovery pages do not require SSR.

Track:

- shell compressed bytes;
- shared engine chunk bytes;
- per-tool adapter chunk bytes;
- route-open → interactive;
- input → result latency;
- long tasks;
- representative memory for file tools;
- cancellation latency for perceptible work.

Public pages should also respect current Core Web Vitals good-threshold practice, but the tool-specific internal experience should be materially faster where the job is simple.

## 12. Privacy and security

### LOCAL

- no network request during tool fixtures/browser acceptance;
- no payload content in analytics;
- no implicit persistence;
- works without account;
- CSP/build policy should make unexpected remote behavior easier to detect.

### Untrusted files/text

- parse at a narrow engine seam;
- preflight known hard limits;
- normalize failures;
- avoid rendering unsanitized content;
- never infer safety from file extension alone when content signature matters;
- avoid security claims the implementation cannot prove.

### Analytics

Approved event payload fields are identifiers/enums/timestamps/duration buckets needed by the experiment, not user content. The schema should be allowlisted/fail-closed rather than “send arbitrary properties but promise not to”.

## 13. Accessibility and responsive verification

Every slice owns its own keyboard/mobile acceptance. The release slice adds cross-product regression.

Minimum browser matrix:

- current/previous Chrome and Edge desktop;
- current/previous Firefox desktop;
- current/previous Safari desktop;
- current/previous iOS Safari;
- representative Android Chrome.

Acceptance covers:

- 390 px primary mobile flow;
- 200% zoom/reflow;
- keyboard-only route/search/tool/result actions;
- focus restoration;
- screen-reader labels/status where applicable;
- reduced motion;
- table header semantics;
- no color-only state.

## 14. Analytics and experiment schema

Candidate allowlisted events:

- `tool_opened` with tool ID + entry source enum;
- `tool_completed` with tool ID + normalized duration bucket;
- `tool_failed` with tool ID + normalized error code;
- `workspace_tool_added` / `workspace_tool_removed`;
- `onboarding_completed` with context ID set only as approved categorical experiment metadata;
- `pack_installed` / `pack_removed`;
- `profile_default_applied` / `profile_default_overridden` with field **type/key**, never field value;
- `search_zero_result` with a non-content intent/category code where available, not the raw query;
- `handoff_used` with source/target tool IDs + descriptor type;
- `config_exported` / `config_imported`.

If raw search text is required for a later research question, it requires a new explicit privacy decision; it is not allowed by this plan.

## 15. Deployment

Build output targets Cloudflare Workers Static Assets:

- static HTML for public discovery/tool/pack routes;
- content-hashed CSS/JS;
- compact generated catalog metadata;
- lazy tool/engine chunks;
- worker/WASM assets only where present.

No SSR runtime is necessary for ordinary use.

A Worker entry point is introduced only for a server-valued feature such as opt-in experiment events; deterministic operation remains independent from it.

Rollback:

- static deploys remain versioned/atomic;
- revert to previous known-good asset deployment;
- Gold index and manifest versions make it possible to remove a broken tool from starter/default eligibility without rewriting unrelated tools;
- config schema migrations must retain import validation and a non-destructive failure path.

## 16. Explicit non-implementation

Do not create in this wave:

- account/session/sync module;
- service worker install/offline product promise;
- ad/CMP module;
- runtime plugin marketplace;
- generic workflow/orchestration engine;
- Redux/global-state framework absent concrete need;
- per-tool databases;
- per-tool analytics SDKs;
- server execution for ordinary deterministic tools;
- PDF/OCR/media stack;
- live-data/regulatory update machinery;
- AI search/recommendation/onboarding.

## 17. Ticket execution model

The historical local tracker was `.scratch/strumentini-v1/issues/`. It is retained as provenance, not as the current queue.

Each ticket:

- is a narrow end-to-end tracer/family slice;
- traces to explicit PRODUCT-SPEC US/AC/DEC IDs;
- inherits relevant C-XX constraints;
- fits one fresh implementation context;
- is independently demoable/verifiable;
- lists genuine blockers only;
- includes runnable verification;
- reaches the required Gold level for any tool it makes default/public.

The historical dependency graph is `.scratch/strumentini-v1/TICKET-DAG.md`.

The first implementation frontier was **Ticket 01 — Gold tracer: Business Day Calculator**. That frontier has long since been integrated; the old prompt/worker waves must not be restarted as active work.

## 18. Closure review gates

### Product / CEO scope review — PASS

- The persistent Workbench remains a falsifiable hypothesis rather than a premise.
- The first scope is capped at 15 Gold tools, the upper edge of the requested 8–15 range, because four visibly different starter contexts require enough real inventory to test personalization without placeholder recommendations.
- Catalog count, public naming, monetization, account/sync, ads, broad developer positioning, and heavy PDF/OCR/media work remain outside the validation objective.
- Expansion is gated by repeat behavior, not implementation capacity.

### Design review — PASS

- Information architecture has one primary concept: Personal Workbench; Search and input recognition are accelerators, not competing homes.
- Anonymous first value, local personalized state, onboarding, Library, packs, tool anatomy, error/loading/cancel states, mobile hierarchy, keyboard behavior, 200% reflow, and anti-AI-slop rules are all specified.
- Quiet Workbench structure is implementable while final public identity/font/logo/accent remain explicitly unresolved and non-blocking.
- Starter-context difference is now mechanically testable rather than relying on subjective “different enough” judgment.

### Engineering review — PASS

- Production starts with one real vertical tracer rather than horizontal framework construction.
- Public test seams S1–S7/S9/S10 are agreed before TDD; speculative sync seam S8 is deliberately not implemented.
- The platform is boring/static/local by default and has no server dependency for ordinary tools.
- Completed core-engine and donor work is promoted through the canonical seams instead of duplicated; CSV/image/large-file hashing retain focused evidence gates.
- Failure, privacy, performance, bundle, accessibility, browser, deployment, and rollback acceptance are assigned to concrete tickets.

### Known non-blocking uncertainty

- The public brand is selected as Strumentini.it; formal legal/trademark clearance remains a separate governance check.
- Product-market success, retention, Work Profile reuse, pack comprehension, and handoff value remain experiment outcomes; the implementation must measure them rather than encode a favorable answer.
- Remaining parallel oracle/heavy-browser lanes may improve implementation choices, but they do not invalidate the current Ticket 01 frontier.
