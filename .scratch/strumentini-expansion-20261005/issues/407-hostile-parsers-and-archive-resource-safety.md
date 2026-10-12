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
