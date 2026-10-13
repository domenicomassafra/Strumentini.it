# 407 — Hostile parsers and archive resource safety

**What to build:** File parsers refuse dangerous zip SVG XML PDF object graphs before materializing

**Traces to:** OWN-03 OWN-10; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-407.1: File parsers refuse dangerous zip SVG XML PDF object graphs before materializing.
- [ ] AC-407.2: Zip bombs XXE script/path traversal cannot escape sandbox/limits.
- [ ] AC-407.3: On the scoped input and failure cases, verify: Threat fixtures adversarial and resource tests. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Threat fixtures adversarial and resource tests; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 wave 14 — reserved Windows console namespace (worker-14)

Confirmed a novel real ZIP member-path bypass in the bounded detector. Synthetic ZIP with docs/CONOUT$ was classified by **actual detectLocalFile()** as supported/zip before the patch, while checkZipPath407(CONIN$) returned null. Windows console-device names CONIN$ / CONOUT$ were missing from the reserved-name gate. Tests reproduced **RED 25/26** and GREEN with a per-segment, NFKC-aware fail-closed refusal of both console aliases and conservative extension variants. Mixed-case, nested-path and fullwidth aliases refuse; ordinary lookalike names remain candidates. Verified **44/44** Vitest for #407 + #333 detector, strict scoped TypeScript PASS. Full scope and Windows-platform nuance are recorded in docs/FILE-THREAT-WAVE14.md. Only original #407 source/test/ticket/new-doc touched; no extraction, uploads, Gold/receipt edits, commit, push or deploy.

**Disposition:** Original AC-407.1–3 remain **unchecked** and ticket **OPEN**: this hardens one archive-path namespace bypass in a preliminary detector, not all PDF object streams, SVG/XML parser graphs, full archive extraction or cross-platform device/rollback validation.

## 2026-10-11 implementation wave 03 — scoped evidence

`src/runtime/file-threat-gate-407.ts` integrated with real `src/runtime/file-detection.ts` candidate screening and `tests/file-threat-gate-407.test.ts` 12/12 plus detector 18/18 PASS. Bounded ZIP symlink/traversal/descriptor/gaps/nested compressed XML/SVG/XXE/script, PDF risky tokens observed; signal cancellation/resource caps and no upload. It does not certify deep PDFs >256KiB/unparsed object streams, all parsers, full archive extraction or malicious file handling past detector; no full production Gold.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 09 — ZIP pathname normalization and Windows reserved targets

An independent hostile ZIP fixture demonstrated that two central-directory names `archive/report.txt` and `archive/ｒｅｐｏｒｔ.txt` were both accepted despite resolving to the same NFKC-normalized path, and `CON`, `NUL.txt`, `AUX.xml`, `COM1`, `LPT9.log` and fullwidth device aliases were accepted as members. A fullwidth separator `folder／file.txt` could also change path segmentation after normalization. These cases are not safe assumptions for consumers extracting onto different filesystems.

The bounded preflight now checks duplicate *canonical* member identities (`normalize('NFKC').toLowerCase()`), rejects reserved DOS/Windows device names with extensions in any segment, and rejects Unicode normalization that changes segment count or exceeds path-depth limits. No ZIP extraction, upload or new dependency was added. Two tests reproduced these failures **RED** before the fix; `vitest run tests/file-threat-gate-407.test.ts tests/file-detection-333.test.ts` **32/32 PASS** afterward, preserving ordinary ZIP and OOXML examples. This is an additional fail-closed pathname gate, NOT proof that every downstream extraction implementation is sandbox-safe, nor deep PDF/SVG analysis. Ticket remains `ready-for-agent`, with original global AC unmarked, release and Gold NO-GO.

**Independent reviewer P2 follow-up (2026-10-11):** ZIP also allowed a regular member `docs` alongside directory `docs/` or child `docs/readme.txt`, which can result in an ambiguous filesystem extraction layout. Reproduced RED, then canonical uniqueness removes trailing directory slash for comparisons and the scanner refuses a regular-file member whose canonical name is a parent of any archive member. A valid directory `docs/` with `docs/readme.txt` remains supported. Relevant existing #407/#333 tests **32/32 PASS** after the fix. Still an early candidate preflight, not an extraction security certification; original ticket OPEN.

## 2026-10-11 independent hostile preflight follow-up — namespace, references and ZIP source-view suffix

Direct `detectLocalFile()` fixtures were accepted **before** the patch even though the bounded ZIP text included: SVG `<s:script>` and `<s:foreignObject>` with prefixes bound to the SVG namespace; SMIL `<animateMotion>`; OOXML `TargetMode="Ex&#x74;ernal"`; or XML `Target="file:///etc/passwd"` without an explicit mode. All five independently failed the initial focused Vitest RED run (`supported` when `UNSUPPORTED` was expected). A sixth RED case showed `<s:svg><s:animateTransform .../></s:svg>` under a `.xml` entry also passed, because namespace-prefixed SVG roots escaped the SVG-specific branch.

The #407 helper now refuses active elements with XML namespace prefixes, SMIL animation and external-load elements, inspects SVG roots even when their ZIP member uses `.xml`, refuses entity-encoded values in reference-bearing XML attributes, and refuses external references in `Target` regardless of `TargetMode`. Two further RED cases proved that arbitrary namespace aliases for XInclude and character references inside `xmlns:inc="...XIncl&#x75;de"` also passed preflight; the helper now refuses the XInclude namespace URI and entity-encoded namespace declarations. A `feImage` fixture and two benign controls guard the boundary: namespace-prefixed SVG paths and ordinary internal OOXML relationships remain candidates. No XML DOM, network fetch or additional dependency was introduced.

Separate RED: `views/render.svg?source` passed ZIP member validation, so a URL query/fragment could obscure an active SVG suffix. Filename policy now refuses `?`, `#`, Windows-incompatible wildcard/quote/bracket/pipe characters and percent-encoded path delimiters/dots (including NFKC aliases). Benign `docs/discount%20offer.txt` remains permitted. Adversarial names include `%3F`, fullwidth `？`, `％`, and encoded `%2f` separators. Focused #407 + #333 detector Vitest run: **43/43 PASS** after all fixes. `astro check` performed during this wave: **0 errors, 0 warnings, 22 hints**; final scoped `git diff --check` PASS. No production release or parser certification claimed.

**Residual gate: OPEN / NO-GO for full AC-407.1–3.** This is a bounded candidate preflight, not an archive extractor or comprehensive hostile-graph validator. PDF checks observe only at most the first and last 128 KiB for large PDFs, with no guarantee for compressed/unparsed object streams or nested objects, and downstream decoders still need resource isolation, parser quotas and adversarial integration/rollback proof. No global AC has been checked off, and no commit, push or deployment was performed in this worker lane.

## 2026-10-12 scoped PDF annotation-action follow-up

Two independently valid PDF object graphs were offered as `supported/pdf` by the actual bounded `detectLocalFile()` gate: an annotation with an indirect `/A` dictionary containing `/S /URI /URI (https://example.test/outbound)`, and an indirect `/Next` action with PDF-name-escaped `/S /R#65ndition` pointing at a media-clip URL. Python `pypdf` in strict mode independently parsed each one-page document, its page annotation and action graph from real, correctly offset xref/trailer bytes. The first focused RED test run produced **3 failures, 1 pass** (two security cases plus a valid 300 KiB fixture that initially had a malformed trailer); the corrected, independently parseable large fixture still reproduced the actual security refusal failures before the code change.

`src/runtime/file-threat-gate-407.ts` now refuses the two previously omitted action names in the **observed** PDF window; it retains bounded reads and the explicit candidate-only outcome. The new `tests/file-threat-operational-next-407.test.ts` verifies those real PDF actions, an innocuous internal `/GoTo` annotation, and both hostile and benign large PDFs beyond the 256 KiB full-inspection threshold. No remote URL was contacted or file materialized beyond local test bytes. Focused operational + existing #407 + detector #333 tests were **48/48 PASS** after the change; scoped strict TypeScript passed.

**Disposition: AC-407.1–3 remain UNCHECKED / ticket OPEN / Gold and release NO-GO.** This addresses observed plain-text PDF action names within bounded windows, including name `#xx` escapes and referenced action chains. Compressed object streams, unobserved middle windows, downstream PDF/SVG/XML parsing and full hostile-graph/resource isolation remain outside this evidence.

## 2026-10-12 wave22 — SVG/HTML external-reference and CSS escape boundary (RED→GREEN, original AC still OPEN)

New genuine **pre-materialization fail-open**, distinct from the previous PDF
`/URI`/`/Rendition`, SVG namespace/script and encoded ZIP-path fixes:
the real `detectLocalFile` accepted a valid compressed ZIP containing
`<svg xml:base="https://outside.invalid/resources/"><a href="payload.svg#p">...`
as `supported/zip`. XML base URI changes how a downstream consumer resolves
the seemingly relative link: independently resolving the parsed attributes
produces `https://outside.invalid/resources/payload.svg#p`.
An SVG `href="../private/tracker.svg#anchor"` also escaped the originating
member's relative URL boundary without `xml:base`; a `mailto:` SVG hyperlink
could launch an external protocol handler despite the previous literal
`http/file/data/javascript` scheme checks. **No such navigation or fetch was
executed** in these tests: the issue is incorrectly labelling content as an
eligible local-only candidate before it is passed to an SVG/HTML consumer.

There was a second concrete CSS-grammar evasion:
`<s:rect style="fill:u\72 l(https://outside.invalid/secret.svg#id)"/>`
inside a fully namespace-bound `<s:svg>` stored in a ZIP member with a
`.xml` extension. The preflight previously looked for a literal `url(`,
but Chromium CSSOM **independently parsed the valid CSS escape as
`url("https://outside.invalid/...")`** while the preflight returned null.
The source ZIP entry was valid, fully decompressible and independently XML
parseable. No remote image was fetched in the CSSOM check.

**TDD evidence:** NEW `tests/file-threat-svg-zip-407-wave22.test.ts`
generated real DEFLATE ZIP members via root `fflate`, independently
decompressed them, and parsed SVG/XML using **root-lock-pinned
`sax@1.6.1` (transitively installed by root `svgo@4.1.0`)**, not the
gate's own regexes, not the spike's separate `node_modules`, and not a
network service. The unmodified gate failed **five tests out of six (RED)**,
including actual `detectLocalFile` fail-open results. The negative test
also wraps the genuine Blob `slice` calls: every requested read remains
at or below `FILE_DETECTION_LIMITS.maxReadBytes` and aggregate reads remain
at or below `maxTotalReadBytes`. Preflight neither uploads nor performs
external URL resolution/network fetching.

**Owned source-only fix:** In `src/runtime/file-threat-gate-407.ts`,
SVG/HTML inspection (also activated by namespace-prefixed SVG roots stored
under `.xml`) now refuses `xml:base` and `href`/`src` values other
than literal safe same-document `#fragment` references. It also decodes
bounded CSS hexadecimal/character escapes *only for rejection matching* so
escaped `url()` or `@import` is refused; it does **not** modify,
execute, render or sanitize supplied XML. Internal relative
`<Relationship Target="media/image.png" TargetMode="Internal"/>` in
ordinary OOXML remains a valid ZIP candidate, as do standalone inert
SVG paths/rectangles and same-document `href="#shape"` anchors. The previous
entity, XInclude, active-markup and ZIP path gates are unchanged.

**GREEN:** `vitest run tests/file-threat-svg-zip-407-wave22.test.ts
tests/file-threat-gate-407.test.ts
tests/file-threat-operational-next-407.test.ts
tests/file-detection-333.test.ts` **54/54 PASS** (new 6/6 and existing
48/48). Strict focused TypeScript `tsc --ignoreConfig --noEmit
--target es2023` **PASS**. No new direct or transitive
dependencies were installed, no `file-detection.ts` change, no
archive extraction, content materialization, provider, production
deployment or commit/push. All modifications scoped to this original
ticket, its existing threat helper, and the new test.

**Remaining blockers:** This remains a conservative **candidate-screening**
helper operating on bounded text members, not a complete XML/CSS/HTML
sanitizer or an independently verified downstream renderer. It does not
prove arbitrary SVG namespaces, complex CSS grammar, percent/URL semantics,
compressed/nested archives, large PDF object streams or all filesystem
extraction paths safe. No physical-device, release, full hostile-corpus
or rollback verification occurred. **AC-407.1, AC-407.2 and AC-407.3 remain
unchecked; original status `ready-for-agent`, owner and Gold NO-GO.**

## 2026-10-13 wave4 worker-2 — HTML meta-refresh navigation in ZIP (RED → GREEN; OPEN)

**New genuine runtime fail-open, distinct from the prior ZIP pathname, SVG link,
CSS escape and PDF action fixes:** A real CRC-valid DEFLATE ZIP member
`pages/index.html` can contain a valid HTML5 automatic redirect via
`<meta http-equiv="refresh" content="0;url=https://outside.invalid/next">`
without any script, `href`, `src`, stylesheet, DTD or CSS `url()` token. An
alternate order (`content` first), an HTML numeric character reference in the
attribute (`http-equiv="ref&#x72;esh"`), and unquoted `http-equiv=refresh`
are also valid. The installed root-lock-pinned `parse5` HTML5 parser
independently expands the character reference into `refresh` and recovers the
external HTTPS target from the actual inflated ZIP member. **No redirect or
network request was made**, and the recorded vulnerability is a false
`supported/zip` *candidate* status at the preflight boundary, not proven
navigation by this app or an exploit of an extraction consumer.

**Source-bound RED:** New
`tests/file-threat-407-20261013-html-refresh.test.ts` builds the ZIP using
the installed `fflate` ZIP encoder, independently decompresses/UTF-8 decodes
the member, and uses `parse5`, not a copy of the detector regex, to establish
its HTML attribute semantics. With the gate unmodified, all **three live
`detectLocalFile()` calls returned `supported/zip`** rather than the required
`UNSUPPORTED` refusal (**RED 3/4**, benign control GREEN); the same inputs
also escaped the standalone `checkTextPart407` check.

**Smallest source-only GREEN:** Only `src/runtime/file-threat-gate-407.ts`
adds a bounded `html`-member `<meta>` tag scan that identifies `http-equiv`
regardless of attribute order, quoting, case or a `>` inside a quoted
attribute. It refuses `refresh` and conservatively refuses HTML entity
references in `http-equiv` values, which HTML5 consumers can decode into
active navigation semantics. This is a fail-closed detector, **not a DOM
parser, HTML sanitizer, a browser navigation test or a proof about every
possible HTML grammar variation**. Ordinary `<meta charset>`, viewport and
`http-equiv="content-type"` metadata remain supported, as do prior benign
SVG and internal OOXML relationships. It changes no archive decoding,
input/read/expansion limits, ownership, file uploads or network policy.

**Verification and open gates:** New focused test GREEN 4/4. Together with
`file-threat-svg-zip-407-wave22`, `file-threat-gate-407`,
`file-threat-operational-next-407` and `file-detection-333`, the five-suite
regression is **58/58 PASS**; scoped strict TypeScript on source/new test
**PASS**. The benign test checks aggregate bounded reads and a pre-aborted
detector refuses with `CANCELLED`. This is only local preliminary screening
of the tested ZIP/HTML cases, not proof that all hostile HTML/CSS/XML/ZIP/PDF
inputs or downstream renderers are contained. Physical/device, comprehensive
hostile corpus, release/rollback and Gold gates are **NOT_RUN / NO-GO**.
Original **AC-407.1–3 remain unchecked** and ticket stays OPEN. No new
dependencies, vendor changes, code changes outside this file/new test/original
ticket, Git staging/commit/push/PR or production deployment by this worker.

**2026-10-13 integrator CI reconciliation (PR #10):** The first HTML-refresh
follow-up copied an older local source variant and accidentally dropped the
previously proven Unicode XML namespace-prefix refusal from the same gate.
GitHub changed-source CI reported six real failures in the existing
`tests/file-threat-407-20261013-unicode-prefix.test.ts`. The integrator
restored the original delimiter-bounded Unicode namespace checks while
retaining the new HTML meta-refresh rejection. Both focused regression
files, historic SVG/ZIP tests and file-detection checks now pass together:
**6 Vitest files / 68 tests PASS**. This is source regression restoration,
not a new archive-security acceptance or Gold claim; all original AC stay OPEN.

## 2026-10-13 independent P2 repair — HTML5 unquoted quotes hiding meta refresh (RED → GREEN, OPEN)

**Real bypass at Draft PR #10 source SHA dda51b9b:** An HTML5 attribute without
quotes may contain an apostrophe or a double quote as a recoverable parse
error. The previous meta regex treated that character as a new balanced
quoted string, skipped the entire tag and accepted a genuine CRC-valid ZIP
with pages/index.html containing an external meta refresh after data-x=a'.
Installed parse5 independently identified http-equiv=refresh and its external
target; the original Chrome probe intercepted an attempted external GET
without sending it over the network. Before the repair, the helper returned
null and actual detectLocalFile() returned supported/zip (candidate only).

**New independently observed RED:** New test
tests/file-threat-407-20261013-malformed-meta-refresh.test.ts uses installed
fflate to build/decompress real DEFLATE ZIP bytes and installed parse5 to
check four browser-valid HTML5 refresh variations: unquoted apostrophe,
unquoted double quote, quoted > followed by an unquoted apostrophe, and
entity-encoded http-equiv value after an unquoted apostrophe. All four
hostile cases failed against the original source (**4 failed / 1 benign
pass**). The test does not mock the detector or infer semantics from its regex.

**Scoped fix:** src/runtime/file-threat-gate-407.ts now scans HTML5 meta
start-tag attributes in a linear pass, opening quotes only where an attribute
value begins with a quote. Quotes embedded in unquoted values remain literal.
Quoted > does not end the tag; a truncated or ambiguous tag refuses
conservatively, and entity-bearing http-equiv remains unsupported. The scanner
is reached only for the ZIP detector's bounded HTML members (128 KiB/member,
256 KiB combined); no sanitizer, DOM or new dependency was added. Unicode XML
namespace refusals and ZIP path/entry/resource gates were retained unchanged.

**GREEN / limits:** New test **5/5 PASS**; cumulative seven scoped test files
**73/73 PASS**, including the prior six files / 68 cases, the original 10
Unicode namespace cases and 4 meta-refresh cases. Scoped strict TypeScript
(tsc --ignoreConfig --noEmit --target es2023 --module esnext
--moduleResolution bundler --strict --skipLibCheck --lib es2023,dom)
on source and new test **PASS**; scoped git diff --check **PASS**. A separate
source-bound Chrome readback confirmed that the real ZIP is now refused
UNSUPPORTED before HTML consumption; its Chrome refusal view issued **zero
outbound requests**. Browser probe is local headless Chrome, not physical
device, full downstream renderer or deployment acceptance. **Original
AC-407.1–3 remain unchecked / ticket OPEN / Gold and release NO-GO.**
Integrator owns PR #10 commit/push and CI; worker made no Git stage/commit/
push, provider write or production change.

## 2026-10-13 — independent Draft PR #10 P1 XML/HTML character references hiding CSS URLs (worker-10; RED → GREEN)

**Published-source reader-confirmed RED:** On exact remote Draft PR #10 head `eef624949ecfa82c7340abc47c4c2b4845ab74ad`, an independently inflated, real CRC-valid DEFLATE ZIP containing `graphics/drawing.svg` with `<rect style="fill:url&#40;https://outside.invalid/secret.svg#frame&#41;"/>` was marked `supported/zip` by the actual `detectLocalFile` public preflight and `checkTextPart407` returned null. Strict, namespace-aware installed SAX interpreted the style attribute as `fill:url(https://outside.invalid/secret.svg#frame)`; actual Chromium `DOMParser('image/svg+xml')` and SVG/CSSOM returned the same external CSS URL. Encoded `url&#x28;...&#x29;`, `u&#114;l(...)`, a CSS presentation `fill` attribute, Unicode-prefixed SVG inside `.xml`, and HTML5 `style="background-image:url&#40;..."` and unquoted HTML `style=background-image:u&#114;l(...)` all bypassed the preflight. Installed parse5 independently decoded the HTML attributes and Chromium `DOMParser('text/html')` CSSOM recovered their external `url(...)`. Browser probes intercepted all potential external requests; **zero offsite requests** were made. This proves incorrect candidate admission and parser disagreement, **not** an actual exfiltration or ZIP extraction exploit.

**Minimal owned fix / bounded safety:** `src/runtime/file-threat-gate-407.ts` adds a linear scan of CSS-capable attributes (`style`, SVG `fill`, `stroke`, `filter`, `clip-path`, `mask`, `marker-*`, `cursor`) in an already recognized SVG/HTML or namespace-prefixed SVG-in-XML source. XML/HTML entity-bearing values are refused before downstream character-reference decoding can turn them into executable CSS URLs. The scanner respects quoted attribute values including embedded opposite quotes and treats a quote inside an HTML5 unquoted value literally. It reuses the already enforced **128 KiB/part, 256 KiB total, 32 text-part** limits, with no DOM, CSS renderer, fetch, vendor import, network or unbounded match list. Existing `<style>` SVG elements are separately rejected by the original active-element gate. The existing standalone OOXML internal `<Relationship Target="media/image.png" TargetMode="Internal"/>` path is unchanged.

**Independent RED→GREEN tests:** New `tests/file-threat-407-20261013-xml-css-entities.test.ts` builds and independently decompresses real DEFLATE ZIP members, validates SAX XML namespaces and parse5 HTML5 attribute values, then checks the real bounded `detectLocalFile` decision. Its initial focused run was **7 failures / 9 tests** against the published source; two benign controls passed. Additional cases cover CSS single/double quotes and SVG `<style>` text. After the scoped fix the new suite **11/11 PASS**; all seven earlier #407/#333 suites remain **73/73 PASS**, for **84/84 PASS across eight suites**. Scoped strict TypeScript and whitespace checks were rerun separately. Current changed-source CI `38385478938` SUCCESS applies only to the **earlier** published SHA, not to this new local worker correction.

**Global #407 ticket lifecycle remains OPEN / NO-GO:** Original AC-407.1–3 unchecked. Candidate checks do not guarantee downstream XML/HTML/SVG sandboxing, malicious compressed/nested archives, unobserved PDF object graphs, arbitrary encodings, physical device/peak memory acceptance, Gold certification or production rollback. Prime alone handles scoped GitHub Flow staging/push, next PR #10 head/CI review and any release decision.


## 2026-10-13 — independent Draft PR #10 HTML5 slash CSS boundary (RED → GREEN)

**Published-source P2:** Independent second-pass review at Draft PR #10 head 44434aef211845b68adcefcb68ae6a087fb20993 against origin/main 402774b32a3d8cb6d2f2cbe836734ea1c655a4fa proved the CSS numeric-entity scan missed HTML5 slash-separated attributes. Before this correction, the actual ZIP public detector classified a real DEFLATE archive with pages/index.html containing an HTML div whose start tag had /style="background-image:url&#40;https://outside.invalid/steal.svg&#41;" as supported/zip. Installed parse5 independently recovered style=background-image:url(https://outside.invalid/steal.svg) while checkTextPart407 returned null. Variants with whitespace before the slash, repeated slashes, an HTML-embedded SVG rect and an unquoted HTML5 style attribute also escaped.

**Browser and bounded-read evidence:** Real headless Chromium CSSOM decoded the numeric references into background-image and fill url("https://outside.invalid/steal.svg") values, with two requests to the external resource intercepted and aborted: zero actual outgoing requests permitted. A 257-byte real ZIP containing 155 HTML bytes required 556 aggregate inspected read bytes, within the pre-existing 128 KiB text-member cap and bounded reader quotas. This proves external resource-load attempts if unsafe HTML is rendered after false candidate admission, not successful exfiltration. Prior GitHub changed-source CI run 38388096918 was SUCCESS for the vulnerable SHA, not for this unpublished correction.

**Scoped RED → GREEN:** New tests/file-threat-407-20261013-slash-css-entity.test.ts uses fflate CRC-valid ZIP generation and decompression, parse5 HTML5 recovered style attributes, public detectLocalFile and explicit bounded reads. Before the patch: **5 failures / 2 benign passes**. Minimal src/runtime/file-threat-gate-407.ts repair includes slash as a CSS attribute-name boundary **only for the HTML5 text-part kind**; strict XML/SVG keeps its former token boundary rules, including a benign XML attribute containing an inert /style sequence. No parser library, network, model, vendor asset, dependency or route was added. After patch: **7/7 new PASS**, original eight suites **84/84 PASS**, total **91/91 PASS** across nine suites; scoped strict TypeScript PASS. Integrator owns same Draft PR #10 staging, push and new exact-SHA CI readback; worker made no Git stage/commit/switch/push or PR comment.

**Global ticket remains OPEN/NO_GO:** Original AC-407.1–3 are unchecked. A bounded candidate-only ZIP preflight does not certify SVG/HTML sanitization, hidden PDF graphs, nested ZIP and extractor runtime isolation, physical mobile/performance quotas, Gold, source release, rollout or rollback acceptance.

## 2026-10-13 — independent Draft PR #10 HTML responsive-image `srcset` bypass (RED → GREEN)

**Published-source P2:** Independent review at exact remote Draft PR #10 SHA `89c21238eebfda7f4490ada906cc3321dfde0b69` (against `402774b3`) found a new unguarded external-resource attribute. A real 202-byte CRC-valid DEFLATE ZIP containing `pages/index.html` with `<img srcset="https://outside.invalid/pixel.svg 1x">` was independently decompressed using root `fflate` and parsed using installed `parse5`, which recovered the external `srcset` URL. The published `checkTextPart407(html, "html")` returned `null`; the genuine `detectLocalFile` classified the archive `supported/zip` after 446 aggregate inspected bytes. A local headless Chromium probe read the independently inflated HTML, recovered the same `img.srcset`/`currentSrc` URL, and attempted `https://outside.invalid/pixel.svg`. `page.route("**/*", route.abort())` intercepted the request **before network egress**; zero offsite requests were allowed. This establishes a false ZIP candidate admission at the source screening boundary, not application exfiltration or a downstream renderer exploit.

**Scoped correction:** The existing bounded HTML5 start-tag scanner in `src/runtime/file-threat-gate-407.ts` now covers `srcset` on `img`/`source` (also the HTML5 `image` alias) and `imagesrcset` on image-preload `link`. It refuses non-empty responsive-image attributes, including relative targets whose later browser base URL is unknown, entity-bearing values, HTML5 slash delimiters and quotes recovered from unquoted attributes. It preserves genuinely empty attribute values and inert image metadata, using HTML5 ASCII whitespace semantics so Unicode nonbreaking spaces cannot hide URL data. Existing meta refresh, Unicode XML prefixes, CSS entity, external SVG/OOXML and path gates remain in place. No parser dependency, extraction, upload, network call, provider action or materialization beyond local bounded test bytes was introduced.

**Independent RED → GREEN:** New `tests/file-threat-407-20261013-srcset.test.ts` creates/decompresses actual DEFLATE ZIP members, uses `parse5` for the HTML interpretation, verifies public `detectLocalFile` refusal and per-read/total read caps, plus benign controls. Before the source fix **7/11 failed** on actual missing refusals (the `image` alias and preload `link` already refused through previous active-element checks); after correction **11/11 passed**. Full #407/#333 scope is **102/102 PASS across 10 Vitest files** (91 previously published tests plus 11 new), scoped strict TypeScript and `git diff --check` **PASS**. Initial exact remote PR SHA's GitHub `changed-source` CI was **SUCCESS**, demonstrating prior coverage did not include `srcset`; it does not certify the new local correction. Prime owns publication and the next exact-SHA CI readback.

**Lifecycle:** AC-407.1–3 remain unchecked, original ticket **OPEN / NO-GO**. This is preliminary candidate filtering, not full hostile HTML parser or nested archive isolation, Gold certification, physical mobile/performance proof, production release or rollback validation. Worker owns only this original issue append, the threat gate and its new regression; no checkout/stage/commit/push/PR comments by the worker.


## 2026-10-13 — PR #10 HTML5 active media source attributes (worker-13, genuine RED → GREEN)

**Original-source independent P2:** Exact Draft PR #10 remote SHA `f664b6babf0cef1a750297bc3ca37d5acc486964` versus `origin/main 402774b32a3d8cb6d2f2cbe836734ea1c655a4fa` passed its preexisting 105/105 focused tests and GitHub changed-source CI, but missed browser-active HTML5 media URL attributes. In real CRC-valid DEFLATE ZIP `pages/index.html`, `<img src=https://outside.invalid/probe.png>`, `<video poster="https://outside.invalid/poster.png">`, `<audio src=https://outside.invalid/sound.mp3 autoplay>`, unquoted `<source src>`, `<track src>` and analogous relative/slash-delimited media attributes were parsed as real URLs by installed `parse5`, while `checkTextPart407` returned null and the public `detectLocalFile` reported `supported/zip`. A genuine Google Chrome headless Chromium probe recovered those attributes and attempted **three requests** (image, poster image, audio media). Every request was intercepted with Playwright `page.route('**/*', route.abort('blockedbyclient'))` before egress; no external traffic was allowed. This is an actual P2 false candidate admission, **not** demonstrated data exfiltration or a claim about downstream exploitation.

**Precise source RED:** New `tests/file-threat-407-20261013-media-attrs.test.ts` uses the real bounded ZIP detector, independent `fflate` DEFLATE roundtrip, `parse5` HTML5 attribute interpretation, and explicit read caps. On the vulnerable source, **12/14 failed** (two benign/existing guarded controls passed), reproducing unquoted `src`, slash-delimited, quote recovered, poster, video/audio/source/track/input media and unquoted anchor `href` bypasses. The independent Chrome evidence above demonstrates active attempts from exactly these resource attributes when consumed, and was not produced by a simulated network mock.

**Minimal bounded GREEN:** Extended the existing linear `hasUnsafeHtmlNavigation407` start-tag scanner in `src/runtime/file-threat-gate-407.ts` (no new parser/dependency) to cover `src` for `img/image/source/video/audio/track/input`, `poster` for `video`, and `href` for navigational `a/area/link`. Nonempty resource URLs—including unquoted, slash-delimited, protocol-relative, relative and entity-bearing attributes—are refused without resolving/fetching URLs; inert media metadata, empty `poster`, and strict same-document `#fragment` anchors remain permitted. Existing srcset/imagesrcset, CSS entities, Unicode XML namespace, meta-refresh, ZIP bounded reads, abort semantics, SVG and PDF gates remain in force. Postfix **12 Vitest suites, 119/119 PASS**, including the 14 new tests and all 105 previously focused tests. Strict scoped TypeScript `--ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --strict --skipLibCheck --types node --lib es2023,dom` on source and new test **PASS**, scoped `git diff --check` **PASS**. Separate independent real ZIP resource-budget smoke probes (129 KiB single HTML member, 300 KiB across three HTML members, 33 HTML members) all returned `TOO_LARGE` within bounded aggregate and per-read budgets; benign control remained supported. No new assets, extractor, provider network, receipt, registry or release operation; worker did not stage/commit/checkout/push or comment on PR.

**Lifecycle:** Original AC-407.1–3 remain unchecked / ticket **OPEN**, and browser end-to-end downstream renderer, nested archives, encrypted content, physical device and resource/rights acceptance, Gold and product/release remain **NO_GO**. Prime exclusively owns same Draft PR #10 staging, publishing and CI readback on the **next** exact SHA; the old SHA's green changed-source CI does not certify this additional fix.

## 2026-10-13 — CSS image-set string-resource admission bypass (worker-2, RED → GREEN)

**Verified P2 source gap after existing HTML media, srcset, SVG, XML and CSS url/entity fixes:** An actual bounded `pages/index.html` ZIP member with `<div style='background-image:image-set("https://outside.invalid/remote-background.png" 1x)'>` passed the existing `checkTextPart407` even though Chromium CSSOM recognizes `image-set()` with a quoted URL as an active image source, with no `url(`, `@import`, `<img src>` or HTML entity required. A local headless Chromium test observed an attempted image request and aborted it via Playwright route interception *before network egress*; no server or external endpoint was contacted. Also reproduced the `-webkit-image-set()` and CSS-escaped `im\\61 ge-set()` source patterns. This is a real P2 **false candidate admission** in a security preflight, not proof of actual downstream exfiltration.

**Bounded owned correction:** `src/runtime/file-threat-gate-407.ts` reuses the existing linear CSS-bearing-attribute scanner for `style`, SVG paint/filter/mask/marker/cursor, adds a conservative `image-set`/`-webkit-image-set` function check and decodes CSS escapes for this check. Raw prose and ordinary `data-*` attributes mentioning `image-set` remain candidates; benign gradients and ordinary OOXML references remain untouched. XML/HTML entity refusal remains active. CSS escape decoding also treats out-of-range code points as replacement characters rather than throwing. The gate still performs no DOM/CSS rendering, ZIP extraction, remote request or deep archive traversal.

**Focused regression/proof:** New `tests/file-threat-407-20261013-css-image-set.test.ts` used real CRC-valid DEFLATE ZIP generation/decompression, independent `parse5` HTML attributes, current bounded public `detectLocalFile`, and a native Chromium CSSOM/request attempt blocked before egress. The **initial test run was RED: 3/5 failed** because `checkTextPart407` returned null for the three live-style patterns; native browser and benign gradient controls passed. After the fix the new suite **6/6 GREEN**, proving actual ZIP candidate refusal through `detectLocalFile`, including an additional inert text/data-attribute control. Adjacent historical #407/#333 tests plus new suite **122/122 PASS across 12 files**. Scoped strict TypeScript `--ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --strict --skipLibCheck --types node --lib es2023,dom` PASS; scoped diff whitespace check PASS. No shared catalog/engine, CI, credential, provider, release or Git mutation by this worker.

**Global acceptance still OPEN / NO_GO:** AC-407.1–3 remain unchecked because a bounded candidate preflight cannot certify arbitrary nested/recursive archives and decompression resource isolation, opaque PDF object graphs, XML parser semantics beyond observed bytes, every HTML/CSS/browser feature, downstream materialization, physical-device/resource budgets or full production/security review. Prime owns serial review, Draft PR #10/CI integration and exact-SHA remote readback.

**2026-10-13 prime PR #10 Linux CI reconciliation:** The original real-browser `it` test failed at the GitHub `b40fbeab` changed-source job only because the Linux runner has **no installed Playwright Chromium binary** (`browserType.launch` missing), not because source assertions failed (the same job reported 2,318 passing Vitest cases plus that one infrastructure failure). Following existing repository browser harness convention, the CSSOM attempted-request proof moved unchanged in substance into explicit `tests/file-threat-407-20261013-css-image-set.browser.mjs`. `node` on the already provisioned real macOS Chromium independently passed the CSSOM/aborted-network check; all five portable ZIP/parser/benign tests remain mandatory in `tests/file-threat-407-20261013-css-image-set.test.ts` and pass. This is **not a skipped or simulated browser pass on Linux CI**: it deliberately separates source-only CI from the separate native-browser acceptance run. Fresh PR #10 CI on the new SHA is mandatory; #407 global AC and device/release gates remain OPEN.

## 2026-10-13 — direct OOXML parser ZIP metadata boundary (worker-5, RED → GREEN)

**Concrete parser entrypoint escape:** The production-facing `analyzeOoxmlPackage` was independently called by the Office worker, OOXML rebuild/media compression, metadata inspection and other engines before their `fflate.unzipSync` materialization. It had a second, weaker ZIP namespace/type validator even though the earlier `detectLocalFile` guard already rejected these inputs. A real, CRC-valid generated DOCX with a ZIP member `word/．．/outside.xml` (NFKC becomes `word/../outside.xml`), `word／outside.xml` (NFKC separator), `word/CONOUT$.txt` (Windows console namespace), `word/report.xml` plus `word/ｒｅｐｏｒｔ.xml` (normalization collision), and an actual Unix-mode symbolic link member were each accepted by the direct analyzer before the patch. The linked OOXML rebuild therefore entered its ZIP materialization path. The ZIPs were independently expanded only inside local disposable test fixtures, without filesystem extraction or external access. Separately, a regular ZIP file member `word` masked its descendant `word/document.xml` and was also accepted.

**Native reuse and scoped fix:** Root-lock installed `fflate@0.8.3` already contains the upstream July 2026 malformed-ZIP64 hang fix, so upgrading/introducing a competing archive parser would not address this application boundary. `src/engines/ooxml/package.ts` now reuses existing `checkZipPath407` and `checkZipEntryType407` on every central-directory entry before any decompression, normalizes path identities with NFKC case folding for duplicate checks, and refuses a regular file acting as the ancestor of another ZIP member. Existing `CORRUPT_PACKAGE: Duplicate OOXML part path` classification was preserved for the native #368 audit consumer; unsafe-path/type violations are `UNSAFE_PACKAGE_PATH`. No dependency or shared detection gate was changed.

**Reproducible source-bound proof:** New `tests/test_407_20261013_ooxml_materialization.test.ts`: **5/6 initial RED** on the pristine source for hostile metadata; a sixth distinct file/descendant conflict was independently RED after the initial fix; final **7/7 GREEN**, including valid DOCX bytes preserved through a real rebuild+ZIP reopen. Extended adjacency with #225, #264, #368 real donor/duplicate audit, #68, Office print, PDF-to-DOCX, spreadsheets, #333 and #407: **15 Vitest files / 125 tests PASS**. Scoped strict TypeScript and diff whitespace **PASS**. The first broad run failed due missing local donor `spikes/.../node_modules`; it was rerun after linking the identical installed donor dependency tree from the canonical checkout, and the three #368 failure cases additionally required preserving the upstream duplicate error mapping before the 125/125 PASS. Tests were run in isolated detached worktree at `c38da864`; worker did not stage/commit/push/deploy or change ticket status.

**Lifecycle:** Original AC-407.1–3 remain **UNCHECKED / OPEN / NO-GO**. This closes a bounded direct OOXML ZIP header/name/type check, but not all malicious XML/SVG/PDF object graphs, nested or enormous archives, arbitrary downstream consumers/filesystem extraction, complete independent corpus, physical-device resource limits, Gold/CI at integrated SHA, or rollout/rollback verification. PRIME owns review and integration; none of these global gates is implied by this suite.

## 2026-10-13 — direct OOXML true DEFLATE size/CRC preflight (worker-8, RED → GREEN)

**Reproduced P2 on real compressed ZIP bytes:** A CRC-valid 2,000,000-byte DEFLATE member was compressed to under 8KB, then its central-directory expanded-size field was forged to match the compressed byte length (~2KB). With both central and local metadata forged consistently, the direct `analyzeOoxmlPackage` accepted the archive as small and `fflate.unzipSync` materialized a silently truncated output. Independent built-in Node `zlib.inflateRawSync` on the *same compressed stream* verifies the actual 2,000,000-byte payload. A separately forged CRC (even with equal local and central metadata) likewise escaped the direct analyzer before remediation. The original regression supplied four RED cases (two size forgeries, CRC, and a purported positive that was actually over the preexisting 100:1 expansion limit); the positive was corrected to contain a lawful 8KB media member.

**Smallest native fix with bounded output:** `src/engines/ooxml/package.ts` reuses installed `fflate@0.8.3` `Inflate` (already used by other local bounded streaming consumers), feeding each raw DEFLATE payload in 256-byte compressed chunks and immediately counting/CRC32-hashing returned output without retaining full expanded entries. Real per-member expanded length must equal ZIP metadata and CRC32 must match, independently of forged local/central agreement; unexpected decompression output beyond declared size aborts as `EXPANSION_LIMIT`, invalid output/CRC as `CORRUPT_PACKAGE`. A 20 MiB cumulative decoded-byte cap applies to metadata and streamed output. Stored members also receive actual CRC verification. Local/central flags, CRC and sizes when no data descriptor exists, and compressed-member-to-directory bounds are checked before streaming. No new package, extractor, provider, filesystem extraction, deployment or other consumer was introduced.

**Source-bound acceptance:** The enhanced `tests/test_407_20261013_ooxml_raw_integrity.test.ts` independently distinguishes the forged true payload, coherent and incoherent size lies, wrong CRC, stored CRC, cumulative 20 MiB quota, and valid rebuild byte identity. The earlier namespace/type regression remains covered by `tests/test_407_20261013_ooxml_materialization.test.ts`. Focused suite **22/22 GREEN**; final **18 adjacent Office/ZIP Vitest files: 147 passing, one preexisting skipped** using `--testTimeout=15000`. The first 18-file rerun had 146 PASS, one skip and one unrelated #68 JPEG test exceeding the default 5-second budget under parallel load; the identical test passed alone in 698ms, and the complete 18-file rerun then passed with the explicit timeout. Scoped strict `tsc --ignoreConfig` and `git diff --check` PASS. Worker-only detached tree based on `origin/main` SHA `56e0e2dd`; prime exclusively owns Git, CI and PR integration.

**Residual:** #407 umbrella AC-407.1–3 stay **OPEN / NO-GO** pending broader archive/parser isolation, independent full matrix/real resources, integrated-SHA CI and required release acceptance. Streaming verification protects the synchronous analyzer, but cross-await mutations of caller-owned byte buffers before a separate downstream consumer are not proven absent by this narrow patch.

### 2026-10-14 prime + independent worker-10 — caller-buffer TOCTOU after CRC preflight

**Independent reproducible P2:** `rebuildOoxmlPackage`, the `loadPackage` path used by semantic extraction and the media-only compression entrypoint accepted a caller-owned `Uint8Array` for synchronous `analyzeOoxmlPackage` verification, then awaited dynamic imports before consuming the same mutable bytes. With a real stored DOCX ZIP, the caller changed one byte in `word/document.xml` immediately after invoking each async API: the original package's true CRC preflight had passed, but the rebuild returned `verification.memberBytesUnchanged:true` while outputting the **unverified mutated bytes**; semantic extraction consumed the changed text, and the media-only compressor failed late on an actual CRC mismatch. The new deterministic `tests/test_407_20261014_mutable_input_snapshot.test.ts` was **RED 3/3** on exact pre-fix source (actual `AAAA` became `ZAAA` after the checked entrypoint returned a Promise).

**Fail-closed single-snapshot fix:** The three exact OOXML entrypoints in `package-codec.ts`, `office-semantics.ts` and `media-compress.ts` now copy input bytes once before synchronous analysis and the first await; the actual materialization uses only this privately owned snapshot. No CRC weakening, reanalysis waiver, new dependency or provider access. New 3/3 GREEN, combined local parser + rebuild regressions 25/25 PASS. The public original #407 AC1–3 remain **OPEN/NO_GO**; malformed data descriptors/member layout, additional XML/SVG/PDF graphs, external resource and physical acceptance remain subject to broader security review. No Gold/publish/device evidence is implied.

### 2026-10-14 — ZIP record overlap and data descriptor parity

Independent adversarial review identified that metadata-consistent ZIP records could still overlap other local headers and that a bit-3 data-descriptor flag without an actual descriptor could pass the structural analyzer, although the CRC and expanded-byte budget checks remained enforced. New `tests/test_407_20261014_zip_layout_integrity.test.ts` creates actual CRC-consistent stored OOXML ZIP forgeries and was **RED 2/3** before remediation, with an independently constructed valid signed descriptor passing as a positive control. The direct OOXML analyzer now tracks each complete local-record interval, refuses intersecting header+data+descriptor spans, and checks the descriptor's CRC/compressed/expanded sizes against verified central metadata (with and without the optional signature). Latest 3/3 GREEN; combined targeted OOXML cases **28/28 PASS**. These are bounded structural invariants, not authorization to mark original AC-407.1–3 complete. No filesystem extraction, live provider or Gold receipt.

**Real GitHub CI regression #368 resolved before republishing:** First PR #47 head `7ab1919e` failed changed-source (run `38475377427`) with one independently reproducible existing test: `audit-office-fidelity-368-20261013-duplicate-raw-parts.test.ts` expects `ZIP_DUPLICATE_MEMBER` when duplicate raw DOCX part names coexist with an earlier entry's forged CRC; the new eager CRC/local parity verification instead returned `INVALID_ZIP_CENTRAL_DIRECTORY`. The analyzer now parses *all central names first* and refuses duplicate names before any local-header or inflated-byte validation; all local parity, real CRC and quota checks still happen before downstream materialization. Exact failed test genuinely **RED** in the integrator on original PR head; after two-pass preflight, independent suite **5/5 GREEN**, together with raw CRC, mutable-input, layout regressions **17/17 GREEN**. The old GitHub run is a historical **FAIL** and cannot certify the updated PR: fresh SHA/CI required. #368 acceptance is preserved without tolerating a single corrupt nonduplicate ZIP.
