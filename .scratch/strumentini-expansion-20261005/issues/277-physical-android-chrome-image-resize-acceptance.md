# 277 — Physical Android Chrome image-resize acceptance

**What to build:** Run the existing image-resize physical-device acceptance on a real Android Chrome device, capture current-build evidence and file/output verification, and record failure honestly if the path is not green.

**Traces to:** AC-09.1; DEC-EXP-06

**Constraints:** C-EXP-02, C-EXP-04; evidence-only ticket; do not change Gold state unless the physical run passes.

**Blocked by:** No verifiable physical Android Chrome target is currently reachable from this host; `adb` is not installed/exposed in PATH or the common Homebrew locations.

**Status:** blocked — physical Android target/tooling unavailable

**Suggested skills:** qa-browser

- [ ] Receipt identifies real device/browser/build fingerprint.
- [ ] Resize interaction, output dimensions/type/bytes and download are verified on-device.
- [ ] No desktop emulation result is promoted as physical evidence.

**Verification:** Physical Android Chrome run with screenshots/console/output artifact receipt.

**Device check (2026-10-07, revalidated):** `command -v adb` returns no executable, and neither `/opt/homebrew/bin/adb` nor `/usr/local/bin/adb` exists. There is therefore no verifiable physical Android Chrome target available through the configured local tooling. No emulator or desktop result was substituted, no physical receipt was created, and this ticket remains open.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #362.

**Next actionable AC:** Receipt identifies real device/browser/build fingerprint.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
