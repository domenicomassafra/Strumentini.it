# Product definition synthesis — pre-design

Date: 2026-09-23

Status: integrated working authority from completed lanes 01, 02, 03 and 05.
Pending before implementation planning: lane 04 product-design response.

## What exists today

StrumentiUtili.it is **not yet an implemented product**.

There is currently:

- no application shell;
- no package manifest;
- no TypeScript/JavaScript production source;
- no HTML product;
- no build system;
- no deployed site.

What exists is a substantial product-definition corpus:

- demand/job research;
- competitor and business-model research;
- naming/brand/GTM research;
- a 200-tool candidate catalog;
- catalog prioritization;
- Tool Factory quality standard;
- concrete engineering architecture;
- TDD seams and Gold-certification plan.

## Current product thesis

Do not build or market a generic online toolbox.

The strongest surviving thesis is:

> **A personal utility workbench for the small jobs behind knowledge work.**

Candidate value claim:

> **Your everyday work tools, already set up for your work.**

The catalog is supply infrastructure. The user-facing product should remain small, relevant and configured.

## What the evidence does NOT support

Completed research does **not** establish broad demand for a generic persistent “knowledge-worker utility workspace”.

The persistent-workspace thesis remains a falsifiable hypothesis.

Reject or radically narrow it if real product experiments show:

- generated workspaces do not reduce time-to-right-tool;
- Work Profile defaults are rarely reused;
- users return only through search and not through Your Tools/Recent;
- packs are confusing or unrelated to retention;
- users prefer a few bookmarks/Raycast/native apps;
- tool-to-tool handoff is rarely used;
- profile/local-first advantages do not change behavior;
- 30-day retention is no better for personalized users than anonymous one-off users.

## Strongest demand wedges

Lane 01 identified five evidence-supported pack territories.

### 1. Client Work

For freelancers, consultants, service businesses and small agencies.

Tool families:

- rate/effective-rate;
- scope delta;
- margin/markup/profitability;
- proposal budget sanity;
- utilization/capacity;
- timezone overlap;
- business days;
- invoice-math validation;
- file/PDF handoff.

Persistent context:

- currency;
- timezone;
- workweek;
- rates;
- billable assumptions;
- client presets.

### 2. Campaign Ops

For marketers, growth operators, small agencies and hands-on founders.

Tool families:

- campaign naming;
- UTM build/parse/clean;
- URL normalize/group;
- audience CSV clean/map/dedupe;
- metric scenarios;
- image resize/compress presets.

Persistent context:

- naming conventions;
- source/medium vocabulary;
- casing;
- destinations;
- platform asset presets.

### 3. Data Cleanup

For operations, analysts, marketers, agencies, researchers and export-heavy workers.

Tool families:

- CSV inspect/detect;
- clean;
- dedupe;
- column map;
- filter/sort;
- profile;
- list set operations;
- CSV/JSON.

Core test:

> Must be materially faster than opening a workbook and building a query for the target jobs.

### 4. Research Evidence Prep

For researchers, graduate students, evidence analysts and source-heavy writers.

Tool families:

- citation dedupe;
- deterministic metadata normalization;
- RIS/BibTeX conversion;
- DOI/ISBN normalization;
- URL cleanup/domain counting;
- timeline/date normalization;
- evidence-table prep.

### 5. File & Asset Handoff

Cross-segment, especially client services and creators.

Tool families:

- image resize/convert/compress;
- PDF split/reorder/extract;
- metadata inspect/remove;
- batch rename preview;
- checksum;
- file-list diff;
- handoff manifest.

## Product architecture principle

Build **families/engines**, not hundreds of isolated pages.

The strongest current engine families are:

- Table engine;
- URL/Campaign engine;
- Client-work math engine;
- Capacity/Date-Time engine;
- Research-reference engine;
- File-handoff engine;
- Structured-data engine;
- Encoding/Crypto engine;
- Image pipeline;
- Text/List engine.

The first 40 candidate tools should map to at most ~10 primary primitive engines.

## Differentiation that survived competitor research

Do not claim uniqueness from:

- 200+ tools;
- free access;
- client-side/privacy;
- favorites;
- command palette;
- smart paste;
- profession categories;
- professional packs;
- workflow chaining;
- generic workspace language;
- freelancer-OS positioning.

The combination worth testing is:

1. role/profession-aware setup;
2. generated **small installed toolbox**;
3. transparent reusable Work Profile;
4. executable deterministic tools;
5. installable/removable packs;
6. persistent personal workspace;
7. typed structured context handoff;
8. portable/exportable configuration;
9. web-native local-first execution;
10. optional cloud account primarily for sync.

## Economics

Default posture:

### Phase 0

- free;
- ad-free;
- low-ops;
- browser-local normal path;
- no normal-path LLM dependency;
- anonymous first value;
- minimal privacy-respecting product telemetry sufficient to test the thesis.

### Phase 1

Prove:

- generated toolbox beats manual browsing;
- profile defaults are reused across multiple tools;
- 7/30-day workspace return exists;
- repeat launches come from the workspace;
- at least four role packs have materially different installed sets.

### Phase 2

Choose economics from evidence:

- high traffic + weak return → free brand/acquisition asset; optional content-surface ads/sponsors;
- high return + sync demand → optional paid sync/multi-profile;
- team/private-pack demand → optional team services;
- strong OSS contribution quality → expand open surface.

Ordinary deterministic utilities may remain free forever.

## Brand status

StrumentiUtili.it is the selected public brand.

Historical Lane 03 preliminary shortlist, retained only as decision history:

- Plerova
- Tivanoa
- Lervio
- Tevalo
- Niveli
- Ralvoa
- Seviro
- Taveli
- Sivela
- Nolda

Plerova and Tivanoa had the cleanest bounded namespace observations in that historical lane, but **neither is selected**.

The owner selected StrumentiUtili.it; any formal legal/trademark clearance is tracked separately.

## Engineering architecture already settled enough to preserve

- static/PWA browser-first architecture;
- TypeScript-oriented implementation;
- compile-time-known catalog, not runtime executable plugins;
- generated compact metadata plus tool-level dynamic imports;
- deterministic/local-first Tool Runtime;
- Work Profile fields declared explicitly and visibly overridable;
- typed Context Handoff instead of direct tool-to-tool imports;
- network access isolated behind explicit adapters/policy;
- optional sync as small control plane;
- ads isolated from runtime/workspace;
- first 40 backed by shared engines;
- Gold certification fails closed on correctness/privacy/browser/mobile/accessibility/bundle/oracle gates.

## What lane 04 can still legitimately change

Do not freeze these until design response arrives:

- information architecture;
- onboarding flow and wording;
- home/workspace hierarchy;
- how Library/Packs/Profile are exposed;
- desktop/mobile navigation;
- command-first vs dashboard-first balance;
- tool-page anatomy;
- visual system;
- shell interaction model;
- any prototype-backed design decision.

The engineering runtime should remain UI-framework-independent until this design input is reconciled.

## Next execution sequence

After lane 04 terminal response:

1. ingest design artifacts;
2. reconcile design against this synthesis;
3. resolve implementation-blocking owner decisions;
4. freeze a backlog-ready product/engineering spec;
5. run plan-tickets;
6. verify 100% requirement coverage and a valid dependency DAG;
7. start only the unblocked tracer-bullet implementation frontier;
8. use code-implement plus agreed TDD seams;
9. run code/design/QA review before any claim that the product works;
10. deploy only after a runnable site exists and acceptance proof is green.

## Implementation readiness

Current readiness:

- research: high;
- demand confidence: medium / intentionally falsifiable;
- positioning: medium-high;
- brand name: unresolved;
- architecture: high;
- design/UX: pending lane 04;
- ticket DAG: not yet created;
- production code: none;
- runnable site: none;
- deployment: none.
