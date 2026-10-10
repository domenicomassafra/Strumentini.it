# ROLE B — UX evidence, three redesign directions, full-surface coverage

Status: specialist proposal for coordinator integration; 2026-10-10. Planning only. No visual direction is owner-approved; no app, ticket archive, shared design authority, deployment or quality receipt is modified here. OWN-01–20 in docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md and the current mega prompt control this proposal. Local shorthand UX-B identifies proposals, NOT official issue IDs.

## Factual baseline and how to read it

Sources read: docs/AUDIT-INDIPENDENTE-STRUMENTINI-2026-10-10.md §§3,5,12,14; docs/audit-2026-10-10/README.md, ticket-triage.md; actual screenshot boards contact-1440-light-all.png, home-1440-light.png, home-390-dark.png, pdf-result-390.png, recent-after-result-390.png; DESIGN.md; design/WORLD.md; PRODUCT-SPEC.md; src/components/home/HomeHero.astro and src/pages/index.astro; src/components/search/GlobalSearch.astro; src/components/tools/shared/{ItalianToolPage.astro,ToolResultPanel.tsx}; src/runtime/{file-result.ts,binary-handoff.ts,related-tool-graph.ts}; src/workbench/{membership.ts,state.ts}; related original issues #45, #73, #75–#87, #98/#99, #102, #104–#107, #111–#114, #237, #277–#281. Current HEAD observed fbfc9f1, original archive 327 issues. Screenshots are audits of the previous deploy, not mocks or newly accepted UX.

Observed facts, with boundaries:

| Evidence | Consequence for new specification | What it does NOT prove |
|---|---|---|
| Home desktop shows generic slogan, floating tiles and category cards before local state. Home mobile shows large hero/trust blocks before tools. src/pages/index.astro orders HomeHero, TrustRow, CategoryGrid, RecentTools, StarterTools. | Two intentional entries, search-first and file-first; direct returning-user continuation. Remove duplicated ornament/claims via shared composition. | No user study of what people prefer; no selected visual identity. |
| The contact sheet shows thirteen real surfaces with similar card/pill/feature hierarchy. Directory at 390px was ~9683px and category ~9170px; 320px >10k for those pages. | Distinct information hierarchy by intent, short useful result rows, facets on demand, contextual support after the task. | Page length alone is not a failure or measured task time. |
| Mobile PDF result screenshot: controls + page ordering + result panel stacked; image compression exposes codec details before ordinary goal. | Sticky but non-obscuring output/next-step affordance, result announcement and guided default/advanced disclosure; touch plus keyboard replacement for reordering. | Existing Result v2 primitives are not absent: #73/#75/#78/#86/#98 already report completed scoped evidence. |
| Search ranking for “unisci pdf”, zero-query palette, Escape/focus worked; results page adds panels above direct best match. | Preserve ranking/keyboard contract #105. Put best match and intent first; secondary facets and suggestions below or in disclosure. | Not a broken search engine. |
| After verified UTM operation, /preferiti/ recent remains empty. src/workbench/membership.ts has noteToolUse with no caller and without membership broadcast. | New shared successful-result→recent event wiring, reload/live-update test. Honest empty copy until available. | Favorite persistence is not wholly broken; file history does not yet exist. |
| Access Turnstile bootstrap fails in audited browsers; /accedi/ secondary note contrast computed 3.508:1. | Fix account entry in its own live slice independent of design-choice gate; fix token contrast before new skin. | Successful authenticated sync, Google login and account recovery remain unproven. |
| Audit exercised UTM, CSV, PNG, PDF outputs on Mac Chrome and 130 light/dark navigation states at widths 320,390,768,1024,1440, without overflow. | Reuse these journeys as regression seed; require independent artifact verification and actual devices for mobile acceptance. | 130 status-200 visits, synthetic outputs and desktop emulation do not certify real mobile, WCAG AA or 269 engines. |
| #102 binary handoff is 64 MiB bounded ephemeral same-origin; #107 graph only advertises executable edges for actual compatible runtimes. | Show “Continua con…” only when manifest/action/size allow it; incompatible or over-ceiling files get actionable alternatives and no fake seamless promise. | Every PDF/image/batch or advanced editor can chain today. |

Older DESIGN.md and design/WORLD.md encode the implemented blue/card skin and counts around 200 tools; they are implementation history. OWN-02, OWN-06–09, OWN-12, OWN-16–18 now supersede any implication that the old skin, directory-first order or desktop-priority is selected for the new redesign. The coordinator should update those shared authorities only with the confirmed invariants and explicit PENDING-OWNER status; do not select a palette/font by editing WORLD prematurely.

## Three genuinely different directions — designs to prototype, not decisions

All three must represent EXACTLY the same fixture set, capacities, failure cases and informational truth. Their differences must survive monochrome, the same typeface and an accessiblity pass. They are not “three color themes.” Avoid selecting a logo, accent, font, custom icon pack or animation style until the owner gate.

### Direction A — Strumenti in chiaro: rigorous, quiet, high-precision

Core idea: document-like clarity for someone with one immediate job. The first viewport is a compact question with TWO equally visible actions, “Scegli un file” and “Descrivi cosa devi fare”, plus three concrete actions by verb. Working layout has a single strong result and a concise input rail; text rows and meaningful whitespace replace hero blobs and repeated category cards. The returning home begins with real recent tools + “ripeti operazione”, with clear distinction between repeating settings and restoring a file (requires explicit opt-in).

Distinct mechanics: universal “find by job” row, thin searchable catalog with sortable columns, form sections progressively disclosed, operation result in the reading path, concise proof under output, minimal persistent chrome. PDF/image pages use compact file list + controls with inspection in adjacent panel desktop; mobile uses numbered steps and an output tray. Identity comes from disciplined typography/grid and confident factual copy, not decoration.

Trade-off to test: can look utilitarian/anonymous; reviewers must test recognition and engagement, not grade it automatically higher for neatness. On mobile, controls must remain reachable and input fields legible without sacrificing preview.

### Direction B — Atlante del lavoro: editorial, human, recognizable

Core idea: tell the story of what someone wants to produce, with strong Italian job naming and artifacts as visual anchors. Home offers a few worked examples (e.g., “Riunisci allegati”, “Sistema un CSV”, “Prepara un'immagine”) alongside file entry and fast search; the whole 269-tool catalog stays reachable by directory and intent. The work surface is a short sequence with purposeful headings “Parti da… → Imposta… → Controlla → Porta via”; output and evidence look like a finished deliverable, not another decorative card.

Distinct mechanics: sharp editorial heading/annotation hierarchy, visually demonstrative before/after artifacts, task collections that contextualize groups without inventing popularity, a “Quello che hai fatto qui” recap on return. Categories have distinct editorial intros plus compact tool listings; result comparison earns visual real estate while status/methodology stay actionable. Personal owner attribution is subtle in About/author/footer, separate from any commercial endorsement.

Trade-off to test: storytelling can slow a person who already knows the task; direct skip to form, search and download is mandatory. Illustrated samples are fixtures, labelled samples, never real user files or misleading outcomes. Long screens must collapse optional explanation.

### Direction C — Banco continuo: task/workspace-driven

Core idea: keep files, action selection and output in one visible, local workspace. Home for a new visitor offers a primary file tray/format detector beside action search; a returning visitor opens a small genuine local recent shelf. After adding a file, compatible operations appear alongside known limits. Input→preview→result→next operation stays in one task model, avoiding unnecessary fetch/download/re-upload.

Distinct mechanics: desktop workspace has file shelf, central canvas/preview and properties/actions inspector; output and “Continua con” are first-class. Keyboard navigation and explicit click controls replicate drag, select, reorder, masks and undo; mobile turns those panes into a single ordered stepper with an always accessible “risultato” position and predictable return. Documents are ephemeral unless an explicit save-to-device/local-retain action succeeds; project persistence is not presumed.

Trade-off to test: denser UI, more state and higher memory pressure; tool-only deep links must still start and complete with no workspace setup. This proposal must pass cold-load/lazy and memory study before adopting a persistent multi-file shelf. A file tray cannot imply documents live in an account/cloud.

### Identical prototype deliverables for each direction

One interactive, locally viewable future prototype per direction, with the SAME input/output fixtures and acceptance script. State coverage: first visit and return on /; file-first and search-first; /strumenti/ filtering; /categorie/pdf/; /cerca/ with hit and zero; /tools/utm-builder/ (text/form success + error); /tools/csv-cleaner/ (file + real output + onward handoff when compatible); /tools/pdf-merge/ (multiple files, reorder, preview, progress, cancel, download); /tools/image-compression/ (default objective + advanced codec disclosure); /preferiti/ empty+recent; /onboarding/ generated set; /accedi/ available+unavailable; /impostazioni/ privacy. Capture at 390 and 1440 for all core surfaces; at 320/768/1024 for shared responsive templates. Include light/dark conceptual treatment, reduced-motion, focus path and a screen-reader narrative. Prototypes must label unsupported operations as simulated, never suggest backend or security capability shipped.

Owner gate decision artifact (ONLY this gate PENDING-OWNER): side-by-side comparison of the three prototype URLs/screens, same fixture/screen/task, alternatives named A/B/C and a signed owner choice/revision with date, rationale, binding tokens/components decision and no ambiguity about scope. Do not infer choice from old WORLD, reference screenshots or a casual reaction. Patches for current account, recent use, accessibility and source truth can proceed without this gate.

### Observable choice rubric (proposed, not owner-approved scoring)

Each dimension score 0–4 using a predeclared test (0 broken/unusable, 1 needs help, 2 completes with friction, 3 clear independent completion, 4 fast, recoverable and distinctive). Weights are relative proposal weights, not fabricated user metrics:

| Dimension | Weight | Evidence collected on SAME journeys |
|---|---:|---|
| First task & discoverability | 20% | New visitor locates PDF merge, CSV cleaner, UTM without help; count actions, wrong path, time-to-useful-output |
| Result/output truth | 20% | Output clearly selected and validated; user distinguishes preview, downloaded artifact and safety caveat |
| Continuity & return | 15% | Existing tool settings/results reused only with allowed state; recent is genuine; compatible next action |
| Mobile editor/task equivalence | 15% | 320/390 phone interaction, native Files/Photos, keyboard alternative, zoom/gesture alternatives |
| Character & IA differentiation | 10% | Blind comparison of silhouette, hierarchy, artifact-oriented expression and recall, sans accent color |
| Dense catalog and advanced controls | 10% | 269-item discovery, layered advanced control, no giant undifferentiated card wall |
| Focus, accessibility and motion | 5% | Keyboard/VoiceOver/TalkBack sampling, AA contrast, reduced-motion, assistive feedback |
| Engineering and resource cost | 5% | Reuse of shared seams, lazy-load/cold path, peak memory plan, no imaginary full-payload persistence |

Mandatory floor before scoring a direction as viable: users can complete all three principal journeys anonymously, no hidden upload, no fabricated certified badge, keyboard alternative for drag, focus order and recovery, readable result at 320, reduced-motion, output accessible as native download, direct tool URL behavior preserved. A direction failing a mandatory floor needs correction; weights never override it. Use 8–12 observed users for directional discovery if available, log incomplete recruitment as such; don't treat panel results as owner selection.

## Information architecture and all template/state surfaces

Neither the chosen visual skin nor account/cloud is a prerequisite to adding file-first and fixing false copy. Global IA should preserve the public slugs and indexability where currently present; /library/ historical redirect remains. The currently generated manifest controls what a route supports. Global nav must make search, file entry, full catalog and actual local area reachable while differentiating first vs returning visitors.

| Surface/template (real current route or future explicitly marked) | State variants and action to represent | Owns UX-B slice |
|---|---|---|
| Global SiteHeader/ShellChrome/SiteFooter; every route | desktop primary nav, keyboard palette, mobile drawer, back/forward, active route, theme; clear file entry and real author/footer link; no dialog trap | UX-B05/06/25 |
| Home / first visit | file-first plus search-first, job examples, no gating signup or jargon, accurate runtime badge only where supported | UX-B07 |
| Home / return | installed, actual recents, saved configuration vs saved files distinguished; empty/denied storage has fallback | UX-B07/10/19 |
| Full directory /strumenti/ | all 269 tools searchable, facet applied/reset/shareable via URL, sorted compact rows, loading/empty and pagination; 320 density | UX-B08 |
| Category /categorie/ and /categorie/[slug]/ | ten public categories preserved with real counts, pertinent job entry; favorites vs library distinction; no forced card repetition | UX-B08 |
| Search /cerca/ and GlobalSearch dialog | exact hit top, grouped results, zero with query intact, escape/focus restore, virtual keyboard, offline searchable index; entry source remembered only if consent | UX-B09 |
| Initial onboarding /onboarding/ | explain why questions matter, skip, recover/back, generated starter reasons, edit tools, explicit save destination | UX-B20 |
| Tool wrapper /tools/[slug]/ (shared ItalianToolPage) | user task first; valid input, help, runtime and true quality note; form and result near each other; SEO sections lower | UX-B11 |
| Plain calculator/validator /tools/utm-builder/ | empty, invalid, calculation success, copy/download, provenance/safe defaults, reset/rerun | UX-B11/12 |
| File image /tools/image-compression/ | picker, incompatible format, size preflight, objective preset, advanced settings, actual output/comparison, save/next action | UX-B12/13/14 |
| Multi-file PDF /tools/pdf-merge/ | file add/removal/order, keyboard move, page preview when verified, batch progress, cancel, partial/error, download and re-opened artifact | UX-B12/13/14 |
| Data import /tools/csv-cleaner/ | source info, encoding/headers/preview, error-safe original, output comparison, copy/download and executable CSV→CSV handoff | UX-B12/14 |
| Tool results shared Result v2 + batch/file | idle/loading/progress/success/warning/partial/error/cancel/retry/stale suppression, bounded preview, manual download/share or auto-download opt-in, metadata/verification/return focus | UX-B14/15/26 |
| Consecutive actions /tools/csv-cleaner/ to /tools/csv-dedupe/ | explicit compatible action with details of transfer, confirmation, no hidden uploading; over 64MiB refusal/recovery | UX-B16 |
| Local area /preferiti/ | zero-state, installed/favorites, recent tools from completed operations, saved history opt-in, storage cleared/denied, sensible suggestions | UX-B19 |
| Settings /impostazioni/ | profile/theme, sound off/on, reduced-motion/system handling, storage visibility/capacity, export/delete local history, account state | UX-B21/22 |
| Access /accedi/ | register/login/logout, anti-bot loading/error retry, unavailable backend, keyboard/password help; optional use remains | UX-B02/03/23 |
| Resources /risorse/ | human descriptions: what stays local, optional server, quality/current limits, support/contact, author | UX-B24 |
| Trust and errors, all routes | not found /404/, missing format/API, disabled feature/no permission/large file, storage quota, API offline, network explicit refusal, partial downloads | UX-B15/24 |
| Advanced PDF editor (future route to be chosen, linked to #237/#247) | page thumbnails, annotate/edit/form/OCR/redact only when certified, undo/history and export proof; 320–1440 equivalence | UX-B27/29 |
| Advanced image editor (future route to be chosen) | layers/masks/selections, image composition, undo/history, source vs project export; mobile virtual panels, memory gates | UX-B28/29 |
| Advanced data/XLSX workflow (future route to be chosen) | sheet/table preview, precision/formula boundaries, selection/edit/compare/join/export; mobile row inspector, work queue | UX-B29/30 |
| Sound and motion settings/state | animation progress/transition and opt-in start/success/error sounds; focus/live-region always semantic, sound never sole signal | UX-B22 |
| Network-opt-in feature, if approved future | upfront consent, precise data/file transmitted, cost 0 ceiling, cancel/delete expiry status, local/unsupported fallback | UX-B24 |

Note: future advanced editor routes intentionally require a route/SEO decision ticket; creating route names in this proposal would falsely claim product URL authority. The general shell/template contract applies to marketing, research, file/archive, developer, audio/video and fiscal tool families as well as PDF/image/data. Fiscal tools require year/source/methodology/status next to result, with refusal rather than made-up precision; concrete fiscal logic is owned by ROLE A/quality tickets.

## Required transitions and persistent state vocabulary

State machine proposed for operation UI: empty → selected input → preflight (supported/degraded/refused) → configurable → running (progress known/indeterminate; cancel permitted where supported) → success/partial/warning/error/cancelled → preview/verify → download/copy/share → compatible next action. Each transition must show location of current artifact and status; failed subsequent runs invalidate stale download. Retry keeps user-safe input when feasible and never resubmits an opaque upload silently. File name, size and format are displayed only for the actual local File object and never sent to telemetry.

Vocabulary and data owner:
- “Strumenti preferiti” = installed tool IDs, with optional account sync only for explicitly supported fields. Do not equate to saved files.
- “Usati di recente” = actual successful tool invocation per this device, tool ID + non-sensitive time; no files or raw outputs, observable live and after reload.
- “Risultati di questa sessione” = ephemeral in-memory artifacts until tab lifetime/capability; warn about tab close, refresh and storage denial.
- “Cronologia locale” = opt-in metadata operations and, only if explicitly requested/successfully stored, local file artifacts with capacity limits and clear/export, no account cloud default. Storage opt-in must support revocation and irreversible clear.
- “Salva il file” = browser/OS download or user-authorized Files/Photos/share, independent from local preference history. No silent auto-download by default; optional user-controlled auto-download setting.
- “Continua con” = executable edge validated by #102/#107 and target manifest; unsupported edges may be informational related-tool links labelled as such.

For local server execution exceptions, the file/input is not “always local”: per-operation source truth must identify network transport, explicit choice, retention/deletion, cancel/error and alternative before upload. Data-classified privacy copy from runtime should be displayed contextually, not a global unverifiable absolution.

## Responsive, inclusive-design and real-device floor

Widths 320, 390, 768, 1024, 1440 CSS pixels at both themes, plus zoom/reflow at 200%; record screenshot and DOM/focus evidence for every canonical template and meaningful state, not just screenshot of the homepage. Screenshots alone are not physical testing. Workflows must be usable with the iOS Files/Photos picker, Android Documents/Photos picker and ordinary keyboard/touch. Dragging a file or page has an explicit Select file/Add, Move up/down, reorder list or numeric position alternative. Touch targets and spacing tested against WCAG 2.2 (including target-size exceptions rather than crude pixel-only heuristics); label/input association, contrast ≥4.5:1 ordinary text and ≥3:1 meaningful non-text/UI, visible focus/not obscured, screen reader announcements, error recovery, no reliance on color/sound. No horizontal page overflow at 320; inner editor canvas/panes may intentionally pan with a labelled navigator and accessible fit-to-screen mode.

Advanced editor mobile proposal: navigation shell collapses; file/pages/layers panels are switchable sheets/tabs, independent of pinch/drag; object selection exposes inspector and undo/redo; keyboard and screen reader retain linear order; export survives OS background/permission failure gracefully. The acceptance study measures before setting ceilings: actual peak memory, input/output MB, warm/cold route/chunk, time-to-result, cancel cleanup, Safari/Chrome OOM/restart and post-resume state on physical devices at representative file sizes. The physical evidence is related to still-open original #277/#278/#280/#281, but advanced PDF/image/data need NEW scoped device tickets after design/engine capabilities exist. No assumed high-end-only cutoff or “desktop-only” escape without measured independent owner decision.

Sound: disabled by default; a clearly labelled opt-in in /impostazioni/, separate per-category toggles only if justified by prototype, mute always immediate, never auto-play through browser restrictions, no sensitive file titles in sound/notifications. Reduced-motion follows system unless user has explicitly chosen a compatible preference; never disable actual progress information. Motion benefits the task (input recognized, file entered, result ready, handoff) and cannot delay controls/download. Recording, telemetry and analytics remain content-free.

## Future verification and nonblocking gates

1. Reuse audit synthetic fixtures for UTM, CSV, PNG, PDF; independently reopen downloaded bytes; instrument measured steps/errors/first useful result without content telemetry.
2. Deliver three identical clickable journey prototypes and a per-direction evidence/rubric sheet; owner visually decides only after side-by-side mobile+desktop comparison. If owner requests revision, update only affected direction and choice ticket.
3. In parallel fix independently proven live failures (Turnstile, secondary-text contrast, recents wiring, misleading area copy), with fresh cross-browser checks and no implied account success.
4. After choice, implement shared foundations before per-family editor templates. Verify no regression of 269 manifest routes, deep links, localized names, indexability/redirects, eager script, consent and known Result v2 action semantics.
5. Browser matrix and physical device receipts must specify device, OS/browser, branch/build fingerprint, method, artifact and observed refusal; Android unavailable leaves a specific physical AC open while desktop implementation and design remain plannable.
6. Release of redesigned UI requires controlled preview/canary, rollback rehearsal, security-sensitive route guards (#237/#247 untouched unless separately authorized), accessible smoke and current trusted-output provenance. No global “Gold” from visual screenshots.

Specific ticket proposals, dependency suggestions, acceptance and coordinator reconciliation are in UX-TICKET-SLICES.md beside this document.
