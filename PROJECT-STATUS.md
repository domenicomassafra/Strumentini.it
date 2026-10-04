# StrumentiUtili.it — Current Project Status

Date: **2026-10-05**

This is the short, live map of the repository. It exists so old worker waves, ticket ledgers and handoffs cannot be mistaken for the current project state.

## Canonical repository state

- Checkout: `/Users/domenico/Code/StrumentiUtili.it`
- Branch: `main`, tracking `origin/main`. The tool-hardening + frontend-system audit tranche is integrated locally; generated evidence is kept separate from the source fingerprint by design.
- The retired catalogue/workbench/a11y implementation is deleted: `src/pages/library.astro`, `src/library/**`, `src/components/library/**`, the retired Workbench UI, the old accessibility wrapper layer, `scripts/build-catalog.ts`, `scripts/lib/catalog-compiler.ts`, and their obsolete tests.
- The replacement shell/catalog/account implementation is tracked: `src/catalog/{groups,projections}.ts`, `src/components/{home,catalog,account,icons}/**`, the new shell, public routes, `worker/**`, self-hosted Inter fonts, expanded-local evidence and matching acceptance tests.
- Throwaway debug scripts and screenshots are gone. `design/references/redesign-20261003/` is intentional retained design provenance, not working-tree debris.
- Git hygiene rechecked on 2026-10-04: remote branches: only `main`; worktrees: one primary worktree; stashes: none.
- Archive tags: three, all prefixed `archive/2026-09-24-` and explicitly closed historical references, not active work (`performance-wip`, `a11y-wip`, `browser-acceptance-wip`). Their relevant performance/search/browser behavior is already represented by the current projection, lazy-loading and acceptance architecture; retired Library/Workbench deltas are not a queue.
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
- Optional account, served by `worker/index.ts` (Cloudflare Worker + D1, `wrangler.jsonc`): PBKDF2-SHA256 at **600,000 iterations**, an opaque 30-day session cookie, sliding-window throttling and server-side Turnstile for email/password. Google Identity Services support is implemented with a server-issued nonce and Worker-side RS256/JWK verification; new Google users can create a password later, while an existing password account must explicitly link Google from settings. D1 migrations `0001_init.sql` and `0002_google_auth.sql` are applied remotely. Production currently fails closed for Google because no `GOOGLE_CLIENT_ID` is configured yet; the Google controls stay hidden rather than exposing a broken login. The static product still remains deployable without the account worker.
- Local-first workspace: onboarding starter set, installed/recent tool set, work profile and last values persist in IndexedDB/`localStorage` (`src/workbench/**`, `src/profile/**`, `src/persistence/**`). No file content or job result is ever sent anywhere.
- 35 tools declare work-profile fields; 71 declare typed handoff metadata; 200/200 are bound to an oracle entry and a fixture family.

## Quality frontier

Machine authority: `quality/receipts/expanded-catalog-certification.json`, generated by `npm run certification:build` (`scripts/build-certification-index.ts`). The site imports the derived `src/generated/quality.ts`; public `Verificato` / `In verifica` labels read the same authority.

- **198 Gold**
- **1 Partial**: `image-resize` — automated certification passes, but genuine physical iOS Safari and Android Chrome evidence is still missing.
- **1 Implemented Unverified**: `ris-bibtex-converter` — browser acceptance passes, but oracle `cand-187` remains medium-confidence because no single freely accessible normative RIS authority is treated as canonical and no independent parser cross-check has closed that gap.
- **2 release-blocked tools total**: the Partial tool plus the one unverified tool.
- 200/200 oracle-bound, 200/200 fixture-bound, 200/200 local-declared; physical-device passes: 0.
- Gold tranche additions in this wave: **13 research-knowledge**, **9 local-jobs**, **8 marketing/media**. `image-resize` was deliberately not promoted.

The formerly large frontier is closed. There is no justification to add more tools merely to increase the catalog count; new tools should only be added for a clear missing job with full implementation and evidence in the same tranche.

Closure gate snapshot on the integrated tree: **55 test files / 592 tests PASS**, `astro check` **0 errors / 0 warnings / 0 hints** over **1216 files**, static build **220 pages**. Browser acceptance is PASS for research-knowledge (14 routes), local-jobs (9 tools), and marketing/media (10 result checks, including QR raster round-trip and EXIF byte-level proof).

## Release status

The catalog/tool implementation itself is now nearly closed: **198/200 Gold**, with only the intentionally unclosed RIS oracle and physical-device image-resize gate. The portable static check passes.

Remaining release blockers are evidence/infrastructure boundaries, not hidden implementation failures:

1. `ris-bibtex-converter` has no Gold receipt until the RIS oracle gap is closed with an acceptable independent authority/cross-check;
2. `image-resize` remains Partial until real iOS Safari and Android Chrome device receipts exist;
3. the verified rollback receipt must be refreshed after the final committed source tree is deployed and rolled back for real;
4. any whole-tree browser-performance receipt must match the final source fingerprint.

All **198 Gold receipts** have been regenerated against source fingerprint `af36506d34b3cfe26d9b1c8247d8dbcba3788cb23ea17688479133b9b5edbc54`. Do not synthesize the two physical-device receipts or weaken the RIS oracle requirement.

## Design system and brand

- `design/WORLD.md` is the canonical visual authority: one accent (`--brand #0b6cfd` — primary action, link, active state, computed value), Inter self-hosted as variable woff2 (latin + latin-ext, preloaded, `font-display: swap`), Roboto Mono for machine output only, white cards on a very light blue canvas, a fixed eight-tone category wheel, and a dark mode that redefines the same roles rather than inverting them.
- `src/styles/global.css` implements it, and `tests/design-system.test.ts` parses the palette table straight out of `design/WORLD.md` so token drift fails the suite. It also refuses local colour literals, a second token authority, dead tokens, and contrast-floor regressions in both themes.
- `design/WORLD.md` §SURFACES lists the ten surfaces; the implementation matches it (`/`, `/strumenti/`, `/cerca/`, `/categorie/[slug]/`, `/tools/[slug]/`, the workspace, `/preferiti/`, `/impostazioni/`, `/accedi/`, `/onboarding/`).
- `design/FRONTEND-SYSTEM-STANDARDIZATION.md` is the implementation-ready refactor authority produced from the Impeccable audit. It maps duplicated primitives, concrete component/token APIs, what must remain surface-specific, migration order, screenshot/browser gates, and eight progressive waves. The rule is **consolidate the existing visual system, do not create a parallel component library**.
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
| `npm run acceptance:auth` | the account API end to end against `wrangler dev` + a throwaway local D1: Google config/nonce boundary, register/login/session/profile/password/sessions/delete + favourites, cookie attributes and throttling |
| `npm run acceptance:expanded-local` | the 49-tool expanded-local batch against the built static site |
| `npm run acceptance:local-jobs` | the 9-tool local-jobs tranche: semantic output, locality, lazy loading, 390px, a11y and Italian error states |
| `npm run acceptance:research-knowledge` | all 14 research-knowledge routes, including the one intentionally left unverified on oracle grounds |
| `npm run acceptance:marketing-media` | URL/marketing, QR and image-media browser behavior, including QR raster and EXIF byte-level proofs |
| `npm run gold:local-jobs` | replays every local-jobs fixture vector and writes the nine Gold receipts |
| `npm run gold:research-knowledge` | certifies the 13 research tools whose oracle gaps are actually closed |
| `npm run gold:marketing-media` | certifies the eight marketing/media tools |

`npm run release:validate` combines the catalog, the build and `scripts/validate-release.ts`; `npm run acceptance:family-matrix` and `npm run acceptance:browser-performance` regenerate the heavier browser matrices. Neither is a substitute for the gates above. The two sibling acceptance scripts that assert on console errors must tolerate the single `/api/auth/session` probe a static server answers with 404, exactly as `scripts/acceptance-family-matrix.mjs` documents.

## Real technical debt still worth addressing

- `ris-bibtex-converter`: close the RIS oracle gap honestly; browser behavior is already accepted, but medium-confidence provenance is not enough for Gold.
- `image-resize`: collect genuine physical iOS Safari and Android Chrome evidence. Desktop emulation does not count.
- Frontend consolidation: implement `design/FRONTEND-SYSTEM-STANDARDIZATION.md` wave by wave. The audit found substantial repeated UI/CSS patterns; standardize primitives such as controls/actions/states/cards/pagination first, but keep homepage/catalog/tool/account compositions distinct where their jobs differ.
- The browser acceptance run exposed why that refactor matters: some family renderers still rely on wrapping-label behavior instead of one consistently associated field primitive. Accessibility semantics belong in the primitive, not in each tool.
- The Worker already has an internal login-attempt limiter, but an outer Cloudflare WAF rate-limit rule requires a user-controlled custom domain/zone. Add it when the custom domain is connected.
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
- `.scratch/`, `tasks/prompt2prompt/`, `research/`, `docs/history/` — historical provenance only.

## Next source-changing tranche

The next meaningful source tranche is **frontend-system consolidation**, not catalog growth. Follow `design/FRONTEND-SYSTEM-STANDARDIZATION.md` in its staged order: first shared primitives/tokens and low-risk drift, then family renderers, and only later the riskier tool-shell/file-drop areas. Each wave must preserve the approved reference screens and rerun visual/browser gates before proceeding.

Certification work remains separate: close `ris-bibtex-converter` only when the oracle can be strengthened honestly; keep `image-resize` separate until real physical-device evidence exists. Infrastructure work that depends on ownership/billing (custom domain, outer WAF, Google client ID, plan confirmation) should not be mixed into a source fingerprint unless repository code changes.
