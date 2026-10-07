# 13 — Integrated Gold release certification and validation deployment

**What to build:** Certify the complete first validation product as a coherent release: all 15 Gold tools, shell/Workbench/Search/Library/onboarding/packs/profile/handoff/portability/telemetry, full browser-mobile-accessibility-privacy-performance gates, truthful public copy, and an atomic Cloudflare Workers Static Assets validation deployment.

**Traces to:** US-07 / AC-07.4 / US-11 / AC-11.2 / AC-11.3 / AC-11.4 / US-12 / AC-12.3 / AC-12.4 / US-13 / AC-13.1 / AC-13.2 / AC-13.3 / AC-13.4 / US-14 / AC-14.1 / AC-14.3 / AC-14.4 / US-16 / AC-16.1 / AC-16.2 / AC-16.3 / US-17 / AC-17.1 / AC-17.2 / AC-17.3 / DEC-03 / DEC-09 / DEC-11 / DEC-12 / DEC-13 / DEC-15 / DEC-22

**Constraints:** C-01 / C-02 / C-03 / C-04 / C-05 / C-06 / C-07 / C-08 / C-09 / C-10 / C-11 / C-12 / C-13 / C-14 / C-15 / C-16 / C-17 / C-18 / C-19 / C-20 / C-21 / C-22

**Blocked by:** 12 — Privacy-safe falsification telemetry and experiment reporting.

**Status:** ready-for-agent

- [ ] All 15 first-set tools are Gold with current receipts; no tool with an open correctness/privacy blocker appears in default starter sets.
- [ ] Full declared browser matrix and representative Android Chrome pass core route/search/Workbench/onboarding/tool/handoff/portability flows.
- [ ] Keyboard-only completion, focus restoration, semantic labels/status, reduced motion, non-color-only state, 390 px layout, and 200% zoom/reflow pass the release checklist.
- [ ] Simple-tool reference interaction creates no >50 ms main-thread long task; production build records shell/shared-engine/per-tool bundle deltas and proves unrelated tool/worker/WASM chunks remain lazy.
- [ ] Storage denial, unsupported capability, hard file limit, cancellation, and worker failure injection produce normalized recoverable states with no fake success/infinite progress.
- [ ] Runtime/network inspection proves LOCAL tools do not transmit task data and event schemas/content-free telemetry remain within policy.
- [x] Public copy uses Strumentini.it consistently, makes no unsupported uniqueness/catalog/privacy claims, and states runtime mechanics near relevant operations.
- [ ] Public tool/pack pages are static/crawlable while normal deterministic execution has no SSR/backend dependency.
- [ ] No account/sync, ad SDK, PWA/offline marketing promise, runtime plugin marketplace, live/regulatory dependency, or AI-first behavior has re-entered scope.
- [ ] Deployment to Cloudflare Workers Static Assets is versioned/atomic and rollback to the previous known-good static deployment is documented and exercised or dry-run proven.
- [ ] The release emits a current Gold index and validation receipt that identifies the exact build/revision.

**Verification:** Run the complete unit/integration/oracle/Gold suites, typecheck/build, production bundle analysis, declared desktop/mobile browser matrix, automated + manual accessibility acceptance, failure-injection suite, network/privacy audit, static-route crawl check, validation deployment smoke test, and rollback proof. Record the exact deployed revision/build receipt.
