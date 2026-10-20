# STR-390 — Compare, join and split/merge tables

Checked 2026-10-20. Reused existing project dependencies and browser runtime:

- PapaParse (https://github.com/mholt/PapaParse), MIT, already installed:
  CSV/RFC4180 parsing and serialization in src/engines/table/csv.ts.
- read-excel-file (https://github.com/catamphetamine/read-excel-file), MIT,
  already installed: XLSX values in the bounded src/engines/office-local worker.
- Native repository compareCsvTables, joinCsvTables, assertBoundedTable,
  runOfficeLocalJob, tool registry and Result v2 bounded table preview.

No new dependency is required. Local logic covers missing decimal key normalization,
duplicate cardinality refusal, original value recovery and strict concatenation.

Limits: Decimal keys accept only signed base-10 digits with dot separator, no
exponents or locale-specific commas. Scale 0–12 validates fractional significance
and never rounds. Text identifiers preserve leading zeros. Join rejects duplicate
keys unless Cartesian expansion is selected explicitly; NULL keys never join by
default. Compare refuses NULL identities unless opted into matching; duplicate
keys are disclosed as ambiguous groups. Appending CSV chunks requires identical
unique ordered headers, preserves every row and retains duplicate records.
XLSX import uses one sheet (explicit choice for multi-sheet files); formula
results and styles are not silently presented as editable input. Existing local
file/row/cell/output limits remain in effect.
