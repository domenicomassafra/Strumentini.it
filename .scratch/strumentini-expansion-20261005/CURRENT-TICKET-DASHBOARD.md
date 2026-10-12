# Strumentini.it — execution dashboard (generated)

Machine source: ticket issue files + `ticket_dashboard.py`. Rebuild with `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --write`; validate with `--check`.
This is a backlog/triage dashboard, **not** a release readiness or Gold certificate.

| Metric | Count |
|---|---:|
| All / completed / open | 424 / 300 / 124 |
| Closed with explicit refusal (NOT shipped) | 17 |
| DAG-ready (all numeric dependencies closed) | 36 |
| Ready for assignment (feasibility still to prove) | 29 |
| Waiting on other tickets | 88 |
| Waiting on official sources | 2 |
| Waiting on physical evidence | 5 |
| Blocked by unapproved capability | 0 |
| Stored status mismatches | 0 |

`ready-for-agent` means a worker may begin exploration/implementation, **not** that technical acceptance is already proven. External gates are never silently waived. An implemented feature may still be open for unproven acceptance.

## Closed with explicit REFUSAL

#150, #207, #208, #209, #222, #223, #224, #230, #242, #244, #245, #253, #257, #258, #259, #262, #263

## Ready for assignment (feasibility still to prove) (29)

- #047 — JPEG/PNG/WebP/SVG compression engines
- #056 — Office-to-PDF and printable export pack
- #212 — HEIC AVIF and GIF directional image implementations
- #237 — True PDF redaction with post-export proof
- #246 — Local image OCR
- #328 — P0 Account Turnstile login reale
- #329 — P0 Contrasto accesso e errori WCAG
- #330 — P0 Recenti realmente alimentati
- #336 — Picker iPhone Android e touch equivalente
- #339 — Scarica manuale e auto opt-in
- #347 — P0 Badge Gold fingerprint frontend backend
- #349 — File server opt-in TTL delete prova
- #350 — P0 Accessibilità AA di base e advanced
- #351 — Tre direzioni redesign non cosmetiche
- #363 — Budget memoria mobile editor reali
- #366 — Licenze e provenance donor pinning
- #367 — Codec immagini local vs donor
- #368 — Office rich DOCX XLSX PPTX donor spike
- #369 — Motore PDF editor proprietary-safe confronto
- #370 — Spreadsheet CSV Excel donor fidelity
- #371 — OCR multilingual donor and quality study
- #378 — True redaction security independent gate
- #394 — Metadata stripping with after-export forensic inspection
- #396 — Two Italian tax journeys privati PIVA
- #397 — Official annual tax source inventory
- #404 — Change scoped CI and cumulative release validation
- #406 — Independent PDF redaction attack corpus
- #407 — Hostile parsers and archive resource safety
- #415 — Per-tool base claim proof and certification coverage

## Waiting on other tickets (88)

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
- #032 — PDF edit/security family (awaiting #237)
- #035 — Audio capture/playback utilities (awaiting #229)
- #040 — Italy utilities beyond CalcolaTutto (awaiting #152)
- #046 — Full expansion certification + release integration (awaiting #018, #158, #279, #280, #281)
- #049 — Image conversion matrix + HEIC/AVIF/GIF (awaiting #212)
- #058 — PDF↔image directional conversion pack (awaiting #235)
- #062 — Upgrade existing business/date functionality (awaiting #126, #127, #128, #130, #133, #134, #135)
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
- #332 — Sync preferiti con rimozioni e conflitti (awaiting #328, #330)
- #343 — Esporta importa elimina configurazione (awaiting #330)
- #345 — Navigazione stabile da task e file (awaiting #330)
- #352 — Selezione owner direzione visuale (awaiting #351)
- #353 — IA e design system dopo scelta (awaiting #352)
- #354 — Redesign home file-first search-first (awaiting #352, #353)
- #355 — Redesign catalogo ricerca categorie (awaiting #352, #353)
- #356 — Redesign wrapper e input famiglia (awaiting #352, #353)
- #357 — Redesign risultati e next-action (awaiting #352, #353)
- #358 — Redesign area settings onboarding (awaiting #330, #352, #353)
- #359 — Redesign risorse privacy ed errori (awaiting #352, #353)
- #360 — Motion utile opt-out reduced-motion (awaiting #352, #353)
- #361 — Sound design opt-in OFF default (awaiting #352, #353)
- #362 — Device fisici mobile file-result-share (awaiting #336)
- #364 — Canary e rollback design per tranche (awaiting #353, #354, #355, #356, #357, #358, #359)
- #372 — Editor PDF page workspace (awaiting #369)
- #373 — PDF editing testo originale font e layout (awaiting #369, #372)
- #374 — PDF annotazioni highlighter comments (awaiting #372)
- #375 — PDF immagini oggetti posizionati (awaiting #372)
- #376 — PDF form input edit e flatten (awaiting #372)
- #377 — PDF OCR searchable scansioni (awaiting #247, #371)
- #379 — PDF progetto history e undo (awaiting #372)
- #380 — PDF editor export source-bound (awaiting #373, #374, #375, #376, #379)
- #381 — Image editor canvas e layers (awaiting #363, #367)
- #382 — Image editor masks selections crop (awaiting #381)
- #383 — Image editor color resize adjustment (awaiting #381)
- #384 — Image editor text shapes composite (awaiting #381, #382)
- #385 — Image editor undo project save (awaiting #381, #382, #383, #384)
- #386 — Image editor mobile memory QA (awaiting #363, #385)
- #387 — CSV XLSX import export fidelity (awaiting #370)
- #388 — Table cleaning sort filter transforms (awaiting #387)
- #389 — Excel workbook editing cells formulas (awaiting #370, #387)
- #390 — Data compare join split merge (awaiting #387)
- #391 — Data automation pipeline local typed (awaiting #388, #390)
- #392 — Rich Office fidelity corpus and go-no-go (awaiting #368)
- #393 — Image codecs multi-frame orientation metadata (awaiting #212, #367)
- #395 — OCR language confidence and user correction (awaiting #246, #371)
- #398 — Versioned IVA and IRPEF examples (awaiting #117, #397)
- #399 — Net salary and employee contribution model (awaiting #128, #398)
- #400 — Forfettario partita IVA calculations (awaiting #117, #397)
- #401 — TFR accrual revaluation and indicative scope (awaiting #134, #398)
- #402 — Fiscal rollover source expiry and blocking (awaiting #115, #117, #397)
- #403 — Physical microphone and audio media continuation (awaiting #229)
- #405 — Release scope gates and rollback drill (awaiting #347, #404)
- #409 — Tax-year review ownership and retrospective versions (awaiting #397, #402)
- #411 — Audio video large file mobile progress and cancel (awaiting #363)
- #412 — Editor project schema and forward-safe migrations (awaiting #379, #385)
- #414 — Commercial engine vendor proposal and license gate (awaiting #366)
- #416 — Safe ZIP GZIP archive compression and extraction (awaiting #407)
- #417 — PDF password encrypt decrypt legitimate unlock engine study (awaiting #369)
- #418 — PDF repair tolerant recovery bounded and independently proved (awaiting #369)
- #419 — PDF/A compliant export independent validator decision (awaiting #369)
- #420 — PDF to editable DOCX semantic reconstruction feasibility (awaiting #369, #368)
- #421 — EML MSG offline viewer and safe attachment handling (awaiting #407)
- #422 — EPUB offline reader and text export safety (awaiting #407)
- #423 — P7M legally scoped verification and extraction feasibility (awaiting #366, #407)
- #424 — Audio transcode target bitrate and compression feasibility (awaiting #363)

## Waiting on official sources (2)

- #115 — Italian administrative geography source pack — Official historical municipality/foreign-state code coverage incomplete
- #117 — Italian fiscal annual source snapshots — No complete official annual IVA/IRPEF/forfettario source set for one tax year

## Waiting on physical evidence (5)

- #229 — Microphone test and local recorder — Real physical microphone capture/permission proof missing
- #277 — Physical Android Chrome image-resize acceptance — Physical Android Chrome target and evidence missing
- #278 — Physical iOS Safari image-resize acceptance — Physical iOS Safari Web Inspector/picker acceptance missing
- #280 — Physical Android heavy-tool web acceptance lane — Physical Android heavy-tool acceptance evidence missing
- #281 — Physical iOS Safari heavy-tool web acceptance lane — Physical iOS Safari heavy-tool acceptance evidence missing

## Blocked by unapproved capability (0)


## Integrity and release boundary

- The scheduler reads numeric dependencies, while this dashboard also preserves evidenced non-numeric constraints.
- To clear a source/device/capability gate, add verifiable evidence to the corresponding issue and deliberately update this gate registry.
- Run targeted tests per lane; one integrated test/check/build for merged batches; update release validation independently.
- No automation here changes Gold receipts, source hashes, physical evidence, release state or production.
