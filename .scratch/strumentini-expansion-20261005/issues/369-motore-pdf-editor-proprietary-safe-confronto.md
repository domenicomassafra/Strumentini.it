# 369 — Motore PDF editor proprietary-safe confronto

**What to build:** Confronta existing PDF libs, MuPDF alternative e licenze

**Traces to:** OWN-05 OWN-14; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** feasibility

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-369.1: Confronta existing PDF libs, MuPDF alternative e licenze.
- [ ] AC-369.2: AGPL o commerciale senza accordo non adottata.
- [ ] AC-369.3: On the scoped input and failure cases, verify: Feature+source+license+bundle+mobile matrix. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Feature+source+license+bundle+mobile matrix. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## 2026-10-12 — wave 16, offline executable provenance gate (partial / NO_ADOPT)

**Exclusive additions:** `scripts/audit-pdf-engine-provenance-369.ts`, `tests/audit-pdf-engine-provenance-369.test.ts` and append-only note here. Existing `src/engines/pdf/*`, #56, #237, #378, #47, #371, CI/build and vendor files were **not modified**. HEAD observed `e6d137d0` (Mac Studio). No donor was fetched or installed.

**Real installed evidence:** `npx tsx scripts/audit-pdf-engine-provenance-369.ts` reopens `quality/fixtures/pdf-gold/simple-2page.pdf` with installed `pdfjs-dist` legacy PDF.js parser and independently obtains **2 pages**, extractable `alpha beta`, fixture SHA256 `0a3ea973659ca6d454738bfe49dc14fe9e21acb0ae7c82f389b3c7c14768b551`. Installed `pdfjs-dist@6.4.299` declares `Apache-2.0` in both `node_modules/.../package.json` and the pinned package-lock entry; actual installed Apache-2.0 root LICENSE is read/checked, and npm lock has a syntactically valid SHA512 integrity value/resolved canonical npm URL. The script reads and fingerprints **7 actual local program artifacts** (browser + worker + legacy parser JS, JBIG2/OpenJPEG/qcms/QuickJS WASM), verifies each has nonempty and bounded bytes, checks Apache source headers for the JS files, and reads/fingerprints **10 separate installed license notices** covering WASM, standard fonts and CMaps. Example observed raw WASM sizes: `jbig2.wasm` 103,671 B, `openjpeg.wasm` 251,131 B, `qcms_bg.wasm` 96,589 B, `quickjs-eval.wasm` 469,105 B. All full current-local SHA256 values are in machine-readable output, **not asserted to equal an independently authenticated upstream package**. The installed Liberation font notice expressly mentions GPLv2 **with an exception**, so the root Apache SPDX string must not be generalized as a blanket license for all transitives.

**Security/source gate:** TypeScript AST scans first-party `src/engines/pdf` files plus actual installed PDF.js browser, worker and legacy modules for static remote `import`/`fetch`/`importScripts` or remote Worker loads, and refuses direct imported MuPDF package specifiers and unexpected MuPDF installations. A bare `new URL('https://...')` inside upstream PDF.js is **not** treated as network activity; a remote URL actually passed to `new Worker(...)`, `import(...)` or `fetch(...)` is refused. It also refuses changed package/version/lock integrity declarations, missing/empty JS or WASM assets, changed AGPL/commercial package license and missing, implausible or substituted root/component notices. The check is **read-only/offline** and is not a complete dynamic/network/CSP or legal transitive-source audit.

**TDD negative evidence:** New suite first failed due missing validator (**RED**); after the initial implementation, a plausible-length substituted AGPL text in `wasm/LICENSE_OPENJPEG` **incorrectly passed** and a focused real RED test exposed the hole. The implemented component-notice content patterns then made that attempt fail closed (**GREEN**). Fresh `npx vitest run tests/audit-pdf-engine-provenance-369.test.ts`: **8/8 PASS** (actual installed parser readback, local provenance, adversarial AGPL package+component notice, tampered license text, malformed pin/SRI/vendor file, remote imports in vendor and first-party). `npx tsc --noEmit --pretty false`: **exit 0**; `git diff --check` PASS. PDF.js emitted a nonfatal desktop Node `standardFontDataUrl` warning while extracting the actual fixture; this is **not** browser-font parity proof.

**Comparison / remaining AC:** The script reports existing first-party PDF parser/writer as local source with no donor license, PDF.js installed Apache-2.0 **declared, notices present but no verified upstream tarball/source distribution chain**, MuPDF **not installed** with AGPL/commercial **not adopted** (no commercial agreement claimed), and OS-native macOS PDFKit **not a cross-platform browser vendor**. Report permanently labels adoption `NO_ADOPT_NO_GOLD`, and installed file sizes are **not** measured production bundle downloads. MuPDF edition/rights and full compiled WASM/QuickJS origin, complete NOTICE redistribution, legal sign-off, hardware iPhone/Android memory/battery, dynamic CSP/offsite/network and feature/fidelity parity remain **NOT_RUN/NO_GO**. Original **AC-369.1–3 remain unchecked globally**, including an independently verified MuPDF donor evaluation and physical bundle/mobile matrix. No Gold promotion, vendor download, commit, push or deployment.
