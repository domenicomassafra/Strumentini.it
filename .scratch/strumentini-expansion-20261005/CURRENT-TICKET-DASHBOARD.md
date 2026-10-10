# Strumentini.it — execution dashboard (generated)

Machine source: ticket issue files + `ticket_dashboard.py`. Rebuild with `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --write`; validate with `--check`.
This is a backlog/triage dashboard, **not** a release readiness or Gold certificate.

| Metric | Count |
|---|---:|
| All / completed / open | 327 / 273 / 54 |
| Closed with explicit refusal (NOT shipped) | 18 |
| DAG-ready (all numeric dependencies closed) | 18 |
| Ready for assignment (feasibility still to prove) | 10 |
| Waiting on other tickets | 36 |
| Waiting on official sources | 2 |
| Waiting on physical evidence | 5 |
| Blocked by unapproved capability | 1 |
| Stored status mismatches | 0 |

`ready-for-agent` means a worker may begin exploration/implementation, **not** that technical acceptance is already proven. External gates are never silently waived. An implemented feature may still be open for unproven acceptance.

## Closed with explicit REFUSAL

#150, #207, #208, #209, #222, #223, #224, #230, #242, #244, #245, #253, #257, #258, #259, #262, #263, #320

## Ready for assignment (feasibility still to prove) (10)

- #033 — PDF conversion/productivity family
- #036 — Audio file-processing family
- #047 — JPEG/PNG/WebP/SVG compression engines
- #056 — Office-to-PDF and printable export pack
- #057 — PDF-to-editable/structured conversion pack
- #212 — HEIC AVIF and GIF directional image implementations
- #234 — Video transform worker core
- #237 — True PDF redaction with post-export proof
- #241 — PDF signature placement
- #246 — Local image OCR

## Waiting on other tickets (36)

- #008 — Codice Fiscale generate/decode (awaiting #121, #122)
- #011 — Upgrade IVA + percentage calculator (awaiting #126)
- #012 — IRPEF annual calculator (awaiting #127, #128)
- #013 — Stipendio netto annual calculator (awaiting #130)
- #014 — Regime forfettario annual calculator (awaiting #133)
- #015 — TFR calculator (awaiting #134, #135)
- #018 — Close CalcolaTutto 13/13 parity (awaiting #008, #011, #012, #013, #014, #015)
- #024 — Office/Markdown productivity family (awaiting #056)
- #028 — Image format + target-compression family (awaiting #047, #049)
- #031 — OCR and document-scan family (awaiting #246, #247)
- #032 — PDF edit/security family (awaiting #237, #241)
- #035 — Audio capture/playback utilities (awaiting #229)
- #038 — Video transform family (awaiting #234, #306)
- #040 — Italy utilities beyond CalcolaTutto (awaiting #152)
- #045 — Expanded catalog IA and job-route discovery (awaiting #018, #024, #028, #031, #032, #033, #035, #036, #038, #040, #065, #066)
- #046 — Full expansion certification + release integration (awaiting #018, #045, #065, #066, #158, #279, #280, #281)
- #049 — Image conversion matrix + HEIC/AVIF/GIF (awaiting #212)
- #058 — PDF↔image directional conversion pack (awaiting #235)
- #062 — Upgrade existing business/date functionality (awaiting #126, #127, #128, #130, #133, #134, #135)
- #065 — Format-operation matrix coverage gate (awaiting #047, #049, #053, #056, #057, #058)
- #066 — Existing 200 functional-upgrade coverage gate (awaiting #053, #062)
- #121 — Codice Fiscale formal validate and generate engine (awaiting #115)
- #122 — Codice Fiscale decode and omocodia ambiguity (awaiting #121)
- #126 — IVA add and scorporo with versioned presets (awaiting #117)
- #127 — IRPEF national annual core (awaiting #117)
- #128 — IRPEF supported deductions and addizionali tranche (awaiting #127)
- #130 — Stipendio netto annual v1 (awaiting #128)
- #133 — Regime forfettario annual v1 (awaiting #117)
- #134 — TFR accrual and ISTAT-backed revaluation (awaiting #117)
- #135 — TFR indicative taxation layer (awaiting #127, #134)
- #152 — Italian invoice stamp-duty reference helper (awaiting #117)
- #158 — Italy source freshness and annual rollover gate (awaiting #115, #117)
- #235 — Advanced Images to PDF composition (awaiting #212)
- #247 — Scanned PDF OCR and searchable text layer (awaiting #246)
- #279 — Image-resize Gold promotion gate (awaiting #277, #278)
- #306 — Video to GIF conversion (awaiting #234)

## Waiting on official sources (2)

- #115 — Italian administrative geography source pack — Official historical municipality/foreign-state code coverage incomplete
- #117 — Italian fiscal annual source snapshots — No complete official annual IVA/IRPEF/forfettario source set for one tax year

## Waiting on physical evidence (5)

- #229 — Microphone test and local recorder — Real physical microphone capture/permission proof missing
- #277 — Physical Android Chrome image-resize acceptance — Physical Android Chrome target and evidence missing
- #278 — Physical iOS Safari image-resize acceptance — Physical iOS Safari Web Inspector/picker acceptance missing
- #280 — Physical Android heavy-tool web acceptance lane — Physical Android heavy-tool acceptance evidence missing
- #281 — Physical iOS Safari heavy-tool web acceptance lane — Physical iOS Safari heavy-tool acceptance evidence missing

## Blocked by unapproved capability (1)

- #053 — Upgrade existing PDF inspect/extract/compare tools — Ticket 320 closed REFUSED; PDF password-supplied decrypt acceptance remains unfulfilled

## Integrity and release boundary

- The scheduler reads numeric dependencies, while this dashboard also preserves evidenced non-numeric constraints.
- To clear a source/device/capability gate, add verifiable evidence to the corresponding issue and deliberately update this gate registry.
- Run targeted tests per lane; one integrated test/check/build for merged batches; update release validation independently.
- No automation here changes Gold receipts, source hashes, physical evidence, release state or production.
