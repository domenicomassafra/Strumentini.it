# Strumentini.it future expansion — ticket DAG

Status: **future implementation queue; ticket planning only**
Origin: `docs/10-tool-expansion-result-system-v2.md` + `docs/11-format-operation-matrix.md`
Generated from issue metadata; refresh with `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --write`.
Coverage: **327 tickets, IDs 01–327, continuous, acyclic**

This DAG is the scheduling authority. Parent tickets that depend on targeted children are integration/closure gates; implement the children first. Skill routing lives in `SKILL-ROUTING.md`, and tickets 70–327 also carry ticket-specific `Suggested skills`.

## Current dependency frontier

- **037 — Video inspect/subtitle utilities**
- **047 — JPEG/PNG/WebP/SVG compression engines**
- **053 — Upgrade existing PDF inspect/extract/compare tools**
- **056 — Office-to-PDF and printable export pack**
- **059 — JSON/XML/CSS/HTML/SVG minimizer pack**
- **115 — Italian administrative geography source pack**
- **117 — Italian fiscal annual source snapshots**
- **212 — HEIC AVIF and GIF directional image implementations**
- **218 — Image-aware and scan PDF compression profiles**
- **229 — Microphone test and local recorder**
- **231 — Audio timeline edits and deterministic DSP**
- **234 — Video transform worker core**
- **236 — Advanced PDF to image export**
- **237 — True PDF redaction with post-export proof**
- **241 — PDF signature placement**
- **243 — PDF fill annotate and write overlays**
- **246 — Local image OCR**
- **251 — PDF booklet and front-back interleave**
- **254 — PDF tables to XLSX**
- **277 — Physical Android Chrome image-resize acceptance**
- **278 — Physical iOS Safari image-resize acceptance**
- **280 — Physical Android heavy-tool web acceptance lane**
- **281 — Physical iOS Safari heavy-tool web acceptance lane**

Exactly **23** incomplete tickets currently have every declared numeric blocker completed. This is **not** evidence that the feature is feasible: see `CURRENT-TICKET-DASHBOARD.md` for execution-ready, source/device-gated and capability-refused groups.

## Key decomposition rules

- **01–06:** Result System v2 is split into contracts/primitives/evidence (70–87) and renderer migrations (88–99).
- **07–18:** Italy/CalcolaTutto consumes versioned primary-source packs before fiscal/annual calculators.
- **19–44:** broad families are closure gates over focused calculator, developer, text, design, date, Italy and productivity children.
- **34:** heavy feasibility is split by dependency class (267–275); `REFUSE` is a valid outcome for an unsupported format.
- **47–69:** compression/conversion/upgrade families integrate concrete image/PDF/archive/Office/file-analysis slices.
- **110 + 284–297:** functional completeness of the original 200 tools is measured separately from Result v2 presentation migration.
- **276–279:** RIS/BibTeX oracle was closed; physical Android/iOS image-resize evidence remains outstanding.
- **282–283:** custom-domain migration is reversible ops work; ticket 282 is planning-only and does not authorize DNS mutation.

## Full DAG

| # | Status | Ticket | Blocked by |
|---:|---|---|---|
| 001 | completed | Expand Result System v2 primitives | 070, 071, 072, 073, 074, 075, 076, 077, 078, 079, 080, 081, 082, 083, 084, 085, 086, 087 |
| 002 | completed | Migrate calculator/date/marketing results | 088, 089, 090 |
| 003 | completed | Migrate text/research/developer results | 091, 092, 093 |
| 004 | completed | Migrate table/CSV results | 094, 095 |
| 005 | completed | Migrate file/image/PDF/URL results | 096, 097, 098, 099 |
| 006 | completed | Close Result v2 at 200/200 coverage | 002, 003, 004, 005, 083 |
| 007 | completed | Versioned Italy reference-data framework | — |
| 008 | blocked | Codice Fiscale generate/decode | 121, 122 |
| 009 | completed | IBAN validation and Italian coordinates | 007 |
| 010 | completed | Partita IVA checksum + opt-in VIES | 123, 124 |
| 011 | blocked | Upgrade IVA + percentage calculator | 125, 126 |
| 012 | blocked | IRPEF annual calculator | 127, 128 |
| 013 | blocked | Stipendio netto annual calculator | 130 |
| 014 | blocked | Regime forfettario annual calculator | 133 |
| 015 | blocked | TFR calculator | 134, 135 |
| 016 | completed | Mutuo + amortization calculator | 088 |
| 017 | completed | Connection/device information tool | 081 |
| 018 | blocked | Close CalcolaTutto 13/13 parity | 006, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017 |
| 019 | completed | Universal unit-conversion family | 136, 137, 138, 139, 140 |
| 020 | completed | Everyday math calculator family | 141, 142, 143, 144 |
| 021 | completed | Personal-finance calculator family | 145, 146, 147 |
| 022 | completed | Password/passphrase/security family | 159, 160 |
| 023 | completed | Spreadsheet interchange family | — |
| 024 | blocked (accepted/refused non-rendering Office matrix integrated; PDF-print and embedded-media compression remain unresolved) | Office/Markdown productivity family | 056, 264 |
| 025 | completed | Developer repair/schema family | 164, 165, 166, 167, 168, 170 |
| 026 | completed | Structured-data bulk/SQL family | — |
| 027 | completed | Network/developer diagnostics family | 173, 174, 175, 176, 177 |
| 028 | blocked | Image format + target-compression family | 047, 048, 049 |
| 029 | completed | Image edit/composition family | 213, 298, 299, 300 |
| 030 | completed | Screenshot/document privacy family | 214, 301, 302 |
| 031 | blocked | OCR and document-scan family | 246, 247 |
| 032 | blocked | PDF edit/security family | 237, 238, 239, 240, 241, 242, 243, 244, 245, 319, 320 |
| 033 | blocked | PDF conversion/productivity family | 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260 |
| 034 | completed | Heavy local media/OCR/Office feasibility refresh | — |
| 035 | blocked | Audio capture/playback utilities | 229, 303, 304 |
| 036 | blocked | Audio file-processing family | 230, 231 |
| 037 | ready-for-agent | Video inspect/subtitle utilities | 232, 233, 305 |
| 038 | blocked | Video transform family | 234, 306, 307, 308 |
| 039 | completed | AI-era deterministic helper family | 054, 165, 183, 184, 185, 186, 189 |
| 040 | blocked | Italy utilities beyond CalcolaTutto | 152, 150 |
| 041 | completed | Italian text/language long-tail family | 187, 188, 189, 190, 309 |
| 042 | completed | Design/CSS/web-helper family | 199, 200, 201, 202, 203, 310 |
| 043 | completed | Date/time everyday utility family | 154, 155, 156, 311 |
| 044 | completed | Lightweight generators/productivity family | 204, 205 |
| 045 | blocked | Expanded catalog IA and job-route discovery | 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 035, 036, 037, 038, 039, 040, 041, 042, 043, 044, 065, 066, 104, 105, 106, 107 |
| 046 | blocked | Full expansion certification + release integration | 006, 018, 045, 065, 066, 111, 112, 113, 114, 158, 206, 276, 279, 280, 281 |
| 047 | ready-for-agent | JPEG/PNG/WebP/SVG compression engines | 207, 208, 209 |
| 048 | completed (bounded JPEG/PNG/WebP route; advanced codec and physical gates separate) | Target-size + batch image compression | 210, 211 |
| 049 | blocked | Image conversion matrix + HEIC/AVIF/GIF | 212, 312, 313 |
| 050 | completed | Upgrade existing image-tool functionality | 213, 314, 315, 316, 317 |
| 051 | blocked | True PDF compression profiles + target size | 218, 219 |
| 052 | completed (bounded cross-source page composition with safe per-page mutation and browser verification) | Visual PDF page organizer for existing page tools | 215, 216, 217 |
| 053 | blocked | Upgrade existing PDF inspect/extract/compare tools | 220, 221, 242, 318, 319, 320 |
| 054 | completed | TXT/Markdown/HTML conversion core | 081 |
| 055 | completed (bounded semantic pack; not pixel-faithful Word rendering) | DOCX semantic conversion pack | — |
| 056 | ready-for-agent | Office-to-PDF and printable export pack | 256, 257, 258, 259 |
| 057 | blocked | PDF-to-editable/structured conversion pack | 252, 253, 254, 255 |
| 058 | blocked | PDF↔image directional conversion pack | 235, 236 |
| 059 | ready-for-agent | JSON/XML/CSS/HTML/SVG minimizer pack | 168, 191, 192, 193, 209 |
| 060 | completed | Upgrade existing CSV/table functionality | 172, 194, 195 |
| 061 | completed | Upgrade existing text/developer functionality | 164, 178, 179, 180, 181, 182, 196 |
| 062 | blocked | Upgrade existing business/date functionality | 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 154, 155, 156 |
| 063 | completed | Upgrade existing marketing/URL functionality | 321, 322, 323, 324, 325 |
| 064 | completed | Upgrade existing file/archive/research functionality | 197, 198, 222, 223, 224, 326, 327 |
| 065 | blocked | Format-operation matrix coverage gate | 047, 048, 049, 051, 052, 053, 054, 055, 056, 057, 058, 059, 067, 068, 108, 109 |
| 066 | blocked | Existing 200 functional-upgrade coverage gate | 050, 053, 060, 061, 062, 063, 064, 110, 297 |
| 067 | completed | ZIP/GZIP/archive compression + safe extraction | 222, 223, 224 |
| 068 | completed | DOCX/PPTX/XLSX OOXML compressor | 225, 264 |
| 069 | blocked | Cross-format file-size analyzer | 228, 265, 266 |
| 070 | completed | Result declaration in Tool Manifest | — |
| 071 | completed | Generated Result v2 inventory projection | 070 |
| 072 | completed | Result operation state model with partial and warning | 070 |
| 073 | completed | Accessible result announcements and focus recovery | 072 |
| 074 | completed | Answer explanation and provenance result primitives | 070 |
| 075 | completed | Explicit Result v2 action contract | 070, 072 |
| 076 | completed | Typed output artifact descriptor and download truth | 070 |
| 077 | completed | Bounded large-output preview primitive | 076 |
| 078 | completed | Shared file result row and workspace shell | 072, 076 |
| 079 | completed | Batch result and isolated-failure primitive | 072, 076, 078 |
| 080 | completed | Reference and network provenance state primitive | 072, 074 |
| 081 | completed | Semantic result-class conformance harness | 073, 074, 075, 076, 077, 078, 079, 080 |
| 082 | completed | Renderer-seam migration ledger for all 200 tools | 071 |
| 083 | completed | Legacy raw-result primary-output detector | 082 |
| 084 | completed | Result v2 style-governance gate | 074, 078 |
| 085 | completed | Italian result localization and formatting contract | 074 |
| 086 | completed | Primary-answer and action-semantics exemplar | 074, 075, 085 |
| 087 | completed | Cancellation retry and stale-run browser acceptance | 072, 073, 075 |
| 088 | completed | Migrate BusinessMathTool renderer to Result v2 | 081, 082, 085 |
| 089 | completed | Migrate date-time shared renderers to Result v2 | 081, 082, 085 |
| 090 | completed | Migrate calculator and marketing bespoke results to Result v2 | 081, 082, 085 |
| 091 | completed | Migrate DeveloperWebTool renderer to Result v2 | 077, 081, 082 |
| 092 | completed | Migrate TextWriting and list renderers to Result v2 | 077, 081, 082 |
| 093 | completed | Migrate research and reference renderers to Result v2 | 080, 081, 082 |
| 094 | completed | Migrate TableWorkbench shared path to Result v2 | 077, 081, 082 |
| 095 | completed | Migrate bespoke CSV and data renderers to Result v2 | 077, 079, 081, 082 |
| 096 | completed | Migrate file privacy shared renderers to Result v2 | 078, 079, 081, 082 |
| 097 | completed | Migrate image shared renderers to Result v2 | 078, 081, 082 |
| 098 | completed | Migrate PdfTool and document renderers to Result v2 | 078, 081, 082 |
| 099 | completed | Migrate URL marketing QR and bespoke results to Result v2 | 080, 081, 082 |
| 100 | completed | Browser capability and resource preflight contract | — |
| 101 | completed | Heavy local-job worker cancellation and memory runtime | 072, 100 |
| 102 | completed | Binary file image and bytes handoff envelope | 075, 076, 100 |
| 103 | completed | Generated artifact signature and fidelity verifier | 076, 100 |
| 104 | completed | Canonical job identity and duplicate-route policy | — |
| 105 | completed | Italian search-intent regression corpus | 104 |
| 106 | completed | Expanded directory and category scalability UX gate | 104 |
| 107 | completed | Related-tool and handoff graph policy | 075, 102, 104 |
| 108 | completed | Machine-readable format-operation classification schema | — |
| 109 | completed | Format fidelity and claim evidence records | 103, 108 |
| 110 | completed | Original-200 functional-audit record schema | 082 |
| 111 | completed | Result-state browser certification matrix | 081, 087 |
| 112 | completed | Result-v2 accessibility certification gate | 073, 081 |
| 113 | completed | Result performance regression baseline | 081 |
| 114 | completed | Result privacy and network evidence gate | 080, 081 |
| 115 | blocked | Italian administrative geography source pack | — |
| 116 | completed | Italian public-holiday authoritative source pack | — |
| 117 | blocked | Italian fiscal annual source snapshots | — |
| 118 | completed | INPS annual contribution source snapshots | — |
| 119 | completed | FatturaPA technical-spec and XSD source pack | — |
| 120 | completed | CAP to Comune source feasibility decision | — |
| 121 | blocked | Codice Fiscale formal validate and generate engine | 070, 115 |
| 122 | blocked | Codice Fiscale decode and omocodia ambiguity | 121 |
| 123 | completed | Partita IVA local formal validator | 070, 007 |
| 124 | completed | Opt-in VIES authoritative verification | 080, 123 |
| 125 | completed | Percentage helper complete human modes | 088 |
| 126 | blocked | IVA add and scorporo with versioned presets | 117, 125 |
| 127 | blocked | IRPEF national annual core | 117, 074 |
| 128 | blocked | IRPEF supported deductions and addizionali tranche | 127 |
| 129 | completed | Employee social-contribution model v1 | — |
| 130 | blocked | Stipendio netto annual v1 | 128, 129 |
| 131 | completed — bounded 2026 public calculator | INPS artigiani and commercianti contribution calculator | — |
| 132 | completed — bounded 2026 public calculator | Gestione Separata contribution calculator | — |
| 133 | blocked | Regime forfettario annual v1 | 117, 131, 132 |
| 134 | blocked | TFR accrual and ISTAT-backed revaluation | 117 |
| 135 | blocked | TFR indicative taxation layer | 127, 134 |
| 136 | completed | Unit engine tranche 1 basic dimensions | 070 |
| 137 | completed | Unit engine tranche 2 engineering dimensions | 136 |
| 138 | completed | Digital storage and download-time calculator | 136 |
| 139 | completed | Battery vehicle and power conversion helpers | 136, 137 |
| 140 | completed | Reference-size conversion helpers | 136 |
| 141 | completed | Safe scientific expression calculator | 070 |
| 142 | completed | Exact fractions and integer toolkit | 070 |
| 143 | completed | Descriptive statistics grades and completion | 070 |
| 144 | completed | Geometry equation and motion helpers | 136, 142 |
| 145 | completed | Interest and savings-goal calculators | 088 |
| 146 | completed | Generic loan and installment scenarios | 016 |
| 147 | completed | Everyday cost calculator bundle | 125, 136 |
| 148 | completed — local public reader | FatturaPA single-invoice local reader | — |
| 149 | completed | FatturaPA batch to table export | — |
| 150 | completed | P7M extraction and inspection | 100, 103, 267 |
| 151 | completed — authoritative 2026 public optimizer | Ponti and ferie optimizer | — |
| 152 | blocked | Italian invoice stamp-duty reference helper | 117 |
| 153 | completed | Italian identity-document expiry helper | 007 |
| 154 | completed | Calendar convenience modes on existing date engine | 089 |
| 155 | completed | World clock and live deadline surface | 089 |
| 156 | completed | Timer stopwatch and Pomodoro resilient clock | 072 |
| 157 | completed | CAP to Comune lookup | 120 |
| 158 | blocked | Italy source freshness and annual rollover gate | 115, 116, 117, 118, 119 |
| 159 | completed | Secure password PIN and Italian passphrase generators | 070 |
| 160 | completed | Explainable password-strength estimator | 070 |
| 161 | completed (bounded local parse/write core; public catalog handoff remains an integration concern of the spreadsheet-family umbrella) | CSV XLSX and Markdown-table interchange | — |
| 162 | completed | VCF viewer and CSV export | 070 |
| 163 | completed (bounded OOXML metadata parts only) | Office metadata cleanup with reinspection | — |
| 164 | completed | Structured developer diagnostic envelope | 091 |
| 165 | completed | Deterministic JSON repair with ordered edit log | 164 |
| 166 | completed | Structural JSON diff | 077, 091 |
| 167 | completed | JSON to TypeScript and JSON Schema inference | 091 |
| 168 | completed | XML validate format and minify core | 164 |
| 169 | completed (bounded engine mapping; no standalone public route added in this tranche) | Representable XML to JSON CSV and XLSX mappings | — |
| 170 | completed | CSV to SQL dialect generator | 094 |
| 171 | completed | Streaming huge CSV splitter | 094, 101 |
| 172 | completed | Table compare by explicit keys and columns | 094 |
| 173 | completed | IPv4 and IPv6 CIDR calculator | — |
| 174 | completed | Base 2 through 36 converter | — |
| 175 | completed | chmod Unix permission helper | — |
| 176 | completed | Keyboard event diagnostic | 091 |
| 177 | completed | X509 and CSR local inspector | 091 |
| 178 | completed | Regex execution isolation and hard timeout | 091, 101 |
| 179 | completed | UUIDv7 RFC 9562 conformance repair | 091 |
| 180 | completed | JWT temporal-claim interpretation | 091 |
| 181 | completed | Timezone-aware cron next-runs | 091 |
| 182 | completed | Base64 text file and base64url modes | 091, 076 |
| 183 | completed | AI response code fences to named files ZIP | 222 |
| 184 | completed | Reversible semantic text chunker | 092 |
| 185 | completed | Fact-sensitive original versus AI diff | 092 |
| 186 | completed | Stable-placeholder anonymize and restore | 092, 094 |
| 187 | completed | Italian Gulpease readability | 092 |
| 188 | completed | Mojibake repair with disclosed transforms | 092 |
| 189 | completed | PDF-copy text reflow | 092 |
| 190 | completed | Phone link hashtag and mention extractor | 092 |
| 191 | completed | JSON formatter minify and size-delta mode | 091 |
| 192 | completed | Parser-backed CSS minifier | 070 |
| 193 | completed | Semantic HTML minifier | 070 |
| 194 | completed | Existing CSV cleanup and profiler upgrades | 095 |
| 195 | completed | Existing CSV transform-route upgrades | 094, 172, 170 |
| 196 | completed | Existing text and developer remainder upgrades | 091, 092, 110, 164 |
| 197 | completed | File folder manifest and checksum workflow upgrades | 096, 102 |
| 198 | completed | Research bibliography and source export handoffs | 093 |
| 199 | completed | CSS gradient shadow and radius generator | 070 |
| 200 | completed | Color harmonies tints shades and named-colors upgrade | 097 |
| 201 | completed | Color-blindness image simulation | 097, 103 |
| 202 | completed | Sitemap XML generator | 099 |
| 203 | completed | WiFi QR preset on existing QR generator | 099, 104 |
| 204 | completed | EAN-13 and Code-128 barcode generator | 070 |
| 205 | completed | Secure random picker team splitter and coupon-code modes | 159 |
| 206 | completed (gate contract complete; no heavy path promoted without physical evidence) | Heavy local-job mobile and performance acceptance gate | — |
| 207 | completed | JPEG and WebP format-aware compression adapters | 100, 103, 268 |
| 208 | completed | PNG lossless and palette compression modes | 100, 103, 268 |
| 209 | completed | Safe SVG optimizer and preview | 103, 268 |
| 210 | completed (bounded browser-native target solver; physical-device promotion separately gated) | Image target-size search engine | 207, 208 |
| 211 | completed (bounded sequential queue; real-device promotion separately gated) | Mixed-image batch compression queue | 079, 207, 208, 210, 222 |
| 212 | ready-for-agent | HEIC AVIF and GIF directional image implementations | 103, 206, 268 |
| 213 | completed | Direct-manipulation image transform workspace | 078, 097 |
| 214 | completed | Destructive screenshot image redaction | 103, 213 |
| 215 | completed (bounded on-demand browser PDF.js preview; physical-device evidence remains separate) | Bounded lazy PDF page-thumbnail renderer | 078, 100, 269 |
| 216 | completed (bounded visual preview and existing verified PDF core; production/physical device promotion separately gated) | Visual PDF merge reorder and rotate organizer | 215 |
| 217 | completed (strict shared grammar, bounded visual selection and independently verified multi-PDF ZIP) | Visual PDF split delete and extract selector | 215, 222 |
| 218 | ready-for-agent | Image-aware and scan PDF compression profiles | 098, 100, 103, 269 |
| 219 | blocked | PDF target-size solver and batch compressor | 079, 218, 222 |
| 220 | completed | Page-scoped PDF text and embedded-image extraction | 098 |
| 221 | completed (explicit page alignment, bounded structural/text layers and user-triggered rendered visual diff) | PDF structural text and visual comparison | 215, 220 |
| 222 | completed | Real ZIP DEFLATE compression tranche | 103, 272 |
| 223 | completed | GZIP single-file compress and decompress | 103, 272 |
| 224 | completed | Safe ZIP extraction with bomb and path defenses | 222 |
| 225 | completed (bounded OOXML-only analyze/rebuild core) | OOXML package analyzer and safe DEFLATE rebuild | — |
| 226 | completed (bounded semantic extraction; not layout rendering) | DOCX to Markdown HTML and TXT semantic extraction | — |
| 227 | completed (bounded simple-style semantic DOCX generation) | TXT Markdown and HTML to DOCX generation | — |
| 228 | completed | Cross-format file-size analyzer core | 097, 222 |
| 229 | blocked (physical iOS/Android acceptance pending) | Microphone test and local recorder | — |
| 230 | completed | Audio transcode compress and target bitrate size | 100, 103, 206, 273 |
| 231 | ready-for-agent | Audio timeline edits and deterministic DSP | 230 |
| 232 | completed — bounded local MP4 metadata inspection / mathematical bitrate planner only (NOT Gold, NOT transcoding) | Video inspector and target-size calculator | 100, 206, 274 |
| 233 | completed | SRT VTT transform transcript and readability | 077 |
| 234 | ready-for-agent | Video transform worker core | 100, 103, 206, 232, 274 |
| 235 | blocked | Advanced Images to PDF composition | 098, 103, 212 |
| 236 | ready-for-agent | Advanced PDF to image export | 098, 103, 215, 269 |
| 237 | ready-for-agent | True PDF redaction with post-export proof | 215, 269 |
| 238 | completed | PDF page numbers placement and ranges | 215, 269 |
| 239 | completed | PDF watermark and overlay placement | 215, 269 |
| 240 | completed | PDF crop and page-size normalization | 215, 269 |
| 241 | ready-for-agent | PDF signature placement | 215, 269 |
| 242 | completed | PDF protect encrypt and legitimate unlock | 103, 269 |
| 243 | ready-for-agent | PDF fill annotate and write overlays | 215, 269 |
| 244 | completed | PDF repair and tolerant recovery | 103, 269 |
| 245 | completed | PDF A conversion decision and implementation | 206, 269 |
| 246 | ready-for-agent | Local image OCR | 100, 103, 206, 271 |
| 247 | blocked | Scanned PDF OCR and searchable text layer | 215, 246 |
| 248 | completed | Search text across multiple PDFs | 079, 220 |
| 249 | blocked | Split PDF by maximum output size | 217, 218 |
| 250 | completed | PDF n-up pages per sheet | 215, 269 |
| 251 | ready-for-agent | PDF booklet and front-back interleave | 215, 250 |
| 252 | completed | PDF to Markdown semantic export | 220, 054 |
| 253 | completed | PDF to DOCX semantic reconstruction | 220, 225, 226, 269 |
| 254 | ready-for-agent | PDF tables to XLSX | 161, 220, 269 |
| 255 | blocked | PDF to PPTX page-as-slide baseline | 225, 236, 270 |
| 256 | completed | TXT Markdown HTML and CSV to printable PDF | 054, 103, 269 |
| 257 | completed | DOCX to PDF fidelity-gated conversion | 206, 226, 270 |
| 258 | completed | XLSX to PDF fidelity-gated conversion | 161, 206, 270 |
| 259 | completed | PPTX to PDF fidelity-gated conversion | 206, 225, 270 |
| 260 | completed (bounded text outline + media inventory; raster export refused downstream of 270) | PPTX image export and text outline | 270 |
| 261 | completed (read-only semantic/structure inspector; no faithful rendering) | Office viewer and structure inspector | — |
| 262 | completed | EML and MSG local message viewer | 103, 275 |
| 263 | completed | EPUB local reader and text export | 103, 275 |
| 264 | completed — bounded OOXML media core and user-facing browser route; Gold certification separate | OOXML embedded-media compression core | 207, 208, 225 |
| 265 | blocked | File-size analyzer PDF adapter | 218, 228 |
| 266 | completed | File-size analyzer OOXML and media adapters | 225, 228, 230, 232 |
| 267 | completed | P7M CMS parser feasibility spike | — |
| 268 | completed | Image codec and SVG optimizer feasibility spike | — |
| 269 | completed | Advanced PDF renderer and mutation feasibility spike | — |
| 270 | completed | Office spreadsheet parser writer and renderer feasibility spike | — |
| 271 | completed | OCR engine feasibility spike | — |
| 272 | completed | Archive codec feasibility spike | — |
| 273 | completed | Audio codec and DSP feasibility spike | — |
| 274 | completed | Video codec and media-processing feasibility spike | — |
| 275 | completed | EML MSG and EPUB parser feasibility spike | — |
| 276 | completed | RIS BibTeX converter authoritative oracle closure | — |
| 277 | blocked — physical Android target/tooling unavailable | Physical Android Chrome image-resize acceptance | — |
| 278 | blocked | Physical iOS Safari image-resize acceptance | — |
| 279 | blocked | Image-resize Gold promotion gate | 277, 278 |
| 280 | blocked | Physical Android heavy-tool web acceptance lane | 206 |
| 281 | blocked | Physical iOS Safari heavy-tool web acceptance lane | 206 |
| 282 | completed | Strumentini.it Cloudflare custom-domain cutover runbook | — |
| 283 | completed — Strumentini.it build, live smoke, rollback and restore are certified | Custom-domain post-cutover smoke and rollback certification | — |
| 284 | completed | Existing business-math 200-audit tranche | 110 |
| 285 | completed | Existing client-work-math 200-audit tranche | 110 |
| 286 | completed | Existing data 200-audit tranche | 110 |
| 287 | completed | Existing date-time 200-audit tranche | 110 |
| 288 | completed | Existing developer 200-audit tranche | 110 |
| 289 | completed | Existing documents 200-audit tranche | 110 |
| 290 | completed | Existing files 200-audit tranche | 110 |
| 291 | completed | Existing files-assets 200-audit tranche | 110 |
| 292 | completed | Existing image-visual 200-audit tranche | 110 |
| 293 | completed | Existing marketing 200-audit tranche | 110 |
| 294 | completed | Existing research 200-audit tranche | 110 |
| 295 | completed | Existing text 200-audit tranche | 110 |
| 296 | completed | Existing web-operations 200-audit tranche | 110 |
| 297 | completed | Original-200 functional audit 200 of 200 consolidation | 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296 |
| 298 | completed | Image text watermark and overlay composition | 213 |
| 299 | completed | Image combine grid stack and social slicing | 213, 222 |
| 300 | completed | Image Base64 local encode decode mode | 097, 182 |
| 301 | completed | Screenshot stitching with overlap correction | 213 |
| 302 | completed | Document image perspective straighten | 213 |
| 303 | completed | Tone metronome and noise generator | 070 |
| 304 | completed | Browser text-to-speech Italian controls | 070 |
| 305 | completed — browser-supported local frame-at-time preview and opt-in webcam test (NOT frame-exact guarantee or physical camera certification) | Exact video frame extraction and webcam test | 232, 274 |
| 306 | blocked | Video to GIF conversion | 234 |
| 307 | completed | Audio loudness and LUFS analysis | 273 |
| 308 | completed | Video AI context contact-sheet export | 232, 305 |
| 309 | completed | Italian syllabification feasibility spike | — |
| 310 | completed | CSS px rem em conversion helper | 070 |
| 311 | completed | Astronomy and location-dependent date feasibility | 007 |
| 312 | completed | Common JPG PNG WebP conversion matrix | 097, 103, 104 |
| 313 | completed — **bounded static SVG subset only** (browser codec capability-gated; **not Gold**) | SVG to raster and PDF export | 209, 103, 269 |
| 314 | completed | Image resize functional upgrade | 097, 103 |
| 315 | completed | Image metadata and EXIF before-after upgrade | 097, 103 |
| 316 | completed | Image compare slider overlay and diff upgrade | 097 |
| 317 | completed | Contact sheet favicon and platform export upgrades | 097, 222 |
| 318 | completed | PDF metadata inspect remove upgrade | 098, 103 |
| 319 | completed (verified safe subset; visible appearances explicitly unsupported) | PDF form inspector and flatten upgrade | 098, 215, 269 |
| 320 | completed | PDF password tool capability upgrade | 242 |
| 321 | completed | UTM builder parser cleaner round-trip and bulk | 099 |
| 322 | completed | Meta OpenGraph and social preview preset upgrade | 099 |
| 323 | completed | URL normalize compare and bulk transform upgrade | 099 |
| 324 | completed | Redirect chain and live network diagnostic upgrade | 080, 099 |
| 325 | completed | Robots canonical campaign and naming helper upgrades | 099, 104 |
| 326 | completed | File privacy secret and metadata-risk upgrades | 096 |
| 327 | completed | Research dedupe identity and citation export audit | 093, 198, 276 |

## Validation contract

- IDs stay continuous and unique.
- Every blocker resolves to an existing ticket.
- The dependency graph stays acyclic.
- `completed`, `blocked` and `ready-for-agent` are the only lifecycle states.
- The numeric dependency frontier is derived from incomplete tickets whose declared blockers are all `completed`; external evidence and refused capabilities are independently classified in `CURRENT-TICKET-DASHBOARD.md`.
- `ready-for-agent` is invalid while any declared blocker remains incomplete.
- Closing an umbrella never substitutes for acceptance/verification evidence from its children.
- Final release integration consumes fresh current-fingerprint browser, accessibility, privacy, performance and physical-device evidence where required.
