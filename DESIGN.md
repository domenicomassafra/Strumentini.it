# StrumentiUtili.it — Canonical Product Design

Status: implementation design authority for the first validation build
Date: 2026-09-23
Source authority: reconciles `design/lane-04/UX-BLUEPRINT.md`, `design/lane-04/DESIGN-SYSTEM-CANDIDATE.md`, and the canonical product constraints in `PRODUCT-SPEC.md`.

The lane-04 prototype remains evidence, not production code:

- `design/lane-04/prototypes/quiet-workbench.html`

## 1. Design outcome

The accepted product concept is **Personal Workbench**.

The product must make a large underlying catalog feel small, relevant, and ready. The visible daily experience is the user's installed set, not a catalog wall. Search/command is available everywhere. Input recognition may later accelerate file/text/URL jobs, but it is not the homepage concept.

Design north star:

> I arrived for one tiny job and the product already feels set up for the way I work.

The interface should feel like a calm professional instrument: precise, compact, explicit, and fast. It should not look like an AI dashboard, SEO utility farm, generic SaaS template, card mosaic, or literal toolbox.

## 2. Information architecture

Two layers are deliberately distinct:

### Workbench — what I use

- Your Tools
- Recent
- Suggested additions
- active pack context where useful
- Work Profile defaults at the point they matter

### Library — what exists

- Search
- compact result list
- categories as facets
- packs
- role/job collections
- input/runtime/installed filters

**Rule:** Workbench is the product. Library is supply infrastructure.

### Anonymous flow

```
public/search link
      ↓
tool route
      ↓
complete immediate job
      ↓
optional “Add to my tools”
      ↓
optional starter-workspace setup
```

No onboarding modal may interrupt first task completion.

### Local personalized flow

The first validation build has no account/sync. References in older design artifacts to a “signed-in” shell become a **local personalized shell**:

```
Desktop
┌───────────────┬─────────────────────────────────────┐
│ Brand/mark    │ Global Search / Cmd/Ctrl-K          │
│               ├─────────────────────────────────────┤
│ Your Tools    │                                     │
│ Recent        │          active work surface        │
│               │                                     │
│ Packs         │                                     │
│ Library       │                                     │
│               │                                     │
│ Work Profile  │                                     │
└───────────────┴─────────────────────────────────────┘
```

Account/sync affordances are absent rather than disabled.

## 3. First-run onboarding

Onboarding generates a starter set; it does not explain product features.

### Promise

Suggested working copy:

> Build your everyday tool set in about a minute.
> Start with a small set. Change anything later.

Primary: **Set up my tools**
Secondary: **Skip — browse the Library**

### Stage 1 — Work context

Choose up to three:

- Consulting / client services
- Marketing / growth
- Content / creator work
- Research / academia
- Development / data
- Office / operations
- Finance / business admin
- Something else

An optional one-line free-text context may be tested later, but the deterministic first implementation must not depend on it.

### Stage 2 — Recurring small jobs

Choose up to eight task phrases. Options adapt to Stage 1 while remaining searchable. Use verbs/jobs, not internal categories.

Examples:

- clean tables / CSVs
- compare text or lists
- resize images
- build or clean URLs
- calculate rates / margins
- plan business days
- work across timezones
- prepare client handoffs
- research / citation cleanup

### Stage 3 — Safe defaults

Only values that can remove repeated setup:

- locale;
- timezone;
- currency;
- date format;
- number format;
- workweek;
- preferred units.

Use browser/device derivation when safe but always show/edit the value. Advanced defaults such as a rate or campaign naming convention are collected only when a relevant tool makes their value obvious.

### Stage 4 — Starter-set review

Show 10–15 checked recommendations. Each item includes:

- tool name;
- one-line task;
- one short structured reason;
- pack/source context when relevant.

The user can remove, add, search, or accept. Do not use “AI generated this” language.

### Questions deliberately excluded

Do not ask during first run for:

- name;
- company/employer;
- team size;
- annual revenue;
- detailed industry;
- newsletter/notification preferences;
- theme;
- exact rate unless a selected tool needs it;
- every possible file type;
- pack selection before the user understands packs.

## 4. Workbench

### Your Tools

Target 10–15 installed tools, represented as compact rows/slots rather than marketing cards.

Each row:

```
[glyph] [tool name + optional task] [reason/default/pack meta] [runtime] [Open]
```

Rules:

- no auto-grouping at <=12 items;
- lightweight grouping may appear above that;
- manual reorder is allowed;
- remove/add is secondary but easy to reach;
- no KPI cards, streaks, scores, activity charts, or “productivity” furniture above the tools.

### Recent

Recent records tool launches/completions, not raw task data.

Show tool + relative time + Run again. A safe summary is allowed only when generated locally and the user explicitly enables such history. Provide clear-history.

### Suggestions

Show at most 2–4. Every suggestion has one visible deterministic reason, for example:

> Because you chose Marketing + URLs.

No confidence percentages, generated paragraphs, or anthropomorphic language.

## 5. Search and command

Desktop shortcut: `Cmd+K` on macOS, `Ctrl+K` elsewhere. Mobile uses an explicit Search destination.

Search metadata comes from the catalog compiler and includes:

```
id
name
short_task
verbs[]
aliases[]
category
input_types[]
output_types[]
pack_tags[]
role_tags[]
runtime
network_behavior
profile_fields_used[]
handoff_accepts[]
handoff_emits[]
keywords[]
```

Ranking order:

1. exact installed-tool match;
2. strong task-intent match;
3. recent tool;
4. installed-pack relevance;
5. general catalog match;
6. related alternatives.

The palette visually separates **Your Tools**, **Recent**, and **Library**.

Zero results:

- preserve query;
- offer 2–4 close intents if metadata supports them;
- expose Request this tool;
- never replace deterministic matches with generated AI prose.

## 6. Library and packs

### Library

Default is a dense result list, not a 4-column card grid.

Controls:

- search;
- result count;
- category;
- pack/role;
- input type;
- local/network runtime;
- installed/not installed.

At larger catalog sizes, paginate or virtualize after roughly 50 visible rows. Preserve filter/search/scroll state through navigation and make search/filter state URL-addressable where practical.

### Packs

A pack is a curated install set.

Pack detail contains:

- audience/job statement;
- curator/source;
- tool count;
- tool list with reasons;
- already-installed count;
- per-tool checkboxes;
- **Add recommended** primary action;
- related Work Profile defaults shown separately.

No blind “install 40 tools”. Normal pack target remains about 8–15 core tools plus optional extras.

## 7. Individual tool anatomy

Every tool route has four layers in this order:

1. **Task** — what this tool does;
2. **Work surface** — input, primary operation/result;
3. **Context** — profile defaults, runtime, compatible handoff;
4. **Trust/depth** — methodology, limits, docs, related tools.

Representative desktop anatomy:

```
Breadcrumb                                         [Added ✓]

Tool name
Verb-first task sentence
[Runs on this device] [EUR · from Work Profile]

┌ Input/configuration ─────────────┬ Result ───────────────────┐
│ persistent labels               │ result first              │
│ visible inferred defaults       │ Copy / Download / Export  │
│ file/paste controls if relevant │                            │
└─────────────────────────────────┴───────────────────────────┘

Next useful action
→ compatible tool

Why these defaults
Privacy/runtime detail
Methodology / limitations
```

Layouts adapt by job:

- text/data transform: input/output panes;
- calculator: form + result summary;
- file batch: queue then operation/results;
- compare: A/B plus result;
- lookup: query then results.

Do not force one generic two-card template onto every tool.

### Inputs

- labels persist above controls;
- units sit adjacent to numbers;
- inferred/profile values are visually distinct;
- drag/drop always has a button/keyboard equivalent;
- destructive transforms prefer preview before download;
- sample data never masquerades as real prefilled user input.

### Outputs

Keep output adjacent on desktop and immediately after the operation on mobile. Actions appear only when relevant: Copy, Download, Replace input, Reset, Send to next tool.

### Work Profile provenance

Example:

> EUR · from Work Profile

The value is editable inline. A current-task override is authoritative until the user explicitly changes/saves it.

### Runtime labels

Use mechanics, not trust theater:

- **Runs on this device**
- **Uses network data**
- **Uploads file for processing**

V1 first-set tools should be LOCAL unless a later ticket explicitly changes the manifest and disclosure.

### Handoff

Prioritize useful next actions, not “people also used”.

Example:

> Cleaned 83 rows. Next: **Find duplicates**.
> Send the cleaned table — 83 rows, no file history.

The user explicitly confirms. Handoff never implies a background automation/workflow system.

## 8. Interaction states

Every applicable tool design must cover:

- empty;
- valid input;
- invalid input;
- processing;
- success;
- partial success;
- no result;
- unsupported format;
- too-large input;
- capability unavailable;
- cancellation;
- runtime/privacy detail;
- profile default applied;
- profile default overridden;
- handoff available/incompatible.

Search/Library must additionally cover empty query, zero result, typo/alias, single result, many results, installed result, and capability-limited result.

No fake progress. Sub-100 ms local operations update immediately; perceptible operations use truthful processing/progress and cancellation when meaningful.

## 9. Responsive hierarchy

### Desktop

- rail: 216–248 px;
- page gutters: 24–32 px;
- normal work surface max width: 1120–1280 px;
- data-heavy surfaces may use available width;
- optional contextual panel: 280–340 px only when it earns its space.

### Tablet

- rail becomes a compact drawer;
- retain two panes only when each remains at least ~320 px;
- otherwise switch to a single ordered operation flow.

### Mobile

Mobile is not a stacked desktop sidebar.

Bottom navigation, maximum four:

- Tools
- Search
- Library
- You

Recent lives inside Tools. Packs live inside Library. Work Profile lives inside You.

Workbench order:

1. compact search trigger;
2. Your Tools;
3. Recent;
4. small Suggestions section.

Tool page order:

1. title + runtime;
2. task;
3. input;
4. primary action;
5. result;
6. output/handoff actions;
7. defaults and methodology.

Mobile file flows use Files/Photos pickers where relevant. Drag/drop copy is never the primary mobile instruction.

## 10. Quiet Workbench design system

The structural system is accepted. Brand-sensitive tokens remain candidates.

### Character

- calm precision at professional density;
- industrial/utilitarian softened by warm neutral surfaces;
- minimal decoration;
- one restrained action accent;
- motion only when it explains state.

Avoid:

- generic SaaS gradients;
- glassmorphism;
- giant rounded cards;
- bento-dashboard furniture;
- neon/AI palettes;
- literal wrench/toolbox imagery;
- animation that delays work.

### Typography

Candidate implementation pairing:

- UI/display: Instrument Sans with robust system fallbacks;
- data/code: IBM Plex Mono with robust monospace fallbacks.

These fonts are not a public identity decision. If bundling them creates licensing/performance friction, use system fallbacks without changing the hierarchy.

Type scale should remain compact: roughly 15 px body, 13 px secondary, 12 px metadata, 22–30 px application headings. Sentence case by default.

### Color and surfaces

Candidate light structure:

- warm neutral canvas;
- white work surface;
- near-black text;
- gray dividers;
- one blue action accent;
- semantic success/warning/danger only when meaning requires it.

The exact lane-04 hex palette may seed implementation tokens but is not brand-locked under C-22.

### Shape and elevation

- 4 px spacing basis;
- controls mostly 6 px radius;
- grouped/dialog surfaces around 10 px;
- list rows usually need separators, not cards;
- shadows are reserved for palette/popover/dialog layers.

### Components

The canonical reusable product vocabulary includes:

- AppRail, MobileBottomNav, GlobalSearchTrigger, CommandPalette;
- ToolRow, RecentRow, SuggestionRow, ReasonLabel;
- LibrarySearch, FilterBar, ToolResultRow, ZeroResultsState;
- ToolHeader, RuntimeBadge, ProfileDefaultBadge, Field, FilePicker, ResultPanel, ResultActionBar, HandoffRow, MethodologyDisclosure;
- PackHeader, PackToolChecklist, PackInstallSummary;
- ProfileField, UsedByList, LocalStateBadge, OverrideExplanation;
- InlineError, Banner, Toast, Progress, EmptyState, CapabilityWarning, ConfirmationDialog.

This is a vocabulary, not a mandate to create one source file/class per name.

## 11. Accessibility contract

Target WCAG 2.2 AA and real interaction, not automated-score theater.

Required:

- 4.5:1 body text contrast and appropriate UI/large-text contrast;
- 44×44 px touch targets where touch applies;
- persistent form labels;
- semantic landmarks/headings;
- visible focus;
- keyboard completion of every core action;
- command palette combobox/listbox semantics and focus restoration;
- no hover-only core actions;
- drag/drop equivalent controls;
- errors associated with fields and an error summary for complex forms where useful;
- progress/status exposed without live-region spam;
- non-color-only diff/state representation;
- 200% zoom/reflow without functional loss;
- reduced-motion support;
- resilience to long localized strings.

## 12. Trust, content, and advertising

Trust belongs near the relevant action.

Good:

> Runs on this device. The file is not uploaded.

Bad:

> Privacy-first. Secure by design.

The first validation build has no ads. A future ad experiment, if evidence ever justifies it, may use public editorial/library surfaces but not forms, input-result gaps, command palette, onboarding, Work Profile, or sensitive utilities.

Public/marketing surfaces may use more whitespace/larger typography, but they must still show a real product/workbench example and avoid generic benefit-card/gradient-hero patterns.

## 13. Design verification checklist

A screen is implementation-ready only when:

- primary action is apparent within seconds;
- catalog breadth is hidden until intentionally requested;
- Search is visible or one obvious action away;
- installed vs catalog state is distinct;
- profile defaults show provenance;
- runtime/privacy behavior is near the operation;
- empty/loading/success/error/cancel states are specified;
- keyboard and touch paths exist;
- 390 px and 200% zoom preserve task completion;
- decoration never competes with work;
- panels/cards earn their boundary;
- no AI is present without measurable task value.

## 14. Deliberately unresolved design items

These are **not** blockers for the first implementation:

- final public brand name, logo, type license/source, and accent;
- whether optional free-text onboarding materially improves recommendations;
- whether Input Router deserves a visible top-level affordance;
- whether users want manual groups inside Your Tools;
- whether handoff usage justifies persistent UI beyond contextual next actions;
- whether ads are ever worth their trust/clutter cost.

The first validation build must instrument/observe the behavioral questions instead of pretending they are settled.
