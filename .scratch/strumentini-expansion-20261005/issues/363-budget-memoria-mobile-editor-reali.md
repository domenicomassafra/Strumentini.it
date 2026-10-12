# 363 — Budget memoria mobile editor reali

**What to build:** Misurare device memoria/frame/input S M L per editor futuri.

**Traces to:** OWN-06 OWN-05; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** docs/audit-2026-10-10/manifest.json; desktop browser 390px is not physical iOS/Android memory and crash acceptance. Future fixes require fresh current-revision proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-363.1: Misurare device memoria/frame/input S M L per editor futuri.
- [ ] AC-363.2: OOM e cancel non devono corrompere risultato.
- [ ] AC-363.3: Misurare su iOS Safari e Android Chrome fisici con modello/OS/browser/revisione noti fixture sintetiche S/M/L di PDF, immagini e CSV; acquisire budget/process evidence disponibile, cold/warm, background, annullamento e reopen output. Hardware assente resta NOT_RUN senza simulare soglie universali.

**Verification:** Real device traces con dati sintetici; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Servono dispositivi reali per chiudere la misurazione; non è richiesta né scelta visual #352 né modalità server #348. Hardware assente: NO-GO/NOT_RUN soltanto per le prove fisiche.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-12 wave21 — bounded local heavy-worker cancellation/resource lifetime

**Scope:** From clean main `103d35d3` worker-23 independently reviewed `src/runtime/heavy-local-job.ts`. Owned only that source, new `tests/heavy-local-memory-363-wave21.test.ts` and this original ticket; no actual provider, user data or physical devices. This is a runtime safety slice, **not** an iOS/Android memory budget, OOM benchmark or editor certification.

**NEW source-bound RED evidence (four cases, distinct from earlier heavy-preflight budget sizing):** (1) Starting a >2 MiB rejected synthetic L candidate immediately cancelled an already running valid S job, destroying its pending verified result even though the new candidate never launched. (2) If a caller's `AbortSignal` was aborted before `start`, the owned bitmap/preview and object-URL release callbacks were never invoked. (3) An AbortSignal triggered synchronously inside `createWorker()`—after the initial pre-abort check but *before* the abort listener was installed—was lost, allowing cancelled worker work to be posted and a stale success to resolve; test originally timed out awaiting the expected cancellation. (4) Malformed S input metrics throwing from preflight also bypassed caller-owned resource cleanup. Baseline new tests: **4/4 RED**; separate existing heavy runner suite was already green.

**Scoped GREEN fix:** Validate pre-abort and preflight before superseding valid work; release owned resources on pre-abort and exceptions in input metadata/preflight; create/attach a replacement worker and recheck its signal before posting or replacing the active run. An aborted candidate now cleans up its worker, owned resources and accountant and rejects with `AbortError` without accepting a late success. Accepted replacement cancellation remains as designed; no change to configured memory budgets or thresholds. After fix, new deterministic cases **4/4 GREEN**, existing `tests/heavy-local-job.test.ts` **10/10 GREEN**, including dynamic resource-hard-limit and stale worker message tests. Synthetic sizes in the tests: S=16 KiB, M=256 KiB, L=1024 KiB and rejected L=2049 KiB; resource-accounted M worker image frame adds 384 KiB, peak 640 KiB, accounted final 0.

**Independent real installed desktop Chrome (optional manual test; not a physical mobile receipt):** `RUN_CHROME_HEAVY_363=1 ./node_modules/.bin/vitest run tests/heavy-local-memory-363-wave21.test.ts -t 'measures bounded'` **PASS** using a real browser Worker with a loopback in-memory page and fresh bundled current runner source. One bounded S/M/L run (16/256/1024 KiB) measured durations roughly **11.3/7.7/8.0 ms**, respectively, with *accounted* peak working sets **32/512/2048 KiB** and **0 KiB accounted after cleanup** each. Chrome exposed a main-page heap hint around 2.56 MiB; it **does not represent total browser/worker memory**, native device memory, a process OOM limit or a mobile performance threshold. A pre-aborted run was refused while retaining the last verified synthetic result. Browser test is opt-in to avoid starting Chrome during every CI unit run. `astro check` after the scoped source fix reported **0 errors, 0 warnings** (deprecation hints only). No real editor PDF/image/CSV workloads, physical iOS Safari/Android Chrome, cold/warm/background/reopen or OS OOM receipts were run.

**Disposition:** **Local runtime safety bug fixed, original AC-363.1–3 unchecked / NOT_RUN/NO-GO** for device-specific memory/performance and future editor acceptance. No receipt fabrication, deployment, commit or push; original ticket stays open.
