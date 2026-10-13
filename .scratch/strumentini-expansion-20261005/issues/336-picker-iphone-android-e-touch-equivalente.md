# 336 — Picker iPhone Android e touch equivalente

**What to build:** Photos/Files raggiungono tool e risultato.

**Traces to:** OWN-06 OWN-07; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 333

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-336.1: Photos/Files raggiungono tool e risultato.
- [ ] AC-336.2: Permessi negati/ritorno dall'app non perdono il lavoro.
- [ ] AC-336.3: On the scoped input and failure cases, verify: Receipt fisica iOS Safari e Android Chrome. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Receipt fisica iOS Safari e Android Chrome; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 03 — scoped evidence

Separate native image/* Photos and generic Files pickers; 44 px control targets; cancel/read-denied/app-return preserves previous valid selection, no capture/upload/autostart. `tests/acceptance-mobile-picker-336.mjs` Chromium iPhone-like and Pixel-like emulation 320..1440 PASS incl real filechooser, Photos image result and Files PDF path. Physical iOS Safari/Android Chrome picker/permissions AC-336.3 remain NOT_RUN, HEIC detection unsupported.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-12 independent regression wave — cancel while reading

Found a distinct real-browser bug in `HomeFileEntry.astro`: while a selected File was still being inspected, opening and cancelling the other native file input dispatched a no-selection event that incremented `generation`, aborted the in-flight inspection, and silently discarded the already chosen file. `tests/home-picker-336-next.browser.mjs` holds an actual PDF `Blob.arrayBuffer()` read, cancels the separate Photos chooser, releases the pending read, and expects the PDF route. Original implementation RED (PDF result timeout); changed implementation GREEN in desktop Chrome and Playwright WebKit mobile-sized contexts at 320/390 px. Empty selection/cancel/error now leaves an already chosen file's in-flight read to complete; a subsequent nonempty selection or explicit Remove still replaces/cancels the pending work. Browser coverage additionally verifies a real chooser, same-file reselection, simulated read denial recovery with previous recommendation retained, stale-result notice, keyboard-focusable 44px inputs, and zero file POST requests.

**Evidence boundary:** These are real browser engines with device emulation and scripted DOM events, not physical phone picker or OS permission receipts. AC-336.3 remains **NOT_RUN/NO_GO** on physical iOS Safari Photos and Android Chrome Files, including OS permission denial and app switch/return. AC-336.1/2 retain the existing emulator-scoped evidence and stay unchecked pending required physical coverage; ticket status remains open. No upload, persistence, or automatic tool execution was introduced.

**Adjacent legacy acceptance caveat:** Re-running `tests/acceptance-mobile-picker-336.mjs` against a current Astro dev server and then the already built static `dist` failed *after* the home picker successfully recognized the PNG and navigated to `/tools/image-metadata-viewer/`. The downstream tool, after explicit re-selection and Submit, did not produce `data-result-class` within its timeout (static build displayed `Stato: Errore`). This is outside the three owned files and does not count as a passed end-to-end Photos→tool output receipt. Independent downstream investigation is still needed for full AC-336.1 closure.

## 2026-10-12 downstream follow-up — cause and scoped correction

The PNG fixture is sound: Sharp/Pillow decode `synthetic-1x1-rgb.png` as exactly RGB (20,40,120) at 1×1; the existing `inspectImageMetadataLocal(File)` returns actual dimensions for this and a separate 2×2 PNG. The original browser failure is a **Preact hydration race** rather than a corrupt source: native `<input type=file>` is visible in the Astro SSR island before the `client:load` listener attaches. The old fast Home→tool journey selected during `astro-island[ssr]` (`unhydrated=true`), retained `synthetic-1x1-rgb.png` in the input, but submitted with the component's `file` state still null; old code RED, `Stato: Errore`.

In `ImageVisualTool.tsx`, the **metadata viewer only** now disables Submit until hydration, uses the native file input's still-present File at run time when the selection event occurred before hydration, and clears the native input on Reset to prevent stale reuse. `tests/image-metadata-viewer-336-downstream.browser.mjs` proves the previously failing fast iPhone-like Chrome Home→tool journey GREEN against fresh Astro dev **with `unhydrated=true` observed before selection**, and independent Chrome + WebKit 390 px real-image `1×1`/`2×2` results, rejected invalid-signature image, reset/no-stale reuse, and zero file POST. Desktop emulation is not physical iOS/Android testing. Existing static `dist` at port 19541 precedes this source correction; its historical failure requires a fresh integrated build before any claim that the old full-script acceptance is GREEN. **Original physical AC-336.3 remains NOT_RUN/NO_GO, AC checklist unchanged, no deploy.**

**Additional historical-suite rerun:** `node tests/acceptance-mobile-picker-336.mjs` against a freshly started Astro dev origin during concurrent builds could not reach the downstream step: the first Home PNG recognition exceeded its 15-second assertion on the cold dev runtime. This run is **INCONCLUSIVE**, not a verified regression of the metadata fix. The isolated browser suite above completed the previously failing complete Home→tool journey on dev. The original full historical script still needs rerun against the rebuilt static bundle for end-to-end acceptance.

**Prime post-build reconciliation (2026-10-12):** After `npm run build` successfully rebuilt the complete 292-page static bundle and passed the build inspection, `node tests/acceptance-mobile-picker-336.mjs http://127.0.0.1:19541` completed with **exit 0**, including the original Photos→image-metadata-viewer and Files→PDF-page-count explicit-reselection journeys, 320/390/768/1024/1440 viewport checks, simulated cancel/read denial and no implicit upload. Independently, `node tests/image-metadata-viewer-336-downstream.browser.mjs http://127.0.0.1:19541` finished **exit 0**, with the early unhydrated Chrome Home→tool selection, actual 1×1 and 2×2 decoded image results in Chromium and WebKit, malformed image refusal, reset and zero POST. The earlier pre-build failure is thus resolved on the rebuilt static bundle; a physical iOS Safari/Android Chrome operating-system permission receipt remains **NOT_RUN**, so AC-336.3 and ticket completion remain OPEN.

## Owner round Strumentini — 13 ottobre 2026

Strumentini è un prodotto pubblico per qualsiasi utente. Importazione tramite picker/condivisione standard del browser e del sistema: cartelle/Files, provider personali disponibili nel picker (anche Google Drive), Foto/libreria e documenti ricevuti. Il Drive personale owner e la skill LifeOS non sono requisito né backend del prodotto. Verificare capacità reali iOS/Android/desktop e limiti platform; nessun upload/autenticazione provider impliciti.

Decisione acquisita, non nuova implementation/runtime acceptance; status e checkbox esistenti invariati. Tutto il lavoro autorizzato resta nello scope, riuso prima del codice e gate originali preservati.
