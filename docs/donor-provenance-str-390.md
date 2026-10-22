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

## Ripresa del 21/10/2026: precisione e token NULL

Verifica upstream (21/10/2026), dipendenze gia presenti nel repository:
- PapaParse 5.7.0, MIT, https://github.com/mholt/PapaParse,
  master e78dddce4764a3465e86f3a2fddd0a1bcfc854be (09/10/2026).
- read-excel-file 9.3.10, MIT, https://github.com/catamphetamine/read-excel-file,
  master ed84ee1971d0d4bc334efe320cd7a9a7a207ae62 (07/10/2026).
- Riferimento comportamentale aggiornato (21/10/2026):
  https://duckdb.org/docs/current/sql/data_types/nulls e
  https://duckdb.org/docs/lts/sql/expressions/comparison_operators.
  NULL e un'identita separata dai valori non-NULL; un confronto opt-in di due
  NULL non deve mai accoppiare un valore ordinario al suo token di rappresentazione.

Gap personalizzato circoscritto: la normalizzazione numerica delle colonne chiave
nell'adapter relations-390 poteva produrre lo stesso testo di un token NULL fornito
(ad esempio 00 diventa 0, con nullTokens [0]). Si usa un prefisso interno scelto
per non collidere con alcun token configurato; gli engine gia in uso applicano le
politiche NULL originali, mentre l'output recupera le celle di origine.
Nessuna nuova dipendenza, duplicazione di join/compare o modifica di terzi.
