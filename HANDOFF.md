# HANDOFF — UtilityOS

Repository: /Users/domenico/Code/UtilityOS
Branch: main
Working codename: UtilityOS. Brand is not final.

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

## Current state

Product research only. No production app exists yet.

Next work should deepen novelty/user-value validation and define a small interaction prototype. Do not immediately build hundreds of utilities.
