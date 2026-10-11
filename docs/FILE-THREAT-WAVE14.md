# #407 — Wave 14: Windows console-device ZIP namespace

**2026-10-11, Strumentini.it Studio.** Current Git HEAD observed at start: 39e0782713b23e67e5deecdc1565d777f9ef431b (main advanced from the earlier handoff's cc569867; no checkout). Only bounded ZIP member-name preflight and existing tests were modified. Original ticket stays **OPEN**.

## Confirmed defect and security boundary

The existing checkZipPath407 rejected CON, PRN, AUX, NUL, COM1–COM9, and LPT1–LPT9 but missed reserved Windows console device names CONIN$ and CONOUT$. A ZIP entry named docs/CONOUT$ was not merely accepted by the helper: **the real detectLocalFile() returned status=supported, format=zip** on an in-memory real ZIP archive with that name. This means a later extractor using common Windows path semantics could resolve a member to a console device rather than a regular file. Passing preflight is only candidate classification, never authorization to extract.

Independent reference: Chromium's Windows file-name validation treats conin$ and conout$ as magic names and documents that, unlike legacy DOS devices, extension handling can differ. Source: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/base/files/file_util.cc (reviewed 2026-10-11). This gate **conservatively refuses** extension variants too, since consumers/platform versions can differ; it does not assert that an extension is an active device name on every Windows version.

## TDD: actual bytes, RED then GREEN

1. A new test constructs real ZIP bytes (fflate.zipSync) containing CONIN$, nested docs/CONOUT$, mixed-case assets/conin$.txt, assets/CONOUT$.xml and fullwidth-NFKC assets/ＣＯＮＩＮ＄.txt. It requires both checkZipPath407() and actual detectLocalFile(File) preflight to return MALFORMED. Benign controls docs/console.txt, docs/coninfo.txt and assets/CONIN-report.txt must remain candidates.
2. Before code modification: focused Vitest **RED**, 25/26 PASS; the new test failed because checkZipPath407(CONIN$) returned null. Independent direct call through detectLocalFile() on raw docs/CONOUT$ archive returned supported/zip (136 bytes). No extraction was performed.
3. Minimal fix in src/runtime/file-threat-gate-407.ts: include conin$ and conout$ in existing per-segment NFKC-normalized DOS-device regex. No ZIP parser/rewrite, filesystem writes, imports/dependencies, extraction, personal file access, network fetches or source outside #407.
4. After fix: focused Vitest tests/file-threat-gate-407.test.ts + tests/file-detection-333.test.ts **GREEN 44/44 PASS**, preserving ordinary ZIP/OOXML/PDF and previously implemented XXE/SVG/symlink/zip-bomb gates. Strict scoped TypeScript (target es2023, strict, noUncheckedIndexedAccess, noEmit) **PASS**.

## Remaining explicit NO-GO

This is a single **ZIP namespace safety** regression fix in **bounded candidate inspection**, not extraction-time sandboxing or production host security. Compressed/nested PDF graphs, PDF object streams beyond sampled PDF windows, all XML/SVG resource paths, malicious filesystem extraction on Windows, and physical browser/device acceptance have **not** been independently proven. Original #407 AC-407.1–3 remain unchecked; no Gold/receipt promotion, commit, push or deployment.
