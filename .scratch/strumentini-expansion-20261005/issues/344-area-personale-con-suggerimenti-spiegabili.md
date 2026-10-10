# 344 — Area personale con suggerimenti spiegabili

**What to build:** Spiega raccomandazioni da categorie e uso locale.

**Traces to:** OWN-12; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** 330,335

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-344.1: Spiega raccomandazioni da categorie e uso locale.
- [x] AC-344.2: Senza uso nessuna classifica di popolarità inventata.
- [x] AC-344.3: On the scoped input and failure cases, verify: Anonimo/offline/reset traffic audit. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Anonimo/offline/reset traffic audit; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation proof — completed source-scoped AC

- **Source:** `src/workbench/explainable-suggestions-344.ts` and `src/pages/preferiti.astro`; all suggestions require an actual #330 recent completed-operation record, an exact current canonical `/tools/{id}` catalog route, a category from previously used tools and a non-installed/non-recent target. The four highest deterministic category-scoped candidates display literal locally supported reasons (count of recorded successful operations). No visited-only/favorites-only/global-popularity ranking and no filename or result value enters reason/URL. Clear recent list yields empty state.
- **Deterministic isolated tests:** `tests/explainable-suggestions-344.test.ts` **4/4 PASS**, plus catalog-performance tests; missing history, unknown or spoofed route, duplicate ID, invalid time, impossible count, bounded list, deterministic score and actual explanation.
- **Real browser proof:** `node tests/acceptance-explainable-suggestions-344.mjs` **PASS** with Chromium 390px: anonymous initial state no fake suggestions, seeded IndexedDB two genuine prior completions → only explained same-category candidates, local previous result sentinel absent in suggestion DOM, no POST or external telemetry from suggestions, backend session endpoint force-failed offline while local suggestions remained, then reset IndexedDB recent [] and reload → zero suggestions; no JS page errors or horizontal overflow.
- **Limits:** Android/iOS Safari physical WCAG work belongs to #336/#350, not a basis for claiming this browser fixture proved mobile physical acceptance. Account session endpoint mock was intentionally denied; the recommendation engine itself does not request remote data or persist files. No deployment, new Gold receipt, source/tenant backfill, external login or paid provider.
