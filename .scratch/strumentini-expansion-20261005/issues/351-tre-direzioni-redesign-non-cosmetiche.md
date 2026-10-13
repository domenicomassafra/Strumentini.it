# 351 — Tre direzioni redesign non cosmetiche

**What to build:** Minimal/editoriale/workspace mostrano gli stessi journey desktop/mobile.

**Traces to:** OWN-16 OWN-17; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-351.1: Minimal/editoriale/workspace mostrano gli stessi journey desktop/mobile.
- [ ] AC-351.2: Confronto include IA/interazioni non solo colori.
- [ ] AC-351.3: Tre prototipi cliccabili eseguono gli stessi job PDF merge, CSV cleaning e UTM export con stati errore/progresso/risultato, testati a 320/390/768/1024/1440 e confrontati su IA, tastiera e rubrica predefinita.

**Verification:** Prototipi e rubric 320/390/1440; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Nessuna scelta visuale deve precedere la creazione dei tre prototipi. #352 seleziona soltanto dopo confronto; hardware/server non sono precondizioni dello studio.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-13 — isolated clickable design study, RED → Chromium/WebKit GREEN (partial AC)

**Routes and ownership.** New independent **noindex/noarchive** static preview `/prototipi/351/` in `src/pages/prototipi/351.astro`, with its new scoped reusable `src/components/prototipi/351/JobCanvas.astro` and `tests/prototypes-351-20261013.browser.mjs`. No existing catalog, homepage, header, route, CSS, engine, manifest or worker was modified. The target page initially returned HTTP **404 RED** in live Chromium; after implementation the correct Astro `trailingSlash: "always"` route returned **200 GREEN**. The experimental page is linked only by its explicit URL, not included in the public catalog/navigation; **no direction chosen** for implementation (#352 owner decision still open).

**Three different IAs, common executable task contract.** Minimal/rigorosa uses an action-first 01–03 index and narrow input/result workspace. Editorial/riconoscibile uses a magazine masthead, numbered chapters, reading/deck order and a full-width chapter result. Task/workspace uses a dark desktop-style session toolbar, persistent activity rail, active task surface and output pane. Their navigation hierarchy, action discovery, typographic rhythm and result placement differ. All three offer native keyboard focus, progress bar, cancel/reset, live status and errors, and prior successful download preservation after invalid subsequent input/cancel. The distinct IA is displayed in the responsive comparison rubric; no cookie/account required. On 320–760 px all three restructure their navigation and work canvas; wider breakpoints retain their different layouts. Motion is optional and honors `prefers-reduced-motion` including scroll.

**Actual output reuse, no mock data and no new vendor.** Browser executes existing first-party `mergePdfs` and `inspectPdfBytes` from `src/engines/pdf/index.ts`, `readBlobText` and `cleanCsvText` from `src/engines/table/csv.ts`, and `buildUtmUrl` from `src/engines/campaign-url/index.ts`. PDF applies existing limits/unsupported-format refusal; CSV applies 50 MiB cap, row/cell parser contract and progress per streamed input bytes; UTM applies existing HTTP(S), credential and UTM value validations. All actions use in-memory output `Blob` URLs and user-triggered download; neither uploads files nor posts data. Reset revokes the Blob URL; cancel invalidates pending work and leaves previous good bytes available unless explicitly reset. This is **not** a promise of PDF fidelity outside supported first-party parser scope or physical mobile performance.

**Independent real browser byte readback:** `node tests/prototypes-351-20261013.browser.mjs` ran **Chromium and WebKit PASS**. For **all three** prototype directions, both browser engines: uploaded the actual 2-page `quality/fixtures/pdf-gold/simple-2page.pdf` twice and downloaded a PDF independently reparsed by installed Mozilla PDF.js as **4 pages**; downloaded UTF-8 CSV with original quoted `"uno,due"` and leading-zero `001` cells while verifying LF normalization; downloaded UTM TXT bytes exactly equal to displayed URL, preserving `ref=ok`, `#sezione` and correct `autunno+2026` encoding. Each direction was navigated at **320/390/768/1024/1440 px**, with no viewport horizontal overflow; keyboard selection, reduced-motion and cancel-after-success were verified, as was invalid-URL refusal preserving prior download and explicit reset clearing it. Browser instrumentation observed **zero offsite or non-GET/HEAD requests**. Safari/WebKit on macOS used standard `Alt+Tab` fallback for all-controls keyboard navigation when plain Tab skipped non-text controls. No physical iPhone/Android test, external preview deployment, perf lab or global redesign approval is claimed.

**Source checks and remaining scope:** Repo-wide `astro check` on the shared concurrent checkout examined 2086 files and reported **one unrelated error** `tests/forensic-redaction-378-20261013-pages-stream-bound.test.ts:109:24` (`Error.code`), owned by another worker; no diagnostic cited for #351 source. The prototype remains a scoped feasibility contribution, with original AC-351.1–3 **OPEN globally** until owner rubric review, independently measured practical mobile accessibility/performance and #352 direction choice. Main/production/Gold not touched; sole prime owns all Git/PR actions.

## 2026-10-13 recovery — canonical token admission (in progress)

Owned scope: `src/pages/prototipi/351.astro` and this original issue only. Fresh existing `tests/design-system.test.ts` reproduced the PR #30 CI failure: 13 PASS / 1 FAIL because the isolated page declares local hex colors. Its standalone head also omits the canonical token-sheet import. Reuse `src/styles/global.css` exactly as the existing `BaseLayout.astro` imports it, map the local palette to existing semantic tokens and native `color-mix`, preserve all three directions and executable PDF/CSV/UTM paths. No new token authority, dependency, shared stylesheet edit, chosen design, Gold or release. This existing local capability completely covers the failure; no external donor or replacement component is justified.

**GREEN / actual consumer:** The isolated page now imports the existing canonical global stylesheet and consumes existing color tokens, with native `color-mix` for the workspace's inverse panels/borders. No local custom properties or shared-token changes were introduced. Local headings inherit their parent direction's ink so the newly imported global heading rule cannot render dark text on the inverse workspace. Minimal, editorial and workspace retain distinct IA, typography, navigation and result placement; all existing engine/job code and `JobCanvas.astro` are unchanged.

Serial integrator contrast review retained the existing deeper editorial warm accent via canonical `--danger` for editorial actions, kicker/italic accents and borders, rather than the initially mapped amber `--warning`; focus styling still uses the existing focus accent. This avoids weakening white-button and small-text contrast. The final byte state was rebuilt and the existing real-browser test repeated after this correction; screenshots include the final editorial accent.

## 2026-10-13 recovery — exact experimental route build admission (in progress)

After the token correction passed 14/14 local tests, updated PR #30 CI failed at a different existing gate: `scripts/inspect-build.ts:66`, `Unexpected HTML page set ... prototipi/351/index.html`. The existing inspector already admits two exact noindex noncatalog experiments. Reuse that mechanism for this exact 351 route only, require all three directions and explicit unapproved isolated-study labels/title/heading plus `noindex,nofollow,noarchive`, and retain catalog/index/sitemap exclusion. This exact nonindexable study is excluded from public SEO DTO requirements only after its own narrower metadata gate; no wildcard allowance, tool promotion, new release authority or Gold. Ownership is the existing inspector and this original issue; prototype and shared style bytes unchanged.

**Fresh GREEN:** Canonical `npm run build` completed exit 0, including catalog/format/ticket/certification checks, 293 actual built pages and `build inspection PASS` (291 full public metadata pages, 285 sitemap entries, historical baseline preserved). The exact 351 study has its own validated title/description/heading/robots and is omitted only from public canonical/OG/JSON-LD completeness checks; other pages retain them. Three negative actual-inspector probes against disposable copies of current build HTML **PASS**: making 351 indexable is rejected by its preview gate; removing the workspace direction is rejected; adding an unknown `prototipi/999/index.html` still fails the unexpected-page gate. The temporary inspector copy changed only root/dist/import locations for isolation, retained the actual validation source, and was removed with its reconstructed fixture. No production data or build HTML was mutated for negatives. `git diff --check` PASS. Previous design-system/browser proof remains unchanged because this patch touches no prototype CSS or runtime code. Original AC stay OPEN and this is source build admission, not deploy/Gold or acceptance of a design. Worker did not stage/commit/push; same PR #30 publication and CI belong to integrator.

`tests/design-system.test.ts` changed from **13 PASS / 1 FAIL RED** to **14/14 PASS GREEN**. Fresh isolated Astro build `/tmp/strumentini-351-recovery-20261013` completed **293 pages / exit 0**. Existing `node tests/prototypes-351-20261013.browser.mjs` passed **Chromium and WebKit**, all three directions with actual PDF (independent PDF.js 4-page reopen), CSV and UTM byte-exact downloads, navigation at 320/390/768/1024/1440, error/cancel/reset preserving previous successful output, keyboard/reduced-motion, zero offsite or non-GET/HEAD requests. Four actual screenshots (`/tmp/strumentini-351-{minimal,editorial,workspace}-1440.png`, `/tmp/strumentini-351-workspace-390.png`) were captured and visually inspected: distinct three layouts, readable inverse headings, workspace single-column mobile, no observed clipped work controls. These are scoped desktop checks, not exhaustive contrast/a11y or physical mobile acceptance. Local server and browsers were stopped. `git diff --check` PASS. No worker commit/push/merge/deploy; original AC remain OPEN pending rubric, physical accessibility/performance and owner decision #352. Integrator owns the same PR #30 update and its fresh CI verification.
