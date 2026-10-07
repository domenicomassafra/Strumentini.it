# Lane 05 — Test seams, correctness oracles and acceptance

Status: pre-implementation TDD seam proposal. No production tests or source are created in this wave.

## 1. Testing rule

Tests should observe behavior through public module interfaces and user-visible surfaces. They should not assert private helper calls, import graphs, internal worker messages or implementation-specific state.

The downstream TDD loop should be vertical:

1. choose one agreed seam;
2. write one failing behavior test with an independent expected result;
3. implement the minimum behavior through that seam;
4. repeat;
5. perform structural refactoring during review, not by prebuilding abstractions in advance.

Mock only true system boundaries such as clock, browser capability, storage, external network and worker process failure. Do not mock Strumentini.it engines merely to make runtime tests pass.

## 2. Approved public-behavior seams

These are the proposed seams for the integrated implementation wave. The owner/integrated planner should explicitly ratify or revise them before TDD begins.

### S1 — Catalog compilation

**Public interface**

```text
compileCatalog(toolSpecs) -> CatalogArtifacts | CatalogErrors
```

**Behavior to observe**

- stable generated metadata for valid specs;
- duplicate IDs/routes rejected;
- invalid pack references rejected;
- privacy/capability contradictions rejected;
- deterministic output ordering;
- dynamic import entry generated without importing code;
- Gold tool missing required acceptance/oracle metadata rejected.

**Do not test**

- internal traversal order;
- helper function call counts;
- intermediate AST/object shapes not exposed in output.

### S2 — Tool registry and lazy load

**Public interface**

```text
registry.list(filter?) -> ToolSummary[]
registry.get(toolId) -> ToolSummary | NotFound
registry.load(toolId, signal?) -> ToolModule
```

**Behavior to observe**

- metadata listing does not load tool implementation;
- loading one tool loads only its declared chunk/dependencies;
- unknown tool has stable NotFound result;
- cancellation during lazy load produces cancelled state;
- load failure is normalized and retryable where safe.

The lazy-load acceptance should use observable module-load counters or bundler/browser instrumentation at the boundary, not tests coupled to a specific generated import-map implementation.

### S3 — Tool runtime execution

**Public interface**

```text
runtime.preflight(toolId, inputContext) -> PreflightResult
runtime.run(toolId, input, context, signal) -> ToolRunResult
```

**Behavior to observe**

- valid deterministic input yields an exact result;
- invalid input yields a typed recoverable error;
- explicit input wins over Work Profile default;
- missing required capability fails before destructive work;
- progress events are monotonic only when percentage is real;
- cancellation produces cancelled outcome, not success;
- runtime failure does not corrupt original input;
- result includes assumptions/warnings/provenance needed by the tool contract.

### S4 — Work Profile resolution

**Public interface**

```text
resolveDefaults(toolManifest, explicitValues, profileSnapshot) -> ResolvedDefaults
```

**Behavior to observe**

- only declared profile fields are returned;
- explicit values override profile values;
- profile values override tool defaults only where allowed;
- provenance is attached to every injected value;
- sensitive fields are not silently injected;
- missing fields remain visibly unresolved rather than fabricated.

### S5 — Pack resolution

**Public interface**

```text
resolvePacks(profile, installedPackIds, catalog) -> PackSnapshot
```

**Behavior to observe**

- same tool can appear in multiple packs without duplicate implementation identity;
- missing/retired tool IDs are reported deterministically;
- pack ordering is stable;
- starter-pack/default logic does not remove user-installed packs;
- catalog changes produce defined migration behavior.

### S6 — Context handoff

**Public interface**

```text
proposeHandoff(sourceResult, targetTool) -> HandoffProposal | Incompatible
applyHandoff(proposal) -> TargetInput
```

**Behavior to observe**

- compatible descriptors pass losslessly;
- registered conversions state whether they are lossy;
- incompatible handoff is rejected with explanation;
- target receives only declared input fields;
- handoff does not implicitly persist or upload content;
- source result remains unchanged after handoff.

### S7 — Local persistence

**Public interface**

```text
store.get(namespace, key)
store.put(namespace, key, value, expectedVersion?)
store.delete(namespace, key)
```

**Behavior to observe**

- round-trip persistence for supported values;
- schema/version mismatch has deterministic migration/error behavior;
- quota/unavailable storage produces recoverable state;
- delete really removes user-visible record;
- a failed write does not report success;
- tool input is not persisted unless a calling feature explicitly writes it.

Use an in-memory adapter only as a second real adapter to the same interface, not as a mock of internals.

### S8 — Optional sync

**Public interface**

```text
sync.push(localChanges, remoteRevision, signal) -> SyncResult
sync.pull(sinceRevision, signal) -> SyncResult
```

**Behavior to observe**

- offline leaves local state usable;
- retry is bounded;
- conflict produces explicit conflict result or documented deterministic winner;
- deletion propagates correctly;
- unsupported/unsyncable fields never leave the device;
- cancellation does not mark unsent changes synced.

Network transport is a true system boundary and may be replaced by a protocol-level fake.

### S9 — Capability preflight / heavy execution

**Public interface**

```text
preflight(runtimePolicy, inputMetadata, capabilities) -> PreflightResult
executeHeavy(job, signal, onProgress) -> Result
```

**Behavior to observe**

- hard-limit input is rejected before allocation-heavy work;
- soft-limit input produces documented warning/fallback;
- missing worker/WASM/image capability selects only a declared fallback;
- worker crash returns normalized failure;
- AbortSignal stops the job;
- progress phases are truthful;
- temporary buffers/resources are released enough for subsequent jobs to run.

### S10 — User-facing Gold acceptance

This seam is the rendered tool route in a real browser.

**Behavior to observe**

- user can understand the job and complete the primary action;
- keyboard-only path works;
- mobile layout works;
- errors are visible and associated with inputs;
- profile-injected defaults are visible;
- privacy disclosure appears before remote transfer;
- copy/download output is valid;
- offline behavior matches the manifest.

Browser tests should exercise the real tool runtime and real engine where feasible rather than mocking Strumentini.it internals.

## 3. Tool-class correctness oracles

The oracle must be independent of the implementation under test.

| Tool class | Primary oracle | Secondary/property oracle | Example |
|---|---|---|---|
| Text counts/normalization | literal worked fixtures including Unicode | idempotence where expected | normalizing whitespace twice equals once |
| Set/list operations | hand-worked set outputs | algebraic properties | A∩B = B∩A; dedupe is idempotent |
| Text diff | known before/after patch fixtures | applying produced patch/reconstruction invariant where supported | exact line additions/removals |
| CSV/table | external corpus / RFC-style examples / independent parser in test tooling | parse→serialize→parse semantic equality | quoted newline and escaped quote cases |
| JSON | native JSON parser behavior + standard fixtures | parse(format(x)) semantic equality | valid/invalid literals |
| YAML | parser conformance corpus or independent implementation | YAML→data expected literals | anchors/types/quoting policy |
| Base64 | published standard vectors | decode(encode(bytes)) = bytes | empty, binary, Unicode UTF-8 wrapper |
| Hash | published NIST/algorithm vectors | independent CLI/browser implementation in test tooling | SHA-256 known answers |
| UUID | RFC format/version/variant properties | collision smoke test is non-authoritative only | version and variant bits |
| URL/query | URL Standard examples / hand-worked URLs | parse→serialize semantic invariants | repeated params, spaces, Unicode |
| UTM/tracking clean | explicit canonical fixtures | idempotence | clean(clean(url)) = clean(url) |
| QR | published QR test vectors / decode output using independent decoder in test tooling | matrix dimensions/error correction metadata | encode text then independent decode |
| Unix timestamp | known epoch literals | round-trip within defined precision | 0 -> 1970-01-01T00:00:00Z |
| Timezone | IANA/Intl known instants around DST | UTC instant preserved through zone display conversion | DST gap/overlap fixtures |
| Business-day | hand-worked calendars | symmetry only where semantics allow | weekend boundaries |
| Duration/decimal hours | literal rational examples | reversible conversions within precision | 1:30 = 1.5h |
| Business math | published/accounting formula examples and hand-worked literals | dimensional/monotonic properties | margin vs markup distinction |
| Image resize/convert | decoded dimensions + pixel fixture or perceptual threshold | output decodes and declared MIME/signature matches | PNG/JPEG/WebP corpus |
| Image compression | output decodes, dimension policy preserved, size/quality properties | compare independent decoder metadata | no false “smaller” guarantee when impossible |
| File hash | standard hash vectors + independent CLI fixture hashes | chunk size independence | same hash for 1 KiB vs 1 MiB chunking |
| Data-backed | source snapshot signed/versioned in fixture | freshness policy | known source version |
| Regulatory | authoritative rule examples with effective dates | cross-version fixtures | formula before/after rule date |
| Semantic/AI | curated eval set with human acceptance rubric | provider/model regression comparison | never self-grade with same model only |

## 4. Wave A oracle mapping

Every first-40 tool needs at least one independent expected result before Gold:

| # | Tool | Minimum oracle |
|---:|---|---|
| 1 | Word/character/line counter | literal Unicode fixtures |
| 2 | Whitespace normalizer | literal before/after + idempotence |
| 3 | Invisible-character detector | code-point fixture set |
| 4 | Line sorter | literal locale/byte-order policy fixtures |
| 5 | Line deduplicator | literal duplicates + idempotence |
| 6 | List intersection/difference | hand-worked sets + algebraic properties |
| 7 | Text diff | known before/after diff fixtures |
| 8 | Markdown preview | CommonMark-style examples + XSS corpus |
| 9 | CSV viewer | independent CSV corpus |
| 10 | CSV cleaner | literal dirty→clean fixtures |
| 11 | CSV delimiter/encoding detector | labeled corpus with BOM/known encodings |
| 12 | CSV deduplicator | literal row fixtures + idempotence |
| 13 | CSV column select/reorder | literal schema/row fixtures |
| 14 | CSV filter/sort | literal ordered output + stable-sort policy |
| 15 | CSV to JSON | literal semantic conversion fixtures |
| 16 | JSON to CSV | literal conversion + round-trip semantic check |
| 17 | JSON formatter/validator | native parser/literal invalid corpus |
| 18 | YAML formatter/validator | external parser/conformance corpus |
| 19 | Base64 encode/decode | standard vectors |
| 20 | Hash generator | published algorithm vectors |
| 21 | UUID generator | version/variant RFC invariants |
| 22 | URL encode/decode | URL Standard/hand-worked fixtures |
| 23 | Query-string editor | repeated-key and encoding fixtures |
| 24 | Unix timestamp converter | known epoch instants |
| 25 | Business-day calculator | hand-worked calendars |
| 26 | Timezone converter | known instants around DST |
| 27 | Multi-timezone overlap | hand-worked working-window fixtures |
| 28 | Decimal-hours converter | rational time literals |
| 29 | Hour/day/project rate converter | hand-worked dimensional examples |
| 30 | Effective hourly rate | explicit formula examples |
| 31 | Margin/markup calculator | independent known formulas distinguishing both concepts |
| 32 | Project profitability calculator | hand-worked revenue/cost examples |
| 33 | UTM builder | canonical URL fixtures |
| 34 | UTM parser | canonical query fixtures |
| 35 | Tracking-parameter cleaner | keep/drop allowlist fixtures + idempotence |
| 36 | QR generator | independent QR decoder round-trip |
| 37 | Image resize | decoded dimension/pixel fixtures |
| 38 | Image format conversion | signature + independent decoder |
| 39 | Image compression | decode validity + dimensions + declared quality policy |
| 40 | File hash/checksum verifier | known hashes + chunk-size independence |

## 5. Acceptance levels

### Bronze

- manifest valid;
- core public seam executes;
- one normal-case behavior fixture;
- not public/default indexed.

### Silver

- normal, boundary, invalid and empty cases;
- responsive UI;
- keyboard operation;
- privacy behavior;
- clear errors;
- measured normal-case performance;
- documented current limitations.

### Gold

- independent correctness oracle;
- all declared edge cases automated where practical;
- Tier 1 browser acceptance;
- Tier 1 mobile acceptance;
- accessibility gate;
- privacy/capability gate;
- bundle budget;
- offline behavior matching manifest;
- no open correctness bug;
- certification receipt tied to exact tool behavior/version.

## 6. Required fixture dimensions by class

### Text/list

- empty;
- ASCII;
- composed/decomposed Unicode;
- emoji/grapheme-sensitive cases where count semantics claim them;
- CRLF/LF;
- huge line;
- huge line count;
- duplicates differing only by configured normalization rule.

### CSV/table

- commas/semicolons/tabs;
- quoted delimiter;
- quoted newline;
- escaped quote;
- BOM;
- empty fields;
- ragged rows;
- duplicate headers;
- large row count;
- large cell;
- invalid encoding/corrupt bytes;
- cancellation during parse/transform.

### Date/time

- epoch boundary;
- leap day;
- month/year boundary;
- DST forward gap;
- DST backward overlap;
- negative timestamps if supported;
- timezone aliases/canonical IDs policy;
- locale display separately from calculation.

### Business math

- zero;
- negative where meaningful;
- exact decimal;
- rounding boundary;
- invalid denominator/division-by-zero;
- explicit currency precision policy;
- formula assumptions shown in result.

### Image/file

- zero-byte/corrupt;
- mislabeled extension;
- large dimensions;
- small file;
- large file near soft limit;
- hard limit;
- unsupported codec;
- metadata/orientation cases;
- cancellation;
- worker/runtime failure.

## 7. Failure injection matrix

The suite should include explicit failure injection at real seams:

| Injected condition | Expected observable behavior |
|---|---|
| IndexedDB denied/unavailable | tool still runs; persistence feature reports unavailable |
| Storage quota exceeded | failed save is visible; current in-memory result preserved |
| Offline during sync | local state remains usable; unsynced revision retained |
| 409/version conflict from sync | deterministic conflict state; no silent overwrite |
| Fetch timeout for REFERENCE tool | cached stale behavior or explicit unavailable state per manifest |
| Worker terminated | normalized runtime failure; no infinite progress |
| WASM fetch fails | declared fallback or unsupported result |
| AbortSignal before start | no work starts |
| AbortSignal mid-job | cancelled result; no completion success |
| Image decoder rejects bytes | corrupt-input error |
| File exceeds hard limit | preflight rejection before heavy allocation |
| Clock advanced beyond data freshness | stale badge/state and policy-defined behavior |
| Gold manifest missing oracle | catalog/certification build fails |
| LOCAL tool declares network capability | policy build fails |

## 8. Performance acceptance

Performance tests should be user-job oriented.

### Simple tools

Measure:

- route-open to interactive;
- keystroke/input to updated result for normal input;
- main-thread long tasks;
- lazy chunk bytes;
- memory for representative input.

Acceptance intent:

- result feels immediate after route load;
- normal input does not create a >50 ms main-thread task;
- opening the catalog or another tool does not preload this tool's heavy dependencies.

### Heavy tools

Measure:

- runtime load time separately from processing time;
- first real progress signal;
- cancellation latency;
- peak memory on representative desktop/mobile devices;
- output validation time.

Do not optimize against synthetic microbenchmarks while ignoring user-perceived blocking.

## 9. Bundle and lazy-load acceptance

Required assertions:

- increasing catalog metadata by N tools does not add N tool implementations to shell bundle;
- opening tool A does not fetch unrelated engine B;
- a shared engine is deduplicated by the bundler;
- worker/WASM assets are absent until needed;
- service-worker precache does not balloon with all tool chunks;
- an explicit offline-installed tool becomes available after network loss if manifest promises FULL offline.

The exact byte budget is set after shell/build technology selection. CI should track both absolute and delta sizes from the first implementation wave.

## 10. Accessibility acceptance

Use a combination of automated checks and real interaction.

Required public behavior:

- tool can be opened, filled, executed, reset and result copied/downloaded by keyboard;
- visible focus never becomes trapped or lost;
- label and error text is exposed to assistive technology;
- progress/cancel state is announced without excessive live-region spam;
- table results retain meaningful header relationships;
- diff output has a non-color-only representation;
- image tools expose dimensions/format as text;
- at 200% zoom/reflow the primary job remains possible;
- reduced-motion preference removes nonessential motion.

Automated accessibility tooling is necessary but not sufficient for Gold.

## 11. Privacy acceptance

### LOCAL

- no network request occurs during fixtures and browser acceptance;
- no tool payload appears in analytics;
- no implicit persistence occurs;
- same job works signed-out.

### REFERENCE

- only declared lookup fields are observed leaving the browser;
- source and freshness are visible;
- offline/stale behavior matches manifest.

### REMOTE / AI

- transfer disclosure appears before first content upload;
- cancel/decline leaves content local;
- transmitted payload matches declared fields;
- provider failure has no silent fallback to a different provider;
- analytics still excludes content.

Network inspection in browser tests is an appropriate system-level oracle here.

## 12. Gold certification pipeline

Proposed sequence:

```
manifest validate
   ↓
public-seam unit/integration tests
   ↓
independent-oracle fixtures
   ↓
privacy + capability policy
   ↓
dependency/license scan
   ↓
bundle/lazy-load checks
   ↓
browser accessibility acceptance
   ↓
desktop/mobile matrix
   ↓
offline/heavy failure tests where declared
   ↓
Gold receipt generated
   ↓
public catalog eligible
```

A failure at any required stage leaves the tool unpublished or at its prior certified version.

## 13. Dependency acceptance

Any new runtime dependency for a tool engine must answer:

- Which browser/native option was evaluated?
- Which required behavior could not be met safely/correctly?
- Is the dependency loaded lazily?
- What is its compressed bundle/WASM cost?
- Does it pull transitive dependencies?
- Is the license acceptable and recorded?
- Is it maintained?
- Is there a smaller equivalent?
- Is untrusted input involved and what is the security history/posture?
- Can the tool be disabled/retired without affecting the shell?

Candidate dependency classes to spike before Wave A implementation:

- CSV parser;
- YAML parser;
- Markdown parser and sanitizer;
- QR encoder;
- incremental hashing implementation.

Do not add date, UUID, query-string, generic utility or state libraries without proof that the platform/native implementation fails the required acceptance.

## 14. Suggested TDD order for the integrated wave

Do not write the entire framework and then the tools. Use tracer bullets.

1. **Catalog tracer:** one manifest compiles to searchable metadata and a lazy import.
2. **Runtime tracer:** one simple tool runs through the public runtime seam with exact result/error handling.
3. **Profile tracer:** one declared profile field is visibly injected and overridden.
4. **Handoff tracer:** output from the tracer tool is proposed to one compatible target without direct imports.
5. **Persistence tracer:** save one explicit preset through the persistence seam.
6. **Heavy tracer:** one worker-backed job proves progress/cancel without polluting the simple path.
7. **Gold tracer:** the same tool obtains a generated certification receipt.
8. Only then fan out by primitive engine and tool wave.

This sequence exercises the architecture with minimal speculative surface while preserving the red → green discipline.

## 15. Definition of acceptance for Lane 05 architecture

The next planning wave has enough information to create implementation tickets when:

- S1–S10 are explicitly accepted or revised;
- the 10 Wave A engine families are accepted;
- each first-40 tool has an independent oracle plan;
- failure behavior is defined for mobile, memory, unsupported APIs, large files, corrupt input, stale data and sync failure;
- privacy classes map to enforceable capabilities/policies;
- dependency exceptions have measurable selection gates;
- Gold certification can fail closed;
- bundle growth is measured at shell, tool and shared-engine levels;
- implementation proceeds in vertical TDD slices rather than horizontal framework construction.
