# Lane D — atomic quality, security and future release tickets

These are **candidate ticket keys** (`Q-D01…Q-D16`) for the coordinator to merge/deduplicate and assign the next canonical numeric IDs in `.scratch/strumentini-expansion-20261005/issues/`. They are **not** existing issue IDs. Planning-only: none of these is implemented here. Levels (`base`, `advanced`, `cross-cutting`, `feasibility`) are metadata, not custom lifecycle values. Parent issues that appear checked for a partial subset remain open until their actual full original acceptance is independently proven.

### Q-D01 — P0: Repair Turnstile browser challenge and verify end-to-end login

- **Traces:** Audit §3/§8 account defect, OWN-03/09/12, existing account features; **priority P0**, base. Coordinate with design lane on visible states and engineering lane on backend, do not duplicate their technical ticket.
- **Deliverable:** Real registered browser login path succeeds/fails deterministically through Cloudflare Turnstile, without `async/defer`+`ready` initialization race; worker/D1 guarded endpoint validated on staging using synthetic identities; clear challenge-failed, expiry, offline, rate-limit, logout and CSRF paths.
- **AC:** (1) real Chrome and Safari/WebKit challenge widget loads and explicit anti-bot verification can complete, with no page exception; (2) completed actual login establishes server-validated session and authorized user-only reads/writes, cross-user request denied, no token leaked; (3) denied/expired/blocked cases show recoverable accessible state without bypass; (4) mobile 320/390 contrast/focus >= applicable WCAG AA, including the 3.508:1 secondary text regression; (5) no new file upload or hidden persistent session data and preview canary/rollback documented.
- **Evidence:** `docs/audit-2026-10-10/extra.json`, `auth-blocked-390.png`, `src/pages/accedi.astro`, `scripts/acceptance-auth.mjs`, worker authentication tests. Current audit failed; these AC remain NOT_RUN after fix.
- **Dependencies/gates:** staging account/test identities, Turnstile configuration and worker reachable; no dependence on visual palette choice. **Rollback:** restore preceding browser challenge/worker pair on preview if server session/authz contract regresses; invalidate test sessions.

### Q-D02 — P0: Capture verified recent tool usage and reconcile product promises

- **Traces:** OWN-03/08/09/12, audit recent-after-result path; priority P0, base. Coordinate with design lane.
- **Deliverable:** Successful user-initiated runs set recent tool identity only after actual verified result; browser refresh/reopen maintains correct scoped history and favorite ordering; product copy describes real local state, file retention is opt-in and separate.
- **AC:** (1) select concrete CSV/PDF/image utility, generate valid output, `recenti` shows exact tool and stable timestamp after page reload/new tab; (2) rejected/canceled run neither falsely increments success nor creates an output recent record; (3) quota/storage denial fallback reports reduced capability without losing in-memory result; (4) clear history removes local records and any opt-in file handles from UI/state; (5) no filename/content/bytes persisted unless user affirmatively selected file storage.
- **Evidence:** `src/workbench/membership.ts`, `state.ts` and actual recent screenshot in audit. **Dependencies:** valid result completion event; no remote account required. **Rollback:** local schema compatibility and data migration test, don't erase user favorites.

### Q-D03 — P0/security: Finish #237 independent PDF redaction source/output forensic gate

- **Traces:** #237/#032, OWN-04/05/06/09, audit §14; priority **P0 to precede public exposure**, advanced/security. Existing #237 remains canonical parent; attach this candidate as a bounded acceptance child or detailed addendum, **no new public route**.
- **Deliverable:** Independent security reviewer reproduces source classification/fail-closed and **post-export actual content absence**, including actual source types outside the positive corpus. Formal policy differentiates permanently rasterized pixels, text/search data and vector semantics; explicit limits and threat model.
- **AC:** (1) cover/opaque-text, orphan, object/XRef/stream/xref incremental/hybrid/linearized, signature (`/Perms`/`DocMDP`/`ByteRange`), forms, attachments, transparency/softmask, annotations, rotation 0/90/180/270, metadata, encrypted/corrupt and declared image bomb fixtures with independent parser signatures, no test-only false success; (2) output decoded with PDF.js, pypdf/pdfminer.six, native PDFKit/CoreGraphics and an additional independent PDF renderer when feasible, plus copy/search/print-to-PDF and raw serialized byte scanner; forbidden markers/object data are absent or source refused; (3) golden image pixel geometry still correct and no secret return in warnings/logs; (4) 390px desktop, then real iOS/Android with user draw/undo/cancel, memory bounds, termination and actual native download re-open; (5) reviewer signs measured test corpus/source digest and exact supported source subset. Original #237 3 AC stay unchecked until joint acceptance.
- **Evidence:** `tests/pdf-redaction-{237,malicious-corpus-237}.test.ts`, `tests/fixtures/pdf-redaction-malicious-237/`, Swift PDFKit helper, `scripts/acceptance-pdf-redaction-237-dev.browser.mjs`; 2026-10-10 real Chromium+PDFKit PASS for two outputs is **partial**. Older Vite/pdfjs split API+worker harness still has independent mismatch; repair/re-run that harness only if used for release evidence.
- **Deps/gates:** #237 source-only, #280/#281 physical routes, external independent security reviewer approval before public claims; no blanket assurance for arbitrary PDFs. **Rollback:** do not ship new redaction, retain hidden DEV-only route; on future regression unpublish route/badge immediately.

### Q-D04 — P0: Replace global release fingerprint with dependency-closed scope identities

- **Traces:** OWN-03/10, audit §8, #046/#279, `scripts/lib/current-revision.ts`; priority P0, cross-cutting.
- **Deliverable:** Deterministic hash/schema for shared framework, tool/engine family, browser assets/WASM, worker/migrations/auth and integrated candidate; closure includes transitive used components and pinned artifacts. Consumer-based invalidation only where necessary; change worker/migration always invalidates corresponding backend evidence.
- **AC:** (1) snapshot two unaffected independent tool inputs and change an unrelated markdown/test, show unaffected scoped receipt still valid; (2) change a shared engine/manifest/assets/Worker/migration and demonstrate all affected scopes stale; (3) deleted file/dependency and changed published build manifest invalidate; (4) source hash is canonical across browser badges, backend receipt and release script with exact versioned schema; (5) no bypass of security/physical/source gates and regression tests include both under- and over-invalidation.
- **Evidence:** current `scripts/lib/current-revision.ts` excludes `worker/` and unnecessarily includes broad unrelated tests/scripts. **Dependencies:** manifest/generator dependency map, review of receipt consumers. **Rollback:** previous global validation remains fail-closed during transition, not forced-green.

### Q-D05 — P0: Make public Gold/status badges reflect current verified receipts

- **Traces:** #046/#279, OWN-03/12, audit §8; priority P0, cross-cutting. Depends Q-D04 scope identity (unless safe legacy fail-closed comparison implemented first).
- **Deliverable:** Shared verified-status selector used by release validator and UI for each tool/route. Badge indicates whether current supported operation has up-to-date proof, source/date/physical restrictions; unsupported and partial features show no full Gold.
- **AC:** (1) mutate relevant source bytes and badge deterministically reverts with explicit evidence status; (2) untouched tool and backend scope with current hash retains its honest prior level; (3) physical NOT_RUN, refusal, source partial, stale evidence and wrong build block promotion; (4) status label accessible in both themes and 320px, linking human-friendly limits; (5) no phantom Gold from global certification list or refusal closure.
- **Evidence:** `goldToolIds` quality index vs live wrapper; `quality/receipts/expanded-catalog-certification.json` locality `PARTIAL`, privacy `DECLARED`, physical `EXTERNAL`. **Rollback:** fail closed with no badge until selector trusted.

### Q-D06 — P0: Reconcile route-level privacy claims with measured network behavior

- **Traces:** #114/#046, OWN-09/10, source audit §8; priority P0, cross-cutting.
- **Deliverable:** Per route input class, capture real outgoing fetch/beacons/fonts/worker requests and their payload classes, local/browser vs optional consented server work, with version-pinned receipts and no user files in evidence. UI copy and exact manifests match observed behavior.
- **AC:** (1) synthetic sensitive PDF/image/CSV inputs and magic markers never appear in requests under claimed LOCAL path; (2) requests classified first-party app shell/Turnstile/telemetry vs content-processing/upload; (3) server opt-in requires explicit consent, publicly bounded cost/retention/delete, reject/offline/limit fallback with no silent upload; (4) blocked/unsupported/network-denied cases fail safely; (5) test distinguishes `networkPolicy=forbidden` declaration from sandbox-enforced isolation and cannot claim a guarantee not actually implemented.
- **Deps:** QA browser/privacy proof, future server design separate. **Rollback:** hide unsupported network claims or disable optional processing path.

### Q-D07 — P0: Install observable, appropriately scoped CI for tickets/source/release

- **Traces:** audit zero GitHub Actions workflows/runs observed, OWN-03/15/20, #046; cross-cutting.
- **Deliverable:** Reviewed remote checks with no secrets required for pull requests: ID/AC/spec validator, check/type/build where modified, impacted oracles/tests, status/preview boundary, dependency/license/security provenance. Nightly/integration jobs optionally run broader cross-browser matrix; physical lanes remain external receipts.
- **AC:** (1) verified remote workflow executes and records immutable run URL/commit SHA on example PR; (2) mutation of missing ticket/duplicate ID/stale badge/backend source dependency fails cleanly; (3) no CI can write a Gold/physical receipt from an emulated test; (4) pass/failure cannot depend on developer laptop tooling/credentials; (5) protected branch/required checks policy documented separately and configured only with owner authorization.
- **Evidence:** `.github` absent at snapshot, zero remote workflows observed; repository has valid tests/build commands. **Dependencies:** Q-D04 identity ideally in second stage; basic CI independent. **Rollback:** disable broken remote check while retaining local validator, never weaken release safety gate.

### Q-D08 — P0: Validate real preview/canary release and rollback rehearsal for changed scope

- **Traces:** #046/#279, OWN-03/10, audit live 100% with previous version listed but no rollback exercised; cross-cutting.
- **Deliverable:** Candidate manifest and runbook for Cloudflare static assets and Worker/D1 as a compatible version set; preview and release smoke; real rollback dry-run on isolated staging with reproducible restore evidence.
- **AC:** (1) named source/asset/worker schema hashes and Cloudflare deployment IDs bound to acceptance; (2) preview health + representative actual PDF/CSV/image output downloaded and independently reopened; (3) mixed-version asset requests and auth/backend migration skew fail cleanly; (4) canary regression signals stop promotion and rollback restores compatible route/content/output without secret/error exposure; (5) rollback proof includes API/bindings/migration safety, not just historical deployment availability; (6) production action remains explicit release owner gate.
- **Dependencies:** Q-D04/05 evidence identity; preview environment and migration safety. **Rollback:** documented immutable prior build; D1 destructive changes require separate migration/restore gate.

### Q-D09 — P0: Real device Android Chrome image-resize receipt (#277), current digest

- **Traces:** #277/#279, OWN-06, base/physical. **Depends external Android device and reachable test/witness tooling**, not the redesign palette.
- **Deliverable:** Actual Android Chrome fixture pick, resize, on-device download, independent output dimensions/type/bytes/alpha and source hash; filename/screenshot privacy controls.
- **AC:** (1) record Android model/OS/Chrome, device physical proof, tool route and deployed fingerprint; (2) gallery/Files selection 16MP boundary JPEG → 1200x1200 confirmed via on-device independent read, download/share recovers; (3) cancel/permission/storage failure and memory/OOM states recover with no false success; (4) one immutable current-build receipt persisted by sanctioned recorder only on PASS, otherwise `EXTERNAL/FAIL/NOT_RUN`; (5) `#279` not promoted by this Android receipt alone.
- **Evidence:** #277 `adb` unavailable as of 2026-10-07. **Rollback:** no receipt on failure; mobile feature remains Partial.

### Q-D10 — P0: Real device iOS Safari image-resize receipt (#278), current digest

- **Traces:** #278/#279, OWN-06, base/physical. **Depends Web Inspector enablement or actual user-observed physical run**, not re-pair assumption.
- **Deliverable:** Test real iPhone Files and Photos picker → resize and download/open result with source/revision binding, including background/lifecycle and memory handling.
- **AC:** (1) record current available/paired iPhone model+iOS+Safari and current source hash, never hardcode 2026-10-07 as fresh; (2) genuine 16MP pick and 1200² JPEG output independently reopened in Files/Photos with dimensions and bytes; (3) permission denied, cancel, memory failure, share and download statuses captured; (4) fail/NOT_RUN does not issue PASS or complete #279. Desktop WebKit and SafariDriver blocked by Web Inspector do not count as successful physical proof.
- **Evidence:** #278 later than #229 notes paired iPhone available but Web Inspector disabled. **Rollback:** keep Partial on evidence failure.

### Q-D11 — P1: Capture live physical microphone user gesture and output (#229)

- **Traces:** #229/#035, OWN-06/09, base/physical. **Dependencies:** real iOS and Android targets; manual witness is essential because SafariDriver mock capture invalidates proof.
- **Deliverable:** Native mic prompt/revocation, level/record/pause/resume/stop/play/export and actual decoded Blob/MIME duration on supported phones; no acoustic personal data retained.
- **AC:** (1) live real device grants mic only after gesture; (2) denied/revoked/unsupported case recovers; (3) actual physical record/play/export file reopened and independently decoded; (4) physical source device/model/OS/browser/build and consent/witness stored without personal recording. Run WebDriver mock separately as desktop browser smoke, never as physical signoff.
- **Evidence:** #229 desktop 6/6 browser pass; iPhone status in #229 stale relative #278. **Rollback:** audio recorder remains bounded and unsupported mobile state truthful.

### Q-D12 — P1: Reproducible per-family physical heavy-tool lane (#280/#281)

- **Traces:** #206/#280/#281, OWN-04/06, advanced/cross-cutting. Integrate into existing physical tickets, no duplicate hardware project.
- **Deliverable:** Accepted family subsets chosen after product/engineering donor decisions (heavy image/HEIC/AVIF/GIF, PDF/Office, OCR, audio/video as applicable). Reusable receipt schema and manual/automation evidence for exact browser output/download.
- **AC:** (1) device/OS/browser, route, engine source digest and input size/class recorded; (2) cold/warm load, peak memory/proxy, progress/cancel and max supported budget measured (no fabricated thresholds); (3) user can recover from quota/OOM/unsupported/cancel without lost previous valid result; (4) independent output parser reopens actual on-device file; (5) Android/iOS witnesses independently tagged, absent target stays EXTERNAL and #046 does not become Gold.
- **Dependencies:** #206 and accepted heavy engine, Q-D09/10 device route setup. **Rollback:** disable/heavily gate affected route where crash or memory corruption observed.

### Q-D13 — P1: Privacy-safe telemetry identities and authentic repeat-use metrics

- **Traces:** OWN-01/09/10/12, audit §7/§8, current telemetry bootstrap/reporting; cross-cutting.
- **Deliverable:** Optional, consent-aware metric identifiers locally generated with expiry/rotation and explicit opt-out, event taxonomy measuring user verified result, distinct-day return, same-subject repeated tool usage and failures. Metrics defined with correct mature-cohort denominators and handling of sparse/no telemetry.
- **AC:** (1) D7/D30 counts user with a qualifying activity on another day among matured eligible consented cohorts; opening workbench 1 minute later never counts as D7; (2) repeated-tool use requires **same** subject using same tool twice, not two subjects using same tool; (3) real producer→adapter→reporting end-to-end synthetic journey passes, user refusal/no consent emits no identity event; (4) event schema excludes input, filenames, inserted URLs, document hashes and full user agent; (5) opt-out/erase/revoke and browser storage-denied work, dashboard clearly reports unknown denominator when no data; (6) no live activation before owner privacy approval.
- **Dependencies:** Q-D02 meaningful verified completion, privacy review. **Rollback:** disable telemetry safely without affecting local tool operation.

### Q-D14 — P1: Independent official-source and year-boundary source-pack validator

- **Traces:** #115/#117/#121/#126/#127/#133/#158, OWN-11, base/fiscal. Partner with product's normative ticket, avoid inventing legal rates.
- **Deliverable:** A dated, hash-pinned official source, effective interval and scope contract validator, with edge-year handling for selected fiscal consumers and an explicit `NO_OFFICIAL_EVIDENCE` state; source/consumer matrix with designated reviewer. It validates primary source bytes and independently derived worked cases, not just copied in-app constants.
- **AC:** (1) Jan 1/Dec 31, year 2025/2026 and Dec 12/13 2025 VAT boundary make correct accept/refusal decisions; (2) 2025 ATECO2007 9 coefficients are exact and official, 2026 ATECO coeff unsupported until sourced, no conflation 2025/2026 national gross IRPEF with deductions/addizionali; (3) SITUAS only 4 pinned dates accepted for exact date, `ND` 15 and foreign 23 remain unsupported/unknown, ANPR 2023 cannot backfill 2026; (4) source URL, legal article/page, downloaded bytes/hash/checked time and effective dates verified independently; (5) source disagreement triggers human legal/scope review and blocked consumer rather than silent fallback; (6) annual rollover alert stale states checked and no automatically published fiscal claims.
- **Dependencies:** primary sources from #115/#117 and domain reviewer; no product feature freeze. **Rollback:** last verified bounded pack and explicit warning; do not present as current-year legal advice.

### Q-D15 — P1: Cross-family independent file result and workflow-handoff corpus

- **Traces:** OWN-04/07/08/09, #103/#109/#111/#114, original #047/#056/#058/#212/#235/#246/#247; cross-cutting.
- **Deliverable:** Independent fixture corpus for PDF/images/CSV/Excel/Office/archives including two chained actions without downloading+reuploading, browser output and explicit lossy conversion warning. Cross-check independent binary signature/parser and requested output properties.
- **AC:** (1) PDF split/merge/image composition sequence keeps page count, order/geometry/text where supported; (2) image resize→compress→PDF preserves RGB/alpha/orientation where claimed and exposes lossy transformations; (3) CSV/XLSX typed columns, separators, leading zero, formulas vs calculated values preserved or documented as lost; (4) corrupt/oversize/cancel leaves previous valid output intact and no silent offsite upload; (5) `binary-handoff` 64MiB current bound is handled with recoverable explicit refusal on unsupported larger payload, measure and propose new budget before claiming full workflow; (6) each output reopened by an **independent** consumer and hash bound to source.
- **Dependencies:** actual base/advanced engine capabilities, not global #046 completion. **Rollback:** remove chained option whose artifact contract regresses, retain standalone proven tools.

### Q-D16 — P1: Comprehensive keyboard/touch accessibility regression and design QA rubric

- **Traces:** OWN-06/16/17/18, #112, audit contrast 3.508:1; coordinate with design lane, advanced+base.
- **Deliverable:** Shared acceptance rubric plus automated and human review runs over chosen redesign for 320/390/768/1024/1440 px, light/dark, semantic focus/labels, keyboard and mobile touch, reduced motion, optional sound off, result download/error navigation.
- **AC:** (1) for three end-to-end journeys and each template state, focus order/return/escape/announcements and no trapped focus; (2) screenshots + measured text/icon contrast, 200% zoom and safe touch target spacing; (3) no drag-only action, same task available via tap, picker and keyboard; (4) audio cues never sole feedback and reduced-motion disables optional animations; (5) mobile output controls accessible above onscreen keyboard/safe areas and real phone QA gates match #280/#281; (6) visual acceptance evidence tied to owner-selected direction, no self-selected final skin.
- **Dependencies:** visual direction selected for final redesign, but current account contrast fix Q-D01 independent. **Rollback:** revert deficient component/state without changing tool engine output.

## Coordinator routing and overlap control

| Candidate key | Existing parent / other lane | Concrete integration decision |
|---|---|---|
| Q-D01/02 | Design worker likely has account/recenti UX tickets | Use one owner-assigned implementation issue each, include security/real browser AC here; **merge duplicates** |
| Q-D03 | Original #237 with #032 umbrella | Prefer detailed child security independent witness or addendum, preserve original 3 unchecked AC |
| Q-D04/05/07/08 | Release/freshness/CI authority, #046/#279 | Four distinct implementation boundaries: identity graph → badge consumer; CI can start independently; release rollback depends on verified identity |
| Q-D06/13 | Privacy and telemetry, potentially design/product | Keep content privacy test distinct from optional behavior instrumentation; no forced analytics deployment |
| Q-D09/10/11/12 | Original #277/#278/#229/#280/#281 | **Extend original tickets rather than clone a second physical backlog**; add truly new child only if new reusable runner/receipt schema work needs separate owner |
| Q-D14 | Original #115/#117/#158, product worker | Add independent source validator AC; do not duplicate legal discovery or claim general legal correctness |
| Q-D15 | Original #103/#109 plus product/engineering handoff | Shared independent fixture orchestration child once; feature improvements remain with engine owner |
| Q-D16 | Design worker and #112 | Integrate quality-specific independent checks in their slice; optional separate human witness ticket |

## Prompt handoff convention for future execution

Each coordinator-issued prompt should include: canonical ticket ID and current status; actual checked/unchecked original AC; source record/receipt SHA; exact ownable files and routes; prohibited release surfaces; supported fixture/input size and expected output; reuse/donor and license proof; targeted unit+independent output+browser+physical gates; source/worker/assets identity; rollback and next proof; final `PASS/PARTIAL/FAIL/NOT_RUN` with commands and real artifacts. A source-only result updates evidence, never public `completed`/Gold unless all AC and owner/security/physical gates are satisfied.
