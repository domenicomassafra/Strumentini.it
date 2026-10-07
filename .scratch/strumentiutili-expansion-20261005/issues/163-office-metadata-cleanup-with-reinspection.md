# 163 — Office metadata cleanup with reinspection

**What to build:** Add metadata inspect/remove for approved OOXML formats with a before→after field diff and independent output reinspection, preserving document package relationships.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** none; ticket 225 now provides the bounded package/reopen seam and ticket 270 authorizes this non-rendering OOXML path.

**Status:** completed (bounded OOXML metadata parts only)

**Suggested skills:** code-module-design → security-audit → code-tdd

- [x] Removed metadata is verified absent after rewrite.
- [x] Unsupported/password/macro cases follow the approved package policy.
- [x] Document/slide/sheet structure remains reopenable.

**Verification:** OOXML privacy corpus, package reopen and metadata byte/reparse checks.

**Evidence (2026-10-07 downstream):** `src/engines/ooxml/office-semantics.ts::cleanOfficeMetadata` runs only after ticket 225 bounded OOXML preflight, rewrites the existing `docProps/core.xml`, `docProps/app.xml` and `docProps/custom.xml` carriers to empty schema-valid containers without deleting package members, then independently reopens the produced ZIP and reinspects those carriers. Success is rejected unless reinspection finds zero non-empty metadata fields, the member set is unchanged, every `.rels` byte is unchanged, `[Content_Types].xml` is byte-identical and document/slide/sheet/relationship counts are unchanged. Macro/encrypted/ZIP64/traversal policy remains inherited fail-closed from ticket 225. `tests/office-downstream.test.ts` exercises DOCX/PPTX cleanup and before→after diff; `quality/receipts/office-downstream/browser-acceptance.json` proves the worker path at 390px with metadata removed `5→0`, zero external requests and verified reinspection.
