# WIP consolidation: future tickets, 2026-10-12

**Status:** OPEN backlog only. This inventory is **not** a substitute for the 424 canonical original issues and must not silently mark their acceptance criteria complete. Every task below is an explicitly separate future follow-up, not unfinished or hidden work in a branch or worktree. The user ordered all new implementation stopped; these tickets are recorded for a later authorized session, not executed now.

## FUT-WIP-001 — Finish global Recenti producer inventory (#330)

**Status:** OPEN. **Prerequisite:** original `issues/330-p0-recenti-realmente-alimentati.md` remains OPEN. This consolidation completed the real Chrome 390px, local clipboard and strictly intercepted explicit-IP slice of `ConnectionDeviceInfoTool.tsx`; prior wave26/27 producer slices are pushed. **Next acceptance:** enumerate all 269 registered routes/embedded modes, differentiate passive display from completed user action, reproduce the absent/stale/duplicate Recently event in each uncovered successful producer with real downloaded/reopened bytes; reject invalid/aborted actions, preserve `{toolId,lastUsedAt,useCount}` only, verify denied IndexedDB and `/preferiti/` reload. Do not auto-promote a noindex experimental tool and do not count mock output as an export. Original AC #330 may be checked only when the complete inventory is covered and source-bound.

## FUT-WIP-002 — Microphone and physical-device acceptance (#229 / #330)

**Status:** OPEN. The wave28 microphone worker never accepted its revival; no microphone source/test file was modified or lost. **Next acceptance:** true MediaRecorder WebM/OGG blob from synthetic live oscillator in desktop Chrome with independent `ffprobe`/`ffmpeg` and success-only Recenti; separately obtain real hardware microphone permission/capture/refusal proof on applicable physical devices for original #229. An oscillator cannot satisfy real microphone/hardware AC. No uploaded audio or persistent payload.

## FUT-WIP-003 — Experimental OCR 247 stale-result safety (#247 / #246)

**Status:** OPEN / NO_GO. Wave28 OCR worker did not run or edit. **Next acceptance:** local scanned and selectable-text PDF fixtures, cancel/file-switch/double-start and downloaded PDF's independently read searchable text layer. This `/tools/pdf-scansionato-ocr-247/` route remains experimental/noindex, not an extra registered catalog ID. Physical mobile memory, Italian corpus and license/asset provenance gates must not be waived.

## FUT-WIP-004 — Visual PDF comparison continuation (#218 / #330)

**Status:** OPEN. No wave28 visual comparison changes landed. **Next acceptance:** verify public real PDF compare with independently decoded raster source/overlay and cancellation, pair selection and stale-session resource revocation. Parent PdfTool may already record activity; ensure no double-counting before adding any recorder. Evidence must distinguish sample-resolution similarity from full-document equivalence.

## FUT-WIP-005 — Complete original source/license matrix (#366 / #369)

**Status:** OPEN / NO_ADOPT. Wave28 license-script revival produced no new files. The existing provenance audit reported unknown licenses, versions and sources for some candidates; no full source-chain legal clearance exists. **Next acceptance:** deterministic inventory of direct and transitive runtime packages, vendored codecs/fonts/WASM/model assets, npm lock integrity and component licenses, primary-source links and actual artifact digests. Unknown or unreviewed license remains NO_ADOPT; no HEIC/AVIF/MuPDF vendor promotion by assertion.

## FUT-WIP-006 — Close original CI source-change acceptance (#404)

**Status:** OPEN. Wave28 #404 worker was stopped before source edit. **Next acceptance:** prove actual CI pipeline's UI/worker/engine changed-path scopes plus cumulative main gate, with fixture-based negative mappings; physical, security, license and official-year release checks must remain explicit NOT_RUN when missing, not silently green. No simulated label counts as physical acceptance or Gold release.

## FUT-WIP-007 — Release and physical evidence reconciliation (#347 / #350 / #363 / #415)

**Status:** BLOCKED on external genuine evidence. Gold/source-binding, current rollback, physical iOS Safari/Android Chrome and independent screen-reader/device measurements have not been attested by these local WIP cleanups. **Next acceptance:** current-SHA evidence from actual devices, source-bound relevant per-tool receipts, non-mutating release validation, verified rollback and explicit owner release authority; no synthetic receipts. Preserve the historical ignored `quality/receipts/release/rollback.json` and `validation.json` byte identity.

## FUT-WIP-008 — Reconcile historical Git orphan/stash commits before garbage collection

**Status:** OPEN, preserved locally, **not safe to merge blindly**. Following the push of `66bcdce9`, a read-only full Git fsck found 74 commit objects with no current branch/reflog reachability, dated September 24–October 9. Stable `git patch-id` comparison against the current 425-commit main history found **50 commits with exact equivalent patches already on main**, **17 different patches needing separate semantic review**, and **7 stash/index WIP commits without a normal patch**. These are historical commits, not additional active worktrees (there remains exactly one checkout on `main`, no stash). All **24 review candidates** were explicitly protected from local Git GC via hidden non-branch refs of the form `refs/archive/strumentini-wip-20261012/<first-12-sha>`. This changes neither the tracked tree nor `origin/main` and does **not** publish the archived objects remotely.

**Preserved SHA prefixes (12 hex):** `c0015b823f9c`, `4d0f7f60b0fd`, `f92a85782ab9`, `bc32709b40de`, `6b38f431344e`, `a038468f13e7`, `a251664c7eaa`, `a053671925df`, `216674ccc9ab`, `8a6822d46497`, `7f767d4eebfb`, `3f785e29632c`, `e87c527efc70`, `208ead3b0516`, `919de1283f9c`, `aeb73b389842`, `01bbb4c340e7`, `b2cac877bad6`, `96d0e5df0557`, `7ad4c245f436`, `29e9c98423ad`, `5ae9fed929ba`, `60f57cef0e21`, `eff843c367aa` (full IDs recoverable from those refs on the source machine). 50 patch-equivalent commits need no cherry-pick.

**Why no automatic cherry-pick:** 17 unmatched patches largely introduce assets, modules and manifests that now exist in newer versions; the historical #237 secure-redaction commit additionally creates **7 paths absent from current main**, including an older public route and fixtures, which are not approved for unsafe promotion. One historical orphan proposes Gold promotions without current source/physical evidence; its receipts must never be blindly restored. Older WIP snapshots include dated telemetry and shell layouts superseded by the current app. Cherry-picking these old commits after current fixes would risk undoing safety boundaries, catalog/refusal policy or source fingerprinting. This is not a claim that all 24 patches have been code-reviewed or merged.

**Next acceptance:** perform a path-by-path human/security code review of the 24 archived refs, compare with current code/AC and device evidence, extract only genuine missing behavior into new clean tests/commits, and report the decision for each ref before deleting any archive. Any route touching signed/secure PDFs, Gold or telemetry must pass its original safety gate. Do not run `git gc --prune`, delete the archival refs, or force-push just to make the historical objects disappear. If off-machine recovery is required, first perform a separate approved encrypted/safe archive rather than pushing unknown stale secrets to remote refs.

## Consolidation policy and cross-repo note

- No original issue was closed solely for a bounded extra test. The sole original closure here is #365, whose author/editorial/390px AC were independently satisfied, and whose historical OPEN notes are preserved.
- As of the consolidation scan, the Strumentini checkout had only `main`, no Git stash or extra Git worktree. All existing original tickets remain authoritative via `npm run tickets:check`.
- Adjacent repositories in `/Users/domenico/Code` were examined read-only for WIP and branch/worktree inventory. In particular, dCreator had active concurrent local changes during the first scan; later its own independent integrator published and cleaned `main`. Do not import dCreator or dFarming work into Strumentini or delete active runtime files. A third-party `Qwen-MM-Plugins` checkout has a clean detached HEAD and is not a candidate for an arbitrary merge onto Strumentini main.
- Generated static browser build copies under `/private/tmp` and dVoice ignored Rust `target/debug` caches were explicitly identified as regenerable before removal. Media, runtime databases, local build executable, developer dependencies, tracked fixtures and release receipts were preserved. Future cleanup must continue to be manifest-based, not blanket `git clean -fdx`.
