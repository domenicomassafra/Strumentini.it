# UtilityOS UX Blueprint

Status: product-design candidate, not production specification
Date: 2026-09-23
Lane: lane-04-product-design
Scope: information architecture, interaction model, onboarding, tool anatomy, responsive hierarchy, and catalog-scale behavior

## Executive decision

The product should not present itself as a directory of 200–500 utilities.

The recommended shape is a **personal workbench with a universal command/search layer**:

- the default signed-in home shows roughly 8–15 installed tools;
- recent work and a small number of evidence-based additions sit beside the installed set;
- the full catalog is a secondary Library surface;
- search is always available and works by task, synonym, input type, tool name, pack and category;
- onboarding creates the first useful workspace instead of teaching the product;
- every recommendation can state a short deterministic reason;
- tool pages are operational surfaces, not SEO articles with a form buried in them;
- mobile is a first-class working surface, with task-first navigation rather than a collapsed desktop sidebar.

This direction intentionally combines the strongest observed patterns from Raycast, Setapp, ToopTools and modern utility suites without copying their product models. The key distinction is that the workspace is **generated from the user's work context and shares safe defaults across executable utilities**.

## Design thesis

### What must be memorable

> I arrived for one tiny job and the product already feels set up for the way I work.

This is more important than remembering a visual gimmick, the size of the catalog, or an AI feature.

### Product posture

The interface should feel like an instrument panel:

- calm;
- precise;
- fast;
- dense enough for professionals;
- visually quiet;
- explicit about privacy and runtime behavior;
- easy to scan;
- easy to operate by keyboard;
- never dependent on a chat box.

The product should not feel like:

- a marketplace homepage;
- a generic SaaS dashboard;
- a tile wall;
- a content farm;
- an AI assistant;
- a literal toolbox;
- a 200-card mega-menu.

## Current competitor UX teardown

Research performed 2026-09-23. These references are used as interaction evidence, not as claims that every behavior is unique.

| Product | First impression | Discovery / search | Personal surface | Packs / curation | Tool / item anatomy | Mobile | Trust / ads | Useful lesson |
|---|---|---|---|---|---|---|---|---|
| [ToopTools](https://tooptools.com/) | Strong breadth claim, then category browse | Categories plus workspace entry; full catalog is prominent | Local pinned workspace and reorderable favorites | Category-led, not profession-led | Simple direct tools with local-processing messaging | Responsive web; workspace persists per browser | Local/browser processing is a major proof point; site says unobtrusive ads support free use | A personal workspace is already expected; merely adding favorites is not enough differentiation |
| [SolveKit](https://usesolvekit.com/) | “The tool you need. Nothing you don't.” reduces directory feel | Search plus numbered category index | Less person-specific than UtilityOS target | “Workspaces” group tools into whole-job flows | Utilities are grouped around concrete outcomes | Responsive web | Private-by-default language is concise | Multi-tool workflow groupings are more useful than arbitrary categories when the job has a natural sequence |
| [TinyWow](https://tinywow.com/tools) | Broad free-tool catalog, strongly category/content oriented | Search over many tools | No meaningful personal workbench in the researched surface | Category grouping | Tool pages center the transformation but the ecosystem carries content/ads | Responsive web | Free tier is ad-supported; uploads are server processed for many tools and deleted after a stated retention window | Ads and breadth can fund acquisition, but they increase trust and clutter pressure around working surfaces |
| [Raycast](https://manual.raycast.com/search-bar) | Search is the product entry point | Root Search, live filtering, aliases, Action Panel, keyboard shortcuts | Favorites live above other results | Store extensions are installable modules | Commands are terse and action-oriented | Native mobile story is separate from the desktop launcher model | No ad-first interaction pattern | Universal search can scale to thousands if ranking is strong, but command-first alone is too opaque for first-time web users |
| [Raycast Store](https://manual.raycast.com/extensions) | Curated extension ecosystem | Search by name, command, keyword or category | Installed extensions become part of root search | Explicit install/uninstall model | Store detail includes description, commands, screenshots and author | Platform-specific compatibility is surfaced | Compatibility is explicit before install | “Install” is a useful mental model for keeping a large catalog out of the daily surface |
| [Setapp](https://support.setapp.com/hc/en-us/articles/213587729-Discover-Setapp-apps) | Curated catalog rather than raw volume | Search accepts app names or functionality; category and subcategory browse | “Recommended for you,” installed apps and Explorer sections | Collections are small groups; Setapp guidance says roughly ten is ideal and caps most collections at 15 | Detail pages show purpose, screenshots, features and metadata | Mac/iOS/Web filters are explicit | Paid membership means no ad pressure in the core browser | Small curated collections and task-language search are stronger than giant category grids |
| [smarterfaster](https://www.smarterfaster.app/) | Profession-first workspace proposition | Dashboard pages rather than a universal utility search | AI/import-built personal workspace | 43+ profession packs with hundreds of links | Primarily links/widgets rather than executable deterministic utilities | Desktop-first product positioning | Local SQLite / no telemetry is central | Profession onboarding and packs are not novel by themselves; UtilityOS must win on executable utilities, defaults and low ceremony |
| [IT-Tools](https://it-tools.tech/) / [project](https://github.com/CorentinTh/it-tools) | Developer utility collection with consistent shell | Header search / Cmd-K pattern, categories, fuzzy discovery | Favorites can be pinned and reordered | Category-led | Consistent one-tool forms and fast outputs | PWA/responsive patterns are useful references | Open source and browser-local behavior build trust | Consistency across many tools matters more than decorative variety; favorites/search are table stakes |
| [ToolDock](https://tooldock.org/) | Browser-local developer utility suite | Cmd-K plus “Smart Paste” that infers likely tools from pasted content | Search-oriented rather than profile-oriented | Category browse | Fast direct tool entry | Responsive web | No-signup and local-processing claims are foregrounded | Input recognition is valuable as a secondary shortcut, but cannot replace browse/search for no-input jobs |
| [Omni Calculator](https://www.omnicalculator.com/mobile-app) | Vast calculator corpus | Fast search across tools and categories | Mobile app exposes pinned favorites and recents | Category taxonomy at very large scale | Calculator variables can act as inputs/outputs; documentation is integrated | Mobile app explicitly prioritizes search, pinned and recent calculators | Strong editorial/methodology layer | Even a 3,700+ item catalog can stay usable when recents, favorites, search and categories are first-class |

### Cross-competitor conclusions

Patterns now close to table stakes:

1. global search;
2. favorites or pinned items;
3. categories;
4. local-processing/privacy claims where technically possible;
5. recently used items;
6. responsive layouts;
7. small curated groups or collections.

Therefore UtilityOS should not position any of those alone as the product innovation.

The stronger UX hypothesis is the combination of:

1. anonymous first value;
2. profile-informed starter workspace;
3. 8–15 visible installed tools instead of the catalog;
4. shared visible defaults;
5. deterministic recommendation reasons;
6. packs that install executable utilities;
7. search that understands tasks, aliases and input types;
8. structured tool-to-tool handoff;
9. portable workspace configuration;
10. local execution whenever the tool allows it.

## Information architecture

### Top-level model

The product has two conceptual layers:

**Workbench — what I use**

- Your Tools
- Recent
- Suggested additions
- active pack memberships
- Work Profile defaults when relevant

**Library — what exists**

- Search
- categories
- packs
- all tools
- new / recently added
- role and job collections

The Library is infrastructure. The Workbench is the product.

### Anonymous visitor

Primary jobs:

1. complete the immediate task;
2. understand whether the tool is private/local/server-processed;
3. discover that a personal workspace exists without being forced to create one.

Anonymous global shell:

- brand;
- universal search;
- Library;
- privacy/runtime explainer;
- optional “Build my workspace” CTA;
- no forced account CTA before tool completion.

Anonymous tool landing route:

```
search / external link
        ↓
individual tool
        ↓
complete job
        ↓
optional: Add to my tools
        ↓
optional: build starter workspace
```

Do not interrupt an anonymous user with onboarding before the first successful output.

### First-run onboarding

Onboarding is a workspace generator, not a tour.

The user should understand the payoff before answering anything:

> Pick what you do. We'll start you with a small set of useful tools. You can change everything.

Four stages maximum:

1. work context;
2. recurring jobs;
3. safe defaults;
4. starter-set review.

No product-feature slideshow.

### Signed-in / synced user

Desktop navigation:

```
[Brand]
[Search / ⌘K]

YOUR WORK
  Your Tools
  Recent

DISCOVER
  Packs
  Library

bottom
  Work Profile
  Sync status / account
```

The selected tool opens in the main pane. The user never has to re-enter the catalog shell to switch among installed tools.

### Your Tools

Default desktop density: 8–15 installed tools visible without a long scroll.

Representation should be compact rows or slots, not marketing cards. Each item needs:

- glyph;
- tool name;
- one-line task label only when ambiguity exists;
- optional default indicator;
- optional pack source;
- remove/reorder action available but visually secondary.

Grouping:

- no grouping for <= 12 tools unless the user explicitly organizes them;
- lightweight group headers for 13–30;
- never auto-create many empty sections;
- permit manual order;
- optionally offer “By task” grouping without changing saved order.

### Recent

Recent is history of tool openings / completed operations, not storage of user input by default.

Show:

- tool;
- relative time;
- safe non-sensitive summary if the tool can generate one locally and the user has opted into history;
- “Run again”;
- clear-history control.

Default history should avoid retaining file contents, pasted text or secret-bearing inputs.

### Library

The Library serves deliberate discovery.

Primary controls:

- search field;
- compact filter chips;
- result count;
- category facets;
- pack / profession facets;
- input type facets: text, URL, file, image, table, numbers, none;
- runtime facets: local, network-required;
- installed / not installed filter.

Result rows should prioritize:

1. tool name;
2. task sentence;
3. relevant category / pack;
4. runtime badge;
5. Add / Open state.

Do not use a 4-column wall of identical cards as the default 500-item view.

### Packs

A pack is a curated install set, not a folder and not a permission boundary.

Pack detail anatomy:

- pack name;
- one sentence: who it is for and what repeated jobs it covers;
- curator/source;
- tool count;
- list of tools with reasons;
- already-installed count;
- “Add recommended” as primary action;
- per-tool checkboxes before confirmation;
- no blind “install 40 things” behavior;
- related profile defaults the pack can use, shown separately from tools.

Default pack size target: approximately 8–15 core tools, with optional extras below the fold.

### Work Profile

Work Profile is not a social profile.

It contains only values that can save repeated setup:

- locale;
- currency;
- timezone;
- workweek;
- date format;
- number format;
- preferred units;
- optional default rate;
- optional role / work tags;
- optional file/export preferences.

Each field must state:

- which tools can use it;
- whether it leaves the device;
- whether it is synced;
- how to override it.

Avoid collecting employer, company name, legal identity or other context unless a specific tool actually needs it.

### Search / command palette

Desktop shortcut: `⌘K` on macOS, `Ctrl+K` elsewhere.

Mobile: explicit Search tab/button; never rely on keyboard shortcuts.

Search corpus:

- tool names;
- aliases;
- action verbs;
- jobs-to-be-done;
- categories;
- packs;
- input types;
- common natural-language phrases.

Example:

`clean tracking from url` → Tracking Parameter Cleaner
`compare two lists` → List Difference / Intersection
`client is in nyc` → Timezone Overlap
`compress these jpgs` → Image Compressor

Ranking:

1. exact installed tool match;
2. strong task-intent match;
3. recent tool;
4. installed pack match;
5. general catalog match;
6. related alternatives.

The palette should clearly separate:

- Your Tools;
- Recent;
- Library results.

Never let AI-generated narrative push exact deterministic matches lower.

Zero-result behavior:

- preserve the query;
- suggest 2–4 close intents;
- expose “Request this tool”;
- optionally show the closest category;
- never show a blank state.

### Individual tool page

The tool page has four layers in this order:

1. **Task** — what this tool does;
2. **Work surface** — inputs, output, primary action;
3. **Context** — defaults, runtime/privacy, next-tool handoff;
4. **Trust / depth** — methodology, limitations, docs, related tools.

Detailed anatomy:

```
Breadcrumb / category               [Added ✓]

Tool name
One-line task statement
[Runs locally] [Uses Work Profile: EUR · Europe/Rome]

┌ Input / configuration ──────────────────────────┐
│ clear labels                                    │
│ profile-fed values visibly marked               │
│ upload/drop/paste only when relevant            │
└─────────────────────────────────────────────────┘

[Primary action]

┌ Result ─────────────────────────────────────────┐
│ result first                                    │
│ Copy / download / replace / export              │
└─────────────────────────────────────────────────┘

Next useful action
→ Check margin     → Export clean CSV

Why these defaults
Privacy/runtime detail
Methodology / limitations
Related tools
```

#### Task

One sentence, verb-first.

Good:

> Remove tracking parameters from one or many URLs.

Avoid:

> An advanced and powerful utility designed to help modern professionals effortlessly optimize URLs.

#### Inputs

- labels always visible;
- units adjacent to numeric values;
- inferred values visually distinguishable from user-entered values;
- drag/drop is an enhancement, not the only file-selection path;
- sample input is optional and never prefilled into a field that looks real;
- destructive transformations use preview-before-download when feasible.

#### Outputs

Output must appear adjacent to the operation on desktop and immediately after it on mobile.

Common actions:

- copy;
- download;
- replace input;
- reset;
- send to next compatible tool.

Do not bury the result behind a modal if the page has room.

#### Work Profile defaults

A profile-fed value uses a small inline marker:

> EUR · from Work Profile

The user can override it inline.

Never silently reapply the stored default after the user overrides it during the current task.

#### Privacy / runtime badge

Use literal statements:

- **Runs on this device**
- **Uses network data**
- **Uploads file for processing**

The badge opens a concise explanation. Do not use vague shields or “secure” claims without mechanics.

#### Related tools / handoff

Prioritize compatible next steps over “people also used.”

Example:

> Cleaned 83 rows. Next: **Find duplicates** or **Export as JSON**.

Handoff must show what will be passed:

> Send the cleaned table — 83 rows, no file history.

Never imply an automation system.

#### Add / remove

“Add to my tools” is an explicit workspace action.

When already installed:

- show “Added”;
- secondary menu exposes remove and reorder;
- pack membership does not prevent manual removal.

#### Documentation / methodology

For calculations:

- formula;
- assumptions;
- units;
- rounding behavior;
- sources if domain facts are used.

For transformations:

- supported formats;
- what changes;
- what is preserved;
- browser/runtime limits.

For privacy-sensitive operations:

- exact processing location;
- storage behavior;
- network behavior.

### Ads policy

Initial product recommendation: **no ads inside the work surface while validating retention**.

If ads are later introduced to support a free tier:

- never place an ad between input and result;
- never disguise an ad as a tool, pack or recommendation;
- never insert an interstitial before copy/download;
- never use pasted text, filenames, document contents or tool outputs for ad targeting;
- keep ads outside the operational canvas;
- at most one clearly labeled placement per tool page viewport;
- hide ads entirely in privacy-sensitive tools such as token/secret inspectors;
- offer a no-ad paid/supporter option if ads materially fund the service;
- measure task completion and abandonment before expanding inventory.

This deliberately avoids copying the clutter dynamics of ad-funded utility farms.

## Three materially different UX concepts

## Concept A — Personal Workbench

### Core idea

The home screen is the user's installed kit, not the catalog.

Desktop:

- persistent left rail;
- universal search at top;
- 8–15 installed tools as compact slots;
- Recent beneath or beside them;
- 2–4 Suggested additions with explicit reasons;
- active tool opens in-place.

Mobile:

- Your Tools list is the home screen;
- Search is a dedicated bottom-nav destination;
- recents are a compact horizontal/vertical section;
- the active tool becomes a full-screen task page.

### Strengths

- aligns directly with the person-first positioning;
- makes a 500-tool catalog mostly invisible;
- supports repeat use;
- gives packs and onboarding a concrete outcome;
- familiar enough for non-power users;
- works without AI.

### Risks

- the workspace is only valuable if starter recommendations are good;
- too many automatic additions would recreate catalog clutter;
- manual customization must remain simple.

### Best for

The broad target: freelancers, consultants, creators, operators and later general knowledge workers.

## Concept B — Command Surface

### Core idea

The product opens into a large universal search field. Favorites and recents rank above catalog matches. The visible shell is minimal.

Desktop:

- command palette is effectively home;
- installed tools and recent tools appear when query is empty;
- actions and tool switching stay keyboard-first.

Mobile:

- prominent search field;
- recent queries and favorite tools below;
- voice/paste can be optional input methods, not required.

### Strengths

- extremely fast for repeat users;
- scales easily to 500+ tools;
- avoids card-grid entropy;
- keyboard navigation is natural.

### Risks

- poor browseability for people who do not know what exists;
- blank-search state must carry substantial product meaning;
- can feel like a Raycast imitation;
- packs and profile benefits become less visible;
- weaker first impression on the open web.

### Best for

Power users and developer-adjacent segments.

## Concept C — Input Router

### Core idea

The product starts with the thing the user has:

> Paste text, drop a file, enter a URL — or choose a task.

It detects the input shape and proposes relevant tools.

Examples:

- JSON → format, validate, compare, query;
- CSV → clean, dedupe, filter, convert;
- image → resize, compress, inspect metadata;
- URL → clean tracking, inspect redirect, build UTM.

### Strengths

- reduces “which tool do I need?” friction;
- makes families of related tools feel like one surface;
- excellent for file/text/data workflows;
- can expose handoff naturally.

### Risks

- many important jobs start with no artifact: margin calculation, timezone overlap, workday count;
- inference mistakes create uncertainty;
- privacy anxiety rises if a giant drop zone appears before runtime explanation;
- can over-center “magic detection” and undercut the calm deterministic posture;
- ToolDock already demonstrates Smart Paste as a useful shortcut.

### Best for

Data/file-heavy subsets and as an accelerator inside the recommended workbench.

## Concept stress test: 200–500 tools

| Stress case | Personal Workbench | Command Surface | Input Router |
|---|---|---|---|
| 200 tools | Strong: most users see 8–15 | Strong if ranking is good | Strong for input-based tools |
| 500 tools | Strong if Library filters/search remain disciplined | Very strong technically | Detection taxonomy becomes harder |
| New user with vague need | Good via starter workspace + Library | Medium; requires wording a query | Good only if user has an artifact |
| Power user | Strong with ⌘K | Excellent | Good as shortcut |
| Non-technical user | Strong | Medium | Medium–strong when input affordance is obvious |
| Mobile | Strong with explicit nav | Good, but search-heavy | Good for photo/file share flows |
| Pack discovery | Excellent | Weak–medium | Weak |
| Work Profile visibility | Excellent | Medium | Medium |
| Anonymous SEO landing | Excellent: tool page stands alone | Weak home proposition | Medium |
| Avoiding “200 cards” | Excellent | Excellent | Excellent |
| Explainability | Excellent | Strong | Medium because inference must be explained |
| Accessibility | Strong | Strong if keyboard/screen-reader semantics are rigorous | Medium; drag/drop must have equivalent controls |

### Recommendation

Use **Concept A: Personal Workbench** as the product shell.

Borrow two accelerators:

- from Concept B: global command/search available everywhere;
- from Concept C: paste/drop input detection inside Search and relevant tool families.

Do not merge all three into a visually busy homepage. The accelerators should remain optional paths into the same underlying tool catalog.

## First-run onboarding

### Principle

Every question must change one of:

- starter tools;
- pack suggestions;
- safe defaults.

If it does not change those, delete it.

### Screen 0 — Promise

No fields.

> Build your everyday tool set in about a minute.
> Start with a small set. Change anything later.

Primary: **Set up my tools**
Secondary: **Skip — browse the library**

### Screen 1 — What kind of work do you do?

Multi-select, maximum three primary contexts.

Examples:

- Consulting / client services
- Marketing / growth
- Content / creator work
- Research / academia
- Development / data
- Office / operations
- Finance / business admin
- Something else

Optional one-line text:

> Add context, e.g. “I run paid social for ecommerce clients.”

This field may improve ranking but must never be required.

Do **not** separately ask employee/freelancer/consultant unless later evidence proves it changes tools beyond the work context. “Consulting / client services” and “business admin” already capture most initial differences.

### Screen 2 — What small jobs keep coming up?

Choose up to 8.

Seed options adapt to Screen 1, but all remain searchable.

Examples:

- clean tables / CSVs;
- compare text or lists;
- resize/compress images;
- prepare PDFs;
- build/clean URLs;
- calculate rates/margins;
- plan dates/business days;
- work across timezones;
- convert formats;
- inspect developer data;
- prepare client handoffs;
- research/citation cleanup.

Use verbs and jobs, not internal categories.

### Screen 3 — Defaults worth saving

Prefill from device/browser when safe:

- locale;
- timezone;
- currency;
- date format;
- workweek.

Everything is editable.

Copy:

> These only prefill compatible tools. You can override them anytime.

Advanced defaults such as rates should not be requested until a user adds a tool that benefits from them.

### Screen 4 — Your starter tools

Show 10–15 recommendations as a checklist.

Each item has:

- name;
- one-line purpose;
- one explicit reason;
- pack source if relevant.

Example:

> **UTM Builder**
> Because you chose Marketing and “build/clean URLs”.

Actions:

- Add selected tools;
- Remove individual items;
- Add one suggested pack;
- Search the Library.

No “AI generated this for you” headline.

### Questions deliberately excluded

Do not ask during initial onboarding:

- name;
- company;
- team size;
- detailed industry;
- annual revenue;
- goals written as marketing prose;
- notification preferences;
- newsletter opt-in;
- theme preference;
- exact hourly/day rate;
- preferred export formats;
- every file type the user might touch;
- “Which packs sound useful?” before the user understands what a pack is.

Collect later at the point of use if needed.

## Recommendation explainability

Every automatically suggested or installed item must have a reason generated from structured evidence.

Reason sources:

- selected work context;
- selected recurring job;
- installed pack;
- frequently/recently used compatible tool;
- Work Profile capability;
- explicit user search/addition.

Display one short reason:

> Because you selected Research + citation cleanup.

> Added with the Consultant pack.

> Suggested after CSV Cleaner — both work with tables.

Avoid:

- “We think you'll love this”;
- confidence percentages;
- anthropomorphic AI copy;
- generated paragraphs;
- opaque “recommended for you” labels with no cause.

The user can open “Why?” for the full rule:

> You selected “Marketing / growth” and “build/clean URLs” during setup. This tool is tagged for both. Remove this suggestion signal from Work Profile.

## Desktop hierarchy

### Persistent shell

1. left rail — stable location;
2. top search / command entry;
3. main work surface;
4. optional right-side contextual panel only when a tool truly benefits from it.

Recommended widths:

- rail: 216–248 px;
- main max readable width for form-like tools: 1120–1280 px;
- full-width data tools may use the viewport with 24–32 px gutters;
- contextual panel: 280–340 px only when needed.

### Workbench homepage hierarchy

1. **Your Tools**
2. **Recent**
3. **Suggested additions**
4. Library escape hatch

Do not put KPI cards, productivity scores, streaks, “activity” charts or account stats above the tools.

### Tool page hierarchy

Desktop split behavior depends on task:

- text/data transform: input left, output right;
- calculator: form left, result summary right;
- file batch: file queue above, controls/result below or adjacent;
- reference/lookup: query top, results below;
- compare: A/B columns with result pane.

Do not force every tool into one universal two-card template.

## Mobile hierarchy

Mobile is not “sidebar stacked above content.”

### Bottom navigation

Four destinations maximum:

- Tools
- Search
- Library
- You

Recent lives inside Tools. Packs live inside Library. Work Profile lives inside You.

### Mobile workbench

Order:

1. compact search trigger;
2. Your Tools;
3. Recent;
4. one small Suggestions section.

Rows should be at least 48 px high. Touch targets at least 44×44 px.

### Mobile tool page

Order:

1. title + runtime badge;
2. task;
3. input;
4. primary action;
5. result;
6. copy/download/handoff actions;
7. defaults and methodology disclosure.

Sticky bottom action is allowed only when:

- the primary action is unambiguous;
- it does not cover results or mobile browser controls;
- the action state is clear.

### Mobile file flows

Support:

- Files picker;
- Photos picker when relevant;
- camera capture only when it materially helps;
- share-sheet/PWA intake later if platform support is reliable.

Never make drag/drop copy the primary mobile instruction.

## Interaction states that must be designed

For every tool family:

- empty;
- valid input;
- invalid input;
- processing;
- success;
- partial success;
- no result;
- unsupported format;
- too-large input;
- browser capability unavailable;
- network unavailable for network-required tools;
- privacy/runtime explanation;
- profile default applied;
- profile default overridden;
- add/remove tool;
- handoff available / incompatible.

For Library/search:

- empty query;
- loading;
- zero results;
- typo/alias;
- 1 result;
- many results;
- installed result;
- unavailable/capability-limited result.

## Catalog scaling rules

The catalog can grow from 200 to 500 without reworking the shell if these invariants hold:

1. no top-level navigation item is created per category;
2. categories remain facets, not the primary home;
3. packs remain intentionally small;
4. search synonyms and task tags are first-class catalog data;
5. installed state is separate from catalog membership;
6. users can remove any recommendation;
7. tool naming is unique and verb/task clear;
8. each tool declares input types, output types, runtime and compatible handoffs;
9. recents are capped and aged;
10. Suggestions are capped at 2–4 visible items;
11. Library supports list density rather than decorative cards;
12. search telemetry records zero-result intent without storing sensitive tool inputs.

### Library pagination / virtualization

At 200 tools, a filtered list can load quickly. At 500+, UI should still avoid infinite DOM growth.

Preferred behavior:

- virtualized or paginated results after approximately 50 visible rows;
- preserve filter and scroll state when opening a tool and going back;
- URL-addressable search/filter state for shareability and browser navigation.

## Search metadata contract

Every tool should eventually declare:

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

This is a UX requirement because reliable search and explanations depend on structured metadata.

## Validation hypotheses

The design should be tested against behavior, not preference surveys.

### Test 1 — starter workspace vs self-browse

Task:

> “Set up the tools you would want for your normal work.”

Compare:

- onboarding-generated starter set;
- blank workspace + Library.

Measure:

- time to first useful workspace;
- number of irrelevant tools removed;
- number of additional tools searched;
- 7-day reuse.

### Test 2 — find one unfamiliar tool

Give a job without naming the tool:

> “You need to remove tracking parameters from 20 URLs.”

Measure:

- time to tool;
- search reformulations;
- whether users use Library, Search or suggestions.

### Test 3 — Work Profile value

Repeated tasks across date/rate/currency tools.

Measure:

- fields avoided;
- overrides;
- errors caused by stale defaults;
- perceived control.

### Test 4 — reason comprehension

Show a suggested tool.

Ask:

> “Why is this here?”

Success means the user can answer from the visible reason without opening help.

### Test 5 — mobile completion

Run image resize, URL cleanup, business-day calculation and PDF merge on a 390 px-wide viewport.

Measure:

- completion without horizontal scroll;
- keyboard type correctness;
- thumb reach for primary actions;
- visibility of output;
- accidental navigation.

## Decisions to carry into implementation planning

### Strong decisions

- Workbench is primary; Library is secondary.
- Global search is always available.
- Starter workspace target is 10–15 tools.
- Suggestions are explainable from structured evidence.
- Packs are small install sets of executable utilities.
- Work Profile values are visible and overridable.
- Anonymous users can complete a tool before signup.
- Tool pages foreground the operation, not SEO content.
- No AI-first shell.
- No ads inside the operation path.
- Mobile has its own navigation hierarchy.

### Hypotheses requiring product evidence

- exact onboarding question count;
- whether optional free-text job description improves recommendations enough to keep;
- whether Input Router deserves a visible home affordance;
- whether Context Bus handoffs are used enough to justify persistent UI;
- whether users prefer manual grouping of Your Tools;
- whether ad-supported free usage is ever worth the trust/clutter cost.

## Implementation non-goals for this lane

This document does not:

- choose the public brand name;
- define production frontend architecture;
- implement tool manifests;
- decide the monetization model;
- make final legal/privacy claims;
- specify every individual tool;
- assume AI is required for onboarding or search.

## Reference summary

Primary UX references checked for this lane:

1. https://tooptools.com/
2. https://usesolvekit.com/
3. https://tinywow.com/tools
4. https://tinywow.com/your-data
5. https://manual.raycast.com/search-bar
6. https://manual.raycast.com/extensions
7. https://www.raycast.com/store
8. https://support.setapp.com/hc/en-us/articles/213587729-Discover-Setapp-apps
9. https://docs.setapp.com/docs/setapp-collections
10. https://www.smarterfaster.app/
11. https://it-tools.tech/
12. https://github.com/CorentinTh/it-tools
13. https://tooldock.org/
14. https://www.omnicalculator.com/
15. https://www.omnicalculator.com/mobile-app
