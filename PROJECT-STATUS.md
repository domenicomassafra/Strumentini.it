# Strumentini.it — Live ticket execution and historical project snapshot

Historical project checkpoint: **2026-10-08**. Live ticket counts below are generated from the issue files, independently of that historical checkpoint.

For ongoing work, use the live ticket panel, the linked issue files and the current checkout/CI/release receipts. **All remaining sections below the historical divider describe the 2026-10-08 checkpoint, not present-day code, tests, catalog certification, production or Git state.** Do not reuse their counts as current facts.

<!-- tickets:live-status:start -->
## Live ticket execution (generated)

Source of truth: `.scratch/strumentini-expansion-20261005/issues/` and the generated [`CURRENT-TICKET-DASHBOARD.md`](.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md). `npm run tickets:sync` refreshes this panel; `npm run tickets:check` fails on drift.

| Metric | Current count |
|---|---:|
| All tickets | 424 |
| Administratively completed | 305 |
| Closed with explicit refusal (not shipped) | 17 |
| Still open | 119 |
| Ready for assignment (acceptance not yet proven) | 27 |
| Dependency-blocked | 85 |
| Official-source-blocked | 2 |
| Physical-device-blocked | 5 |
| Capability-blocked | 0 |
| DAG-ready (numeric dependencies only) | 34 |
| Stored status mismatches | 0 |

Ticket completion, certification, reviewed merge, deployment and physical-device acceptance are separate gates.
<!-- tickets:live-status:end -->

## Historical project snapshot — 2026-10-08 (non-authoritative)

## Canonical repository state

- Checkout: `/Users/domenico/Code/Strumentini.it`
- Branch: `main`, tracking `origin/main`. The tool-hardening + frontend-system audit tranche is integrated locally; generated evidence is kept separate from the source fingerprint by design.
- The retired catalogue/workbench/a11y implementation is deleted: `src/pages/library.astro`, `src/library/**`, `src/components/library/**`, the retired Workbench UI, the old accessibility wrapper layer, `scripts/build-catalog.ts`, `scripts/lib/catalog-compiler.ts`, and their obsolete tests.
- The replacement shell/catalog/account implementation is tracked: `src/catalog/{groups,projections}.ts`, `src/components/{home,catalog,account,icons}/**`, the new shell, public routes, `worker/**`, self-hosted Inter fonts, expanded-local evidence and matching acceptance tests.
- Throwaway debug scripts and screenshots are gone. `design/references/redesign-20261003/` is intentional retained design provenance, not working-tree debris.
- Git hygiene rechecked on 2026-10-08: the functional changes from PR #1 were merged to `main` as `c011a86`; subsequent developer export and bounded visual PDF tranches are committed directly to `main`. There is one active Strumentini worktree and no active stash. The temporary `.cf-rename-strumentini` release/dry-run workspace was previously removed.
- Archive tags: three, all prefixed `archive/2026-09-24-` and explicitly closed historical references, not active work (`performance-wip`, `a11y-wip`, `browser-acceptance-wip`). Their relevant performance/search/browser behavior is already represented by the current projection, lazy-loading and acceptance architecture; retired Library/Workbench deltas are not a queue.
- One module from the previous homepage keeps its name and is still live: `src/components/workbench/last-value.ts`, the Workbench gutter seam that stores one short rendered scalar per tool in `localStorage` and is read by the homepage recent list, `/preferiti/` and `/risorse/`. The widget that rendered the gutter is gone; the seam is not.
- `docs/history/WIP-CLOSURE-2026-10-03.md` and `docs/history/2026-09-24-catalog-performance-wip-receipt.json` are provenance, not queues.

## Product / code state

- Astro 7 + Preact + TypeScript, `output: "static"`, Italian-first, provider-portable `dist/` (Cloudflare Workers Static Assets is the default target; the build artifact stays ordinary static output).
- **259 catalog tool routes and 259 tool pages.** `npm run certification:check` confirms the generated certification index is current for the present catalog.
- The certification authority reports **259/259 oracle-bound**, **259/259 fixture-bound** and **257 local-declared** tools; exceptions are represented explicitly in the generated quality data rather than being inferred from an older 200-tool baseline.
- Public route set:
  - `/` — hero, trust row, the ten public groups, this device's recent tools, the editorial starter set, closing band (`src/components/home/**`);
  - `/strumenti/` — the whole catalogue: all 259 cards server-rendered, three views, facet sidebar, sort, pagination, driven entirely from the URL with no runtime fetch (`src/components/catalog/CatalogDirectory.astro`);
  - `/categorie/` and `/categorie/<slug>/` — the ten public groups defined in `src/catalog/groups.ts` over the 13 internal categories, 18–21 tools each (`getStaticPaths` over `groups`);
  - `/cerca/` — ranked results page; the command palette (`⌘K` / `Ctrl+K`) is the only overlay;
  - `/risorse/`, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`, `404`, `robots.txt`, `sitemap.xml`.
- `/library` and `/library/` are **redirects** to `/strumenti` and `/strumenti/` (`astro.config.mjs`), emitted as ordinary static redirect pages. The old page, its model and its components are deleted; nothing in the product is called a library any more.
- Every tool page is skinned by exactly two stylesheets: `src/styles/global.css` (tokens + base element vocabulary, imported by `src/layouts/BaseLayout.astro`) and `src/components/tools/tool-surface.css` (imported by `ItalianToolPage.astro`). `src/components/account/account.css` and `src/components/onboarding/Onboarding.module.css` are the only other stylesheets in `src/`.
- Optional account, served by `worker/index.ts` (Cloudflare Worker + D1, `wrangler.jsonc`): PBKDF2-SHA256 at **600,000 iterations**, an opaque 30-day session cookie, sliding-window throttling and server-side Turnstile for email/password. Google Identity Services support is implemented with a server-issued nonce and Worker-side RS256/JWK verification; new Google users can create a password later, while an existing password account must explicitly link Google from settings. D1 migrations `0001_init.sql` and `0002_google_auth.sql` are applied remotely. Production currently fails closed for Google because no `GOOGLE_CLIENT_ID` is configured yet; the Google controls stay hidden rather than exposing a broken login. The static product still remains deployable without the account worker.
- Local-first workspace: onboarding starter set, installed/recent tool set, work profile and last values persist in IndexedDB/`localStorage` (`src/workbench/**`, `src/profile/**`, `src/persistence/**`). No file content or job result is ever sent anywhere.
- The original 200-tool functional-audit baseline remains separately tracked by tickets 110 and 284–297; current catalog/certification truth is the 259-tool generated index. The original inventory is regenerated from current manifest declarations (six legitimate capability/runtime changes), with 200 final decisions: 199 verified and one refused. `npm run audit:original-200:final` checks the persisted snapshot and passes; it does **not** refresh stale source-bound Gold receipts.

## Quality frontier

Machine authority: `quality/receipts/expanded-catalog-certification.json`, generated by `npm run certification:build` (`scripts/build-certification-index.ts`). The site imports the derived `src/generated/quality.ts`; public `Verificato` / `In verifica` labels read the same authority.

- **257 Gold**
- **2 Partial**: `image-resize` and `microphone-recorder`; both still require genuine physical-device evidence before Gold promotion.
- **0 Implemented Unverified**: `password-strength-estimator` and `xml-formatter-validator` now have high-confidence, bounded oracle evidence and current Gold receipts.
- **2 release-blocked tools total** and **0 physical-device passes**.
- `ris-bibtex-converter` is no longer a blocker: ticket 276 closed the oracle gap and its Gold receipt is present.

The expansion frontier is now much smaller than the implementation wave that produced the 259-tool catalog, but release truth remains evidence-driven: a completed implementation ticket is not a Gold promotion by itself. Canonical **live ticket execution dashboard**: `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md` (plus machine-readable JSON), generated by `npm run tickets:sync`, validated by `npm run tickets:check` and regression-tested by `npm run tickets:test`. At the latest checkpoint: **246 completed (18 closed with explicit refusal), 81 open: 20 assignable candidates, 53 waiting on dependencies, 2 official-source-blocked, 5 physical-device-blocked and 1 capability-blocked**. The 28 numeric DAG-ready ticket count includes eight still gated; `ready-for-agent` never means proven runnable or safe to release. #242 and #320 are **refusals**, not available PDF decrypt capability; #053 therefore remains capability-blocked rather than automatically becoming ready.

Current integrated machine snapshot (2026-10-08, ticket 319): `npm test` passes **1,134/1,134 tests across 146 files**; `npm run check` reports **0 errors / 0 warnings** (16 TypeScript deprecation hints in tests); `npm run build` emits **279 pages** and `scripts/inspect-build.ts` passes; the previous production-dependency audit reported **0 vulnerabilities**. `npm run certification:check` passes with **259 tool(s), output current** after regenerating the index. Ticket 319 form/flatten regression verifies widget object/page provenance, fail-closed visible annotations, download reparse and 0-pixel PDF.js before/after difference for the supported safe subset: **21/21 Chromium/Firefox/WebKit**. Ticket-221 layered PDF comparison has **24/24** browser checks, ticket-52/215/216 visual PDF organizer acceptance **54/54**, ticket-217 page-selection/ZIP acceptance **18/18**, and the existing 20-route PDF acceptance passes. Ticket DAG now has **245 completed / 82 open**, with 28 dependency-ready candidates. Visible-form appearance painting remains explicitly unsupported rather than claiming flatten fidelity. The raw-format export milestone for ticket 59 remains partial, not closed.

## Release status

The current generated authority is **257/259 Gold**, with two release-blocked tools. The RIS/BibTeX, password-strength and XML oracle gaps are closed; the remaining per-tool blockers are genuine physical-device evidence, plus final integration/infrastructure evidence.

Remaining release blockers are evidence/infrastructure boundaries, not hidden implementation failures:

1. `image-resize` remains Partial until real iOS Safari and Android Chrome device receipts exist;
2. `microphone-recorder` remains Partial until genuine physical capture/permission evidence exists;
3. the earlier clean `2af6e8c` / `2c38b13c…` build remains live on `Strumentini.it` as Worker version `7e974054…`; Chromium/Firefox/WebKit smoke, representative byte identity, auth/D1 smoke, a real rollback to previous known-good version `a38c668c…`, page-hash reversion, and restore to `7e974054…` passed **for that deployed source**. The rollback gate is **not current for the newer main source**;
4. ticket 283 is complete: the Strumentini.it custom-domain release, live smoke, rollback and restore are all proven. No unrelated external domain is part of the product release gate.

The deployed production release, original 257 Gold receipts, previous browser-performance matrix and rollback evidence are bound to source fingerprint `2c38b13c93d65e40d24730c76c0e766fee5a764dd214dd007d17e2a064fafeeb`. **Newer main source changes deliberately stale that fingerprint**. The independent release validator currently blocks a new deploy for stale Gold/browser/rollback receipts and absent physical Android/iOS resize evidence (six blockers after commit, zero compiler errors). Refresh each source-bound authority with actual new acceptance evidence before Cloudflare promotion; do not rewrite hashes or synthesize physical-device receipts.

## Design system and brand

- `design/WORLD.md` is the canonical visual authority: one accent (`--brand #0b6cfd` — primary action, link, active state, computed value), Inter self-hosted as variable woff2 (latin + latin-ext, preloaded, `font-display: swap`), Roboto Mono for machine output only, white cards on a very light blue canvas, a fixed eight-tone category wheel, and a dark mode that redefines the same roles rather than inverting them.
- `src/styles/global.css` implements it, and `tests/design-system.test.ts` parses the palette table straight out of `design/WORLD.md` so token drift fails the suite. It also refuses local colour literals, a second token authority, dead tokens, and contrast-floor regressions in both themes.
- `design/WORLD.md` §SURFACES lists the ten surfaces; the implementation matches it (`/`, `/strumenti/`, `/cerca/`, `/categorie/[slug]/`, `/tools/[slug]/`, the workspace, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`).
- `design/FRONTEND-SYSTEM-STANDARDIZATION.md` is the implementation-ready refactor authority produced from the Impeccable audit. It maps duplicated primitives, concrete component/token APIs, what must remain surface-specific, migration order, screenshot/browser gates, and eight progressive waves. The rule is **consolidate the existing visual system, do not create a parallel component library**.
- The 2026-10-03 audit's action list is **shipped**: accountant/ledger language and ledger-era faces are gone, the 13 internal categories are grouped into 10 public groups with real labels, public quality vocabulary is `Verificato` / `In verifica` instead of internal certification jargon, icons are action- and category-first from one central vocabulary, and the shell is a single header + footer over every page.
- The public name stays **Strumentini.it**; all new copy (`/risorse/`, `/accedi/`, `/impostazioni/`, the account components) is authored Italian-first.
- Cloudflare deploys Worker target `strumentini`. Production `AUTH_DB` is now `strumentini-auth` (UUID `3351c8bf-31fc-4716-9d92-2b07c4d8fd2a`), migrated from the empty pre-rebrand account database. A real rollback proved the previous Worker/D1 pairing, the current release was restored, and the superseded D1 resource was then permanently deleted; post-delete `/api/auth/session` still returns HTTP 200.

## How to verify

Run in this order; each one is unconditional (no env vars, no secrets, no network).

| Command | What it proves |
|---|---|
| `npm run test` | regenerates the catalog, checks the certification index is current, then runs the whole Vitest suite |
| `npm run check` | regenerates the catalog, checks the certification index, and runs `astro check` (0 errors / 0 warnings / 0 hints expected) |
| `npm run build` | full static build plus `scripts/inspect-build.ts` |
| `npm run acceptance:discovery` | the `/strumenti/` directory, the `/cerca/` results page and the command palette, in a real browser: URL state, paging, group view, no eager tool chunk. Writes `quality/receipts/discovery/acceptance.json` |
| `npm run deploy:check:portable` | `dist/` is provider-portable: required pages present, no server-runtime artifacts, no provider-only origin, no absolute developer paths |
| `npm run acceptance:auth` | the account API end to end against `wrangler dev` + a throwaway local D1: Google config/nonce boundary, register/login/session/profile/password/sessions/delete + favourites, cookie attributes and throttling |
| `npm run acceptance:expanded-local` | the 49-tool expanded-local batch against the built static site |
| `npm run acceptance:local-jobs` | the 9-tool local-jobs tranche: semantic output, locality, lazy loading, 390px, a11y and Italian error states |
| `npm run acceptance:research-knowledge` | all 14 research-knowledge routes, including the now-Gold RIS/BibTeX converter |
| `npm run acceptance:marketing-media` | URL/marketing, QR and image-media browser behavior, including QR raster and EXIF byte-level proofs |
| `npm run gold:local-jobs` | replays every local-jobs fixture vector and writes the nine Gold receipts |
| `npm run gold:research-knowledge` | certifies all 14 research-knowledge tools on the current closed oracle set |
| `npm run gold:marketing-media` | certifies the eight marketing/media tools |

`npm run release:validate` combines the catalog, the build and `scripts/validate-release.ts`; `npm run acceptance:family-matrix` and `npm run acceptance:browser-performance` regenerate the heavier browser matrices. Neither is a substitute for the gates above. The two sibling acceptance scripts that assert on console errors must tolerate the single `/api/auth/session` probe a static server answers with 404, exactly as `scripts/acceptance-family-matrix.mjs` documents.

## Real technical debt still worth addressing

- `image-resize`: collect genuine physical iOS Safari and Android Chrome evidence. Desktop emulation does not count.
- `microphone-recorder`: collect genuine physical capture/permission evidence; SafariDriver mock media cannot satisfy this gate.
- `password-strength-estimator` and `xml-formatter-validator` are now Gold on bounded NIST/W3C-backed oracle contracts; any future expansion of their claims must reopen oracle review rather than inheriting that Gold status automatically.
- Frontend consolidation: implement `design/FRONTEND-SYSTEM-STANDARDIZATION.md` wave by wave. The audit found substantial repeated UI/CSS patterns; standardize primitives such as controls/actions/states/cards/pagination first, but keep homepage/catalog/tool/account compositions distinct where their jobs differ.
- The browser acceptance run exposed why that refactor matters: some family renderers still rely on wrapping-label behavior instead of one consistently associated field primitive. Accessibility semantics belong in the primitive, not in each tool.
- The Worker already has an internal login-attempt limiter. The `Strumentini.it` Cloudflare zone/domain prerequisite for an outer WAF rate-limit rule is now satisfied, but the repository has no evidence that the outer rule has been configured or verified yet.
- Google auth still needs the real Web application client ID configured as `GOOGLE_CLIENT_ID`; no Google client secret or refresh token is used by this auth-only flow.
- Confirm Workers Paid before relying on PBKDF2 password flows at production load; the repository cannot attest account billing state.

## Authority map

- `PROJECT-STATUS.md` — current repository/product snapshot (this file).
- `HANDOFF.md` — what a next engineer reads first and which gates to run.
- `ROADMAP.md` — current priorities and certification frontier.
- `PRODUCT.md` — product contract and the optional-account scope; `PRODUCT-SPEC.md` — acceptance criteria US-01…US-17.
- `design/WORLD.md` — canonical visual authority; `DESIGN.md` — the structural system (catalogue, tool surface, account area as three layers); `tests/design-system.test.ts` — the visual contract.
- `src/generated/catalog.ts`, `src/generated/quality.ts`, `quality/receipts/expanded-catalog-certification.json` — generated catalog and certification truth.
- `worker/index.ts`, `worker/google.ts`, `worker/migrations/*.sql` — the account API, Google ID-token verifier and schema.
- `src/catalog/groups.ts` — the public grouping over the internal taxonomy.
- `tasks/prompt2prompt/`, `research/`, `docs/history/` and most `.scratch/` content — historical provenance; `.scratch/strumentini-expansion-20261005/TICKET-DAG.md` plus its linked issue files are the explicit active exception used as the expansion dependency/scheduling authority.

## Next source-changing tranche

For expansion work, use `.scratch/strumentini-expansion-20261005/TICKET-DAG.md` as the dependency authority and preserve the evidence boundary recorded by each ticket. Heavy feasibility tickets 267–275 are decision-complete, but their `REFUSE production promotion` outcomes do not authorize downstream heavy paths without the missing physical/fidelity evidence. Frontend-system consolidation remains a separate staged tranche under `design/FRONTEND-SYSTEM-STANDARDIZATION.md`.

Certification work remains separate: `ris-bibtex-converter` is closed; keep `image-resize` and `microphone-recorder` separate until real physical-device evidence exists. The custom-domain deploy/rollback/D1 migration is complete. Remaining owner-side infrastructure work is the outer WAF rule, optional Google client ID and Workers Paid confirmation; do not mix those into a source fingerprint unless repository code changes.
