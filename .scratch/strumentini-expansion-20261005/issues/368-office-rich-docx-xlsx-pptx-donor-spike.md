# 368 — Office rich DOCX XLSX PPTX donor spike

**What to build:** Prova Libre Convert/ZetaOffice e alternative su documenti realistici

**Traces to:** OWN-04 OWN-15; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** feasibility

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-368.1: Prova Libre Convert/ZetaOffice e alternative su documenti realistici.
- [x] AC-368.2: License runtime, font, isolation e fidelity error impediscono adozione.
- [ ] AC-368.3: On the scoped input and failure cases, verify: Page layout/text/images comparator. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Page layout/text/images comparator. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## 2026-10-12 independent offline rich Office donor experiment (NO_GO)

**Outcome: `NO_GO`, production promotion explicitly false.** New
`scripts/audit-office-fidelity-368.ts` actually processes three existing,
editable, realistic OOXML samples **in memory**, then checks their donor
outputs with separate bounded JSZip and xmldom XML readers. New
`tests/audit-office-fidelity-368.test.ts` exercises real generation/readback
and negative refusal. It makes **no requests to an external converter**,
installs no packages, creates no production routes, and intentionally exits 2
after printing a structured, reproducible NO_GO outcome. The user-supplied
originals are never rewritten.

| Format and exact pinned source | Actual installed donor → output | Independent evidence | Material failure |
| --- | --- | --- | --- |
| DOCX 201,209 B; SHA-256 `973b551b9ec625584f64b1e475f8c766b5a80cde3fee72fd762d342e7f610dee` | `mammoth@1.13.0` → 681,846-byte HTML | 0 source text fragments missing; **2 of 2 image payload hashes preserved**; source has 1 editable table, 12240×15840 twips page size | HTML cannot certify pagination, native font metrics, image anchors, editable table layout or printed-page geometry |
| XLSX 171,698 B; SHA-256 `b79b7b703db87eb55a87c023b1f8c6f90530498ca24b3ec7f4be7e6fc02e286f` | `xlsx@0.18.5` SheetJS read→write → **9,303-byte XLSX** | Reopened via independent ZIP/XML; all extracted cell type/value representations matched by cell address, 0 mismatches; **source formula count 0**, so formula fidelity NOT_VERIFIED | **2 of 2 images lost**, **1 of 1 chart lost**, print margins alone do not prove page layout; old `xlsx@0.18.5` production refusal #270 still stands |
| PPTX 198,595 B; SHA-256 `15f39be12cf28a25abbd9be7d3eda9b380065cf1007690389d8ec060725035ab` | `pptxgenjs@4.0.1` reconstructs actual source text boxes → **44,821-byte PPTX** | Independently reopened: 1 source/1 output slide, all source shape text found, original 9144000×6858000 EMU page size retained; 1 source text shape rectangle matched | **2 of 2 images lost**, **1 chart and embedded workbook lost**; no general PPTX importer, original master, theme, fonts and full geometry are **NOT_VERIFIED** |

The DOCX source retains an image data URI for each original image via Mammoth;
the script compares actual decoded bytes with independent OOXML media digests.
For XLSX, the script reads cell values, shared strings, type and formula from
both OOXML archives without delegating the readback to SheetJS. PPTX slide
shape text and geometry likewise come from independent slide XML; opaque
printer-settings bytes are never interpreted. **No
rendered page images or pixel-difference comparison** was performed; the
result field is `visualPageFidelity: NOT_VERIFIED` for all three formats,
and matched shape rectangles do not override that state. Time and Node RSS
are recorded for every candidate as local snapshots, without claiming physical
mobile/WASM/peak resource bounds. Externally linked resources are never
requested by the audit; the script records this limited behavior as
`NO_URL_FETCH_REQUESTED`, not as an independently inspected network trace.

**Pinned direct donor provenance, all checked against installed package
metadata and SHA-256 of bundled license notices before conversion:**
`mammoth@1.13.0` BSD-2-Clause,
`xlsx@0.18.5` Apache-2.0,
`pptxgenjs@4.0.1` MIT,
`jszip@3.10.2` dual MIT/GPL-3.0-or-later (MIT option),
`@xmldom/xmldom@0.8.15` MIT.
This is **not** a transitive dependency/license or security certification.
LibreConvert/LibreOffice and ZetaOffice were **not installed in inspected local
candidate paths**; their runtime, fonts, vendor rights, outputs, isolation,
fees and fidelity are **NOT_RUN**. The audit rechecks candidate presence
without auto-installing or opening proprietary Office providers; even a later
detected installation remains license gated.

**Negative coverage:** mutated fixture SHA or size prevents conversion;
missing/wrong package or license SHA blocks the donor; malformed ZIP,
expanded 17 MiB ZIP bomb, synthetic `vbaProject.bin` active marker,
path traversal and OOXML kind/part boundaries are refused by the
independent inspector. Explicit pre-aborted request preserves the original
byte digest and yields `ABORTED`. Parsing has 2 MiB compressed source,
256-entry, 16 MiB total expanded, 5 MiB single part, 30-slide and 20,000
character caps. In-flight cancellation, browser and physical mobile
memory/performance, malformed vendor software behavior, and full font/layout
error remain **NOT_RUN/NO_GO**.

**Verification:** TDD first RED (new audit module absent); with real pinned
source/candidate outputs, final `./node_modules/.bin/vitest run
tests/audit-office-fidelity-368.test.ts` **5/5 PASS**. Independent test
capture also reopens the actual DOCX HTML image bytes and generated
XLSX/PPTX archive bytes outside the reporting function; adjacent
`tests/office-print-corpus-56.test.ts` stays **3/3 PASS**, combined **8/8**.
Targeted `tsc --ignoreConfig --noEmit` script+test PASS.
Whole repository `./node_modules/.bin/astro check` **2027 files:
0 errors, 0 warnings, 23 unrelated hints**.
Actual `tsx scripts/audit-office-fidelity-368.ts` ran the installed donors
and independently reopened the resulting files, printed the metrics above,
and deliberately ended **exit 2 NO_GO**. No commits, deployment, Gold,
historical receipts or other ticket files changed.

**AC scope:** AC-368.2 is satisfied only as a tested denial policy: incomplete
rights, transitive security, fonts, isolation, mobile and measured fidelity
continue to prevent adoption. **AC-368.1 stays OPEN** because LibreConvert/
ZetaOffice were unavailable and could not be evaluated against real outputs.
**AC-368.3 stays OPEN** until an approved page renderer provides comparable
page layout, source/output text, image placement, independent pixel comparison
and real device behavior. `Status: ready-for-agent` stays unchanged, and
this source-only feasibility audit does not release Office-to-PDF conversion
under #56.

## 2026-10-13 ZIP integrity and OOXML relationship evidence hardening (NO_GO)

**Three independently reproduced false acceptances were fixed only in the
offline inspector.** New test
`tests/audit-office-fidelity-368-20261013-relationships-integrity.test.ts`
starts from the original SHA-pinned editable XLSX/DOCX fixture bytes and
uses the already installed independent JSZip/xmldom readers to construct
disposable negative variants. Before the patch, **3/3 tests failed**:

- Changing the existing XLSX external hyperlink declaration from
  `TargetMode="External"` to valid `TargetMode = "External"` left the XML
  relationship intact (independently verified via DOM), but the regex-based
  inspector reported **zero** external relationships instead of one. All
  `.rels` evidence is now XML parsed with its package namespace; malformed
  relationship XML also fails closed.
- Changing the existing DOCX main part's ContentType to a macro-enabled MIME
  with legal spaces around `=` was accepted as an ordinary DOCX. The
  `[Content_Types].xml` manifest is now namespace-aware XML; active Override
  declarations and active Default declarations that match actual parts fail
  with `ACTIVE_CONTENT_REFUSED`. SheetJS's inert `.bin` fallback declaration
  without a matching binary part remains accepted for measurement only.
- Flipping the CRC in the existing DOCX central directory for
  `word/document.xml` left the inspector returning a valid inventory. The
  archive now validates actual ZIP CRC values **after** compressed and
  expanded size/entry limits, refusing this corrupt package with
  `INVALID_ZIP_CRC` without inflating unbounded archives during admission.

**Verification:** isolated regression test prepatch **3 RED**; after the
minimal parser/CRC change, original #368 **5/5**, new **3/3**, and adjacent
Office print corpus **3/3**, combined **11/11 PASS**. Strict targeted
`tsc --ignoreConfig --noEmit` with Node types **exit 0**. Actual installed
donor CLI still processes all three SHA-pinned originals, reports all as
`MEASURED_WITH_FIDELITY_LOSS`, retains `visualPageFidelity: NOT_VERIFIED`,
`transitiveLicenseAndSecurityAcceptance: NOT_VERIFIED`,
`productionPromotion: false`, and deliberately exits **2 (`NO_GO`)**.
No packages, original fixture bytes, production routes, historical Gold
receipts, provider access, or vendor installation changed. Original
AC-368.1 and AC-368.3 remain **OPEN**; LibreConvert/ZetaOffice, layout
renderer, device and transitive license gates are still unproven.

**Same-day bounded-inflate correction to the CRC fix:** A fourth new
regression uses the authentic SHA-pinned DOCX plus an 18 MiB DEFLATE member
whose local and central ZIP headers falsely advertise 1 KiB; the resulting
ZIP is below the 2 MiB compressed input cap. Simply asking JSZip to perform
whole-archive `checkCRC32` after validating the *claimed* sizes was shown
**RED**: it processed the forged expansion before reporting invalid CRC.
The final implementation instead streams actual bytes, increments CRC32 per
chunk, and terminates immediately on real per-part/total size excess or
disagreement with the claimed size. JSZip's installed readable-stream emits
`data/end/error` events and does not implement `Symbol.asyncIterator`, so
the bounded reader uses its native event API. The fabricated 18 MiB case now
fails promptly as `ZIP_EXPANSION_LIMIT` (**GREEN**), including an isolated
run with V8 heap limited to **128 MiB**. Final scoped suite after this
correction: #368 original **5/5**, new **4/4**, adjacent Office **3/3**,
combined **12/12 PASS**. The earlier 11/11 intermediate count above is
superseded by this final 12/12 proof. Release decision remains `NO_GO`.

## 2026-10-13 raw ZIP duplicate/entry-budget review correction (NO_GO)

An independent read-only review of Draft PR #26 (remote source SHA
`8d266c7ffadb24774bc80885e4f5ee0a00cf2bc2`) found **two actual P2 false
acceptances and an entry-cap bypass** in the earlier offline inspector:
JSZip's `archive.files` map keeps one member when two physical ZIP directory
entries have the same filename. The prior CRC check and `.rels` inventory only
visited the surviving member; empty directory entries were excluded from the
advertised 256-member limit. The separately reproduced originals were:

- Authentic XLSX: a second ZIP member with the *same* raw
  `xl/worksheets/_rels/sheet1.xml.rels` path shadowed the original external
  relationship. Python `zipfile.infolist()` + `ElementTree` enumerated two
  same-named physical XML parts with external-target counts `[1, 0]`, while
  JSZip-backed `inspectOoxml368` accepted the archive and falsely returned
  `externalRelationshipCount: 0`.
- Authentic DOCX: two raw `word/document.xml` central records, first with
  flipped CRC. Python `zipfile.open(first ZipInfo).read()` raised `BadZipFile`
  for the corrupt member while the inspector accepted the shadowed package.
- Authentic DOCX with 9,000 additional directory entries, under the 2 MiB
  compressed input limit, was accepted despite a 256-member cap. A separate
  exact boundary probe now accepts 256 physical entries and rejects 257.

New `tests/audit-office-fidelity-368-20261013-duplicate-raw-parts.test.ts`
builds all evidence in disposable memory using the installed pinned JSZip,
rewrites local **and** central ZIP names, and independently invokes Python's
standard-library `zipfile`/`ElementTree`. **4 new adversarial cases were RED
against the previous implementation**, including an additional Unicode NFKC
alias collision. The bounded correction in
`scripts/audit-office-fidelity-368.ts` **reuses the already installed local**
`src/engines/ooxml/package.ts` central-directory analyzer before invoking
JSZip. That existing parser verifies physical ZIP32 entry count, duplicate
and case-folded paths, local/central filename agreement and supported header
bounds. The audit additionally enforces its tighter 256-member limit
**including directories**, refuses NFKC/URI-alias paths, and verifies the
decoded JSZip member count still matches the physical count. The earlier
streaming per-member actual-byte/CRC checks remain in force.

**Verification:** initial adversarial `vitest` **4/4 RED** (old inspector
resolved instead of refusing); final focused new **5/5 GREEN** and all
existing #368 original **5/5**, relationships-integrity **4/4**, adjacent
Office print corpus **3/3**, **17/17 PASS**. Strict `tsc --ignoreConfig`
with ESNext/bundler, Node types, `--strict --noUncheckedIndexedAccess` **PASS**.
Actual three donor conversions on original SHA-pinned DOCX/XLSX/PPTX inputs
all remain `MEASURED_WITH_FIDELITY_LOSS`, with candidate sizes **681,846 B,
9,303 B, 44,821 B**, respectively; `productionPromotion: false`,
`decision: NO_GO`, `visualPageFidelity: NOT_VERIFIED` and
`transitiveLicenseAndSecurityAcceptance: NOT_VERIFIED` still hold.
Python `openpyxl` was not installed and was not installed for this task;
the independent evidence uses standard-library ZIP/XML readers. No new
dependencies, production paths, original fixtures, or Gold receipts changed.
Original **AC-368.1 and AC-368.3 remain OPEN**, with vendor, rendering,
license, physical mobile and fidelity comparisons still gated.
