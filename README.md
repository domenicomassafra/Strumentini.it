# StrumentiUtili.it

Public brand and repository identity.

StrumentiUtili.it is a personal utility workspace for knowledge work.

The thesis is not another website with 200 tools. The product should understand enough about what a person does for work to assemble a small relevant toolbox, reuse safe profile defaults across utilities, and let the user add or remove professional tool packs over time.

## Current product thesis

First wedge to research: independent knowledge workers — freelancers, consultants, solopreneurs, professional creators, small-agency operators and similar people who repeatedly jump between documents, files, text, tables, dates, links, images, pricing and lightweight calculations.

Expected experience:

1. optional sign-in or local-first start;
2. short onboarding about role, locale and recurring work;
3. automatically generated initial toolbox;
4. a small Your Tools home instead of hundreds of cards;
5. add or remove profession packs and individual tools;
6. one search or command palette across everything;
7. shared profile defaults where useful;
8. deterministic client-side execution for the normal path.

## Differentiation under test

None of these alone are sufficient: many tools, categories, favorites, client-side processing, files staying in-browser, WASM, visible formulas, freelancer calculators or role tabs.

The combination still being researched is:
- role-aware onboarding selecting the first toolset;
- profile-aware tools reusing safe defaults;
- installable and removable professional packs;
- one utility workspace rather than a directory;
- local deterministic execution for common tasks;
- optional account primarily for sync/configuration;
- portable toolbox configuration.

The intended feeling is closer to a browser-based workspace di strumenti per il lavoro than a calculator directory or SaaS back office.

## Principles

- Low-ops by design.
- Static/client-side first.
- No LLM in the normal path unless a tool genuinely requires it.
- Sensitive files remain local whenever technically possible.
- No forced account for simple usage.
- Sign-in, if used, syncs configuration; it does not justify uploading user files.
- Tools should finish small jobs instead of creating workflows users must maintain.
- Avoid becoming an ERP, CRM, project manager or generic AI assistant.
- Prefer stable browser primitives and durable formats over fragile integrations.
- Keep the system useful even if nobody touches the code for months.

## Candidate packs

Universal core: PDF/image/file transforms, text cleanup, CSV/table cleanup, list diff/dedupe, dates/timezones, URL/UTM/QR, units/currency, screenshots/images, metadata, hashing, quick charts, simple calculators.

Independent Work: project/day/hour rate, effective hourly rate, scope-creep cost, payment-fee gross-up, late-payment calculator, invoice helper, proposal budget sanity check, utilization/capacity, timezone overlap, business days, margin/markup, retainer capacity.

Research/Knowledge: DOI/ISBN cleanup, citation conversion, bibliography dedupe, table cleanup, text diff, word/token counts, PDF extraction utilities, timeline/date normalization.

Marketing/Content: UTM builder, campaign naming, image sizing, text-length checks, URL cleanup, audience CSV cleanup, ROAS/CPA/CPC helpers.

Developer/Data: JSON/YAML/TOML, regex, JWT inspection, hashes, UUID, cron, epoch/date, CSV/JSON transforms, diff, URL encoding.

## Earlier ideas retained as modules, not identity

Earlier research explored an Italy-first fiscal toolbox, universal digital moments, MoveProof/DeleteSafe migration verification, conversion fidelity and file/data repair. These remain useful module ideas and decision history, but are not the current core thesis.

## Cost target

Preferred operating shape: static assets + browser compute + lazy WASM + optional tiny sync backend.

The aspirational target is domain-level or similarly small annual infrastructure cost until genuinely dynamic features justify more.

## Repository status

The checkout contains a static Astro/Preact implementation with 200 generated tool entries, public static routes, shared local execution seams, and release-validation tooling. At the current 2026-10-04 checkpoint the global certification index reports **177 Gold / 1 Partial (`image-resize`) / 22 implemented-unverified**. The live machine-readable authority is `quality/receipts/expanded-catalog-certification.json`; do not copy old frontier counts from historical planning files. Release certification is still blocked only by the remaining 22 Gold receipts, by the browser matrix and rollback receipts that any source change invalidates, and by genuine physical Android Chrome and iOS Safari evidence for `image-resize`. Local or emulated validation never substitutes those physical-device proofs.

For the current project state, active priorities, Git/WIP closure and UI/UX audit, start with `PROJECT-STATUS.md`, `HANDOFF.md` and `ROADMAP.md`.

The consolidated validator writes ignored evidence under `quality/receipts/release/` and does not deploy externally:

```sh
npm run release:validate
npm run release:validate:require-ready
npm run deploy:check
npm run deploy:check:portable
```

`release:validate` checks the 200-tool surface, static asset inventory, public metadata and discovery files, Cloudflare configuration, truthful copy, certification receipts, and evidence boundaries. The canonical production origin defaults to `https://strumentiutili.it`; `PUBLIC_SITE_URL` can override it for an explicitly configured preview or alternate environment. `release:validate:require-ready` runs the unit suite, Astro check, portable static-host validation, and Wrangler dry run before exiting nonzero until every blocker is resolved. `deploy:check` runs both deployment gates; `deploy:check:portable` proves that the built `dist/` artifact does not require Cloudflare or any other application runtime. See `docs/09-deployment-costs-and-portability.md`.

## Brand

StrumentiUtili.it is the selected public brand. Historical naming-collision research concerned the former codename and is retained only as decision history.

Implementation should use StrumentiUtili.it consistently. Any formal legal/trademark clearance is a separate release-governance activity.

See:

- docs/05-brand-positioning.md
- docs/06-go-to-market.md
- research/competitive-brand-gtm-2026-09-23.md
