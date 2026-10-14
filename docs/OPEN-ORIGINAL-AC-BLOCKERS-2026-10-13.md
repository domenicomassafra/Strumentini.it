# Strumentini — original ticket AC not yet accepted (source-bound snapshot)

**Authority:** canonical `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.json` and original issue Markdown, not a parallel completion authority. Verified `origin/main` commit `317bf371b7575d6534586dd0a681fb2fd6ffc20b`, 2026-10-14 (source-bound snapshot before subsequent unrelated fixes). Recompute from current main before relying on counts after any merge.

**Current at this source SHA:** **307/424 completed**, **117 open** (25 ready-for-agent, 85 dependency-blocked, 5 external-device-blocked, 2 external-source-blocked. The authoritative taxonomy below is calculated); **0 current Gold**, **269 PENDING**. Completing source tests is not deployment, platform device acceptance, licensing or owner approval. For dependency tickets, the exact ID shown is a formal DAG gate; the first unchecked original AC is provided if it exists; seven structurally blocked tickets have no unchecked original AC but still lack the independent prerequisite listed. For ready tickets, blocker is the smallest material gap evident from original AC and prior receipts—not a claim that all remaining code is absent. No original checkbox, issue status or ticket ledger is changed by this report.


## Azionabili ma con AC ancora non dimostrate (25)

| Ticket | Prima AC originale non spuntata (se presente) | Precondizione/prova mancante |
|---|---|---|
| #47 — JPEG/PNG/WebP/SVG compression engines | JPEG has normal/high-compression presets plus expert controls only when the codec exposes them reliably. | Codec avanzati JPEG/WebP, SVG multipass e prove corpus/mobile non complete; subset PNG provato ≠ AC completa |
| #56 — Office-to-PDF and printable export pack | DOCX/XLSX/PPTX→PDF each have a fidelity corpus and unsupported-feature list before public claims. | Fedeltà layout DOCX/XLSX/PPTX ricchi e verifica fisica non dimostrate; PDF stampabile subset provato |
| #212 — HEIC AVIF and GIF directional image implementations | Only ACCEPTED directions from feasibility matrix become routes/modes. | Copertura direzionale HEIC/AVIF/GIF, animazioni/metadata e output reali inter-browser/mobile non completata |
| #237 — True PDF redaction with post-export proof | Post-export text/image/object inspection proves supported redacted content absent. | Prova post-export indipendente su ogni rev/metadata/signed/hybrid e corpus reale ancora incompleta |
| #246 — Local image OCR | Italian OCR is an explicit supported language when accepted. | Accettazione OCR locale end-to-end con memoria e risultati sui device fisici, confini/lingua ancora da provare |
| #328 — P0 Account Turnstile login reale | AC-328.1: Registrazione/login con challenge funzionante. | Turnstile/Siteverify reale + registrazione/login/logout 2 sessioni staging non provati |
| #329 — P0 Contrasto accesso e errori WCAG | AC-329.1: Etichette/errori account superano contrasto AA. | Etichette/errori AA anche con zoom e screen reader reali, non basta CSS/desktop |
| #336 — Picker iPhone Android e touch equivalente | AC-336.1: Photos/Files raggiungono tool e risultato. | File e Photos picker + sharing/output su iOS Safari e Android Chrome fisici |
| #349 — File server opt-in TTL delete prova | AC-349.1: Se approvato upload esplicito ha retention/cancellazione verificabile. | Decisione owner upload opt-in e staging reale TTL/delete/isolation/retry senza leak fra utenti |
| #350 — P0 Accessibilità AA di base e advanced | AC-350.1: Input/result/touch/keyboard/screenreader passano floor WCAG 2.2 AA. | WCAG 2.2 AA completo: axe, tastiera manuale e screen reader fisici su base e advanced |
| #352 — Selezione owner direzione visuale | AC-352.1: Owner approva o chiede revisione fra prototipi equivalenti. | Owner deve scegliere/approvare fra 3 prototipi; #351 studio completato NON equivale a scelta |
| #363 — Budget memoria mobile editor reali | AC-363.1: Misurare device memoria/frame/input S M L per editor futuri. | Tracce memoria/frame/OOM/cancel su dispositivi fisici iOS/Android con fixture S/M/L |
| #366 — Licenze e provenance donor pinning | AC-366.1: Matrice licenze dirette transitive codec asset e versioni dei candidati. | Fonti primarie e diritti/licenze dirette/transitive/asset dei donor non verificati per tutti i candidati |
| #367 — Codec immagini local vs donor | AC-367.1: Confronto jSquash installed native per JPEG WebP PNG AVIF SVG. | Parità jSquash/codec installed sul corpus JPEG/WebP/PNG/AVIF/SVG e benchmark memoria device |
| #368 — Office rich DOCX XLSX PPTX donor spike | AC-368.1: Prova Libre Convert/ZetaOffice e alternative su documenti realistici. | Benchmark di fedeltà rich Office, licenze e matrice feature/conversioni indipendenti |
| #369 — Motore PDF editor proprietary-safe confronto | AC-369.1: Confronta existing PDF libs, MuPDF alternative e licenze. | Confronto MuPDF/PDF libs con pin, licenza AGPL/commerciale e benchmark/browser/mobile indipendente |
| #370 — Spreadsheet CSV Excel donor fidelity | AC-370.1: Benchmark installed/donor per sheets, formulas, data types. | Roundtrip XLSX formule/date/precision/merge/stili e perf confronto donor/device da attestare |
| #371 — OCR multilingual donor and quality study | AC-371.1: Misura OCR IT EN con motore esistente e alternative. | Corpus OCR annotato IT+EN confrontabile fra motori, memoria e licenze/device non ancora tutti dimostrati |
| #378 — True redaction security independent gate | AC-378.1: Rimozione irreversibile verificata su sottinsieme esplicito. | Forensics esterno Poppler/PDFium su PDF firmati/hybrid/orfani/metadata e rimozione irreversibile |
| #394 — Metadata stripping with after-export forensic inspection | AC-394.1: Scrubs supported image/document metadata and reports before-after. | Corpus metadata avversario Exif/OOXML/PDF/SVG con before-after e nested/hidden indipendenti |
| #396 — Two Italian tax journeys privati PIVA | AC-396.1: Separate tax routes for worker/employee and partita IVA with year and assumptions. | Due route fiscali distinte lavoratore/PIVA e anno/fonte ufficiale vigente, casi reali/assunzioni |
| #397 — Official annual tax source inventory | AC-397.1: Maps official AdE INPS ISTAT rules to source URL snapshot hash and effective range. | Registro annuale AdE/INPS/ISTAT completo con URL, istantanee hash e intervalli efficacia attuali |
| #404 — Change scoped CI and cumulative release validation | AC-404.1: Affected engine and integration tests run each batch, cumulated release gates before publish. | Gate pre-publish obbligatorio stesso SHA e review fisica/security reali; workflow manuale non basta |
| #406 — Independent PDF redaction attack corpus | AC-406.1: Adversarial signed/hybrid/incremental metadata PDFs produce safe refusal or proven post-export erasure. | Corpus PDF redazione firmati/hybrid/incremental/metadata con oracle terzo e prove diffusal |
| #407 — Hostile parsers and archive resource safety | AC-407.1: File parsers refuse dangerous zip SVG XML PDF object graphs before materializing. | Preflight parser XML/SVG/ZIP/PDF su grafi ostili, limiti risorse e consumer output/reject completi |

## Sospesi da dipendenze del DAG (85)

| Ticket | Prima AC originale non spuntata (se presente) | Precondizione/prova mancante |
|---|---|---|
| #8 — Codice Fiscale generate/decode | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Dipendenze originali non complete: #121, #122; AC di base da provare dopo lo sblocco |
| #11 — Upgrade IVA + percentage calculator | All percentage modes have distinct labels, examples, formulas and reversible inputs. | Dipendenze originali non complete: #126; AC di base da provare dopo lo sblocco |
| #12 — IRPEF annual calculator | Tax year is explicit and only supported versions are selectable. | Dipendenze originali non complete: #127, #128; AC di base da provare dopo lo sblocco |
| #13 — Stipendio netto annual calculator | Inputs state year, RAL, payment months and supported employment/contribution assumptions. | Dipendenze originali non complete: #130; AC di base da provare dopo lo sblocco |
| #14 — Regime forfettario annual calculator | Activity/coefficient data is versioned and source-linked. | Dipendenze originali non complete: #133; AC di base da provare dopo lo sblocco |
| #15 — TFR calculator | Accrued gross TFR and revaluation are separate result lines. | Dipendenze originali non complete: #134, #135; AC di base da provare dopo lo sblocco |
| #18 — Close CalcolaTutto 13/13 parity | Report contains exactly 13 named source jobs with route/status/evidence mapping. | Dipendenze originali non complete: #8, #11, #12, #13, #14, #15; AC di base da provare dopo lo sblocco |
| #24 — Office/Markdown productivity family | Detailed DOCX/Markdown/PDF conversion logic is consumed from tickets 55/56 rather than reimplemented here. (DOCX/Markdown is complete via 55; ticket 56 is still blocked.) | Dipendenze originali non complete: #56; AC di base da provare dopo lo sblocco |
| #28 — Image format + target-compression family | HEIC and each accepted output format inherit real-device/browser fixture evidence from the detailed codec tickets. | Dipendenze originali non complete: #47, #49; AC di base da provare dopo lo sblocco |
| #31 — OCR and document-scan family | Italian OCR path works locally with explicit language/quality state. | Dipendenze originali non complete: #246, #247; AC di base da provare dopo lo sblocco |
| #32 — PDF edit/security family | Page thumbnails support selecting placement/range for page numbers/watermark/signature/redaction. | Dipendenze originali non complete: #237; AC di base da provare dopo lo sblocco |
| #35 — Audio capture/playback utilities | Mic/recorder permission and denial states are accessible and recoverable. | Dipendenze originali non complete: #229; AC di base da provare dopo lo sblocco |
| #40 — Italy utilities beyond CalcolaTutto | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Dipendenze originali non complete: #152; AC di base da provare dopo lo sblocco |
| #46 — Full expansion certification + release integration | Original catalog has 200/200 Result v2 coverage proof. | Dipendenze originali non complete: #18, #158, #279, #280, #281; AC di base da provare dopo lo sblocco |
| #49 — Image conversion matrix + HEIC/AVIF/GIF | HEIC from real iPhone samples is covered on physical iOS/Android/desktop where the promoted path claims support. | Dipendenze originali non complete: #212; AC di base da provare dopo lo sblocco |
| #58 — PDF↔image directional conversion pack | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Dipendenze originali non complete: #235; AC di base da provare dopo lo sblocco |
| #62 — Upgrade existing business/date functionality | Every existing business/date route gets a concrete mode/assumption/output audit. | Dipendenze originali non complete: #126, #127, #128, #130, #133, #134, #135; AC di base da provare dopo lo sblocco |
| #121 — Codice Fiscale formal validate and generate engine | Birth municipality/foreign state resolves through versioned source data. | Dipendenze originali non complete: #115; AC di base da provare dopo lo sblocco |
| #122 — Codice Fiscale decode and omocodia ambiguity | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Dipendenze originali non complete: #121; AC di base da provare dopo lo sblocco |
| #126 — IVA add and scorporo with versioned presets | Preset rates link to version/year source metadata. | Dipendenze originali non complete: #117; AC di base da provare dopo lo sblocco |
| #127 — IRPEF national annual core | Each bracket contribution is visible and sums to gross tax. | Dipendenze originali non complete: #117; AC di base da provare dopo lo sblocco |
| #128 — IRPEF supported deductions and addizionali tranche | Coverage matrix states supported deduction/locality/year combinations. | Dipendenze originali non complete: #127; AC di base da provare dopo lo sblocco |
| #130 — Stipendio netto annual v1 | Annual components reconcile to displayed net. | Dipendenze originali non complete: #128; AC di base da provare dopo lo sblocco |
| #133 — Regime forfettario annual v1 | User must declare 5% eligibility; tool never decides legal eligibility silently. | Dipendenze originali non complete: #117; AC di base da provare dopo lo sblocco |
| #134 — TFR accrual and ISTAT-backed revaluation | Accrual and revaluation are separate visible components. | Dipendenze originali non complete: #117; AC di base da provare dopo lo sblocco |
| #135 — TFR indicative taxation layer | Tax estimate is separable from gross TFR calculation. | Dipendenze originali non complete: #127, #134; AC di base da provare dopo lo sblocco |
| #152 — Italian invoice stamp-duty reference helper | Rule version/source and assumptions are visible. | Dipendenze originali non complete: #117; AC di base da provare dopo lo sblocco |
| #158 — Italy source freshness and annual rollover gate | Every annual/time-varying Italy dataset has owner, latest supported version and checked date. | Dipendenze originali non complete: #115, #117; AC di base da provare dopo lo sblocco |
| #235 — Advanced Images to PDF composition | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Dipendenze originali non complete: #212; AC di base da provare dopo lo sblocco |
| #247 — Scanned PDF OCR and searchable text layer | Output contains selectable/searchable text on OCRed pages. | Dipendenze originali non complete: #246; AC di base da provare dopo lo sblocco |
| #279 — Image-resize Gold promotion gate | All required receipts reference compatible/current source fingerprint. | Dipendenze originali non complete: #277, #278; AC di base da provare dopo lo sblocco |
| #332 — Sync preferiti con rimozioni e conflitti | AC-332.1: Due dispositivi convergono su aggiunta/rimozione. | Dipendenze originali non complete: #328; AC di base da provare dopo lo sblocco |
| #353 — IA e design system dopo scelta | AC-353.1: Tokens/componenti/IA approvati sostituiscono baseline. | Dipendenze originali non complete: #352; AC di base da provare dopo lo sblocco |
| #354 — Redesign home file-first search-first | AC-354.1: Home porta a file o task con gerarchia riconoscibile. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #355 — Redesign catalogo ricerca categorie | AC-355.1: Tutti i manifest ricercabili con URL filtri stabili. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #356 — Redesign wrapper e input famiglia | AC-356.1: Input di PDF/image/data/math usano shared contract e stati. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #357 — Redesign risultati e next-action | AC-357.1: Risultati preview/Scarica/segue leggibili anche mobile. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #358 — Redesign area settings onboarding | AC-358.1: Local/account e suggerimenti/privacy distinguibili. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #359 — Redesign risorse privacy ed errori | AC-359.1: Stati vuoto/loading/cancel/error/success spiegano verità del runtime. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #360 — Motion utile opt-out reduced-motion | AC-360.1: Motion orienta progress/cambio senza nascondere contenuto. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #361 — Sound design opt-in OFF default | AC-361.1: Sound attivabile e feedback visuale equivalente. | Dipendenze originali non complete: #352, #353; AC di base da provare dopo lo sblocco |
| #362 — Device fisici mobile file-result-share | AC-362.1: iPhone+Android reali eseguono job completo con byte apribili. | Dipendenze originali non complete: #336; AC di base da provare dopo lo sblocco |
| #364 — Canary e rollback design per tranche | AC-364.1: Refactor visual conserva SEO/route e output. | Dipendenze originali non complete: #353, #354, #355, #356, #357, #358, #359; AC di base da provare dopo lo sblocco |
| #372 — Editor PDF page workspace | AC-372.1: Manipola pagine e thumbnails in vista unica mobile. | Dipendenze originali non complete: #369; AC di base da provare dopo lo sblocco |
| #373 — PDF editing testo originale font e layout | AC-373.1: Modifica contenuti supportati e preserva semantica testo/font. | Dipendenze originali non complete: #369, #372; AC di base da provare dopo lo sblocco |
| #374 — PDF annotazioni highlighter comments | AC-374.1: Annotazioni vettoriali correttamente posizionate e persistenti. | Dipendenze originali non complete: #372; AC di base da provare dopo lo sblocco |
| #375 — PDF immagini oggetti posizionati | AC-375.1: Immagini/oggetti aggiunti e trasformati con scala corretta. | Dipendenze originali non complete: #372; AC di base da provare dopo lo sblocco |
| #376 — PDF form input edit e flatten | AC-376.1: Compilazione campi e flatten esplicito con esito verificato. | Dipendenze originali non complete: #372; AC di base da provare dopo lo sblocco |
| #377 — PDF OCR searchable scansioni | AC-377.1: PDF scansione produce testo ricercabile su pagina corretta. | Dipendenze originali non complete: #247, #371; AC di base da provare dopo lo sblocco |
| #379 — PDF progetto history e undo | AC-379.1: Progetti edit PDF opt-in con undo redo e restore. | Dipendenze originali non complete: #372; AC di base da provare dopo lo sblocco |
| #380 — PDF editor export source-bound | AC-380.1: PDF export valido per altri viewer e semanticamente corretto. | Dipendenze originali non complete: #373, #374, #375, #376, #379; AC di base da provare dopo lo sblocco |
| #381 — Image editor canvas e layers | AC-381.1: Composizione locale multi-layer con opacità ordine visibilità. | Dipendenze originali non complete: #363, #367; AC di base da provare dopo lo sblocco |
| #382 — Image editor masks selections crop | AC-382.1: Maschere selezioni crop con alpha preserved. | Dipendenze originali non complete: #381; AC di base da provare dopo lo sblocco |
| #383 — Image editor color resize adjustment | AC-383.1: Curves/levels/resize e color profiles dichiarati. | Dipendenze originali non complete: #381; AC di base da provare dopo lo sblocco |
| #384 — Image editor text shapes composite | AC-384.1: Testo shapes e compositing layer con export fedele. | Dipendenze originali non complete: #381, #382; AC di base da provare dopo lo sblocco |
| #385 — Image editor undo project save | AC-385.1: History undo redo, project opt-in e flattened export. | Dipendenze originali non complete: #381, #382, #383, #384; AC di base da provare dopo lo sblocco |
| #386 — Image editor mobile memory QA | AC-386.1: Touch pan zoom e export iPhone Android con budget misurato. | Dipendenze originali non complete: #363, #385; AC di base da provare dopo lo sblocco |
| #387 — CSV XLSX import export fidelity | AC-387.1: Date locale number precision leading zeros preserved. | Dipendenze originali non complete: #370; AC di base da provare dopo lo sblocco |
| #388 — Table cleaning sort filter transforms | AC-388.1: Preview diff su clean/sort/filter con annulla. | Dipendenze originali non complete: #387; AC di base da provare dopo lo sblocco |
| #389 — Excel workbook editing cells formulas | AC-389.1: Edits supported cells and formula graph with accurate export. | Dipendenze originali non complete: #370, #387; AC di base da provare dopo lo sblocco |
| #390 — Data compare join split merge | AC-390.1: Diff/join per key con gestione duplicati e null esplicita. | Dipendenze originali non complete: #387; AC di base da provare dopo lo sblocco |
| #391 — Data automation pipeline local typed | AC-391.1: Chain filters join export replicabile e spiegata. | Dipendenze originali non complete: #388, #390; AC di base da provare dopo lo sblocco |
| #392 — Rich Office fidelity corpus and go-no-go | AC-392.1: Rich DOCX XLSX PPTX converter accepted only for provably faithful subset. | Dipendenze originali non complete: #368; AC di base da provare dopo lo sblocco |
| #393 — Image codecs multi-frame orientation metadata | AC-393.1: Gif multi-frame HEIC AVIF metadata orientation each tracked by direction. | Dipendenze originali non complete: #212, #367; AC di base da provare dopo lo sblocco |
| #395 — OCR language confidence and user correction | AC-395.1: Italian/English OCR exposes confidence and editable text. | Dipendenze originali non complete: #246, #371; AC di base da provare dopo lo sblocco |
| #398 — Versioned IVA and IRPEF examples | AC-398.1: Fiscal values use official year version and show formula/breakdown. | Dipendenze originali non complete: #117, #397; AC di base da provare dopo lo sblocco |
| #399 — Net salary and employee contribution model | AC-399.1: Yearly salary net produces assumptions on contributions/deductions. | Dipendenze originali non complete: #128, #398; AC di base da provare dopo lo sblocco |
| #400 — Forfettario partita IVA calculations | AC-400.1: Coefficient rates INPS and taxes year pinned for supported business cases. | Dipendenze originali non complete: #117, #397; AC di base da provare dopo lo sblocco |
| #401 — TFR accrual revaluation and indicative scope | AC-401.1: Accrual uses verified annual/ISTAT indexes and period breakdown. | Dipendenze originali non complete: #134, #398; AC di base da provare dopo lo sblocco |
| #402 — Fiscal rollover source expiry and blocking | AC-402.1: Outdated annual values are blocked and dated version presented. | Dipendenze originali non complete: #115, #117, #397; AC di base da provare dopo lo sblocco |
| #403 — Physical microphone and audio media continuation | AC-403.1: Record and reopen actual audio capture on physical platform. | Dipendenze originali non complete: #229; AC di base da provare dopo lo sblocco |
| #405 — Release scope gates and rollback drill | AC-405.1: Promotion requires current source receipt for chosen scope and proven rollback. | Dipendenze originali non complete: #404; AC di base da provare dopo lo sblocco |
| #409 — Tax-year review ownership and retrospective versions | AC-409.1: Annual source owner and change log manage effective/retroactive amendments. | Dipendenze originali non complete: #397, #402; AC di base da provare dopo lo sblocco |
| #411 — Audio video large file mobile progress and cancel | AC-411.1: Media tools state progress and real mobile resource limits. | Dipendenze originali non complete: #363; AC di base da provare dopo lo sblocco |
| #412 — Editor project schema and forward-safe migrations | AC-412.1: PDF/image projects versioned and restorably migrated with opt-in save. | Dipendenze originali non complete: #379, #385; AC di base da provare dopo lo sblocco |
| #414 — Commercial engine vendor proposal and license gate | AC-414.1: Vendor API fees lock-in maintenance privacy alternatives and owner approval documented. | Dipendenze originali non complete: #366; AC di base da provare dopo lo sblocco |
| #416 — Safe ZIP GZIP archive compression and extraction | AC-416.1: ZIP/GZIP known supported archive handling with real compression and per-entry outcome. | Dipendenze originali non complete: #407; AC di base da provare dopo lo sblocco |
| #417 — PDF password encrypt decrypt legitimate unlock engine study | AC-417.1: Compare approved encryption/decryption engine for supplied valid password only. | Dipendenze originali non complete: #369; AC di base da provare dopo lo sblocco |
| #418 — PDF repair tolerant recovery bounded and independently proved | AC-418.1: Safe salvage explicitly possible cases with reconstructed bytes and losses disclosed. | Dipendenze originali non complete: #369; AC di base da provare dopo lo sblocco |
| #419 — PDF/A compliant export independent validator decision | AC-419.1: Evaluate PDF/A profile and candidate exporter with full validator before offering route. | Dipendenze originali non complete: #369; AC di base da provare dopo lo sblocco |
| #420 — PDF to editable DOCX semantic reconstruction feasibility | AC-420.1: Compare legitimate reconstruction paths text/tables/layout with disclosure of editable subset. | Dipendenze originali non complete: #369, #368; AC di base da provare dopo lo sblocco |
| #421 — EML MSG offline viewer and safe attachment handling | AC-421.1: Locally parse supported email formats and safely export message/attachments. | Dipendenze originali non complete: #407; AC di base da provare dopo lo sblocco |
| #422 — EPUB offline reader and text export safety | AC-422.1: Read EPUB chapters/text offline with encoding and navigation. | Dipendenze originali non complete: #407; AC di base da provare dopo lo sblocco |
| #423 — P7M legally scoped verification and extraction feasibility | AC-423.1: Evaluate CMS/P7M valid signed payload and verify vs merely extract contents. | Dipendenze originali non complete: #366, #407; AC di base da provare dopo lo sblocco |
| #424 — Audio transcode target bitrate and compression feasibility | AC-424.1: Compare browser native/installed/donor codecs and device acceptable size/quality. | Dipendenze originali non complete: #363; AC di base da provare dopo lo sblocco |

## Dispositivi esterni (5)

| Ticket | Prima AC originale non spuntata (se presente) | Precondizione/prova mancante |
|---|---|---|
| #229 — Microphone test and local recorder | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Microfono reale/browser OS: permessi, cattura audio e file riapribile |
| #277 — Physical Android Chrome image-resize acceptance | Receipt identifies real device/browser/build fingerprint. | Android Chrome fisico: image resize/output reale |
| #278 — Physical iOS Safari image-resize acceptance | Receipt identifies physical iOS/Safari/build fingerprint. | iOS Safari fisico: image resize/output reale |
| #280 — Physical Android heavy-tool web acceptance lane | Lane records device/browser/build and exact route/input class. | Android dispositivo fisico: strumenti pesanti |
| #281 — Physical iOS Safari heavy-tool web acceptance lane | Lane uses physical iOS Safari and records current build fingerprint. | iPhone/iPad Safari fisico: strumenti pesanti |

## Fonti ufficiali esterne (2)

| Ticket | Prima AC originale non spuntata (se presente) | Precondizione/prova mancante |
|---|---|---|
| #115 — Italian administrative geography source pack | Nessuna AC originale non spuntata: blocco strutturale/prova esterna | Snapshot e licenze fonte ufficiale geografia amministrativa italiana complete e verificabili |
| #117 — Italian fiscal annual source snapshots | Each annual rule pack has identifiable taxYear/effective dates and source links. | Snapshot fonti primarie annuali AdE/INPS/ISTAT e data validità ufficiale corrente |

## Avvertenza di rilascio
La classificazione automatica non equivale ad accettazione delle AC: il campo di stato si ricava solo dai record canonici. Non viene concesso alcun permesso di Cloudflare production deploy, revisione Gold, acquisto/licenza o uso dati reali. I risultati dei successivi branch/CI prevalgono su questa fotografia solo dopo aggiornamento del dashboard in main.
