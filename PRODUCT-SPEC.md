# Strumentini.it — Canonical Product Specification

Status: implementation authority for the first validation build
Date: 2026-09-23
Public name: **Strumentini.it**.

This document supersedes the earlier product-definition notes for implementation scope. The research and lane artifacts remain evidence and decision history; when they disagree with this file about v1 scope, this file wins.

## 1. Product thesis

Strumentini.it tests one narrow proposition:

> A personal utility workbench for the small jobs behind knowledge work.

The user-facing product is **not** a directory of hundreds of tools. The large catalog is supply infrastructure. The daily surface is a small installed toolbox that is relevant to the user's work, can reuse safe visible defaults, and remains fast enough to replace hunting through search results, bookmarks, spreadsheets, and one-off utility sites.

The current evidence does **not** prove that a persistent workspace is broadly wanted. The first build therefore exists to test the workspace thesis, not to assume it.

Candidate value claim:

> Your everyday work tools, already set up for your work.

## 2. Initial users and jobs

Primary validation users:

- freelancers and consultants;
- small client-service agencies;
- marketers and growth operators;
- researchers and evidence-heavy knowledge workers;
- professional creators and operations-heavy independent workers.

Strongest recurring job territories from the completed demand research:

1. data cleanup and comparison;
2. client-work economics and scheduling;
3. campaign operations;
4. research-evidence preparation;
5. file and asset handoff.

Developer utilities can reuse the same engines later, but developer/data is not an initial positioning wedge because the incumbent alternatives are unusually strong.

## 3. Constitution — non-negotiable constraints

These constraints inherit into every implementation ticket.

- **C-01 — Public brand.** Strumentini.it is the selected public brand and must be used consistently on public product surfaces.
- **C-02 — Workbench over catalog.** The primary product surface is a small personal Workbench. The Library is secondary supply, never the default wall of tools.
- **C-03 — Anonymous first value.** A user can complete an ordinary deterministic tool task before onboarding, account creation, or sign-in.
- **C-04 — Local deterministic normal path.** Ordinary deterministic operations run in the browser and require no backend request.
- **C-05 — No normal-path LLM.** Search, recommendations, calculations, transforms, onboarding rules, and deterministic tools must work without model inference.
- **C-06 — Local means local.** A tool declared LOCAL performs no network request with user input or output. Files are not uploaded merely because a future user is signed in.
- **C-07 — Minimal transparent Work Profile.** A tool receives only profile fields it declares. Reused values show provenance, remain editable, and never silently overwrite an explicit per-task override.
- **C-08 — Compile-time-known executable catalog.** V1 has no runtime-downloaded executable plugin marketplace.
- **C-09 — Lazy tool code.** Catalog growth must not linearly grow the initial application bundle; tool/engine code loads on demand.
- **C-10 — Typed indirect handoff.** Tools do not import each other. Handoff uses typed descriptors and shows exactly what data will pass.
- **C-11 — Gold before public default.** Only Gold-certified tools may appear in default starter sets or count toward public catalog-size claims.
- **C-12 — Native-first dependencies.** Prefer Web Platform/standard-library capability. Every runtime dependency must pass a documented capability, size, license, maintenance, security, and lazy-load gate.
- **C-13 — Accessible and mobile-complete.** Public behavior targets WCAG 2.2 AA, keyboard completion, visible focus, 200% zoom/reflow, reduced motion, and a task-first mobile hierarchy.
- **C-14 — Ad-free validation build.** No ads or ad SDKs in the first validation build. Any later ad experiment must remain outside the operational task path.
- **C-15 — Content-free telemetry.** Analytics never sends raw text, URLs, filenames, files, tool output, or Work Profile values. Only events needed to test explicit product hypotheses are allowed.
- **C-16 — No account/sync in the first validation build.** Local persistence plus explicit configuration export/import is sufficient until repeat Workbench use creates observed cross-device friction.
- **C-17 — No v1 offline/PWA promise.** The architecture may remain cache-friendly, but the first validation build does not advertise installability or an offline SLA.
- **C-18 — No live/regulatory first-wave dependency.** V1 avoids live FX, maintained holiday feeds, tax/payroll/legal rules, and other update-sensitive behavior.
- **C-19 — Explainable deterministic discovery.** Search ranking and starter recommendations derive from structured metadata/rules and expose concise reasons; no opaque AI recommendation narrative.
- **C-20 — Inputs are ephemeral by default.** Tool input/output is not persisted unless the user explicitly saves a preset/history artifact or exports a result.
- **C-21 — No SEO-tool-farm scope.** A tool exists because it completes a real job and passes the quality contract, not to manufacture a keyword page.
- **C-22 — Candidate visual tokens are not brand lock.** Quiet Workbench structure is authoritative for product UX, but font, logo, name, and accent remain revisitable in the later identity sprint.

## 4. Resolved product and technical decisions

- **DEC-01 — Shell concept:** Personal Workbench is the primary shell; universal Search/Command and input recognition are accelerators inside it, not competing home concepts.
- **DEC-02 — Daily surface size:** starter and normal Workbench target is 10–15 installed tools; visible suggestions are capped at 2–4.
- **DEC-03 — Navigation:** desktop uses stable rail + global search + main work surface; mobile uses at most Tools, Search, Library, and You.
- **DEC-04 — Onboarding purpose:** onboarding is a workspace generator, not a tour. Every question must change tools, pack suggestions, or safe defaults.
- **DEC-05 — Onboarding shape:** maximum four substantive stages after the promise: work context, recurring jobs, safe defaults, starter-set review.
- **DEC-06 — Packs:** packs are curated install sets/views over tool IDs, not folders, forks, workflows, or permission boundaries.
- **DEC-07 — Work Profile:** initial safe fields are locale, timezone, currency, date/number format, workweek, preferred units, plus narrowly justified optional tool-specific defaults.
- **DEC-08 — Search:** deterministic structured metadata search ranks installed exact matches, task intent, recent use, installed-pack relevance, then general catalog results.
- **DEC-09 — Tool page:** task and operation come first; context/trust/methodology follow. Runtime location is stated in literal language.
- **DEC-10 — Stack:** Astro static-first shell with strict TypeScript and Preact for interactive islands unless an implementation ticket proves a concrete incompatibility.
- **DEC-11 — Hosting:** Cloudflare Workers Static Assets is the default validation/production target, but the built `dist/` artifact must remain provider-portable static output. Ordinary deterministic tool execution does not route through a Worker.
- **DEC-12 — Browser floor:** current and previous major Chrome, Edge, Firefox, Safari, plus current and previous iOS Safari; other browsers degrade gracefully.
- **DEC-13 — File baseline:** File/Blob input, ordinary file picker, drag/drop where useful, and browser download. File System Access is progressive enhancement only.
- **DEC-14 — Storage:** IndexedDB for structured local product state; localStorage only for tiny non-sensitive preferences when justified; OPFS only for scratch/cache, never the sole durable copy.
- **DEC-15 — Heavy execution:** Web Workers + AbortSignal are the standard heavy-work seam; WASM is lazy and capability-specific, not a default.
- **DEC-16 — Manifest validation:** validate static tool manifests at build time. Runtime schema validation exists only at genuine trust boundaries.
- **DEC-17 — Schema tooling:** Zod is accepted for the build/catalog compiler and later server trust boundaries; do not load it into every deterministic tool.
- **DEC-18 — CSV parser:** no CSV parser is hand-rolled for production. The first table slice compares the current Papa Parse and `csv-parse` browser-capable candidates from the donor census against the adversarial corpus, bundle, worker, maintenance, license, and security gates, then pins the winner.
- **DEC-19 — First tracer:** Business Day Calculator is the first end-to-end Gold tracer because it is deterministic, dependency-light, has strong independent oracles, and proves visible Work Profile reuse without live holiday data.
- **DEC-20 — V1 portability:** installed tools, pack selections, layout, safe Work Profile, and preferences can be exported/imported locally in a versioned configuration; user files are excluded.
- **DEC-21 — Analytics posture:** Cloudflare Web Analytics is the baseline for aggregate page/performance signals. Longitudinal custom experiment events are enabled only for an explicitly disclosed validation cohort and contain no content/profile values.
- **DEC-22 — Parallel enablers:** outputs from the 20260923-181500 donor/spike/oracle wave are promotion inputs, not closure blockers. At closure time all four enablers are complete: OSS donor census, dependency-free core-engine spike, Gold oracle/fixture factory, and heavy-browser dependency/benchmark spike. Related implementation tickets must consume/promote their proven behavior, oracle data, fixtures, and dependency evidence before introducing equivalent code or a duplicate authority.

## 5. First Gold vertical set

Historical validation baseline: the first validation build targeted **15 Gold tools**. This section remains the acceptance baseline for that initial vertical set; it is not the current catalog or certification frontier. Current global status is published by `quality/receipts/expanded-catalog-certification.json` and summarized in `PROJECT-STATUS.md` / `HANDOFF.md`.

| ID | Tool | Primary engine | Why it is in the validation set |
|---|---|---|---|
| T01 | Business Day Calculator | Date/time | First tracer; Work Profile workweek/date defaults; independent calendar fixtures |
| T02 | Timezone Overlap | Date/time | Reuses timezone/working-hours context and tests repeated setup savings |
| T03 | Rate Converter | Client-work math | Reuses currency/rate/workday assumptions without live FX |
| T04 | Margin / Markup Calculator | Client-work math | Repeated client-work calculation with visible formulas |
| T05 | UTM Builder | URL/campaign | Campaign conventions/presets provide persistent-context leverage |
| T06 | Tracking Parameter Cleaner | URL/campaign | Deterministic URL transformation and natural handoff |
| T07 | Campaign Name Builder | URL/campaign | Tests whether saved naming conventions make the workspace meaningfully faster |
| T08 | CSV Cleaner | Table | Real-file/data job with strong demand evidence |
| T09 | CSV Dedupe | Table | Repeated data cleanup and direct follow-on from CSV Cleaner |
| T10 | CSV Column Map / Reorder | Table | Saved target shape and handoff value |
| T11 | List Compare / Dedupe | Text/list | Common deterministic comparison primitive across roles |
| T12 | Text Diff | Text/list | Cross-segment comparison; useful research/client evidence work |
| T13 | DOI / ISBN Normalizer | Research-reference | Gives Research a specific deterministic surface without semantic repair |
| T14 | Image Resize | Image | Real local file operation and destination preset leverage using native paths first |
| T15 | File Hash / Checksum Verifier | File/crypto | Local file handoff proof using Web Crypto/native streaming strategy where viable |

The implementation may expose focused modes behind a shared engine; it must not create 15 unrelated mini-app architectures.

Not in this first set: PDF engines, YAML/Markdown/QR, archives, OCR/media, live data, regulatory calculators, AI/semantic tools, account/sync, ads, and developer-only catalog depth.

## 6. Starter-context behavior

The same 15-tool pool must generate visibly different recommended sets for at least these contexts:

- **Client work:** T01, T02, T03, T04, T11, T12, T15 plus relevant universal tools.
- **Campaign ops:** T05, T06, T07, T08, T09, T10, T14 plus relevant universal tools.
- **Data cleanup:** T08, T09, T10, T11, T12, T15 plus relevant universal tools.
- **Research evidence:** T08, T09, T11, T12, T13, T15 plus relevant universal tools.
- **File & asset handoff:** T14, T15 plus relevant table/text tools; this context remains intentionally thinner until heavy-file research is promoted.

Each generated starter set contains 10–15 tools, can be edited before acceptance, and shows one traceable reason per recommended tool. The product does not claim that these are universally optimal packs; they are experiment inputs.

## 7. User stories and acceptance criteria

### US-01 — Complete a tool task anonymously

As a visitor with one small job, I can open a public tool route and finish it without creating an account.

- **AC-01.1:** A direct public tool URL renders the task and usable operation surface without authentication.
- **AC-01.2:** A LOCAL deterministic tool completes with zero network requests carrying task input/output.
- **AC-01.3:** The tool states its runtime behavior next to the operation in literal language.

### US-02 — Generate a starter Workbench

As a first-time user, I can answer only questions that change my starter tools or safe defaults and review the result before saving it.

- **AC-02.1:** Setup has no more than four substantive stages after the promise screen and always offers a Library/skip path.
- **AC-02.2:** At least four work contexts produce 10–15-tool recommendation sets from deterministic rules, and every pair among the four primary contexts has a symmetric membership difference of at least four tools.
- **AC-02.3:** Every recommendation displays one structured reason tied to context/job/pack evidence.
- **AC-02.4:** The user can remove recommendations and add/search alternatives before accepting the set.

### US-03 — Use and control My Tools

As a returning local user, I see my installed tools and recents before the catalog and can add/remove/reorder tools.

- **AC-03.1:** Workbench opens with Your Tools as the primary content and does not render the full catalog by default.
- **AC-03.2:** Installed tool state survives reload locally with no account.
- **AC-03.3:** Add, remove, and reorder actions are keyboard-operable and immediately reflected in the Workbench.
- **AC-03.4:** Recent records tool use without retaining raw task input by default.

### US-04 — Discover tools intentionally

As a user who needs a tool I have not installed, I can use Search or Library without scanning hundreds of decorative cards.

- **AC-04.1:** Search matches names, aliases, verbs/jobs, packs, categories, and input types from generated metadata without importing tool implementation chunks.
- **AC-04.2:** Search distinguishes Your Tools, Recent, and Library results and supports keyboard navigation on desktop.
- **AC-04.3:** Zero-result search preserves the query and offers close intents plus a request-tool action.
- **AC-04.4:** Library exposes compact list results and relevant facets; at large counts it avoids unbounded DOM growth.

### US-05 — Install curated packs without losing control

As a user, I can preview a pack, understand why its tools are relevant, choose which tools to add, and later remove any one of them.

- **AC-05.1:** Pack definitions reference existing tool IDs and never duplicate tool implementation.
- **AC-05.2:** Pack detail shows audience/job, tool count, tool reasons, already-installed count, and a per-tool checklist before installation.
- **AC-05.3:** Removing a tool that came from a pack remains allowed and does not corrupt pack/workspace state.

### US-06 — Reuse safe Work Profile defaults

As a repeat user, compatible tools can start with my saved safe defaults while keeping me in control.

- **AC-06.1:** A tool receives only profile fields declared by its manifest.
- **AC-06.2:** Every injected value includes provenance and is visibly marked in the UI.
- **AC-06.3:** An explicit per-task override wins for the current task and is not silently replaced.
- **AC-06.4:** The first Gold set demonstrates the same profile/default system across at least three distinct tools and two engine families.

### US-07 — Understand and trust each operation

As a user, I can tell what will happen to my data, what changed, and what assumptions produced the result.

- **AC-07.1:** Tool pages foreground task, inputs, primary action/result, then context/trust/depth in that order.
- **AC-07.2:** Calculations expose formula/assumptions/rounding where relevant; transformations state supported formats and preservation/change behavior.
- **AC-07.3:** LOCAL/REFERENCE/REMOTE/AI runtime class is machine-declared and rendered as literal explanatory text.
- **AC-07.4:** Invalid, empty, unsupported, too-large, processing, cancelled, success, partial-success, and capability-unavailable states are normalized where applicable.

### US-08 — Pass results to a compatible next tool

As a user finishing one operation, I can deliberately pass a compatible result to a useful next tool without copy/re-upload ceremony.

- **AC-08.1:** Handoff compatibility is derived from declared input/output descriptors rather than direct imports.
- **AC-08.2:** The proposal names the payload shape/size or count and requires an explicit user action.
- **AC-08.3:** Incompatible or lossy transfers are rejected or clearly disclosed before transfer.
- **AC-08.4:** At least one first-set flow proves handoff end to end (CSV Cleaner → CSV Dedupe is the required baseline).

### US-09 — Keep the workspace portable without cloud sync

As a user, I can keep my local configuration and move it explicitly between browsers/devices without uploading my working files.

- **AC-09.1:** Installed tools, pack selections, ordering/layout, safe profile values, and preferences persist locally.
- **AC-09.2:** Export creates a versioned configuration artifact containing no tool input/output files.
- **AC-09.3:** Import validates version/schema, previews material changes, and fails without corrupting current state on invalid input.

### US-10 — Use real file/data jobs locally

As a user handling tables or files, I can complete meaningful real-input work in-browser with clear limits and cancellation where needed.

- **AC-10.1:** CSV Cleaner accepts local files, handles adversarial CSV fixtures, and produces independently validated output.
- **AC-10.2:** Image Resize accepts local images, validates produced dimensions/format, and exposes mobile-safe size/capability limits.
- **AC-10.3:** File Hash/Checksum validates known vectors and does not upload the file.
- **AC-10.4:** Heavy/perceptible work exposes truthful progress or a stable processing state and cancellation when technically meaningful.

### US-11 — Receive Gold-quality deterministic results

As a user, I only encounter default/public tools that satisfy the declared quality contract.

- **AC-11.1:** Every first-set tool has stable manifest metadata, maintenance/privacy class, edge cases, and at least one independent correctness oracle.
- **AC-11.2:** Gold certification fails closed on required correctness, privacy, browser/mobile, accessibility, bundle/lazy-load, and oracle checks.
- **AC-11.3:** A certification receipt identifies the exact tool behavior/version and invalidates when relevant inputs change.
- **AC-11.4:** A tool with an open correctness blocker cannot remain Gold/default.

### US-12 — Get fast behavior as the catalog grows

As a user, opening the Workbench or Library remains fast even as metadata grows toward hundreds of tools.

- **AC-12.1:** Initial shell bundle contains no unrelated tool implementations.
- **AC-12.2:** Opening one tool does not fetch unrelated engine/worker/WASM chunks.
- **AC-12.3:** Normal simple-tool interaction introduces no >50 ms main-thread long task in the reference acceptance fixture.
- **AC-12.4:** Build output records shell, shared-engine, and per-tool bundle deltas so regressions are gateable.

### US-13 — Complete core flows on mobile and keyboard

As a mobile or keyboard-only user, I can complete the same core jobs without a degraded information hierarchy.

- **AC-13.1:** Desktop and mobile use their specified distinct navigation hierarchy rather than merely stacking the desktop rail.
- **AC-13.2:** Core flows are keyboard-completable with visible focus and correct focus restoration for palette/dialog interactions.
- **AC-13.3:** Primary touch targets meet the 44×44 px target and core flows remain functional at 390 px and 200% zoom/reflow.
- **AC-13.4:** Reduced-motion preference removes nonessential motion and no state is conveyed by color alone.

### US-14 — Fail safely and recover

As a user, malformed input, missing browser capability, storage failure, or a worker failure produces a useful state rather than silent corruption or fake success.

- **AC-14.1:** Runtime errors use normalized error codes/messages that preserve recoverable user input.
- **AC-14.2:** Storage denial/quota failure leaves the current in-memory result usable and reports that persistence failed.
- **AC-14.3:** Unsupported capability or file-size hard limits are rejected before unsafe/heavy allocation when preflight can know them.
- **AC-14.4:** Cancellation never reports success and a worker failure cannot leave infinite progress.

### US-15 — Measure the thesis without collecting work content

As the product owner, I can distinguish one-off acquisition from Workbench retention and default reuse without collecting users' task content.

- **AC-15.1:** Event taxonomy can distinguish tool entry source (public/search/workbench), completion, onboarding completion, pack install, profile-default applied/overridden, zero-result search, handoff use, and config export/import.
- **AC-15.2:** Event payload schemas reject raw input/output, filenames, URLs, and profile values.
- **AC-15.3:** Longitudinal experiment telemetry is off unless the user is in an explicitly disclosed validation cohort; ordinary deterministic operation remains functional when analytics is blocked.
- **AC-15.4:** The reporting plan can compute 7/30-day Workbench return, distinct tools reused, Workbench-vs-public launch share, default reuse/override, pack install, search failures, and handoff use for the validation cohort.

### US-16 — Deploy a crawlable low-ops product

As the product owner, I can ship public tool/pack pages and the interactive Workbench without operating an application server for deterministic work.

- **AC-16.1:** Public tool/pack discovery pages are statically rendered/crawlable and the operation surface hydrates only where needed.
- **AC-16.2:** The default deployment uses Cloudflare Workers Static Assets with content-hashed assets, while the same `dist/` artifact remains deployable on a generic static host with no SSR requirement for normal use.
- **AC-16.3:** File System Access, OPFS, service worker/PWA installation, account, and sync are not required for any first-build core story.

### US-17 — Preserve product truth in copy and brand

As a prospective user, I see concrete task/relevance/readiness claims rather than unsupported novelty, privacy theater, or an un-cleared brand.

- **AC-17.1:** Product copy does not claim uniqueness from tool count, free access, local processing, favorites, command palette, packs, or generic workspace alone.
- **AC-17.2:** Public-facing copy uses Strumentini.it consistently; no placeholder or former-codename treatment may ship.
- **AC-17.3:** Privacy claims describe mechanics near the relevant operation rather than relying on a generic “secure/privacy-first” badge.

## 8. Validation experiments and stop rules

These experiments are part of product definition. Their thresholds are validation gates, not claims that the market already meets them.

- **EXP-01 — Starter workspace vs self-browse.** Randomize/controlled-test generated starter setup against blank Workbench + Library. Measure time to first useful set, irrelevant removals, extra searches, and 7-day reuse. Falsify the onboarding advantage if the generated arm does not improve time-to-useful-set or creates materially more correction work.
- **EXP-02 — Work Profile reuse.** Measure injected defaults, overrides, and distinct tools benefiting per activated user. Falsify the profile advantage if defaults are rarely reused across tools or override/error behavior indicates stale defaults create comparable friction.
- **EXP-03 — Workbench retention.** Compare 7/30-day return and launch source for personalized/installed users versus anonymous one-off users. Narrow/reject the persistent shell if repeat users overwhelmingly re-enter through public search/tool pages and the personalized cohort shows no retention advantage.
- **EXP-04 — Pack comprehension.** Ask users to explain why a suggested pack/tool is present and observe install/remove behavior. Remove or simplify packs if users cannot predict what they add or pack use does not support repeat use.
- **EXP-05 — Handoff utility.** Observe whether users accept typed next-tool proposals versus copy/download/re-upload. Remove persistent handoff UI if baseline flows are rarely used.
- **EXP-06 — File/data speed.** Compare bounded CSV cleanup tasks with the user's normal spreadsheet/query flow. Deprioritize the table wedge if the workbench does not materially reduce steps/time for target jobs.

Global stop/narrow rule: do not expand toward 40/200 tools merely because implementation capacity exists. Expansion requires the current Gold set to remain green and at least one validated wedge to show repeat utility beyond one-off acquisition.

## 9. Product non-goals for the first validation build

- ERP, CRM, project management, invoicing/accounting system, or automation platform;
- generic AI assistant/chat shell;
- dynamic executable plugin marketplace;
- user-file cloud drive;
- team collaboration;
- account/sync;
- ad monetization;
- public brand selection;
- PWA install/offline promise;
- live/regulatory calculators;
- PDF/OCR/media-heavy suite;
- broad developer-tool positioning;
- “200 tools at launch” target.

## 10. Definition of product-ready for implementation

The product definition is implementation-ready when:

1. all C/DEC/US/AC IDs in this file resolve;
2. DESIGN.md defines the accepted interaction system and open identity items;
3. PRODUCT-MARKETING-CONTEXT.md defines the market/message truth constraints;
4. IMPLEMENTATION-PLAN.md maps architecture, test seams, stack, rollout, and verification;
5. every US/AC is traced by at least one local implementation ticket;
6. the ticket graph is acyclic with an unblocked tracer-bullet frontier;
7. no ticket silently restores account/sync, ads, runtime plugins, AI-first behavior, or the old 40-tool wave.
