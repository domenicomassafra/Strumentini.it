# 169 — Representable XML to JSON CSV and XLSX mappings

**What to build:** Add explicit XML→JSON and tabular XML→CSV/XLSX mappings only where structure is representable, exposing repeated/attribute/text mapping choices and refusing ambiguous flattening.

**Traces to:** US-EXP-04, US-EXP-05; AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** none; 168 and 161 are complete and reused directly.

**Status:** completed (bounded engine mapping; no standalone public route added in this tranche)

**Suggested skills:** code-typescript → code-module-design → code-tdd

- [x] Nested ambiguous XML refuses or requires explicit mapping.
- [x] Representable structures round-trip under the documented mapping.
- [x] Tabular exports expose row/column counts and mapping summary.

**Verification:** Representable and deliberately ambiguous XML fixtures.

**Evidence (2026-10-07):** `src/engines/table/xml-interchange.ts` reuses ticket 168's bounded `parseXmlDocument` so DTD/ENTITY declarations and unknown/external entities fail before mapping and no network resolver exists. XML→JSON uses the declared compact policy `@attribute`, `#text`, repeated children→arrays, empty elements→`null`, decoded predefined/numeric references, and refuses mixed content/comments/PIs that would be lossy (except an XML declaration envelope). XML→CSV/XLSX accepts only representable row tables: homogeneous direct rows by inference or a user-explicit relative `rowPath` through lossless single wrappers; row attributes map to safe `attr:name` columns, direct leaf children map to element columns, scalar rows use `#text`, missing cells become empty strings, and repeated fields/mixed content/nested fields/sibling data are refused rather than flattened. Every tabular result exposes row count, column count, resolved row path and per-column source mapping. XLSX generation reuses ticket 161's all-text `tableToXlsx`, immediately reopens through the independent `read-excel-file` path exposed by `xlsxToCsv`, and refuses success unless dimensions and the safe CSV projection match exactly. `quality/fixtures/xml-interchange/vectors.json` is registered as `xml-interchange`; `tests/xml-interchange.test.ts` covers deterministic JSON/CSV, explicit nested mapping, ambiguity refusal, zero-network DTD/entity rejection and XLSX reopen evidence. No browser acceptance was added because ticket 161/169 currently expose an engine seam rather than a standalone public route.
