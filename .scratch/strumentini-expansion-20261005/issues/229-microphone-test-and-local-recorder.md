# 229 — Microphone test and local recorder

**What to build:** Add user-gesture mic permission, live level/device health, record/pause/resume/play/download using actual MediaRecorder-supported MIME and strictly local Blob handling.

**Traces to:** US-EXP-06, US-EXP-10; AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** Genuine physical-device acceptance. The host still has no verifiable Android target/tooling, and the paired iPhone is currently unavailable; the last reachable iOS attempt also had Web Inspector disabled. WebDriver mock media cannot substitute for live microphone permission/capture evidence.

**Status:** blocked (physical iOS/Android acceptance pending)

**Suggested skills:** security-audit → interaction-design → code-tdd → qa-browser

- [x] No permission prompt before explicit user action.
- [x] Deny/revoke/unsupported states recover.
- [x] Recorded duration/type/size are derived from actual Blob/media support.

**Verification:** `tests/browser-audio-utilities.test.ts` is 6/6 PASS and `scripts/acceptance-microphone-recorder.mjs` passes explicit permission, deny→retry, revoke→retry, runtime MIME, pause/resume/stop, actual Blob type/bytes, local download, zero external requests, unsupported recovery and 390 px overflow checks. `npx astro build` emits `/tools/microphone-recorder/`. A bounded physical iOS attempt was run on iPhone 14 Pro Max `00008120-0006384E14D8201E`, iOS 26.6.2 build 23G90, Safari/safaridriver 26.6.2 (21624.5.1.11.3). safaridriver found the exact physical device but refused the session because Web Inspector is disabled; `devicectl` proved the phone fetched the route over LAN but cannot drive the real page/native permission UI through its exposed CLI. safaridriver also documents that WebDriver sessions replace live media capture with mock capture devices, so a WebDriver mic run would not satisfy the physical permission/live-microphone requirement even after enabling Web Inspector. See `evidence/ticket229-physical-ios-attempt-20261006.md`. On the 2026-10-07 recheck the phone remains paired but reports `State=unavailable` with last connection on 2026-10-06 at 22:19; `adb` is still absent from PATH and the common Homebrew locations. No physical PASS receipt was created; physical permission/record/download/no-crash remains blocked.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #403, #362.

**Next actionable AC:** Verify the original outstanding requirements and dated source evidence before closing. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
