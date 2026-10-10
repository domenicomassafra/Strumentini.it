# ROLE B — Crosswalk to coordinator's concurrently drafted official issues

Source snapshot: read-only inspection of files #328–#365 in .scratch/strumentini-expansion-20261005/issues/, as observed during worker drafting, 2026-10-10. Other agents/coordinator are concurrently writing them: reread current files before final integration. This is a reconciliation proposal inside ROLE B write set only; no official issue IDs were allocated by this worker.

This crosswalk complements the richer AC in UX-TICKET-SLICES.md and states/screen directions in UX-EVIDENCE-DIRECTIONS-COVERAGE.md. The coordinator should merge behavioral criteria into existing official originals first and create only truly missing children after full A/C/D reports.

| Existing official issue(s) just drafted | ROLE B proposals covered | Important detail to integrate |
|---|---|---|
| #328 account Turnstile; #329 contrast | UX-B02/03 | Turnstile API bootstrap, accessible recovery; measured 3.508:1 on actual session copy, verify 4.5:1 on both themes |
| #330 recenti; #331 false copy | UX-B04/10 | Success triggers noteToolUse and broadcast; no raw values; after UTM /preferiti/ must populate; no claim unsaved files resume |
| #332 favorites sync | UX-B23 | Two session add/remove conflicts, no deleted favorite reappearing, account optional and no document cloud |
| #333 format; #334 file-first; #335 compatibility; #336 mobile picker | UX-B12/13 | Detect MIME/magic and refuse spoofed input, clear file-picker alternatives, mixed/large files, 320 physical iOS/Android |
| #337 handoff; #338 preview/truth; #339 save; #340 session history | UX-B14/15/16/17/26 | #102/#107 already provide bounded compatible handoff; distinguish actual executable transfers from related links; download success after independent artifact reopen; auto-download off by default |
| #341/#342 durable storage; #343 config; #344 personal suggestions; #345 navigation | UX-B05/17/18/19/21/37 | Explicit file opt-in, quota/denial/expiry, no silent eviction; suggestion rationale and correct empty-state, stable navigation |
| #346 telemetria; #347 quality badges; #350 accessibility | UX-B03/10/14/15/31 | Truth and fresh evidence; avoid page visits counting as completed jobs, no raw content, 200% zoom/focus/non-color states |
| #348/#349 optional server | UX-B24/38 | No upload or server fallback without per-operation consent/retention/delete, zero extra cost ceiling and explicit refusal |
| #351 prototypes; #352 visual gate; #353 IA/system | UX-B01/33/34/35 | Identical content, 3 actual interaction models, 320/390/768/1024/1440, weighted rubric, owner selection/date before palette/font |
| #354 home; #355 catalog/search; #356 wrapper/input; #357 result; #358 area/settings/onboarding; #359 resources/errors | UX-B06/07/08/09/11/12/14/15/16/18/19/20/21/24/25 | Each route's meaningful empty, loading, error, done, cancel, download + keyboard/touch variant; keep all 269 and verified result actions |
| #360 motion; #361 sound | UX-B22 | Motion for task transitions, reduced-motion, sound off/default, opt-in, no sole audio feedback |
| #362 device; #363 memory budget | UX-B29/36 | Real hardware with S/M/L explicit fixture, picker/share/OS interruption, peak memory and bounded graceful degradation; no desktop-only assumption |
| #364 canary/rollback; #365 author/editorial | UX-B25/31/32 | Before/after output checks, route/SEO, dedicated rollback plus discreet authorship away from operation |

Potential missing separate official UI slices, if not already created by A/C/D or subsequent coordinator work: UX-B27 professional PDF editor interaction, UX-B28 image layers/masks/history, UX-B30 XLSX/CSV advanced table workspace, UX-B29 shared advanced-editor mobile panels/undo/selection alternatives. A standalone shell/navigation issue and first/return state difference may instead be precise AC extensions to #345/#353/#354; avoid duplicate issues without looking at updated content. UX-B01 inventory of 269 templates and states can be added to #351 or #353 with an explicit baseline deliverable.

## Corrections needed in current draft issue boilerplate

1. **#352 owner gate**: current AC-352.3 is generic “Verify a user-visible end-to-end real route/result”; a decision-only issue should verify three evidence-equivalent clickable prototypes and an explicit owner selection/dated revision. It has no user-visible execution or browser output to certify. Likewise current “Owner or external gate: Visual choice #352” is self-referential. Give #352 owner-choice dependency on #351, nothing else globally.
2. **#351 direction study**: three directions must differ in IA, density, input→result interaction and representation of local history, not just visual treatment. Require three representative jobs with same input/output, prototype evidence at 390+1440 and responsive 320/768/1024; same browser/device/accessibility floor; rubric before owner vote. Current AC too general to enforce.
3. **#328–331 live hotfix and #363 early measurement**: generic owner visual gate #352 or unrelated file-server #348/hardware #362 must not become prerequisites for these independently correctable slices. The current boilerplate appears copied across all new issues; audit “Owner or external gate” per requirement.
4. **#338 preview**: currently depends on #337 typed handoff; a verified primary download/preview is already described by completed #75/#76/#78/#98/#99 and can work without chain transfer. If the actual new #338 behavior does not require #337, remove artificial numeric dependency. Likewise existing CSV→CSV compatible handoff can be exercised from #102/#107 without waiting for generalized #333 format detection; scope #337 narrowly if justified.
5. **Every new issue AC-3**: currently many issues repeat the same “Verify a user-visible end-to-end real route/result against source revision, with documented negative/limit/cancel cases”. That is not evaluable for owner choice, a design token system, a memory budget study, authorship or sound concept. Replace with route/class specific user-observable AC and appropriate verification, retaining real downloaded artifact reopening only for true output tools.
6. **Current evidence**: “independent audit, historical only” is too coarse for #328–331 and other issues with newly observed concrete code/screenshot defects. Use exact audit path and source seam, mark 2026-10-10 snapshot versus future implementation fresh receipt distinctly.
7. **Global visual dependency**: #353 actually needs #352; actual visual redraw #354–359 needs #353; logic, source truth, native picker and browser resource feasibility may proceed. Physical acceptance gates #277/#278/#280/#281 must attach to their own tools, not every visual/content ticket.
8. **Security and privacy**: user experience for PDF redaction and OCR may be prototyped only with clearly simulated status; never unblock #237/#247 via visual quality, editor shell or generic “tested result.”

Acceptance examples ready to paste into official tickets:
- #351: Three prototype variants A/B/C show identical PDF merge, CSV cleaner→dedupe and UTM→TXT journeys at 390 and 1440 with file entry, empty/error/loading/success, optional account, actual result/download; each distinguishes navigation+layout+operation model even in monochrome.
- #352: Dated owner decision records A/B/C (or explicit requested modifications), pros/cons under preagreed rubric and prototype links; no approved color/font claimed before this record.
- #354: New anonymous visitor can start PDF merge from drag/click/picker OR text search without login; returning user after UTM successful operation sees only actual recent activity, with saved file status clearly separate.
- #357: After merging two PDF fixtures on 390px, latest result is visibly announced and reachable without manual full-page scan; preview limitation is clear; user downloads, PDF.js reopens expected five pages and then sees only valid next-operation actions; cancel leaves zero new downloads.
- #358: After onboarding save, installed area reflects selected tools; /preferiti/ recent is updated by real successful result, and storage denial/history opt-in cannot fabricate recoverable local files.
- #363: iOS Safari and Android Chrome physical runs with named OS/device/build, fixture sizes, peak memory, lifecycle + artifacts and cancellation, plus NOT_RUN/NO-GO for any missing target; ceilings derived from measured constraints rather than declared universal mobile parity.

No changes to the official archive or shared specifications are made in this ROLE B directory.
