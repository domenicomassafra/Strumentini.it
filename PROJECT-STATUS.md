# StrumentiUtili.it — Current Project Status

Date: **2026-10-03**

This is the short, live map of the repository. It exists so old worker waves, ticket ledgers and handoffs cannot be mistaken for the current project state.

## Canonical repository state

- Checkout: `/Users/domenico/Code/StrumentiUtili.it`
- Branch: `main`, tracking `origin/main`. The redesign/backend source tranche is committed as `3722032` (`feat: ship redesigned utility workspace and account backend`); regenerated evidence and closure documentation are committed separately so source fingerprints stay meaningful.
- The retired catalogue/workbench/a11y implementation is deleted: `src/pages/library.astro`, `src/library/**`, `src/components/library/**`, the retired Workbench UI, the old accessibility wrapper layer, `scripts/build-catalog.ts`, `scripts/lib/catalog-compiler.ts`, and their obsolete tests.
- The replacement shell/catalog/account implementation is tracked: `src/catalog/{groups,projections}.ts`, `src/components/{home,catalog,account,icons}/**`, the new shell, public routes, `worker/**`, self-hosted Inter fonts, expanded-local evidence and matching acceptance tests.
- Throwaway debug scripts and screenshots are gone. `design/references/redesign-20261003/` is intentional retained design provenance, not working-tree debris.
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
- Optional account, served by `worker/index.ts` (Cloudflare Worker + D1, `wrangler.jsonc`): PBKDF2-SHA256 at **600,000 iterations** (measured at ~81 ms per hash on the owner's machine), an opaque 30-day session cookie (`HttpOnly; Secure; SameSite=Lax`), only the SHA-256 token digest in D1, sliding-window login throttling, and Cloudflare Turnstile verified server-side for registration and sign-in. A credential hashed with a lower work factor is re-hashed on the next successful sign-in (`needsRehash`). The real `strumentiutili-auth` D1 database exists in EEUR, migration `0001_init.sql` is applied, and the four expected tables (`users`, `sessions`, `login_attempts`, `favorites`) were queried successfully. The current stable deployment is `https://strumentiutili-it.massafradomenico4.workers.dev`; the Turnstile secret exists only in Cloudflare while the public site key is tracked in `src/config/security.ts`. The static product still remains deployable without the account worker.
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

Closure gate snapshot: **50 test files / 344 tests PASS**, `astro check` reports **0 errors / 0 warnings / 0 hints** over 1192 files, and the static build produces **220 pages**. Re-run the commands below rather than treating these numbers as permanent.

## Release status

The post-commit release validation has **0 errors**. Browser evidence is current and PASS; the rollback gate is now PASS after a real Cloudflare deploy → 100% rollback → live smoke → restore exercise. The remaining release blockers are intentionally evidence-bound:

1. 31 implemented tools still have no Gold receipt;
2. `image-resize` remains Partial rather than Gold;
3. physical Android Chrome evidence for `image-resize` is missing;
4. physical iOS Safari evidence for `image-resize` is missing.

All 168 existing Gold receipts were regenerated against source fingerprint `9d532b7bf863338382f3a254373f6e9b31bd95ee8f6e763ac613f4ad0786cf71`. The fresh browser matrix targets the same fingerprint. Do not synthesize the remaining device/certification evidence.

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

- The remaining 31 unverified tools need independent family evidence before promotion; this is the certification roadmap, not hidden WIP.
- `image-resize` needs genuine physical iOS Safari and Android Chrome runs. Desktop emulation does not count.
- The Worker already has an internal login-attempt limiter, but an **outer Cloudflare WAF rate-limit rule** requires a user-controlled custom domain/zone; it cannot be attached in front of the account API while the only public hostname is `workers.dev`. Add it when the custom domain is connected.
- The repository cannot prove the Cloudflare billing plan. Because the measured PBKDF2 cost is well above a Free Worker CPU budget, confirm Workers Paid before relying on production password flows.
- When a custom domain is attached, add that hostname to the existing Turnstile widget as well.

## Authority map

- `PROJECT-STATUS.md` — current repository/product snapshot (this file).
- `HANDOFF.md` — what a next engineer reads first and which gates to run.
- `ROADMAP.md` — current priorities and certification frontier.
- `PRODUCT.md` — product contract and the optional-account scope; `PRODUCT-SPEC.md` — acceptance criteria US-01…US-17.
- `design/WORLD.md` — canonical visual authority; `DESIGN.md` — the structural system (catalogue, tool surface, account area as three layers); `tests/design-system.test.ts` — the visual contract.
- `src/generated/catalog.ts`, `src/generated/quality.ts`, `quality/receipts/expanded-catalog-certification.json` — generated catalog and certification truth.
- `worker/index.ts`, `worker/migrations/0001_init.sql` — the account API contract and schema.
- `src/catalog/groups.ts` — the public grouping over the internal taxonomy.
- `.scratch/`, `tasks/prompt2prompt/`, `research/`, `docs/history/` — historical provenance only.

## Next source-changing tranche

The redesign/backend/refactor tranche is closed, committed, deployed and recertified. Any new source edit changes the evidence fingerprint, so treat the next work as a new tranche. The next source work is family-by-family certification of the 31 unverified tools; `image-resize` stays separate until physical-device evidence is available. Infrastructure work that depends on ownership/billing (custom domain + outer WAF rule + plan confirmation) should not be mixed into a source fingerprint unless it changes repository code.
