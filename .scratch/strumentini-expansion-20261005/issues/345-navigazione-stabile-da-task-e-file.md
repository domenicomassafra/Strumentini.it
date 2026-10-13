# 345 — Navigazione stabile da task e file

**What to build:** Back/forward/query/URL recuperano il contesto non sensibile.

**Traces to:** OWN-07 OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 330,334

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-345.1: Back/forward/query/URL recuperano il contesto non sensibile.
- [x] AC-345.2: Deep-link non recupera blob scaduto fingendo disponibilità.
- [x] AC-345.3: On the scoped input and failure cases, verify: 3 journey e history/navigation. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** 3 journey e history/navigation; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 02 — metadata navigation slice

Replaced home recent cards sourced from cached last scalar values with canonical post-success membership `recent` IDs/time/count. The home links are now resolved only through the current generated workbench catalog and allowlisted `/tools/{id}` routes; no last input/output, filenames, query string, blob or deleted catalog route is promoted. `tests/home-recent-navigation-345.test.ts` (3 checks) and real Chromium `tests/acceptance-home-recent-345.mjs` PASS: persisted IndexedDB, reload, back navigation, sanitized route links, hidden legacy localStorage sentinel and narrow viewport. Source is `src/components/home/{RecentTools.astro,recent-tools-345.ts}`.

**Still open:** Full task/file state recovery across arbitrary history/query paths and expired #337 handoff deep-link behaviour require additional scoped integration acceptance. This note does not check original AC, certify Gold or authorize deployment.

## 2026-10-13 — original AC closure: three genuine source-bound journeys, Chromium + WebKit

**Canonical source and separation.** Independent detached clean worktree `/Users/domenico/Code/Strumentini-w4-345-20261013`, pinned to `origin/main 75744d89c2a8cd2cb3ab2f2cb9702b2d067dfedc` after actual #330/#339 closure PR37 and #334 closure. Only NEW `tests/navigation-345-20261013-three-journeys.browser.mjs` and this original issue changed. No runtime, catalog, engine, routing, provider, dashboard, release, Git commit or shared-root changes. `npm run catalog:build && ./node_modules/.bin/astro build --outDir dist` produced **293 static pages, exit 0** on the independent worktree; the first bare `astro build` RED failed only because generated catalog files do not exist in a fresh clone until the required catalog generator runs. Browser receipt was rerun from this fresh built `dist`, not a mocked route or development server:

`NAV345_DIST=dist node tests/navigation-345-20261013-three-journeys.browser.mjs` — **exit 0, Chromium 3/3 + WebKit 3/3**, each at 390×844 CSS pixels, actual native pages, real IndexedDB, local HTTP static assets only, and zero POST/off-origin requests or uncaught page errors. Each path is checked in both engines:

1. **Actual UTM task → Home Recenti → back/forward/query/reload:** native UTM form produces a visible real result; `utility-workbench/state/workbench/state:v1` stores exactly `{toolId,lastUsedAt,useCount}` for `utm-builder`, finite ISO time, useCount 1, with the private URL/source absent from the record. The dynamically populated Home recent link opens the correct canonical task; browser Back/Forward preserves navigation but does **not** invent a previous input/output. The real `/cerca/?q=utm` search query and result route survive Back/Forward, and Home reload preserves the exact non-sensitive Recenti metadata.
2. **Actual Home File picker → compatible tool → back/forward/direct URL/query/reload:** actual `quality/fixtures/pdf-gold/simple-2page.pdf` is selected under a private filename. Local format inspection offers the canonical `/tools/pdf-page-count-verifier/` route. The selected browser File is already cleared on Home before navigation; the destination never receives an implicit stale File, result or URL filename, including History Back/Forward and direct `?from=local-file` URL reload. Manual re-selection is truthful and expected, not a failed recovery.
3. **Real verified PNG result → actual #337 one-use handoff → reload/expired/direct URL:** genuine local GIF→PNG production in `/tools/image-format-conversion/` displays its verified `ImageResultV2`; explicit handoff button opens the actual `/tools/image-compression/` consumer, receives the PNG only once, strips the capability fragment, and starts no compression automatically. Consumer reload has no file/result or handoff token. A separate direct deep-link with the *spent* token and no opener strips the hash and truthfully says its original tab is unavailable; no Blob resurfaces. A fresh otherwise valid token opened with an actual opener but no authorized sender reaches the genuine receiver's 30-second expiry (Playwright virtual clock accelerated only **after** observing the real `ready` message); the page reports expiry, strips the token and still has no File/result. No forged payload or synthetic destination implementation was substituted.

**Independent adjacent validation:** `npx vitest run tests/home-recent-navigation-345.test.ts tests/ephemeral-file-handoff-337.test.ts tests/recent-completions-330.test.ts --maxWorkers=2 --fileParallelism=false` — **25/25 PASS** (3 + 19 + 3); `node --check` new browser script PASS and `git diff --check` PASS. The first browser script RED on a direct-link assertion because the test asserted before the real Preact effect ran; after waiting for hash removal this passed. Another RED on newly built WebKit was self-inflicted by the **test** calling `indexedDB.open(name,1)` before the app's own first version-upgrade, creating an empty v1 DB. The corrected harness waits for the Home's native DB initialization via non-mutating `indexedDB.databases()` before any test open, then both engines GREEN on the independent build. These timing fixes touched only the new test, not app source.

**Literal acceptance disposition:** AC-345.1/2/3 now satisfy the scoped three real tasks/history/query and expired-capability refusal; prior historical `Still open` describes the earlier 2026-10-11 checkpoint, superseded by this independent test. It is **not** a blanket promise to restore arbitrary unsaved task input or raw file bytes after reload, does **not** prove every catalog route, screen reader, physical iPhone/Android, OS Files/Photos permissions, performance, deployment, Gold or production release. None of those broader claims are made or needed to assert this ticket's three scoped original criteria; follow-up QA remains independent. No source merge, dashboard mutation or deploy performed by this worker.
