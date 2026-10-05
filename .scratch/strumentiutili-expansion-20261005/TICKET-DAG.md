# StrumentiUtili.it future expansion — ticket DAG

Status: **future queue; do not auto-start from this planning turn**  
Origin: `docs/10-tool-expansion-result-system-v2.md`  
Generated: 2026-10-05

This queue uses tracer-bullet tickets. A blocked ticket is `ready-for-agent` only when its blockers are complete. Existing release blockers and modified quality receipts are outside this queue and must not be rewritten as part of ticket planning.

## Start frontier

- **01 — Expand Result System v2 primitives**
- **07 — Versioned Italy reference-data framework**
- **34 — Heavy local media/OCR/Office feasibility refresh**

These three can run independently.

## DAG

| # | Ticket | Blocked by |
|---:|---|---|
| 01 | Expand Result System v2 primitives | — |
| 02 | Migrate calculator/date/marketing results | 01 |
| 03 | Migrate text/research/developer results | 01 |
| 04 | Migrate table/CSV results | 01 |
| 05 | Migrate file/image/PDF/URL results | 01 |
| 06 | Close Result v2 at 200/200 coverage | 02,03,04,05 |
| 07 | Versioned Italy reference-data framework | — |
| 08 | Codice Fiscale generate/decode | 07 |
| 09 | IBAN validation and Italian coordinates | 07 |
| 10 | Partita IVA checksum + opt-in VIES | 07 |
| 11 | Upgrade IVA + percentage calculator | 01,07 |
| 12 | IRPEF annual calculator | 01,07 |
| 13 | Stipendio netto annual calculator | 12 |
| 14 | Regime forfettario annual calculator | 01,07 |
| 15 | TFR calculator | 01,07 |
| 16 | Mutuo + amortization calculator | 01 |
| 17 | Connection/device information tool | 01 |
| 18 | Close CalcolaTutto 13/13 parity | 06,08,09,10,11,12,13,14,15,16,17 |
| 19 | Universal unit-conversion family | 01 |
| 20 | Everyday math calculator family | 01 |
| 21 | Personal-finance calculator family | 01 |
| 22 | Password/passphrase/security family | 01 |
| 23 | Spreadsheet interchange family | 01 |
| 24 | Office/Markdown productivity family | 01,23,34 |
| 25 | Developer repair/schema family | 01 |
| 26 | Structured-data bulk/SQL family | 01,23 |
| 27 | Network/developer diagnostics family | 01 |
| 28 | Image format + target-compression family | 01,34 |
| 29 | Image edit/composition family | 01,28 |
| 30 | Screenshot/document privacy family | 01,29 |
| 31 | OCR and document-scan family | 01,29,34 |
| 32 | PDF edit/security family | 01,05,34 |
| 33 | PDF conversion/productivity family | 01,05,23,34 |
| 34 | Heavy local media/OCR/Office feasibility refresh | — |
| 35 | Audio capture/playback utilities | 01 |
| 36 | Audio file-processing family | 01,34 |
| 37 | Video inspect/subtitle utilities | 01,34 |
| 38 | Video transform family | 01,34 |
| 39 | AI-era deterministic helper family | 01,23 |
| 40 | Italy utilities beyond CalcolaTutto | 01,07,34 |
| 41 | Italian text/language long-tail family | 01 |
| 42 | Design/CSS/web-helper family | 01 |
| 43 | Date/time everyday utility family | 01 |
| 44 | Lightweight generators/productivity family | 01 |
| 45 | Expanded catalog IA and job-route discovery | 18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,35,36,37,38,39,40,41,42,43,44 |
| 46 | Full expansion certification + release integration | 06,18,45 |

## Coverage notes

- Tickets 02–05 partition the **current 200 tools exactly** by existing engine family: 44 + 62 + 20 + 74 = 200.
- Ticket 18 is a hard **13/13 CalcolaTutto parity gate**; existing equivalents such as Base64 and color conversion are covered through the Result v2 migrations plus targeted parity assertions rather than duplicate engines.
- Tickets 19–44 capture the high-value expansion jobs found in the competitor research. Each family ticket must certify every route it actually adds in the same tranche.
- Games/entertainment clones remain intentionally outside implementation scope; the source spec records that boundary so their omission is not accidental.

## Parallel waves

- **Wave A:** 01, 07, 34.
- **Wave B:** after the frontier closes, run every newly unblocked direct child in parallel; the main set is 02–05, 08–12, 14–17, 19–23, 25–28, 35–38, and 41–44, subject to the exact blocker table above.
- **Wave C:** run the dependent second-order slices 13, 24, 29–33, 36, 39–40 as their prerequisites close.
- **Wave D:** 06 and 18 once their migrations/parity work is complete.
- **Wave E:** 45 discovery/IA integration, then 46 full certification/release integration.
