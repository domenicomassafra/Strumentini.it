# Tool expansion + Result System v2

Status: **future implementation plan**  
Research snapshot: **2026-10-05**  
Scope: improve every existing tool and create a grounded expansion backlog without weakening the current Gold/certification contract.

Detailed format/operation authority: `docs/11-format-operation-matrix.md`.

## 1. Why this plan exists

StrumentiUtili.it already has 200 implemented tools and a strong local-first quality system. The next phase is not a vanity catalog-count exercise. It has two user-facing goals:

1. make the result of **every current tool** feel like an answer to the user's job rather than a dump of fields/JSON; and
2. fill high-value gaps exposed by Italian and international utility sites, especially everyday calculations, Italy-specific utilities, Office/spreadsheet interchange, document workflows, privacy/security, and local audio/video.

The current release frontier stays authoritative. This document is a future expansion plan, not permission to fabricate receipts, weaken Gold, or bypass the two existing non-Gold boundaries.

## 2. Research inputs

Research was checked on 2026-10-05 against these public surfaces:

- CalcolaTutto — https://calcolatutto.it/
- Toolopoli — https://toolopoli.com/
- TinyWow tools — https://tinywow.com/tools
- iLovePDF features/help — https://www.ilovepdf.com/features and https://www.ilovepdf.com/help/documentation
- iLoveIMG features — https://www.iloveimg.com/features
- Calculator.net — https://www.calculator.net/
- Omni Calculator IT — https://www.omnicalculator.com/it
- CyberChef — https://gchq.github.io/CyberChef/
- INPS 2026 contribution notices and simulator — https://www.inps.it/
- EU VIES VAT validation — https://ec.europa.eu/taxation_customs/vies/

Observed competitor patterns that matter to this product:

- CalcolaTutto currently exposes 13 public tools, with an explicit Italy-first editorial/fiscal-maintenance model.
- Toolopoli exposes a very broad browser-local catalog and demonstrates demand for job-specific routes such as "CSV in Excel senza perdere gli zeri", "dividi PDF per peso", "cuci screenshot", "ripara JSON", and "estrai il codice dall'AI".
- iLovePDF/iLoveIMG prove that a small set of document/image jobs becomes much more useful when the workspace has thumbnails, direct manipulation, progress, and a clear downloadable result.
- TinyWow exposes the conversion matrix users expect around PDF, Office, image, audio, and video formats.
- CyberChef demonstrates that sophisticated developer/security operations can remain browser-local, while keeping explicit boundaries around the few networked operations.
- Calculator.net/Omni confirm durable demand for finance, percentage, conversion, date, math, and everyday-life calculators.

## 3. Product requirements

### User stories

- **US-EXP-01 — Answer-first results.** As a user of any existing tool, I get a result whose primary answer, meaning, next action, and provenance are immediately understandable.
- **US-EXP-02 — Full CalcolaTutto parity.** As an Italian user, I can perform every public job currently offered by CalcolaTutto, either through an existing StrumentiUtili tool upgraded to parity or a new tool.
- **US-EXP-03 — Everyday calculations and conversions.** As a non-technical user, I can solve common unit, percentage, finance, date, math, and household calculations without knowing a formula.
- **US-EXP-04 — Practical files and documents.** As a user handling Office, PDF, images, archives, and tables, I can finish common conversion, cleanup, privacy, extraction, and handoff jobs locally when technically feasible.
- **US-EXP-05 — Developer and security utilities.** As a technical user, I can repair, validate, convert, inspect, and safely transform common web/data formats with precise errors and copy/download outputs.
- **US-EXP-06 — Local media tools.** As a user with audio/video files, I can inspect and perform common edits/conversions without mandatory upload, subject to explicit browser capability and memory limits.
- **US-EXP-07 — Italy utilities.** As an Italian user, I can handle common Italian identifiers, documents, invoice formats, holidays, and fiscal calculations with explicit source/year/provenance boundaries.
- **US-EXP-08 — AI-era local helpers.** As a user moving content between AI chats and real files, I can repair/extract/anonymize/reflow outputs without sending private content to another service.
- **US-EXP-09 — Privacy remains legible.** As a user, I always know whether an operation is local, reference-network, or genuinely remote before data leaves the device.
- **US-EXP-10 — Search by job, not engine.** As a visitor, I can discover a specific job route even when several routes reuse one underlying engine.

### Acceptance criteria

- **AC-01.1** Every one of the current 200 catalog entries is covered by a Result System v2 migration wave or an explicit no-change proof.
- **AC-01.2** Result surfaces expose the appropriate combination of primary answer, human explanation, structured detail, copy/download/share, before/after, warnings, and provenance rather than defaulting to raw object/JSON presentation.
- **AC-01.3** Empty, running, success, warning, partial, and error states are coherent on desktop and 390px mobile, keyboard accessible, and announced correctly.
- **AC-02.1** All 13 current CalcolaTutto public tools are mapped to `ADD`, `UPGRADE`, or `COVERED`, with no silent omissions.
- **AC-02.2** Fiscal/regulatory calculators show reference year, source authority, assumptions, exclusions, last verified date, and a reproducible calculation breakdown.
- **AC-03.1** The conversion program covers the common physical/digital dimensions surfaced by the research, while sharing one conversion engine where dimensions permit it.
- **AC-03.2** Finance/math tools explain formulas and intermediate values and never present a context-dependent financial estimate as a guaranteed amount.
- **AC-04.1** New file workflows use a shared dropzone/file-list/progress/result-download pattern with file name, type, size, and before/after information when applicable.
- **AC-04.2** Destructive/privacy operations state what was actually removed or rewritten and can be verified from the output bytes where feasible.
- **AC-05.1** Validators identify the exact failure and location; formatters/converters expose copy and download; large output has a bounded preview plus file download.
- **AC-06.1** Heavy media work is lazy-loaded, cancellable, bounded by explicit file/memory guidance, and tested on mobile before Gold.
- **AC-07.1** Italy datasets and rules are versioned; time-varying rules never live as unexplained magic constants.
- **AC-07.2** A remote authoritative check such as VIES is opt-in and visibly distinct from a local formal checksum.
- **AC-08.1** AI-era helpers are deterministic transformations; they do not silently call a generic LLM or invent missing content.
- **AC-09.1** New tools enter the same oracle/fixture/certification discipline as the existing catalog.
- **AC-10.1** Distinct high-intent routes may reuse one engine, but aliases/routes must not become duplicate pages with no unique job or output.

### Decisions

- **DEC-EXP-01 — One engine, many honest jobs.** Reuse engines aggressively, but permit job-specific routes when input language, default behavior, result presentation, or search intent is materially different.
- **DEC-EXP-02 — Local-first by default.** Personal files and identifiers stay local unless a tool's declared job fundamentally requires a remote authority. Any such network use is explicit before execution.
- **DEC-EXP-03 — Result System v2 is answer-first.** Generic key/value and raw JSON remain debugging/fallback representations, not the primary presentation for normal users.
- **DEC-EXP-04 — Fiscal rules are versioned data.** Annual brackets, allowances, rates, thresholds, and coefficients have source metadata and validity windows and are independently testable.
- **DEC-EXP-05 — Heavy WASM is capability-gated.** Audio/video/OCR/Office dependencies are lazy and justified by a measured browser spike before production promotion.
- **DEC-EXP-06 — Gold is earned per new tranche.** Every new tool has oracle/fixture coverage, browser acceptance, privacy assertions, and maintenance class in the same tranche.
- **DEC-EXP-07 — No catalog-count target.** Prioritize a missing job and a superior result, not a target number of routes.
- **DEC-EXP-08 — Existing release blockers remain real.** Future expansion does not reclassify `image-resize` or `ris-bibtex-converter` and does not rewrite existing receipts.

### Constraints

- **C-EXP-01** Preserve existing `npm test`, Astro check, build, catalog, certification, and release gates.
- **C-EXP-02** Never synthesize external evidence or physical-device receipts.
- **C-EXP-03** Italian-first copy and examples; locale-aware numbers, currency, dates, decimal separators, and identifiers.
- **C-EXP-04** 390px mobile without horizontal overflow; touch targets and keyboard access remain first-class.
- **C-EXP-05** Local files/data are not uploaded merely because a library or competitor does so.
- **C-EXP-06** Fiscal/legal-adjacent results are labelled as calculations/estimates with scope limits, not professional advice or official certification.
- **C-EXP-07** No generic AI assistant dependency for deterministic tools.
- **C-EXP-08** Heavy dependencies must justify bundle/runtime cost and stay out of unrelated routes.
- **C-EXP-09** Result actions and controls use shared primitives; no new parallel design system.

## 4. CalcolaTutto parity matrix — all 13 current tools

| CalcolaTutto job | StrumentiUtili status | Future action |
|---|---|---|
| Codice Fiscale | missing | **ADD** generation + decode + checksum, municipality/Belfiore dataset, omocodia limits made explicit |
| Partita IVA | missing | **ADD** local Italian checksum + separate opt-in VIES authoritative lookup |
| Stipendio Netto | missing | **ADD** annual versioned calculator with inputs/assumptions and monthly/annual breakdown |
| Calcolo IVA | partial overlap | **UPGRADE** percentage/IVA tool with add/scorporo presets, clear taxable/VAT/gross result |
| Regime Forfettario | missing | **ADD** versioned coefficient, INPS-management, substitute-tax breakdown |
| Calcolo IRPEF | missing | **ADD** year-scoped brackets/deductions/additional-tax breakdown |
| Calcolo TFR | missing | **ADD** accrual, revaluation, indicative net/tax explanation with year/source data |
| Calcolo Mutuo | missing | **ADD** French amortization, monthly payment, total interest, schedule/export |
| Verifica IBAN | missing | **ADD** MOD-97 validation + Italian coordinate parsing; never imply account existence |
| Base64 | exists | **UPGRADE** clearer text/file modes, encoding labels, copy/download, invalid-input explanation |
| Info Connessione | partial overlap | **ADD/EXTEND** device/browser/viewport locally; public-IP lookup only as explicit network mode |
| Convertitore Colori | exists | **UPGRADE** live preview, bidirectional synchronized values, copy buttons, alpha/CMYK if proven |
| Calcolo Percentuale | partial overlap | **UPGRADE** separate human modes: X% of Y, X is what % of Y, increase/decrease, variation, discount reverse |

## 5. Expansion inventory captured from the benchmark

This is an inventory, not a promise to clone competitor catalogs. Items already covered by an existing StrumentiUtili job are upgrades/aliases, not duplicate engines.

### 5.1 Conversions and everyday math

Build one dimension-aware conversion system with job views for: length, mass/weight, temperature, area/surface, volume, speed, time, angle, energy, pressure, power, force, torque, frequency, density, flow, illuminance, digital storage (decimal/binary), battery mAh↔Wh, auto consumption, kW↔CV/HP, paper sizes, Roman numerals, number-to-words, shoe/clothing size references, model scale, TV inches/dimensions, and download-time estimation.

Additional deterministic calculators captured by the benchmark: scientific expression calculator, simple/compound interest, savings goal, amortization/loan, percentage/discount/cascading discounts, unit price, split bill/tip, annual subscription cost, installment split, salary↔hourly-rate conversion, energy cost, car-trip cost, mean/median/mode, standard deviation/variance, quadratic equation, fractions, MCD/mcm, prime/factorization, combinations/permutations, areas/perimeters/volumes, Pythagorean theorem, speed-time-distance, grade/weighted average, and completion percentage.

### 5.2 Security, identifiers, and privacy

Password generator, Italian passphrase generator, PIN generator, password-strength estimator, barcode generator (EAN-13/Code-128), IBAN validator, Partita IVA validator/VIES, Codice Fiscale generate/decode, file/type inspection improvements, ZIP password/encryption feasibility, screenshot redaction, PDF redaction, text/table anonymize-and-restore workflows, and metadata/privacy reports.

Cryptographic developer operations from CyberChef are **not** copied wholesale. Future scope is limited to understandable jobs with standard WebCrypto/library support and explicit misuse boundaries; existing hash/HMAC/checksum tools remain the base.

### 5.3 Spreadsheet, Office, and structured data

CSV→XLSX with text-preservation controls; XLSX→CSV with sheet selection; XML↔JSON; XML↔CSV; XML↔XLSX where structure is representable; JSON diff; JSON repair with every correction disclosed; XML formatter/validator; CSV→SQL; JSON→TypeScript / JSON Schema; split huge CSV by rows/size while repeating headers; Markdown tables→XLSX; Markdown→DOCX; table compare; Office viewer (DOCX/ODT, PPTX/ODP), Office metadata cleanup, Office image compression, Office password-removal only when the user supplies the password and the format/library supports it; VCF viewer→CSV; EML/MSG viewer; EPUB reader/export; RAR/7z viewer/extractor subject to dependency and browser-cost proof.

### 5.4 PDF/document jobs

Add: sign PDF, page numbers, watermark, true redaction, protect/encrypt, crop, PDF/A conversion, repair/recovery, searchable scanned PDF via OCR, search text across many PDFs, split by maximum output size, n-up pages per sheet, booklet imposition, fill/write on PDF, PDF→Markdown, PDF→Word, PDF→Excel/table extraction, Office→PDF feasibility, front/back interleave, document-level preview and page thumbnails.

Keep/improve existing: merge, split, page extract/delete/reorder/rotate, compress, flatten, forms inspection, metadata inspect/remove, image extraction, link extraction, page size/count, password check/remove, text extraction, PDF→images, images→PDF, compare.

### 5.5 Images and screenshots

Add/upgrade: HEIC→JPG/PNG, target-file-size compression, rotate/flip, watermark/text overlay, combine/grid images, round/profile crop, add border/background, screenshot stitching with overlap detection, irreversible screenshot redaction/pixelation, document perspective straighten, OCR, transparent uniform background, common format routes (JPG/PNG/WebP/AVIF/SVG rasterization where safe), image↔Base64, exact social/carousel slicing, grayscale/sepia/brightness/contrast/saturation, color-blindness simulation, meme/simple composition only if it reuses the same editor primitives.

### 5.6 Developer/web/network

Add: JSON repair, structural JSON diff, XML validator/formatter, XML↔JSON, CSV→SQL, JSON→TypeScript/Schema, subnet/CIDR IPv4+IPv6, numeric base converter 2–36, chmod permission helper, X.509/CSR certificate inspector, CSS minifier, sitemap.xml generator, px↔rem/em converter, keyboard event inspector, screen/viewport inspector, Wi-Fi QR preset, and explicit connection-info tool.

Improve existing developer tools with precise error location, formatted/minified modes where relevant, copy/download, input/output byte counts, and safe large-output behavior.

### 5.7 AI-era deterministic helpers

Add: extract named code files from an AI response and bundle ZIP; repair JSON copied from chat while listing every deterministic repair; split long text into numbered reversible chunks at semantic boundaries; compare original vs AI-edited text with numbers/dates called out; reflow text copied from PDF; strip Markdown while exposing removed syntax; anonymize text/table values to stable placeholders and restore them after a response; Markdown→DOCX; Markdown tables→XLSX.

No generic generation/summarization/humanizer feature is implied by this plan.

### 5.8 Italy-specific utilities beyond CalcolaTutto

Captured from the broader Italian benchmark: ponti/ferie optimizer; batch FatturaPA XML→table; read FatturaPA XML and signed envelope where feasible; P7M extraction/inspection; invoice stamp-duty reminder/reference; CAP↔comune lookup; identity-document/passport expiry helper; Italian public-holiday/bridge views; formal Partita IVA; Codice Fiscale; IBAN parsing; vehicle-registration-period estimate only if a reliable bounded source can be maintained.

Each Italy-specific dataset/rule must declare source, version/date, coverage, and what the result does **not** prove.

### 5.9 Audio and voice pack

Captured jobs: convert audio (MP3/M4A/WAV and proven browser formats), trim, merge, speed/volume, silence removal, microphone test, recorder, tone generator, metronome, white/pink/brown noise, browser TTS, voice/audio cleanup if deterministic local DSP is good enough. Heavy codec/DSP work is blocked by a measured runtime/dependency spike.

### 5.10 Video pack

Captured jobs: inspect codec/fps/rotation/bitrate, bitrate↔target-file-size calculator, subtitle readability checker, SRT/VTT→transcript, subtitle offset/rescale and SRT↔VTT, frame extraction, webcam test, compress video, convert common inputs→MP4, extract audio, trim video, video→GIF, audio loudness/LUFS measurement when a proven local implementation exists, and "video per l'AI" contact-sheet/timecode context export. Heavy codec work is blocked by a measured runtime/dependency spike.

### 5.11 Text, language, design, and lightweight utilities

High-value additions not already covered: Italian Gulpease readability with sentence-level hints; syllabification only with a defensible Italian rule set; phone/link/hashtag/mention extractors; mojibake repair; PDF-copy reflow; line-length transforms; CSS gradient/box-shadow/border-radius generators; color harmonies and color-blindness simulation; named CSS colors; barcode; random-number/list picker/team splitter/coupon-code generator where they remain deterministic utilities.

Games/entertainment clones are not scheduled by this plan because they do not serve the current product thesis. They remain research-only unless the product scope is explicitly changed later.

## 6. Result System v2 contract

The new result system is semantic, not one universal card.

| Job class | Required primary presentation |
|---|---|
| Calculator | primary answer + unit/currency + one-sentence interpretation + breakdown + formula/assumptions + copy/export where useful |
| Validator | valid/problem state + exact failing rule/position + what was checked + what validity does not prove |
| Text/code transform | editable/selectable output + copy + download + change/byte/line counts + syntax/error location where relevant |
| File transform | file card + type/name/size + before/after metrics + progress + direct download + batch ZIP when applicable |
| Image | visual preview + dimensions/format/size before→after + relevant controls + download |
| PDF | page thumbnails/preview when page choice matters + operation summary + output size/pages + download |
| Table/CSV | row/column summary + issue counts + real table preview + export + per-row error/warning when needed |
| Batch | completed/failed counts + per-item status + isolated failures + download all successful results |
| Reference/network | source identity + retrieval timestamp + local-vs-network boundary + unavailable/stale state |

Shared actions should cover, where meaningful: Copy, Download, Download all/ZIP, Swap/reuse result as input, Reset, Retry, and compatible handoff. The primary action must not be inferred from button position.

## 7. Migration rule for the current 200 tools

The migration must be mechanically measurable:

1. inventory all 200 routes by engine/result class;
2. add Result v2 primitives beside the current primitives (expand);
3. migrate by renderer family while CI remains green;
4. bespoke tools receive explicit migration tickets where the shared family cannot cover their result semantics;
5. add a generated contract report proving every catalog entry has a result-class declaration and passes its result-state acceptance checks;
6. only then remove/deprecate the old generic fallbacks (contract).

No tool is considered migrated merely because it renders inside `ToolResultPanel`.

## 8. Priority order

1. Result System v2 expand-contract + 200/200 coverage.
2. CalcolaTutto parity and Italy source/version infrastructure.
3. Universal conversions, passwords/security, XLSX/CSV/XML, JSON repair/diff, HEIC/target compression.
4. PDF signing/redaction/page numbers/watermark/OCR/search and screenshot privacy workflows.
5. Office/Markdown productivity and developer/network packs.
6. Audio/video only after browser-runtime proof.
7. Long-tail deterministic calculator/text/design utilities after the high-intent jobs prove quality and discovery.

## 9. Source-maintenance rule for Italian fiscal tools

Every annually changing calculator must ship its data as an identifiable version, e.g. `taxYear=2026`, and expose source metadata to both tests and UI. At minimum the implementation ticket must identify the authoritative Agenzia delle Entrate / INPS / ISTAT / MEF / EU source it relies on, the date checked, what inputs are intentionally unsupported, and a regression fixture set around every bracket/threshold boundary.

For VIES, a local Partita IVA checksum and a remote EU existence check are two different claims and must remain two different result states.

## 10. Definition of done for the future expansion program

- current 200 tools: 200/200 Result v2 coverage proof;
- all 13 CalcolaTutto jobs: mapped and implemented/upgraded with no missing parity row;
- every newly accepted tool: catalog manifest, route, Italian copy, oracle/fixtures, maintenance class, privacy/network declaration, browser acceptance, mobile result acceptance;
- no regression of current release/certification gates;
- discovery works by concrete job and aliases, without duplicate low-value pages;
- no personal file or identifier silently leaves the device;
- no fiscal result silently uses stale or source-less annual constants.
