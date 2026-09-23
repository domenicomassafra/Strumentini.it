# Lane 05 — Tool Factory engineering architecture

Status: architecture proposal for the integrated planning wave. This document does not authorize production implementation.

## 1. Executive decision

The current hypothesis is directionally correct and should be tightened, not replaced:

- static/PWA distribution;
- TypeScript;
- browser and Web Platform APIs first;
- deterministic work stays on-device by default;
- Web Workers for CPU-heavy work;
- WASM only where the platform cannot meet correctness/performance needs;
- heavy code and data load lazily;
- local state is optional and local-first;
- accounts/sync are optional control-plane features, not a prerequisite for using tools;
- ordinary deterministic tools never require a server or per-use LLM call.

The important correction is architectural: **the unit of scale is not a tool page. It is a small set of deep primitive modules plus declarative tool manifests.** A 200–500 tool catalog must not become 200–500 independent implementations.

The recommended shape is:

```
                         BUILD TIME

 tool specs/manifests ──> catalog compiler ──> compact catalog metadata
        │                        │                     │
        │                        ├──> route map         ├──> search index
        │                        ├──> pack index        ├──> static discovery pages
        │                        └──> policy checks     └──> dynamic import map
        │
        └──> tool implementations ──> lazy tool chunks / worker chunks / WASM

                         RUNTIME

                       ┌────────────────────────────┐
                       │         App Shell          │
                       │ nav/search/packs/workspace │
                       └──────────────┬─────────────┘
                                      │
                       ┌──────────────▼─────────────┐
                       │       Tool Registry        │
                       │ metadata + lazy resolver   │
                       └──────────────┬─────────────┘
                                      │
                       ┌──────────────▼─────────────┐
                       │        Tool Runtime        │
                       │ validate/preflight/run     │
                       │ progress/cancel/result     │
                       └───────┬──────────┬─────────┘
                               │          │
                    ┌──────────▼───┐  ┌──▼──────────────────┐
                    │ Primitive    │  │ Capability adapters │
                    │ engines      │  │ files/storage/net   │
                    └──────────────┘  └─────────────────────┘
```

No runtime plugin marketplace is needed. The initial system should use a **compile-time-known catalog with tool-level dynamic imports**. A remote registry that downloads executable tool code at runtime would add supply-chain, versioning, CSP, offline and privacy complexity without solving a present problem.

## 2. Architecture principles

### 2.1 Deep modules, not shallow wrappers

The external interface of each major module should be small. Complexity belongs behind the interface so fixes have locality and callers gain leverage.

Examples:

- the shell asks the registry for a tool; it does not know chunk names;
- the runtime asks a tool to execute; it does not know whether the implementation uses native APIs, a worker or WASM;
- tools ask the Work Profile resolver for declared defaults; they do not read global profile state directly;
- tools produce typed handoff payloads; they do not know the destination tool UI;
- LOCAL tools do not receive a network adapter.

### 2.2 Browser-native first

Prefer native capabilities where they are correct and sufficiently portable:

- `URL` and `URLSearchParams`;
- `TextEncoder` / `TextDecoder`;
- `crypto.randomUUID()`;
- Web Crypto for supported in-memory hashing;
- `Intl` for locale/number/date/time presentation and timezone behavior;
- File/Blob/Streams APIs;
- IndexedDB for structured local state;
- OPFS only for cases that genuinely need file-like local storage;
- `AbortController` / `AbortSignal` for cancellation;
- `createImageBitmap`, canvas and related image APIs where supported;
- Web Workers for isolation from the main thread.

Native-first does not mean “reimplement standards badly.” A focused dependency is justified when the browser has no equivalent and correctness is expensive to reproduce, especially CSV, YAML, Markdown, QR encoding and incremental hashing for large files.

### 2.3 Static catalog, lazy execution

Catalog breadth must not create linear initial-bundle growth.

The shell may load:

- a compact, generated catalog metadata file;
- a compact search index;
- installed-pack metadata;
- recent/favorite tool IDs.

It must not eagerly import:

- tool implementations;
- tool-specific UI;
- PDF/image/QR/CSV/YAML engines;
- workers;
- WASM;
- large reference datasets.

### 2.4 Local-first privacy is a structural property

Privacy labels are not prose only. They affect allowed capabilities, CI policy and UI disclosure.

For first-party code, the enforcement model is:

1. manifest declares privacy and capabilities;
2. dependency graph prevents LOCAL tool packages from importing remote adapters;
3. lint/build policy forbids direct `fetch`, XHR, WebSocket and EventSource access from tool implementation directories;
4. sanctioned network access goes through narrow adapters owned outside tool packages;
5. CI rejects capability/privacy contradictions;
6. runtime displays disclosure before REFERENCE/REMOTE/AI transfer occurs.

This is stronger and simpler than pretending same-realm JavaScript can be perfectly sandboxed. If third-party executable plugins are ever introduced, they require a separate threat model and isolation architecture.

## 3. Module map

### 3.1 App Shell

**Interface responsibility:** present navigation, workspace layout, tool route, global search/command palette, packs, recents, favorites and install/offline state.

The shell must not contain tool business logic. It renders generic tool chrome and delegates tool-specific content to the loaded tool module.

It owns:

- route selection;
- responsive shell layout;
- keyboard navigation;
- generic input/output chrome where reusable;
- install/offline indicators;
- disclosure surfaces;
- error boundary around a loaded tool.

It does not own:

- CSV parsing;
- date calculations;
- image conversion;
- business formulas;
- remote calls on behalf of tools.

### 3.2 Catalog Compiler

**Interface:** `compileCatalog(toolSpecs) -> CatalogArtifacts | CatalogErrors`.

This is a build-time deep module. It validates cross-tool invariants and generates:

- compact public metadata;
- stable route map;
- dynamic import map;
- pack membership index;
- command/search index;
- static discovery page inputs;
- Gold certification index;
- dependency/license inventory;
- offline/precache hints.

The compiler is the main anti-drift mechanism at 200–500 tools. Authors should not hand-edit duplicate route, search, pack and lazy-loader registries.

### 3.3 Tool Registry

**Interface:** conceptually:

```ts
registry.list(filter?): ToolSummary[]
registry.get(toolId): ToolSummary | NotFound
registry.load(toolId, signal?): Promise<ToolModule>
```

The registry exposes metadata without importing implementation chunks. `load` resolves only the requested tool.

### 3.4 Tool Runtime

**Interface:** conceptually:

```ts
runtime.preflight(toolId, inputContext): PreflightResult
runtime.run(toolId, input, context, signal): Promise<ToolRunResult>
```

The runtime hides:

- manifest/input validation;
- Work Profile default injection;
- runtime capability checks;
- lazy dependency loading;
- worker/WASM selection;
- progress transport;
- cancellation;
- normalized error/result envelopes;
- optional analytics event emission without payload contents.

Simple deterministic tools may execute synchronously behind this interface. The caller does not need a second execution model.

### 3.5 Work Profile

**Interface:** `resolveDefaults(toolManifest, explicitValues) -> ResolvedDefaults`.

Each resolved value carries provenance:

- `explicit`;
- `profile`;
- `tool-default`;
- `system-derived`.

Rules:

- only fields declared by the tool may be requested;
- sensitive fields are never injected silently;
- profile-provided values remain visible and overridable;
- tools receive only requested fields, not the whole profile object;
- tool input is not persisted merely because profile defaults were used.

Recommended field families:

- locale and language;
- timezone;
- currency;
- date/number format;
- working days/hours;
- optional hourly/day rate;
- preferred image export format/quality;
- optional organization identity fields, individually consented.

### 3.6 Pack Registry

**Interface:** `resolvePacks(profile, installedPackIds) -> PackSnapshot`.

A pack is a curated view over tool IDs, not a fork of tools.

Pack definitions contain:

- stable ID/name;
- audience/job statement;
- ordered tool IDs;
- optional starter layout;
- optional recommended profile fields;
- version.

The same tool can belong to multiple packs without duplicated implementation or configuration.

### 3.7 Search and Command Palette

**Interface:** `search(query, context) -> RankedToolHit[]`.

Search consumes generated metadata only. It must not import tool chunks.

Ranking inputs may include:

- exact/prefix name match;
- aliases and keywords;
- pack relevance;
- installed-pack membership;
- recency/frequency;
- category.

Search should remain deterministic initially. Semantic/AI search is not required to make 200–500 tools discoverable.

### 3.8 Context Handoff

**Interface:** `proposeHandoff(sourceResult, targetTool) -> HandoffProposal | Incompatible`.

Handoff is explicit and typed. Tools publish output descriptors such as:

- text;
- lines;
- bytes/file;
- table;
- JSON-like object;
- URL;
- image;
- date/time;
- numeric quantity.

A target declares accepted input descriptors. The handoff module converts only through registered, loss-aware adapters and always previews or labels destructive/lossy transformations.

Do not let tools import one another directly. Direct imports create an N×N dependency graph and defeat catalog modularity.

### 3.9 Local Persistence

Use a tiered policy:

- `localStorage`: tiny non-sensitive preferences only if synchronous simplicity matters;
- IndexedDB: normal structured app state, recent/favorite tools, pack state and optional draft metadata;
- OPFS: large local artifacts/caches only after capability checks and only when the job requires file-like access.

Tool inputs and outputs are ephemeral by default. Persistence requires an explicit feature such as “save preset,” “keep recent,” or “pin result.”

The persistence interface should expose named namespaces and schema versions instead of raw database handles.

### 3.10 Optional Account and Sync

**Interface:** narrow control-plane sync:

- identity;
- installed pack IDs;
- workspace layout;
- safe profile defaults;
- UI preferences;
- optional saved presets that are explicitly syncable.

The default architecture does not upload user files or arbitrary tool inputs.

Sync requires:

- local version/revision;
- deterministic conflict policy per record type;
- tombstones or equivalent deletion semantics;
- offline queue;
- bounded retries/backoff;
- user-visible “local / syncing / synced / conflict” state where relevant.

### 3.11 Analytics and Feedback

Analytics is optional and payload-minimal.

Allowed default events should describe product behavior without content:

- tool opened;
- tool completed;
- tool failed with normalized error code;
- cancellation;
- duration bucket;
- platform/browser capability bucket;
- feedback submitted.

Never log raw text, URLs, files, document contents, profile values or transformed output by default.

### 3.12 Ad Boundary

Ads, if ever enabled, are an optional acquisition-surface module.

Architectural rule:

- no ad SDK import in the personal workspace or tool runtime bundle;
- no ad placement adjacent to tool controls, drag/drop, copy/download or command palette;
- public static discovery pages may expose explicit ad slots;
- consent/CMP integration is isolated behind the ad module;
- disabling ads removes the module without affecting tool execution.

## 4. Tool contract

The exact TypeScript syntax can change during implementation. The semantic contract should not.

```ts
type MaintenanceClass = "E" | "D" | "R" | "H" | "S";
type PrivacyClass = "LOCAL" | "REFERENCE" | "REMOTE" | "AI";

type Capability =
  | "clipboard"
  | "share"
  | "file-read"
  | "file-write"
  | "image-decode"
  | "worker"
  | "wasm"
  | "local-db"
  | "opfs"
  | "reference-network"
  | "content-network"
  | "ai-provider";

interface ToolManifest {
  id: ToolId;
  version: string;
  route: string;
  name: string;
  shortJob: string;
  category: CategoryId;
  keywords: readonly string[];
  aliases?: readonly string[];
  packIds: readonly PackId[];

  maintenanceClass: MaintenanceClass;
  privacyClass: PrivacyClass;
  deterministic: boolean;

  input: ToolDataContract;
  output: ToolDataContract;
  profileFields: readonly WorkProfileFieldId[];
  capabilities: readonly Capability[];
  offline: OfflineSupport;

  lazyDependencies: readonly LazyDependencyRef[];
  runtime: RuntimePolicy;
  acceptance: ToolAcceptanceContract;
  provenance?: SourceProvenance;
}
```

### 4.1 Metadata invariants

- ID never changes after publication. Rename changes display name, not ID.
- Route changes require a redirect alias.
- Version is the behavior/schema version, not the app build number.
- Category is singular; pack membership can be plural.
- Keywords are curated discovery terms, not SEO stuffing.
- A tool cannot claim Gold without an acceptance contract.

### 4.2 Input/output contract

Use a small set of reusable descriptors rather than bespoke schemas for every tool:

- `text`;
- `lines`;
- `number`;
- `date-time`;
- `url`;
- `table`;
- `structured`;
- `file`;
- `image`;
- `bytes`;
- `none`.

Each descriptor can add constraints such as max supported bytes, accepted MIME/extensions, columns, encoding, locale semantics and multiplicity.

Tool-specific parameters remain typed fields, but shared descriptors are what enable generic shell rendering, handoff and fixtures.

### 4.3 Runtime policy

Runtime policy should declare:

- preferred mode: main / worker;
- worker required vs preferred;
- WASM required vs optional;
- soft input limit;
- hard input limit;
- memory-risk policy;
- progress support;
- cancellation support;
- expected offline behavior;
- fallback message/action when capability is unavailable.

### 4.4 Offline support

Use:

- `FULL`: after tool chunk is cached, all behavior works offline;
- `SHELL_ONLY`: shell/docs load offline but tool requires reference data/network;
- `NONE`: intentionally remote-only.

For Data-backed tools, also declare cache age and stale-data policy.

### 4.5 Acceptance contract

Each tool declares:

- fixture sets;
- independent oracle type/source;
- browser/mobile requirements;
- accessibility assertions;
- performance class/budget;
- privacy assertions;
- known edge cases;
- Gold status and certification revision.

The manifest points to test assets; it does not embed large fixtures in the runtime catalog.

## 5. First-40 primitive engines

The first 40 targets can be covered by **10 primitive engines**. This is the recommended upper bound for Wave A; fewer is acceptable if interfaces stay deep, but splitting beyond this requires evidence of incompatible semantics.

| # | Wave A tool | Primary engine |
|---:|---|---|
| 1 | Word/character/line counter | TextNormalizationStats |
| 2 | Whitespace normalizer | TextNormalizationStats |
| 3 | Invisible-character detector | TextNormalizationStats |
| 4 | Line sorter | ListSetDiff |
| 5 | Line deduplicator | ListSetDiff |
| 6 | List intersection/difference | ListSetDiff |
| 7 | Text diff | ListSetDiff |
| 8 | Markdown preview | MarkdownRender |
| 9 | CSV viewer | Tabular |
| 10 | CSV cleaner | Tabular |
| 11 | CSV delimiter/encoding detector | Tabular |
| 12 | CSV deduplicator | Tabular |
| 13 | CSV column select/reorder | Tabular |
| 14 | CSV filter/sort | Tabular |
| 15 | CSV to JSON | Tabular |
| 16 | JSON to CSV | Tabular + StructuredData |
| 17 | JSON formatter/validator | StructuredData |
| 18 | YAML formatter/validator | StructuredData |
| 19 | Base64 encode/decode | EncodingCrypto |
| 20 | Hash generator | EncodingCrypto |
| 21 | UUID generator | EncodingCrypto |
| 22 | URL encode/decode | URLCampaignQR |
| 23 | Query-string editor | URLCampaignQR |
| 24 | Unix timestamp converter | DateTime |
| 25 | Business-day calculator | DateTime |
| 26 | Timezone converter | DateTime |
| 27 | Multi-timezone overlap | DateTime |
| 28 | Decimal-hours converter | DateTime |
| 29 | Hour/day/project rate converter | BusinessMath |
| 30 | Effective hourly rate | BusinessMath |
| 31 | Margin/markup calculator | BusinessMath |
| 32 | Project profitability calculator | BusinessMath |
| 33 | UTM builder | URLCampaignQR |
| 34 | UTM parser | URLCampaignQR |
| 35 | Tracking-parameter cleaner | URLCampaignQR |
| 36 | QR generator | URLCampaignQR |
| 37 | Image resize | ImagePipeline |
| 38 | Image format conversion | ImagePipeline |
| 39 | Image compression | ImagePipeline |
| 40 | File hash/checksum verifier | EncodingCrypto |

### 5.1 Engine interfaces

The engines should expose domain operations, not generic “do anything” functions.

Examples:

- TextNormalizationStats: `inspectText`, `normalizeWhitespace`, `findInvisibleCharacters`;
- ListSetDiff: `sortLines`, `dedupeLines`, `compareLists`, `diffText`;
- Tabular: `parseTable`, `transformTable`, `serializeTable`;
- StructuredData: `parseStructured`, `formatStructured`, `convertStructured`;
- EncodingCrypto: `encode`, `decode`, `digest`, `verifyDigest`, `newUuid`;
- URLCampaignQR: `parseUrl`, `editQuery`, `buildCampaignUrl`, `cleanTracking`, `encodeQr`;
- DateTime: `parseInstant`, `convertZone`, `overlapWindows`, `businessDays`, `convertDuration`;
- BusinessMath: named formulas returning result plus assumptions/rounding metadata;
- ImagePipeline: `inspectImage`, `transformImage`, `encodeImage`;
- MarkdownRender: `renderMarkdown` returning sanitized render output plus warnings.

Do not collapse all engines into a universal expression/transform DSL. That would trade duplicated code for an oversized, hard-to-test interface.

## 6. Dependency and YAGNI review

### Keep native

| Need | Preferred implementation | Why |
|---|---|---|
| URL/query parsing | URL / URLSearchParams | Standards-compliant and built-in |
| UUID v4 | crypto.randomUUID | Built-in secure generator |
| Basic hashes | Web Crypto | Built-in, trusted implementation |
| UTF-8 | TextEncoder/TextDecoder | Built-in |
| Locale formatting | Intl | Built-in |
| Cancellation | AbortController/AbortSignal | Cross-module standard |
| Blob/file reads | Blob/File/Streams | Built-in |
| Simple image decode/encode | createImageBitmap + canvas | Avoid heavy image runtime for common formats |
| Local structured state | IndexedDB | Browser-native and sufficient |

### Dependencies likely justified after a focused spike

| Need | Why native is insufficient | Selection gate |
|---|---|---|
| Production CSV parser | No native CSV parser; quoting/newlines/encoding edge cases are deceptively hard | Streaming support, tiny footprint, maintained, corpus proof |
| YAML parser | No browser YAML parser | YAML 1.2 behavior, safe schema defaults, size/licensing |
| Markdown parser + sanitizer | No native Markdown parser and untrusted HTML needs XSS control | Secure defaults, sanitizer compatibility, bundle budget |
| QR encoder | No browser QR encoder | Deterministic vectors, small lazy chunk, no tracking |
| Incremental file hashing | Web Crypto digest is not a streaming hash interface | Worker-friendly, chunked, audited, lazy, license-compatible |

### Explicit YAGNI rejections

- remote executable plugin registry;
- microservices per tool or category;
- event bus for all app communication;
- Redux/global state framework before state complexity proves it;
- server execution for deterministic conversions/calculations;
- a universal workflow engine;
- per-tool databases;
- per-tool analytics SDK calls;
- one worker per tool bundle when a shared worker adapter suffices;
- eagerly bundled PDF/OCR/media engines before Wave C.

## 7. Tool Factory

### 7.1 Scaffold/generator

A generator is justified because the repeated artifact set is large and consistency matters.

It should generate only boring structure:

- tool manifest/spec stub;
- tool module stub;
- fixture folder;
- acceptance test stub at the approved public seam;
- documentation/example stub;
- optional worker entry if the manifest requests it.

It must not generate domain logic or fake tests.

### 7.2 Catalog generation

One command should:

1. discover tool manifests;
2. validate IDs/routes/categories/packs;
3. detect duplicates and aliases;
4. validate privacy/capability combinations;
5. resolve dynamic imports;
6. produce compact runtime metadata;
7. produce pack/search indexes;
8. produce static public-page data;
9. emit dependency/license inventory;
10. emit certification summary.

Generated artifacts should be deterministic so CI can fail on drift.

### 7.3 CI gates

Every change affecting a tool should pass:

1. typecheck with strict TypeScript settings;
2. manifest/catalog validation;
3. public-seam behavior tests;
4. independent-oracle fixtures where required;
5. privacy/capability policy;
6. dependency and license policy;
7. bundle-delta budget;
8. accessibility checks;
9. required browser/mobile acceptance tier;
10. offline/caching assertions where declared;
11. worker/WASM cancellation tests for Heavy tools;
12. existing Gold regression suite.

Catalog publication fails closed: a newly implemented tool can exist at Bronze/Silver without entering the default public Gold catalog.

### 7.4 Gold certification

Gold should be machine-readable, not only a label in documentation.

A certification receipt should identify:

- tool ID/version;
- manifest hash;
- implementation/build revision;
- fixture/oracle revision;
- browsers/devices exercised;
- privacy checks;
- accessibility checks;
- performance measurements;
- bundle delta;
- timestamp;
- any accepted limitations.

Publishing a changed tool invalidates its prior receipt until the required gates pass again.

### 7.5 Browser/mobile matrix

Recommended tiers:

- Tier 1 desktop: current stable Chrome/Edge, Firefox, Safari;
- Tier 1 mobile: current iOS Safari, current Android Chrome;
- Tier 2: previous major where practical for shell/simple deterministic tools;
- capability-specific matrix for worker/OPFS/WASM/image behavior.

Do not infer support from user-agent strings. Feature-detect capabilities and test actual fallback behavior.

### 7.6 Bundle/performance budgets

Initial proposed budgets for the planning wave:

- shell JS budget excludes tool implementations and optional ad/analytics SDKs;
- each simple tool should normally add only its own small lazy chunk plus shared-engine references;
- dependency duplication across tool chunks is a CI failure;
- no Wave C engine may appear in the shell chunk;
- no WASM fetched before a tool that needs it is opened;
- normal simple-tool execution must not create a main-thread long task;
- heavy tools must expose progress and cancellation;
- public pages continue to target good Core Web Vitals.

Exact byte thresholds require measurement after the shell technology is chosen. The enforcement mechanism should exist before the numeric thresholds are frozen.

### 7.7 Accessibility gate

At minimum:

- keyboard-only completion of the primary job;
- visible focus;
- programmatic labels/descriptions;
- status/progress announced appropriately;
- error association with the relevant input;
- no color-only meaning;
- zoom/reflow on mobile;
- reduced-motion respected;
- copy/download actions reachable without pointer-only gestures.

Tool-specific acceptance adds requirements for tables, image previews, diff views and other rich outputs.

### 7.8 Regression and sabotage proof

The factory should deliberately test that policy checks can fail.

Examples:

- duplicate tool ID causes catalog build failure;
- LOCAL + `content-network` capability is rejected;
- missing oracle on a deterministic Gold tool is rejected;
- eager import of a heavy engine increases the shell budget and fails;
- a tool marked FULL offline but depending on network is rejected;
- stale Data-backed source beyond allowed age produces a visible stale state;
- a Heavy tool that ignores AbortSignal fails cancellation acceptance.

These tests verify the guardrails rather than merely checking happy-path tools.

## 8. Security and privacy model

### 8.1 LOCAL

- no network adapter;
- input/output stays in browser memory/local stores chosen by the user;
- telemetry excludes payload;
- file tools prefer Blob/stream processing;
- no implicit persistence.

### 8.2 REFERENCE

Only a non-sensitive lookup key may leave the device.

Examples: public-holiday country/year or a standardized reference ID.

The manifest must declare:

- endpoint/source;
- fields transmitted;
- cache/freshness behavior;
- offline/stale behavior.

### 8.3 REMOTE

Content upload is part of the job and requires pre-transfer disclosure.

The user must know:

- what is sent;
- destination/provider;
- purpose;
- retention assumptions if known;
- whether cancellation can stop an in-flight upload.

### 8.4 AI

AI is a subtype with additional model/provider/cost/evaluation requirements. It is not a default fallback for deterministic tool failure.

### 8.5 Untrusted input

Treat tool inputs as untrusted even when processing is local:

- sanitize Markdown/HTML render output;
- never execute CSV/JSON/YAML content as code;
- avoid formula execution in table tools;
- validate image/file signatures where relevant;
- never infer safety solely from file extension;
- bound decompression/archive expansion before Wave C archive work.

## 9. Large-file, mobile and WASM behavior

Every heavy-capable tool should use this decision sequence:

```
input selected
    │
    ├─ invalid/corrupt ─────────────> reject with precise recoverable error
    │
    ├─ exceeds hard limit ──────────> do not start; explain limit/alternative
    │
    ├─ mobile memory-risk threshold > warn or offer reduced operation
    │
    ├─ required capability missing ─> supported fallback?
    │                                  ├─ yes -> fallback path
    │                                  └─ no  -> explicit unsupported state
    │
    └─ runnable
         │
         ├─ lazy-load worker/WASM
         ├─ stream/chunk where possible
         ├─ emit real progress only
         ├─ honor AbortSignal
         └─ validate produced output before success
```

Rules:

- never fake a progress percentage when total work is unknowable;
- distinguish “preparing runtime,” “processing,” and “encoding/writing” phases;
- cancellation must release large buffers/references promptly;
- memory failure returns a recoverable explanation rather than automatic retry loops;
- worker crash is a normalized runtime error;
- unsupported mobile paths do not silently upload work to a server;
- WASM initialization failure may fall back only to an explicitly tested implementation.

## 10. Failure-mode table

| Failure | Required behavior | Must not happen | Acceptance proof |
|---|---|---|---|
| Mobile viewport/input constraints | Responsive controls, usable touch targets, bounded preview, clear limits | Desktop-only layout or hidden primary action | Mobile E2E on Tier 1 |
| Memory pressure/OOM risk | Preflight size guard; stream/chunk/worker where possible; actionable failure | Browser tab freeze/retry loop | Threshold fixture + constrained-device test |
| Unsupported browser API | Feature detect and use tested fallback or explicit unsupported state | UA sniffing or silent failure | Capability-off test |
| Very large file | Show size guidance; do not buffer if streaming path exists; cancellation works | Loading entire unsupported file into memory without warning | Large-file corpus + cancel test |
| Corrupt input | Reject with domain-specific error and preserve original input | Partial output presented as valid | Corrupt corpus |
| Stale reference data | Show source/version/age and stale state; use policy-defined last-known data only | Pretending stale data is current | Clock/source fixture |
| Sync failure | Keep local state authoritative; queue/retry bounded; show sync status/conflict | Data loss or blocking local tool use | Offline/conflict tests |
| Worker crash | Normalize error, release state, allow safe retry | Infinite spinner | Forced worker-termination test |
| WASM load/init failure | Tested fallback or clear unsupported state | Automatic remote upload | Load-failure test |
| User cancellation | Stop work at the nearest safe boundary and keep no misleading “success” | Completion event after cancel | Abort acceptance |

## 11. Hosting and build strategy

Recommended deployment topology:

```
Static CDN
  ├─ shell HTML/CSS/JS
  ├─ generated discovery pages
  ├─ compact catalog/search metadata
  ├─ lazy tool chunks
  ├─ lazy worker chunks
  ├─ lazy WASM
  └─ versioned reference datasets

Optional edge/backend
  ├─ auth callback/session
  ├─ tiny profile/layout sync
  ├─ privacy-safe feedback
  └─ sanctioned remote/reference adapters
```

Build requirements:

- content-hashed immutable chunks;
- route/tool dynamic imports;
- worker chunks emitted separately;
- WASM emitted separately and fetched on demand;
- catalog metadata versioned independently from tool chunks when useful;
- static public tool pages generated from manifests/docs;
- service worker precaches shell and small metadata only;
- tools are cached opportunistically after first use or explicit offline install;
- old build assets remain available long enough for active clients to complete an update safely.

No SSR runtime is required for ordinary use. Static pre-rendered discovery pages can satisfy crawlability without making tool execution server-dependent.

## 12. How this architecture scales to the 200 candidate tools

The current 200-tool map clusters naturally into reusable engines:

- text/list;
- tabular/CSV;
- structured data;
- encoding/crypto;
- URL/web;
- date/time;
- business math;
- PDF/document;
- image/visual;
- file/archive/privacy;
- citation/research.

Wave A builds the first ten engine families. Wave B mainly deepens those engines and adds citation/reference primitives. Wave C introduces isolated heavy PDF/archive/image/file capabilities with workers/WASM. Wave D adds the update/provenance machinery needed for data-backed and regulatory tools.

The catalog can therefore grow by adding mostly:

- manifests;
- small operation adapters;
- fixtures/oracles;
- docs;
- occasional new primitive operations.

It should not grow by adding a fresh architecture per tool.

## 13. Future ticket DAG outline

This is architecture guidance only. The integrated wave should create actual tickets after reconciling all lanes.

```
A0 owner decisions: browser floor + shell/build choices
 │
 ├─ A1 repo/tool package shape + strict TS config
 │    ├─ A2 tool manifest contract
 │    │    ├─ A3 catalog compiler + generated registries
 │    │    │    ├─ A4 registry/search/pack runtime
 │    │    │    └─ A5 static discovery-page generation
 │    │    └─ A6 manifest policy / privacy / license gates
 │    └─ A7 shared result/error/progress/cancel contracts
 │
 ├─ B1 Work Profile resolver
 │    ├─ B2 local persistence adapter
 │    └─ B3 optional sync seam
 │
 ├─ C1 Tool Runtime tracer tool
 │    ├─ C2 lazy loader + capability preflight
 │    ├─ C3 worker adapter + cancellation
 │    └─ C4 handoff module
 │
 ├─ D1 Tool Factory scaffolder
 │    ├─ D2 Gold certification receipt
 │    ├─ D3 bundle/license/accessibility CI
 │    └─ D4 browser/mobile matrix
 │
 └─ E1 Wave A engines in vertical TDD slices
      ├─ E1a TextNormalizationStats + ListSetDiff
      ├─ E1b Tabular
      ├─ E1c StructuredData + MarkdownRender
      ├─ E1d EncodingCrypto
      ├─ E1e URLCampaignQR
      ├─ E1f DateTime
      ├─ E1g BusinessMath
      └─ E1h ImagePipeline

E2 Wave A tool manifests/adapters 1–40
    depends on A3/A7, relevant E1 engine, and D1

E3 certify/publish first Gold batch
    depends on D2/D3/D4 and a green existing-Gold regression suite
```

The first implementation tracer should be one simple but non-trivial tool end-to-end through manifest → registry → runtime → engine → result → Gold tests. Do not horizontally build every framework layer before proving the seam.

## 14. Owner decisions required before implementation

These decisions should be made before `plan-tickets` locks implementation details:

1. **Supported browser floor.** Especially minimum iOS Safari/Android Chrome expectations for workers, image APIs, OPFS and install/offline behavior.
2. **Shell view technology.** Native/custom elements versus a small UI runtime. The tool runtime interfaces should remain framework-independent either way.
3. **Build tool.** A bundler must support reliable dynamic imports, workers, WASM and deterministic chunk/bundle reporting. Vite is a reasonable default candidate but is not mandated by this lane.
4. **Runtime schema strategy at trust boundaries.** Decide whether a small schema library is accepted or whether narrow manual parsers will be maintained for sync/remote payloads.
5. **Third-party parser/codec shortlist.** CSV, YAML, Markdown+sanitizer, QR and incremental hashing require focused dependency/license/size/security spikes.
6. **Account/sync scope for v1.** No account at all versus optional sign-in with only packs/layout/safe profile fields.
7. **Analytics posture for v1.** None, self-hosted/minimal, or a vendor; payload content remains forbidden by default.
8. **PWA offline promise.** Shell-only offline versus “recent/installed tools work offline” as a user-facing promise.

Ads are deliberately **not** an implementation-blocking owner decision. The architecture keeps an isolated insertion point and otherwise proceeds ad-free.

## 15. Architecture acceptance checklist

Before implementation planning is considered ready:

- 200–500 tool scale does not require runtime-downloaded executable plugins;
- initial bundle contains no tool implementations by default;
- first 40 map to at most 10 primary primitive engines;
- tool-to-tool handoff does not create direct imports;
- LOCAL tools cannot import sanctioned network adapters;
- manifest has maintenance, privacy, capability, dependency, oracle, pack, profile and offline declarations;
- Heavy tools have explicit progress/cancel/memory behavior;
- Gold certification is generated and invalidated by relevant changes;
- CI can demonstrate guardrail failures, not only success;
- all TDD tests target agreed public seams;
- ordinary deterministic tool operation remains viable with static hosting and zero backend calls.
