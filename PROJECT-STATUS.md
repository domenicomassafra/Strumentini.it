# StrumentiUtili.it — Current Project Status

Date: **2026-10-03**

This is the short, live map of the repository. It exists so old worker waves, ticket ledgers and handoffs cannot be mistaken for the current project state.

## Canonical repository state

- Checkout: `/Users/domenico/Code/StrumentiUtili.it`
- Branch: `main`, tracking `origin/main`; `HEAD` and `origin/main` are both `8b50066` (`chore: close legacy WIP state and refresh project truth`).
- **The end-to-end 2026-10-03 redesign is uncommitted working-tree work and none of it is pushed.** `git status --porcelain` reports roughly 110 entries in one tranche: staged deletions, untracked new paths, and further unstaged modifications of the same redesign.
  - Deleted in this tree, so that the two redirects below are all that remain of the previous catalogue route: its page, model and components (`src/pages/library.astro`, `src/library/**`, `src/components/library/**`), plus the three retired homepage widgets under `src/components/workbench/`, `src/components/a11y/**`, `scripts/build-catalog.ts`, `scripts/lib/catalog-compiler.ts`, and their tests.
  - Untracked and new: `src/catalog/{groups,projections}.ts`, `src/components/{home,catalog,account,icons}/**`, `src/components/shell/{SiteHeader,SiteFooter,ThemeToggle,navigation,theme}.*`, `src/pages/{strumenti,categorie,cerca,risorse,preferiti,impostazioni,accedi}.astro`, `src/workbench/membership.ts`, `worker/**`, `public/fonts/inter-*.woff2`, `quality/receipts/expanded-local/**`, `scripts/acceptance-directory.mjs`, `scripts/acceptance-auth.mjs`, and the matching tests.
  - Working-tree debris, not a deliverable: `scripts/_dbg{,2,3,4}.mjs`, `scripts/account-pages-check.mjs`, `.screenshots/`, `design/references/`.
- Remote branches: only `main`. Worktrees: one primary worktree. Stashes: none.
- Archive tags: three, all prefixed `archive/2026-09-24-` and explicitly not active work (`performance-wip`, `a11y-wip`, `browser-acceptance-wip`).
- One module from the previous homepage keeps its name and is still live: `src/components/workbench/last-value.ts`, the Workbench gutter seam that stores one short rendered scalar per tool in `localStorage` and is read by the homepage recent list, `/preferiti/` and `/risorse/`. The widget that rendered the gutter is gone; the seam is not.
- `docs/history/WIP-CLOSURE-2026-10-03.md` and `docs/history/2026-09-24-catalog-performance-wip-receipt.json` are provenance, not queues.

## Product / code state

- Astro 7 + Preact + TypeScript, `output: "static"`, Italian-first, provider-portable `dist/` (Cloudflare Workers Static Assets is the default target; the build artifact stays ordinary static output).
- **200 tool routes and 200 tool pages.** Every page in `src/pages/tools/` renders through `src/components/tools/shared/ItalianToolPage.astro` (200/200), over 19 engines and the 13 internal factory categories.
- Normal tools are local and deterministic: all 200 catalog entries declare `runtime.location = "LOCAL"` with `network: "forbidden"`.
- Public route set:
  - `/` — hero, trust row, the ten public groups, this device's recent tools, the editorial starter set, closing band (`src/components/home/**`);
  - `/strumenti/` — the whole catalogue: all 200 cards server-rendered, three views, facet sidebar, sort, pagination, driven entirely from the URL with no runtime fetch (`src/components/catalog/CatalogDirectory.astro`);
  - `/categorie/` and `/categorie/<slug>/` — the ten public groups defined in `src/catalog/groups.ts` over the 13 internal categories, 18–21 tools each (`getStaticPaths` over `groups`);
  - `/cerca/` — ranked results page; the command palette (`⌘K` / `Ctrl+K`) is the only overlay;
  - `/risorse/`, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`, `404`, `robots.txt`, `sitemap.xml`.
- `/library` and `/library/` are **redirects** to `/strumenti` and `/strumenti/` (`astro.config.mjs`), emitted as ordinary static redirect pages. The old page, its model and its components are deleted; nothing in the product is called a library any more.
- Every tool page is skinned by exactly two stylesheets: `src/styles/global.css` (tokens + base element vocabulary, imported by `src/layouts/BaseLayout.astro`) and `src/components/tools/tool-surface.css` (imported by `ItalianToolPage.astro`). `src/components/account/account.css` and `src/components/onboarding/Onboarding.module.css` are the only other stylesheets in `src/`.
- Optional account, served by `worker/index.ts` (Cloudflare Worker + D1, `wrangler.jsonc`): PBKDF2-SHA256 at **600,000 iterations** (measured at ~81 ms per hash on the owner's machine, so this component needs the Workers **Paid** plan: the Free plan's per-request CPU budget is 10 ms), an opaque 30-day session cookie (`HttpOnly; Secure; SameSite=Lax`), only the SHA-256 token digest in D1, sliding-window login throttling. A credential hashed with a lower work factor is re-hashed on the next successful sign-in (`needsRehash`), so raising the constant migrates accounts instead of locking them out. `worker/migrations/0001_init.sql` creates `users`, `sessions`, `login_attempts`, `favorites`. The worker serves `/api/**` and hands every other path to the static assets binding, so the site is complete and fully working with no worker deployed (`/accedi/` and `/impostazioni/` say so instead of pretending a session exists).
- Local-first workspace: onboarding starter set, installed/recent tool set, work profile and last values persist in IndexedDB/`localStorage` (`src/workbench/**`, `src/profile/**`, `src/persistence/**`). No file content or job result is ever sent anywhere.
- 35 tools declare work-profile fields; 71 declare typed handoff metadata; 200/200 are bound to an oracle entry and a fixture family.

## Quality frontier

Machine authority: `quality/receipts/expanded-catalog-certification.json`, generated by `npm run certification:build` (`scripts/build-certification-index.ts`). The site imports the derived `src/generated/quality.ts`; the public `Verificato` / `In verifica` labels on `/strumenti/`, `/categorie/`, `/cerca/` and every tool page read it through `goldToolIds()`.

- **168 Gold**
- **1 Partial**: `image-resize` (blocked only on the still-missing physical iOS Safari and Android Chrome evidence)
- **31 Implemented Unverified**
- 32 tools without a Gold receipt = 32 release-blocked
- 200/200 oracle-bound, 200/200 fixture-bound, 200/200 local-declared; physical-device passes: 0
- 49 of the 168 Gold receipts are the new `quality/receipts/expanded-local/**` batch
- The older "119 Gold / 1 Partial / 80 unverified" figure is stale — it described the frontier before that batch.

Remaining unverified, by engine (the 32 tools with no Gold receipt):

| Engine | Remaining |
|---|---:|
| research-knowledge | 14 |
| file-privacy | 4 |
| text-writing | 4 |
| url-marketing | 4 |
| image | 2 |
| qr-local | 2 |
| date-time | 1 |
| image-visual | 1 |

The PDF/document family is 20/20 Gold and is not part of the remaining frontier.

Test, `astro check` and build figures are deliberately not frozen in this document: `tests/` held 49 test files at the time of writing (recount with `find tests -type f | wc -l`), and the pass counts, checker diagnostics and produced page count are whatever the gates below print today.

## Release status

The last release receipt, `quality/receipts/release/validation.json`, was generated at revision `cd3b2f2` from a dirty tree and is now stale (it still reports 100 tools with no certification receipt, against today's 32). Regenerate deliberately with `npm run release:validate`; never hand-edit it.

Its shape — **BLOCKED, not failed**: 0 errors — stands, and these blockers are real and unresolved:

1. browser evidence targets different source content than the current tree;
2. tools missing a Gold receipt (32 today);
3. `image-resize` is not Gold;
4. physical Android Chrome evidence for `image-resize` is missing;
5. physical iOS Safari evidence for `image-resize` is missing;
6. rollback remains explicitly unproven (`quality/receipts/release/rollback.json`, status `UNPROVEN`);
7. the release receipt was produced from a dirty working tree.

Every receipt records a `sourceFingerprint` over the evidence sources (`src/`, `scripts/`, `tests/`, `public/`, `quality/{fixtures,oracles}/` and the root config files). While the redesign is uncommitted, every receipt is stale by construction: recomputing the working-tree fingerprint with `currentEvidenceSourceFingerprint()` from `scripts/lib/current-revision.ts` yields a value that matches none of the four fingerprints recorded under `quality/receipts/`, and it changes with every uncommitted edit. Recertify after the tranche is committed, not before.

Do not synthesize external browser/device/rollback evidence.

## Design system and brand

- `design/WORLD.md` is the canonical visual authority: one accent (`--brand #0b6cfd` — primary action, link, active state, computed value), Inter self-hosted as variable woff2 (latin + latin-ext, preloaded, `font-display: swap`), Roboto Mono for machine output only, white cards on a very light blue canvas, a fixed eight-tone category wheel, and a dark mode that redefines the same roles rather than inverting them.
- `src/styles/global.css` implements it, and `tests/design-system.test.ts` parses the palette table straight out of `design/WORLD.md` so token drift fails the suite. It also refuses local colour literals, a second token authority, dead tokens, and contrast-floor regressions in both themes.
- `design/WORLD.md` §SURFACES lists the ten surfaces; the implementation matches it (`/`, `/strumenti/`, `/cerca/`, `/categorie/[slug]/`, `/tools/[slug]/`, the workspace, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`).
- The 2026-10-03 audit's action list is **shipped**: accountant/ledger language and ledger-era faces are gone, the 13 internal categories are grouped into 10 public groups with real labels, public quality vocabulary is `Verificato` / `In verifica` instead of internal certification jargon, icons are action- and category-first from one central vocabulary, and the shell is a single header + footer over every page.
- The public name stays **StrumentiUtili.it**; all new copy (`/risorse/`, `/accedi/`, `/impostazioni/`, the account components) is authored Italian-first.

## How to verify

Run in this order; each one is unconditional (no env vars, no secrets, no network).

| Command | What it proves |
|---|---|
| `npm run test` | regenerates the catalog, checks the certification index is current, then runs the whole Vitest suite |
| `npm run check` | regenerates the catalog, checks the certification index, and runs `astro check` (0 errors / 0 warnings / 0 hints expected) |
| `npm run build` | full static build plus `scripts/inspect-build.ts` |
| `npm run acceptance:discovery` | the `/strumenti/` directory, the `/cerca/` results page and the command palette, in a real browser: URL state, paging, group view, no eager tool chunk. Writes `quality/receipts/discovery/acceptance.json` |
| `npm run deploy:check:portable` | `dist/` is provider-portable: required pages present, no server-runtime artifacts, no provider-only origin, no absolute developer paths |
| `npm run acceptance:auth` | the account API end to end against `wrangler dev` + a throwaway local D1: register/login/session/profile/password/sessions/delete + favourites, cookie attributes and throttling |
| `npm run acceptance:expanded-local` | the 49-tool expanded-local batch against the built static site |

`npm run release:validate` combines the catalog, the build and `scripts/validate-release.ts`; `npm run acceptance:family-matrix` and `npm run acceptance:browser-performance` regenerate the heavier browser matrices. Neither is a substitute for the gates above.

## Real technical debt still worth addressing

- Two page wrappers are orphaned: `src/components/tools/file-privacy/FilePrivacyPage.astro` and `src/components/tools/research-knowledge/ResearchKnowledgePage.astro`. No route imports them — all 200 pages go through `ItalianToolPage.astro`. Delete them or give them the contract the others have; do not leave a second page shell that silently drifts.
- `toLegacyCatalogSummary` / `renderLegacyCatalogSource` keep a second, lossier summary schema alive inside the generated catalog path (`src/tool-factory/catalog.ts`, `src/catalog/projections.ts`). Consolidate once nothing needs the older summary shape, and before any non-local runtime variant is added.
- The uncommitted tranche itself: the staged deletions, the untracked new paths and the unstaged modifications have to be committed as one deliberate change, with the throwaway `scripts/_dbg*.mjs`, `scripts/account-pages-check.mjs`, `.screenshots/` and `design/references/` either removed or confirmed as intentional.
- `quality/receipts/browser-performance/fresh-browser-matrix.json` was generated at revision `05a8696` with a source fingerprint that no longer matches anything; it must be regenerated, not cited.
- `ROADMAP.md` has not been refreshed with this state: it still quotes the pre-redesign 119/1/80 frontier and a retired UI tranche. `PROJECT-STATUS.md` and `HANDOFF.md` are current; the roadmap is not.

## Authority map

- `PROJECT-STATUS.md` — current repository/product snapshot (this file).
- `HANDOFF.md` — what a next engineer reads first and which gates to run.
- `ROADMAP.md` — priorities; stale on the certification frontier until refreshed.
- `PRODUCT.md` — product contract and the optional-account scope; `PRODUCT-SPEC.md` — acceptance criteria US-01…US-17.
- `design/WORLD.md` — canonical visual authority; `DESIGN.md` — the structural system (catalogue, tool surface, account area as three layers); `tests/design-system.test.ts` — the visual contract.
- `src/generated/catalog.ts`, `src/generated/quality.ts`, `quality/receipts/expanded-catalog-certification.json` — generated catalog and certification truth.
- `worker/index.ts`, `worker/migrations/0001_init.sql` — the account API contract and schema.
- `src/catalog/groups.ts` — the public grouping over the internal taxonomy.
- `.scratch/`, `tasks/prompt2prompt/`, `research/`, `docs/history/` — historical provenance only.

## Next source-changing tranche

Commit the redesign first, then recertify. The evidence fingerprint covers `src/`, `scripts/`, `tests/`, `public/`, `quality/{fixtures,oracles}/` and the root config files, so any further source edit invalidates every receipt again. A sane order:

1. remove the throwaway scripts and screenshots, review the diff, commit the redesign;
2. run `npm run test`, `npm run check`, `npm run build`, `npm run deploy:check:portable`, `npm run acceptance:discovery`, `npm run acceptance:auth`, `npm run acceptance:expanded-local` on the committed tree;
3. delete the two orphaned page wrappers and consolidate the legacy summary path (a source change, so do it before recertifying);
4. regenerate the browser-performance matrix and every receipt against the committed tree, then `npm run release:validate`;
5. only then resume family-by-family certification of the remaining 32 tools, in the engine order in the table above.
