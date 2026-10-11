# 365 — Autore e selezione editoriale veritiera

**What to build:** Pagina autore e curated tools non nascondono job.

**Traces to:** OWN-02 OWN-13; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-365.1: Pagina autore e curated tools non nascondono job.
- [ ] AC-365.2: No claims su popolarità testimoni o utenti non misurati.
- [ ] AC-365.3: On the scoped input and failure cases, verify: Public copy QA e viewport 390. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Public copy QA e viewport 390; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 wave 05 — verified transparent editorial slice, original ticket OPEN

`src/pages/chi-siamo.astro` publishes a visible transparency page, real `{catalog.length}` count and exact 8 current `curateHomeTools413(catalog)` editorial entries rather than invented, popular or unmeasured usage examples; footer links the page. `tests/acceptance-author-365.mjs` real Chrome at 390px **PASS**, checks absent invented popularity/registered-user claims, responsive width, complete catalog link and an exact set comparison against the homepage eight currently published editorial routes (trailing slash normalization only). The page explicitly refrains from attributing an author/person without authenticated public evidence. **AC-365.2/.3 are locally supported, but AC-365.1's identified-author portion is NOT verified**, so #365 remains open, with no guessed personal attribution or false close. No deploy or new Gold.
