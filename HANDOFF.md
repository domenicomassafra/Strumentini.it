# HANDOFF — StrumentiUtili.it

Repository: /Users/domenico/Code/StrumentiUtili.it
Branch: main
Public brand: StrumentiUtili.it.

## Thesis

Build a personal utility workspace for knowledge work, not another generic directory of online tools.

Current target wedge:
- freelancers;
- consultants;
- solopreneurs;
- professional creators;
- small-agency operators.

A short role-aware onboarding generates a small starter toolbox. Users can then add/remove individual tools and professional packs.

## Candidate differentiators

- onboarding selects first toolset automatically;
- reusable profile defaults;
- professional packs;
- command palette/search surface;
- deterministic/local execution for normal tools;
- optional sign-in primarily for sync;
- portable/exportable workspace configuration.

## Important novelty blockers

Do not claim originality from large tool count, categories, favorites, client-side privacy, all-tools-in-one-place, freelancer calculator collections or formula transparency alone.

Competitor research found partial overlaps including ToopTools, TinyWow, IT-Tools-class projects, Moderrno, freelancer toolkits and CyberChef.

Direct novelty of the current combination is NOT yet proven.

## UX

Home should emphasize Your Tools, Recent, Recommended Additions, command palette and a library drawer. Do not default to a wall of hundreds of cards.

Onboarding can use profession/role, worker type, country/locale, currency, timezone, recurring tasks and common file/data formats.

## Architecture

Preferred:
- static/PWA shell;
- TypeScript;
- browser APIs;
- Web Workers;
- lazy WASM;
- local file processing;
- tiny optional sync backend;
- no remote user-file database;
- no per-use LLM requirement.

AI can be optional for onboarding suggestions or truly semantic tools.

## Historical research

Migrated evidence:
- research/toolbox-opportunity-evidence-2026-09-23.md
- research/universal-toolbox-moment-map-2026-09-23.md

These contain earlier rejected/narrowed candidates too. Read the latest scope corrections before treating older sections as current direction.

## Current state — 2026-10-03

The implementation is well beyond the research-only phase. The repository now contains a real Astro application with a deterministic Tool Factory and a 200-tool catalog.

Verified local checkpoint:

- 200 public tool routes in the generated catalog;
- 119 tools with Gold certification and 119/119 release-eligible Gold receipts;
- 1 Partial tool (`image-resize`), blocked only on the still-missing physical iOS Safari and Android Chrome evidence;
- 80 implemented tools still classified `IMPLEMENTED_UNVERIFIED` rather than falsely promoted to Gold;
- 200/200 tools bound to oracle and fixture authorities;
- 334/334 automated tests passing across 48 test files;
- `astro check`: 0 errors, 0 warnings, 0 hints;
- static build: 204 pages, with the build inspection and historical bundle baseline passing;
- public catalog copy, shell, onboarding, Workbench and shared tool surfaces are Italian-primary; a focused UI/UX audit on 2026-10-03 found a small number of source-level English/shared-chrome strings and internal quality jargon that remain redesign cleanup work;
- `aaa0c7f` added the 20-tool PDF/document Gold batch, moving the global frontier from 99/1/100 to 119/1/80.

Discovery/clarity checkpoint added on 2026-09-30:

- semantic icon vocabulary is centralized in `src/ui/tool-icons.ts`, with category fallbacks plus tool-specific semantic rules;
- icons are visible in the Library, global search, Workbench rows and tool headings;
- the Library now exposes category navigation with counts, human category labels and an explicit `Affidabilità` filter;
- Gold tools are shown as `Verificato`; implemented tools that have not completed Gold certification are shown as `In verifica` instead of appearing equally mature;
- the first large naming pass rewrites opaque noun-heavy labels into action/result-oriented Italian names and descriptions from the centralized `TOOL_COPY_IT` source;
- search indexes both canonical metadata and the human Italian category/input/tag vocabulary;
- shared runtime failures are translated through `src/i18n/it/errors.ts` into user-actionable Italian messages rather than leaking machine error codes;
- browser smoke on the static build loads and hydrates 200/200 tool routes with no page/console errors;
- representative end-to-end operations pass for Business Day, UTM Builder, JSON Formatter, text counter, CSV viewer and date difference;
- Library browser checks confirm 50 tools under `Verificati` and 20 under `PDF e documenti`.

The Italianization/backend tranche plus the later PDF/document certification batch are committed on `main` and pushed. The current operational truth is the generated certification index, not older checkpoint prose.

The current product direction is **backend/content/correctness first, UI redesign second**. Do not spend the next tranche polishing the present visual design. The immediate work is to improve the actual utilities, data/reference quality, deterministic behavior, catalog/search semantics and Gold coverage while preserving the Italian-only public experience.

`HANDOFF.md`, `ROADMAP.md` and `PROJECT-STATUS.md` are the live operational entry points. `.scratch/`, `tasks/prompt2prompt/`, the archived mega-handoff and the original first-validation implementation plan are historical evidence, not active queues.

## Brand / GTM update

StrumentiUtili.it is the owner-selected public brand. The prior codename collision is historical and no longer defines the product identity.

Important deeper blockers:

- SolveKit already owns multi-tool workspaces and connected workflows.
- smarterfaster already uses profession-based workspace generation and professional packs.
- FreelTools already calls itself a freelancer operating system and has 242 tools.
- ToopTools already offers a personalized client-side workspace.

Current differentiation hypothesis depends on the full combination of role onboarding + shared profile + executable deterministic utilities + packs + persistent workspace + context handoff + portable config.

Current message to test:

**Your everyday work tools, already set up for you.**

Read research/competitive-brand-gtm-2026-09-23.md, docs/05-brand-positioning.md and docs/06-go-to-market.md before further product work.

## Scale / free-model update

The preferred business hypothesis is now deliberately compatible with being fully free, potentially open source, and useful primarily as a brand/distribution asset.

Advertising is optional and should not shape the product early. If tested later, prefer public discovery/documentation surfaces; keep the personal workspace clean and never place ads adjacent to critical tool controls.

The catalog may grow to hundreds of tools, but only through a Tool Factory with a single quality contract. Only Gold-certified tools should count toward public catalog-size claims.

Read:

- research/free-scale-monetization-stress-test-2026-09-23.md
- research/tool-catalog-200-candidate-map-2026-09-23.md
- research/catalog-prioritization-v1-2026-09-23.md
- docs/07-tool-factory-quality-standard.md
