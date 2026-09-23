# Lane 01 — Market demand and recurring-jobs census

Date: 2026-09-23
Status: decision research, not implementation authorization
Scope: recurring small jobs, target segments, alternatives, demand signals, first-pack implications

## Executive decision

The evidence does **not** support launching UtilityOS as a generic “200–500 tools for knowledge workers” product. That framing is already crowded, is easy to substitute with search/AI/launchers, and was not supported by a fresh broad community scan.

The evidence supports a narrower thesis:

> A persistent utility workspace is most defensible when the user repeatedly handles real files or structured data, repeatedly re-enters stable work context, or repeatedly performs a small deterministic sequence where mistakes cost time or money.

The strongest first wedges are:

1. **Data cleanup and comparison** for people who receive CSVs/tables/lists from other systems and need a fast deterministic cleanup path without building a spreadsheet workflow.
2. **Client-work economics and handoff** for freelancers, consultants and small agencies: rates, margins, scope change, capacity, business days, timezone overlap, invoice math and client-ready files.
3. **Campaign operations** for marketers/growth operators: UTM conventions, URL cleanup, campaign naming, audience-table cleanup, image preparation and deterministic metric math.
4. **Research evidence preparation** for researchers/analysts: citation/reference dedupe, identifier cleanup, RIS/BibTeX normalization, research-URL cleanup and evidence-table preparation.
5. **File and asset handoff** as a cross-pack substrate: PDF/image preparation, metadata inspection, checksums, manifests and comparison.

Developer utilities are real and recurring, but they are a weaker *go-to-market wedge*: Raycast, browser consoles, ChatGPT, regex101, JSONFormatter and existing client-side utility hubs already make many developer jobs one-keystroke commodities. Developer/Data should exist as an installable support pack, not define the initial identity.

The core product implication is equally important: **the Work Profile must save repeated setup**. If locale, currency, timezone, workweek, rates, date formats, file conventions, campaign naming patterns or preferred presets are not reused enough to be noticed, a persistent workspace loses much of its advantage over a bookmark or search result.

## What counts as evidence in this report

Three evidence classes are kept separate:

- **Direct/primary evidence (P)**: first-party product documentation or platform specifications proving what alternatives can already do, or what current platform constraints exist.
- **Community evidence (C)**: Reddit/Hacker News discussions exposing recurring pain language, workarounds and objections. These are qualitative signals, not population estimates.
- **Competitive evidence (D)**: current direct-product pages showing that a product position or feature is already occupied.
- **Inference (I)**: product conclusions derived from the above. Inference is never presented as observed popularity.

Frequency labels in the census are intentionally qualitative:

- **H**: plausibly daily/weekly for the named role or repeatedly triggered within active projects.
- **M**: project/monthly/periodic.
- **L**: occasional or edge-case.

Other census abbreviations:

- **Risk** = annoyance/error/cost risk: H/M/L.
- **AI/Search repl.** = how easily a search result or chat answer replaces the utility: H/M/L. Lower is better for UtilityOS.
- **Files** = real user file/structured-data involvement: Y/N/Sometimes.
- **Local** = browser/client-side feasibility: H/M/L.
- **Profile** = Work Profile leverage: H/M/L.
- **Repeat** = repeat-use potential: H/M/L.
- **Class** = E evergreen, D data-backed, R rule/regulatory, H heavy-local-compute, S semantic/AI.

## Freshness check: the broad thesis did not clear the bar

The DStack `last30days` engine was run for 2026-08-24 through 2026-09-23 across a planned query set covering freelance/admin, marketing/data, research/citations, developer utilities and alternatives. It returned 72 items from Reddit, Hacker News, GitHub and Digg after filtering, with partial Reddit coverage due to HTTP 429 and no usable X/web channel in that run.

Crucially, the engine's own ranked-evidence synthesis reported:

> “Nothing solid this window.”

No recent evidence cluster cleared its relevance floor. This is **negative evidence against claiming a broad current community wave around generic utility workspaces**. This report therefore relies on task-specific evidence plus primary-source capability checks, and treats the product thesis as something to validate rather than something already proven.

### Product Hunt and GitHub gap round

The prompt explicitly called for Product Hunt and GitHub coverage, so those channels were checked separately rather than inferred from Reddit/HN:

- Product Hunt's January 2026 Developer Tools archive listed **1,528** products in that broad topic. That is category-saturation evidence, not proof of demand for UtilityOS's particular workspace thesis.
- The open-source `CorentinTh/it-tools` repository currently shows roughly **40.6k GitHub stars** and a large collection of developer utilities. This is strong competition/interest evidence for developer micro-tools, but again does not prove a role-aware persistent workspace is wanted.
- BrowseryTools-family repositories advertise **130+ browser-only utilities** spanning developer, data, image, PDF and other categories, reinforcing that “many tools + client-side privacy” is easy to find in open source.
- The 30-day DStack run also searched GitHub; only three GitHub results survived initial collection and **no cross-source recent evidence cluster cleared the relevance floor**. Those three items are therefore not promoted into demand claims.

Conclusion: Product Hunt/GitHub strengthen the **saturation** case, especially for developer/browser-tool territory. They do not rescue the generic-tool-directory thesis.

## Segment test

| Segment | Recurring-job density | Profile leverage | File/data density | Alternative pressure | Wedge assessment |
|---|---:|---:|---:|---:|---|
| Independent consultants / freelancers | H | H | M–H | M | **Strong**. Rates, timezone, business days, scope, profitability and handoff repeatedly reuse personal defaults. |
| Small agencies / client-service operators | H | H | H | M | **Strong**. Same economics plus repeated campaign/client file handling and multi-client presets. |
| Marketing / growth / performance ops | H | M–H | H | M | **Strong**. Naming/tagging/table/image tasks are repetitive and error-prone; saved schemas/presets matter. |
| Researchers / academics / evidence analysts | H | M | H | M | **Strong specialist pack**. Citation/reference cleanup and import/export are file/data-heavy; Zotero is a major incumbent but leaves cleanup gaps. |
| Spreadsheet-heavy business/data ops | H | M | H | H | **Strong job density, difficult wedge**. Excel/Sheets/Power Query are formidable; win only on low-ceremony one-shot cleanup. |
| Developers / technical operators | H | L–M | M | **Very H** | **Useful pack, weak identity**. Extremely saturated by Raycast, CLI, browser devtools and dedicated utilities. |
| Content / creator / design operators | M–H | M | H | H | **Secondary**. Resize/format/compress/handoff recur, but Canva/Adobe/native apps own deeper workflows. |
| Office / admin / project generalists | M–H | M | H | H | **Secondary / risky expansion**. Many jobs quickly become workflow automation, document suites or integrations outside product scope. |

### Segment conclusion

The original “independent knowledge worker” direction survives, but it is too broad as a single persona. The best first audience is better described as:

> **People who personally operate client work, campaigns, research evidence or recurring data handoffs and do not want a heavyweight system for each tiny job.**

That description explains *why* a utility workspace is relevant; “knowledge worker” alone does not.

## Evidence signal map

| Signal | What was observed | Evidence class | Product implication |
|---|---|---|---|
| Freelance timezone conversion causes real coordination failures | A freelancer described a seven-hour client difference and continuing conversion mistakes leading to missed meetings. | C01 | Timezone overlap is not just a novelty converter; saved home/client zones can remove repeated setup. |
| Scope creep has measurable economic cost | One freelancer described a fixed project expanding from ~20 to 43 hours and framed the unpaid delta as a major loss. | C02 | Scope-change cost + rate/profile context is stronger than a generic percentage calculator. |
| A tool alone may not solve scope creep | A 2026 freelancer-validation thread got direct feedback that a dedicated scope-creep tool was not necessary for at least one respondent; communication and boundary-setting remain the harder layer. | C03 | Pair calculation with deterministic output/templates/presets; do not overclaim calculator value. |
| UTM creation is manually repeated and error-prone | PPC user described manually creating UTMs per ad/platform and explicitly asked for a way to reduce manual errors; Google Analytics recommends standardized, case-consistent UTM strategy and dynamic parameters to reduce manual-entry errors. | C04, P18 | Saved campaign conventions materially improve a UTM builder over a one-off page. |
| Platform naming discipline matters | Reddit's own DPA guidance recommends clear campaign identifiers; Google Analytics warns inconsistent campaign/UTM naming fragments reporting. | P17, P18 | Campaign-name builder can use saved schemas; this is profile/preset leverage, not just string concatenation. |
| Citation/reference duplicates can become unmanageable | Zotero users report libraries with thousands/tens of thousands of duplicates where manual merging is impractical. | C05, C06, P08 | Dedupe/normalize tools around citation exchange formats have concrete pain, but must complement rather than reimplement Zotero. |
| Imported citation metadata is often messy | Current Zotero-community tooling targets wrong titles, missing authors, journal names and broken metadata. | C07 | Reference cleanup/normalization has repeat value beyond format conversion. |
| Invoicing can be “too small for SaaS, too repetitive for manual” | A small-business/freelance user described replacing subscription invoicing with Excel macros; another described repetitive invoice data entry. | C08, C09 | UtilityOS should handle math/validation/export/handoff helpers, not become accounting software. |
| Search/AI is a much stronger alternative in 2026 | Google reports very large AI Mode usage; ChatGPT can ingest and transform spreadsheets/documents. | P01, P02, P16 | Pure text answers and ad-hoc transforms are weak moats. Prefer deterministic/file-heavy/profile-aware tasks. |
| Raycast already owns command-style micro-utilities | Raycast supports thousands of extensions, Quicklinks and snippets from root search. | P03, P04, P05, C10 | A command palette is not differentiation. Web portability, no install, profile reuse and file-local execution must earn the switch. |
| Spreadsheet cleanup is already capable | Sheets removes duplicates/trims whitespace; Excel Power Query imports and transforms CSV/folders. | P06, P07 | CSV tooling must win on speed/clarity for one-off cleanup, not claim capabilities spreadsheets lack. |
| Generic local utility hubs already exist | ToopTools, SolveKit, FreelTools and open-source GitHub projects already market large local/browser catalogs/workspaces. | D01–D07 | Tool count, privacy and “one workspace” cannot be the headline moat. |

## Exact customer-language snapshots

These are short verbatim phrases preserved because they describe the pain more precisely than internal product language. They are **qualitative examples, not prevalence claims**.

| Source | Exact language | What it reveals |
|---|---|---|
| C01 — freelancer/timezones | “the 7 hour difference is killing me” / “I'm still missing the mark” | The problem is repeated coordination failure, not curiosity about timezone math. |
| C02 — freelancer/scope | “I can't keep doing this. Next project I need a better approach.” | The trigger is economic leakage plus a desire for a repeatable system. |
| C04 — PPC/UTMs | “make it easier and decrease manual errors” | The job is convention-safe repetition, which is where presets can matter. |
| C05 — Zotero dedupe | “VERY LONG TIME. Far too long” | Manual duplicate resolution becomes the bottleneck at large library scale. |
| C08 — invoicing | “paying for invoicing software I barely used” / “Works offline, no subscription.” | Some users want bounded utility rather than another persistent SaaS system. |
| C09 — invoice/PDF workflow | “without going crazy” | File-to-table repetition can be painful even when the underlying task is simple. |

## Census: 96 recurring micro-jobs

### A. Independent consultants and freelancers

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A01 | Hour/day/project rate conversion | New quote or comparison | Calculator, sheet, mental math | H | M | M | N | H | H | H | Sheets, calculators | E | C11, I |
| A02 | Target-income rate calculation | Pricing/repricing | Spreadsheet template | M | H | M | N | H | H | M–H | Sheets, freelancer calculators | E | C11, I |
| A03 | Effective hourly rate | Review completed work | Timesheet + spreadsheet | M | H | M | Sometimes | H | H | H | Sheets, time trackers | E | C11, I |
| A04 | Scope-creep cost | Change request | Mental math, ad-hoc sheet | H in projects | H | M | N | H | H | H | Sheets, niche calculators | E | C02, C03 |
| A05 | Margin/markup conversion | Quote/procurement | Calculator, sheet | H | H | H | N | H | H | H | Sheets, search calculators | E | I |
| A06 | Project profitability sanity check | Before/after quote | Spreadsheet | M–H | H | M | Sometimes | H | H | H | Sheets, PM/accounting | E | C02, I |
| A07 | Proposal budget sanity check | Before sending proposal | Sheet/manual recomputation | M–H | H | M | Sometimes | H | H | H | Sheets | E | C02, I |
| A08 | Utilization/capacity check | Weekly/monthly planning | Calendar + sheet | H | H | M | Sometimes | H | H | H | Calendars, PM tools | E | I |
| A09 | Retainer capacity | New/renewed retainer | Sheet | M | H | M | Sometimes | H | H | H | Sheets, PM suites | E | I |
| A10 | Client timezone overlap | Scheduling | Google search, world clock | H | H | M | N | H | H | H | timeanddate, calendar | E | C01, P14 |
| A11 | Business-day/deadline math | Commit delivery date | Calendar counting, search | H | H | M | N | H | H | H | timeanddate, calendar | E/D* | P15, I |
| A12 | Invoice math validation / fee gross-up | Before invoice/payment link | Calculator, accounting app | M–H | H | M | Sometimes | H | H | H | Sheets, invoicing SaaS | E | C08, I |

*A11 is E when user supplies workweek/holidays manually; D when UtilityOS supplies current jurisdiction holiday datasets.

### B. Small agencies and client-service operators

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B01 | Multi-client timezone overlap | Schedule cross-region calls | Calendar/world clock | H | H | M | N | H | H | H | Calendar, timeanddate | E | C01, P14 |
| B02 | Per-client rate/margin preset | Estimate work | Client-specific sheets | H | H | M | N | H | H | H | Sheets/PSA | E | I |
| B03 | Change-order delta | Scope changes | Sheet/email calculation | H | H | M | N | H | H | H | Sheets, PSA | E | C02 |
| B04 | Staffing/capacity arithmetic | Assign project | PM suite + sheet | H | H | M | Sometimes | H | H | H | PM/PSA | E | I |
| B05 | Batch client CSV cleanup | Export/import from ad/CRM tool | Excel/Sheets | H | H | L–M | Y | H | M | H | Excel, Sheets, Power Query | E | P06, P07 |
| B06 | List diff before import | Compare old/new contacts/items | Spreadsheet formulas | H | H | L | Y | H | L | H | Excel/Sheets, scripts | E | I |
| B07 | Duplicate-row detection | Before import/handoff | Sheets remove duplicates | H | H | L | Y | H | M | H | Sheets, Power Query | E | P06 |
| B08 | File-list diff | Client sends revised folder | Finder/Explorer/manual | M–H | H | L | Y | H | L | H | diff tools, shell | E | I |
| B09 | Checksum manifest | Large/important handoff | CLI hashes or none | M | H | L | Y | H | L | M | shasum, checksum apps | E | I |
| B10 | Client handoff index | Deliver folder/archive | Manual README/email | M–H | M | M | Y | H | H | H | manual docs | E | I |
| B11 | Clean ZIP / archive inspection | Package deliverables | OS archive tool | M–H | M | L | Y | M–H | M | H | OS archive apps | H/E** | I |
| B12 | PDF package split/reorder | Prepare client deliverable | Acrobat/web PDF site | M–H | M | L | Y | M–H | L | H | Adobe Acrobat, TinyWow | E/H** | P13, D05 |

**Small files are evergreen/local; large archives/PDFs become Class H because of browser memory/CPU constraints.

### C. Marketing, growth and performance operations

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | UTM builder with saved convention | Every campaign/ad/link | Manual URL edits, sheets, builders | H | H | M | N | H | H | H | GA builder, spreadsheets | E | C04, P18 |
| C02 | UTM parser | Audit inbound URLs | Browser/search/tool | H | M | M | N | H | M | H | online parsers | E | P18, I |
| C03 | Tracking-parameter cleaner | Share/normalize URLs | Manual delete/browser extension | H | M | M | N | H | M | H | browser extensions | E | I |
| C04 | Campaign-name builder | Create campaigns/ad groups | Naming sheet/template | H | H | M | N | H | **H** | H | sheets/templates | E | P10 |
| C05 | Bulk URL normalization | Clean exports | Spreadsheet formulas/scripts | H | H | L | Y | H | M | H | Sheets, scripts | E | I |
| C06 | Domain/subdomain grouping | Analyze export/backlinks/leads | Sheet formulas/pivots | M–H | M | L | Y | H | M | H | Excel/Sheets | E | I |
| C07 | Audience CSV dedupe | Upload list | Sheets/Excel | M–H | H | L | Y | H | M | H | Sheets, Excel | E | P06, P07 |
| C08 | Audience CSV column mapping/reorder | Platform import | Sheet/manual edits | M–H | H | L | Y | H | H | H | Sheets, Excel | E | P07 |
| C09 | ROAS/CPA/CPC/CPM scenario math | Budget/performance review | Ads UI + sheet | H | H | H | Sometimes | H | H | H | ad dashboards, Sheets | E | P17, I |
| C10 | Conversion-rate scenarios | Forecast | Spreadsheet | M–H | H | H | Sometimes | H | H | H | Sheets | E | I |
| C11 | Image resize to platform presets | Launch creative | Canva, editor | H | H | L | Y | H | H | H | Canva | E | P11, P12 |
| C12 | Image format/compression batch | Upload constraints | Canva/TinyPNG/editor | H | M | L | Y | H | M | H | Canva, image tools | E/H | P11, P12 |

### D. Researchers, academics and evidence-heavy analysts

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D01 | Citation duplicate detection | Merge search exports/libraries | Zotero duplicate folder | H in reviews | H | L | Y | H | M | H | Zotero | E | P08, C05, C06 |
| D02 | Citation metadata cleanup | Import from mixed sources | Manual Zotero edits/plugins | H in research | H | M | Y | H | M | H | Zotero/plugins | E/S*** | C07 |
| D03 | RIS ↔ BibTeX conversion | Move between tools | Reference manager/export tool | M–H | H | L | Y | H | M | H | Zotero | E | P09 |
| D04 | BibTeX formatting | Before build/share | Editor/CLI | H for LaTeX | M | L | Y | H | M | H | editors, Zotero | E | P09, C05 |
| D05 | BibTeX dedupe | Combine libraries | Script/Zotero/manual | M–H | H | L | Y | H | M | H | Zotero, scripts | E | C05, C06 |
| D06 | DOI normalization/link building | Clean reference set | Search/manual edits | H | M | M | Y | H | M | H | Crossref/Zotero/manual | E | I |
| D07 | ISBN validate/normalize | Bibliography/data prep | Search/manual | M | M | H | Y | H | L | M | online validators | E | I |
| D08 | Reference-list sort/normalize | Draft/handoff | Word/Zotero/manual | M–H | M | M | Y | H | H | H | Zotero, word processors | E | C12, P09 |
| D09 | Research URL cleanup | Save/share sources | Manual URL edit | H | M | M | Sometimes | H | M | H | browser extensions | E | I |
| D10 | Domain/source frequency count | Evidence audit | Spreadsheet/pivot | M | M | L | Y | H | M | H | Sheets/Excel | E | I |
| D11 | Timeline/date normalization | Build chronology | Spreadsheet/manual | M–H | H | M | Y | H | H | H | Sheets, AI | E | I |
| D12 | Evidence-table builder from structured rows | Review/synthesis | Spreadsheet/manual copy | H in reviews | H | M | Y | H | H | H | Sheets, review tools | E | C05, I |

***Deterministic field validation/normalization is E; semantic metadata repair or record matching using inference becomes S and should not be an early default.

### E. Spreadsheet-heavy business and data operations

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E01 | CSV viewer with encoding/delimiter detection | Open unfamiliar export | Excel/text editor | H | H | L | Y | H | M | H | Excel, Power Query | E | P07 |
| E02 | CSV whitespace/quote cleanup | Broken export/import | Excel/Sheets/script | H | H | L | Y | H | M | H | Sheets, Power Query | E | P06, P07 |
| E03 | CSV dedupe by selected key | Before import | Sheets/Excel | H | H | L | Y | H | H | H | Sheets, Excel | E | P06 |
| E04 | Column select/reorder/rename | Match target schema | Power Query/manual | H | H | L | Y | H | H | H | Excel, Power Query | E | P07 |
| E05 | Filter/sort export | Inspect subset | Spreadsheet | H | M | L | Y | H | M | H | Excel/Sheets | E | P06, P07 |
| E06 | Group/count quick summary | Inspect categories | Pivot table | H | M | M | Y | H | M | H | pivots, ChatGPT | E | P01, P06 |
| E07 | Missing-value profiler | QA import/export | formulas/query | H | H | L–M | Y | H | H | H | Power Query/data tools | E | P07 |
| E08 | Column-type profiler | Diagnose dirty data | Power Query/script | M–H | H | L–M | Y | H | H | H | Power Query | E | P07 |
| E09 | Duplicate-row profiler | QA | Sheets/Excel | H | H | L | Y | H | H | H | Sheets/Excel | E | P06 |
| E10 | CSV ↔ JSON conversion | Move between systems | scripts/web tools | M–H | M | L | Y | H | M | H | dev tools, ChatGPT | E | P01, I |
| E11 | Table transpose/reshape-lite | Reformat export | spreadsheet | M | M | M | Y | H | M | M–H | Excel/Sheets | E | P07 |
| E12 | Quick chart from table | Sanity-check trend | spreadsheet/ChatGPT | M | L–M | **H** | Y | H | M | M | Sheets, ChatGPT | E | P01, P06 |

### F. Developers and technical operators

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | JSON format/validate | API/debugging | IDE, jq, web tool | H | M | L | Sometimes | H | L | H | IDE, JSONFormatter, Raycast | E | C13, C15 |
| F02 | YAML format/validate | Config edit | IDE/linter | H for some | H | L | Sometimes | H | L | H | IDE, CLI, Raycast | E | C13 |
| F03 | TOML format/validate | Config edit | IDE/linter | L–M | M | L | Sometimes | H | L | M | IDE, CLI | E | I |
| F04 | Base64 encode/decode | Debug payload | CLI/browser console/tool | M–H | M | H | N | H | L | M | CLI, Raycast | E | C14 |
| F05 | URL encode/decode/query edit | Debug request | devtools/console | H | M | H | N | H | L | H | devtools, Raycast | E | C13 |
| F06 | UUID generation | Test fixtures/IDs | CLI/IDE/web | M–H | L | **H** | N | H | L | M | CLI, Raycast | E | C14 |
| F07 | Hash/checksum | Verify artifact | CLI | M | H | L | Y | H | L | M | sha tools, Raycast | E | I |
| F08 | JWT inspection | Debug auth | jwt.io/devtools | M | H | M | Sometimes | H | L | M | jwt.io, IDE extensions | E | I |
| F09 | Regex testing | Build/debug regex | regex101/IDE/AI | M–H | H | **H** | N | H | L | H | regex101, AI | E | C15 |
| F10 | Cron next-run | Schedule job | crontab guru/AI | L–M | H | **H** | N | H | M | M | cron tools, AI | E | I |
| F11 | Unix timestamp conversion | Logs/APIs | CLI/search/IDE | M–H | M | H | N | H | M | H | search, Raycast | E | C13 |
| F12 | JSON path/query playground | Inspect payload | jq/IDE/online tool | M–H | M | M | Sometimes | H | M | H | jq, IDE, utility hubs | E | C13, C15 |

### G. Content, creator and design operators

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G01 | Image resize | Publish asset | Canva/editor | H | H | L | Y | H | H | H | Canva, native editors | E | P11, P12 |
| G02 | Crop to known aspect ratios | Platform versioning | Canva/editor | H | H | L | Y | H | H | H | Canva | E | P11, P12 |
| G03 | Image format conversion | Platform/export need | editor/web tool | H | M | L | Y | H | M | H | Canva, Preview | E | P12 |
| G04 | Image compression | Upload limit/performance | web compressor/editor | H | M | L | Y | H | H | H | Canva, TinyWow | E | P11, D05 |
| G05 | Batch dimensions inspection | Audit folder/assets | Finder/manual | M–H | M | L | Y | H | H | H | image managers | E | I |
| G06 | EXIF/metadata inspection | Share externally | OS info/web tool | M | H | L | Y | H | H | M–H | exiftool, apps | E | I |
| G07 | EXIF removal | Privacy/handoff | export setting/exiftool | M | H | L | Y | H | H | M–H | exiftool, apps | E | I |
| G08 | Contact sheet | Review/share many images | design app/script | M | M | L | Y | M–H | M | M | Adobe/OS tools | E/H | I |
| G09 | Screenshot border/background prep | Publish demo | design app | M–H | L | M | Y | H | H | H | screenshot apps | E | I |
| G10 | Color conversion / contrast | Asset QA | design tool/web | M | H | H | N | H | M | M | Canva, devtools | E | I |
| G11 | PDF from images | Deliver/submit | Preview/Acrobat/web | M | M | L | Y | H | M | M | Preview, Acrobat | E/H | P13 |
| G12 | PDF page extract/reorder/rotate | Prepare content packet | Acrobat/web PDF tools | M–H | M | L | Y | M–H | M | H | Acrobat, TinyWow | E/H | P13, D05 |

### H. Office, admin and project generalists

| ID | Job | Trigger | Current workaround | Freq | Risk | AI/Search repl. | Files | Local | Profile | Repeat | Direct alternatives | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H01 | Date difference / duration | Plan/verify dates | search/calendar | H | M | H | N | H | M | H | search, calendar | E | I |
| H02 | Add/subtract business days | Commit date | calendar/search | H | H | M | N | H | H | H | timeanddate, calendar | E/D | P15 |
| H03 | Working-hours total | Timesheet/review | spreadsheet | H | H | M | Sometimes | H | H | H | Sheets/time trackers | E | I |
| H04 | Decimal-hours conversion | Payroll/timesheet prep | calculator/sheet | H in some roles | H | H | Sometimes | H | H | H | calculators, Sheets | E | I |
| H05 | Timesheet total | Billing/reporting | spreadsheet | H | H | M | Y | H | H | H | time trackers, Sheets | E | I |
| H06 | Recurring-date list | Schedule plan | calendar/sheet formulas | M | M | H | N | H | H | M–H | calendar, Sheets | E | I |
| H07 | ICS event build/inspect | Share/import event | calendar UI/text editor | L–M | M | M | Y | H | H | M | calendar apps | E | I |
| H08 | Text/list dedupe | Consolidate notes/IDs | editor/sheet | H | M | L | Sometimes | H | L–M | H | Sheets, text tools | E | P06, I |
| H09 | Text diff | Review revisions | Word/Google Docs/git tools | M–H | H | M | Sometimes | H | M | H | Docs, diff sites | E | I |
| H10 | PDF text extraction | Reuse document data | Acrobat/AI/upload | M–H | H | M–H | Y | M–H | M | H | Acrobat, ChatGPT | E/H | P01, P13 |
| H11 | File metadata inspection | Before sharing | OS properties/tools | M | H | L | Y | H | H | M | OS/exif tools | E | I |
| H12 | Filename sanitize / batch rename preview | Prepare upload/handoff | Finder/Explorer/script | M–H | M | L | Y | H | H | H | OS rename tools | E | I |

## Top 35 jobs to prioritize for product validation

These are not “the 35 most popular utilities on the internet.” They are the jobs with the best combination of observed pain, deterministic execution, repeat use, real data/file involvement and/or Work Profile leverage.

| # | Job / family | Concrete evidence basis | Why a persistent workspace can beat a one-off | Main caveat |
|---:|---|---|---|---|
| 1 | CSV cleanup | P06, P07; repeated export/import pattern | Saved delimiter/encoding/schema presets + local files + repeat use | Excel/Sheets are powerful; must be faster for one-shot work. |
| 2 | CSV key-based dedupe | P06, P07 | Repeated import presets and visible deterministic rules | Sheets already removes duplicates. |
| 3 | CSV column select/reorder/rename | P07 | Target-system schemas can be saved per client/platform | Power Query handles this well for invested users. |
| 4 | Table quality profiler | P07 | One-click missing/type/duplicate diagnosis before imports | Needs excellent large-file performance. |
| 5 | List diff/intersection/dedupe | P06, P07 (dedupe/list cleanup incumbents) | Deterministic, local, feeds next tool without copy/search | Commodity if isolated. |
| 6 | Text diff | P02 (document comparison is already a mainstream AI/file task), D02 (connected utility workflows) | Recent + saved comparison settings; local sensitive text | Docs/IDE/AI diff already good in context. |
| 7 | UTM builder with saved conventions | **C04, P18** | Profile stores source/medium/campaign conventions and casing | Many free builders exist. Presets must materially save time. |
| 8 | UTM parser + tracking cleaner | C04, P18 | Natural companion to builder; handoff into clean/share URL | Browser extensions can be faster. |
| 9 | Campaign-name builder | **P17, P18** | Saved naming schema is exactly persistent context | Must support user-defined schemas, not impose one. |
| 10 | Bulk URL normalizer/domain grouping | C04, P18 (repeated campaign URL standardization) | Real exports + repeated normalization rules | Sheets/scripts are strong. |
| 11 | Image resize with platform presets | **P11, P12** | Saved destinations/presets avoid repeatedly looking up dimensions | Canva owns richer creative workflows. |
| 12 | Image convert/compress batch | P11, P12 | File-local, deterministic, natural continuation after resize | Browser memory/mobile constraints. |
| 13 | Client timezone overlap | **C01, P14** | Home/client zones persist; direct scheduling setup reduction | Calendar apps increasingly surface timezones. |
| 14 | Business-day calculation | P15 | Workweek/locale/holiday policy can persist | Holiday data moves tool from E to D. |
| 15 | Hour/day/project rate conversion | C11 | Rate/currency/workday defaults persist across quoting tools | Simple math is easy to search. |
| 16 | Target-income + effective-rate family | C11 + independent-work workflow | Shared rate/hours/overhead context makes repeated review coherent | Needs careful labels to avoid fake business advice. |
| 17 | Scope-creep cost | **C02, C03** | Uses saved rate/project assumptions and can feed change-order output | Calculation alone does not solve boundary-setting. |
| 18 | Margin/markup/profitability family | C02, C11 (economic leakage + recurring rate sense-checking) | Shared cost/rate defaults + proposal handoff | Spreadsheets are entrenched. |
| 19 | Proposal budget sanity check | C02, C11 | Combines hours/rates/margin into deterministic pre-send check | Avoid becoming proposal software. |
| 20 | Utilization/capacity/retainer family | C11 plus C02's project-hours economics | Stable weekly capacity and rates are strong profile inputs | PM/PSA suites cover deep planning. |
| 21 | Invoice math validator | C08, C09 | Useful without replacing invoicing/accounting; local PDF/table values possible | Keep away from tax/legal rules. |
| 22 | Payment-fee gross-up | C08 workflow | User-saved fee schedule makes repeat calculation convenient | Provider fees change; user-entered values safer than maintained tables. |
| 23 | PDF split/extract/reorder | P13, D05 | Real files, local privacy, can flow into handoff package | Acrobat/TinyWow strong; large PDFs are H. |
| 24 | PDF metadata inspector/remover | P13, D01, D05 (active file/PDF utility category) | Local file, deterministic, saved safe-share preset | Must not imply perfect privacy/security. |
| 25 | Client handoff manifest | C09 plus D02's connected-job model | Combines files, names, checksums and notes; persistent client presets help | More niche; validate with service businesses. |
| 26 | File hash/checksum verifier | C13, C15, D01 (technical/local utility category) | Local and deterministic; feeds manifest | Developer-heavy and CLI substitutes exist. |
| 27 | Citation duplicate detection | **C05, C06, P08** | Real libraries; can operate before import and show exact match rules | Zotero already has duplicate detection; complement it. |
| 28 | RIS/BibTeX conversion + formatting | P09, C05 | Repeat file transform across research tools; local | Zotero handles standard import/export. |
| 29 | Citation metadata normalization | **C07** | Repeat cleanup before import; presets for title/author/date conventions | Semantic repair becomes AI/risky; keep deterministic early. |
| 30 | DOI/ISBN normalization | C05, C06, P09 (large standardized reference workflows) | Can batch with citation cleanup and feed reference pack | Weak as standalone landing product. |
| 31 | Research URL cleaner/domain frequency | C05, C06, P09 (large source-set preparation) | Real source lists; natural output into evidence table | Commodity alone. |
| 32 | Timeline/date normalization | P15, C01 (date/time correctness in repeated work) | Saved date format/timezone gives profile leverage | AI can often normalize ad hoc text. |
| 33 | JSON/YAML formatter/validator | C13–C15, D06–D07 (dense developer/browser utility competition) | High repeat for developers; zero setup within installed pack | Saturated; support pack only. |
| 34 | Query-string editor | C04, P18, C13 (marketing + developer URL utility evidence) | Same URL engine powers UTM/parser/cleaner | Devtools/Raycast compete directly. |
| 35 | Filename sanitizer/batch rename preview | C09, D01, D02 (file-handoff/utility workflows) | Saved naming convention per client/project | OS tools already offer batch rename. |

### What should actually be implemented first

The top-35 table should not be translated one row = one isolated page. Several items are **families sharing one engine and one persistent context model**:

- Table engine: inspect → clean → dedupe → map columns → export.
- URL/campaign engine: campaign naming → UTM build → parse → clean/normalize.
- Client-work math engine: rate → target/effective rate → scope delta → margin/profitability → proposal check.
- Capacity engine: working hours → utilization → retainer capacity → deadline/business days/timezone.
- Research-reference engine: import → normalize → dedupe → convert → export.
- File-handoff engine: rename → metadata check → PDF/image prep → checksum → manifest.

This is a stronger product architecture than publishing dozens of unrelated cards while still keeping each operation independently callable.

## Five evidence-supported starter packs

### 1. Client Work pack

Audience: freelancers, consultants, small service businesses and small agencies.

Initial tools/families: rate/effective-rate, scope delta, margin/markup/profitability, proposal sanity, utilization/capacity, timezone overlap, business days, invoice math, file/PDF handoff.

Why persistent: the same currency, timezone, workweek, rates, billable assumptions and client presets recur across the pack.

### 2. Campaign Ops pack

Audience: performance marketers, growth operators, small agencies and hands-on founders.

Initial tools/families: campaign-name schema, UTM build/parse/clean, URL bulk normalize/domain group, audience CSV cleanup/map/dedupe, metric scenarios, image resize/compress presets.

Why persistent: campaign naming conventions, destinations, casing, source/medium vocabulary and platform asset presets can be saved.

### 3. Data Cleanup pack

Audience: operations, analysts, marketers, agencies, researchers and anyone handling exports.

Initial tools/families: CSV inspect/detect, clean, dedupe, column map, filter/sort, profile, list set operations, CSV/JSON.

Why persistent: import/export schemas and cleanup presets recur. This pack must explicitly optimize for “faster than opening a workbook and building a query.”

### 4. Research Evidence Prep pack

Audience: researchers, graduate students, evidence analysts, writers with large source sets.

Initial tools/families: citation dedupe, deterministic metadata normalization, RIS/BibTeX conversion/formatting, DOI/ISBN normalize, URL cleanup/domain count, timeline/date normalization, evidence-table prep.

Why persistent: output format, citation-key conventions, date formats and recurring source-cleanup rules can persist; real files make local execution valuable.

### 5. File & Asset Handoff pack

Audience: cross-segment; especially client services and creators.

Initial tools/families: image resize/convert/compress, PDF split/reorder/extract, metadata inspect/remove, batch rename preview, checksums, file-list diff and handoff manifest.

Why persistent: client/destination naming rules, image presets and handoff conventions recur; local processing avoids unnecessary file upload.

### Pack deliberately not promoted to first wedge: Developer/Data

Developer/Data should still exist because usage can be high and implementation primitives are reusable. It should not be one of the first positioning wedges until retention data proves otherwise. The alternatives are unusually strong: IDEs, CLIs, browser devtools, Raycast, regex101, JSONFormatter, ChatGPT and existing developer utility hubs.

## Cut, defer, merge or demote: 31 catalog decisions

These decisions apply to the existing 200-candidate map. “Demote” means it may still exist later; it should not consume first-wave product attention.

| Candidate | Decision | Why |
|---|---|---|
| Reading-time estimator (#2) | Demote | Trivial, highly search/AI-replaceable, almost no profile leverage. |
| Case converter (#3) | Demote | Commodity; useful only as low-cost universal filler after core engines exist. |
| Lorem/sample-data generator (#19) | Demote | Rare outside developer/design contexts; many substitutes. |
| Language-aware text statistics (#20) | Defer | Language complexity/edge cases for weak differentiation. |
| TOML formatter/validator (#43) | Demote | Useful but narrower than JSON/YAML and already well served by IDEs. |
| HMAC generator (#51) | Defer | Security-sensitive framing and low general-user value. |
| JWT inspector (#48) | Demote | Saturated developer tool; avoid making security claims. |
| Regex tester (#52) | Demote | regex101 + IDE + AI are exceptionally strong incumbents. |
| Cron explainer (#53) | Merge | Merge with next-run calculator as one cron utility; AI/search substitutes are strong. |
| Cron next-run calculator (#54) | Merge/demote | Same engine/use case as cron explainer. |
| HTTP status reference (#56) | Cut from early product | Search/IDE documentation is faster; no persistent-workspace benefit. |
| MIME type lookup (#57) | Defer | Mostly reference data (D), easy search, weak repeat/profile value. |
| User-agent parser (#58) | Defer | Volatile ecosystem and specialist use. |
| Social character-limit checker (#69) | Defer | Platform limits change (D), easy to search, modest workspace advantage. |
| Meta title/description preview (#70) | Demote | Very crowded SEO commodity; limited profile leverage. |
| Open Graph preview (#71) | Defer | Remote fetch/CORS/server requirements weaken static-local model. |
| Robots directive helper (#72) | Defer | SEO correctness risk; easy to misuse as advice. |
| Redirect-chain inspector (#74) | Defer | Requires network/server behavior, not pure local deterministic execution. |
| QR reader (#67) | Demote | Native phone cameras already solve much of this job. |
| Public-holiday lookup (#100) | Defer | Class D maintenance; business-day calculator can start user-supplied/local. |
| Age/date anniversary calculator (#95) | Cut from work wedge | Weak professional relevance and profile leverage. |
| Late-payment interest calculator (#112) | Defer | Class R: jurisdiction/contract/legal assumptions. |
| VAT/general percentage helper (#119) | Split | Generic percentage is E but commodity; VAT is R and should be deferred. |
| Currency scenario calculator (#120) | Defer live mode | Live FX makes it D; manual-rate scenarios can be E. |
| PDF password remove (#133) | Defer | Security/permissions UX and PDF edge cases; not first-wave value. |
| PDF flatten helper (#134) | Defer | Specialist and rendering-heavy relative to stronger PDF jobs. |
| Perceptual duplicate finder (#160) | Defer | Class H and browser performance burden. |
| Secret/token pattern scanner (#175) | Defer | Security claims require specialist design/audit; false positives/negatives matter. |
| Favicon/app-icon size generator (#157) | Demote | Platform-specific dimensions/spec churn; narrow user set. |
| Vocabulary/frequency analyzer (#198) | Demote | Word processors/AI/data tools cover it; weak profile value. |
| Quick chart from table (#40) | Demote from first wave | ChatGPT/Sheets/Excel already make ad-hoc charts very easy; keep only as table-engine convenience. |

Additional merges recommended:

- Margin (#108) + markup (#109) → one bidirectional margin/markup tool.
- ROAS (#78) + CPA/CPC/CPM (#79) + conversion scenarios (#80) → one performance-metrics family with visible formulas.
- URL comparison (#64) + bulk normalizer (#65) + tracking cleaner (#63) → one URL cleanup/compare engine with separate entry points.
- Rate converter (#101) + target-income rate (#103) + effective rate (#102) → one shared client-work rate context, exposed as focused modes.
- Image resize (#141) + platform presets (#146) + format conversion (#143) + compression (#144) → one reusable image pipeline, exposed as simple operations.
- List intersection (#10) + list difference (#11) + line dedupe (#9) → one set/list engine with distinct focused modes.

## Alternative test: when UtilityOS loses

### Google / AI search

Search or chat wins when the user needs a one-off fact, explanation, formula or low-stakes transformation and has no reusable context. Google's 2026 AI-search expansion and ChatGPT's file/data analysis support make this alternative stronger, not weaker.

UtilityOS should **not** assume users will open a separate workspace for:

- a single percentage calculation;
- a definition/reference lookup;
- simple prose rewriting;
- a one-time timestamp conversion;
- a one-off “what size should this image be?” question.

UtilityOS has a better case when the answer must be deterministic, repeated, applied to a file/table, uses saved defaults, or needs a visible reproducible transform.

### Raycast / native launchers

Raycast wins for Mac users who already live in its root search and can install an extension/Quicklink/snippet. It is especially strong for developer commands, clipboard operations, links and tiny text utilities.

UtilityOS can only beat that on combinations Raycast does not naturally own: no-install web portability, cross-platform use, a role/profile setup shared across many browser-local file/data utilities, and exportable packs/configuration.

If users with the same job consistently say “I already do this in Raycast in one keystroke,” that job should be demoted.

### Excel / Google Sheets / Power Query

Spreadsheets win when the work is already in a workbook, when the user wants an exploratory model, or when the transform must remain as a reusable query/formula inside a larger analysis.

UtilityOS can win a different moment:

> “I received/exported this file and need it clean enough for the next system in two minutes.”

The UX benchmark is therefore not feature parity with Excel. It is fewer steps, clearer previews, safer defaults and no workbook/query setup for bounded transforms.

### ChatGPT

ChatGPT can ingest spreadsheets/documents and perform transformation, calculation and charting. It wins when interpretation is required, the input is messy in a semantic way, or the user wants an explanation with the result.

UtilityOS should win on repeatable operations where users value:

- the exact same result for the same input;
- local/no-upload processing;
- visible formulas/rules;
- fast file-in/file-out interaction;
- reusable presets;
- no prompt crafting;
- no token/model cost or model variability.

### Browser bookmarks / single-purpose websites

Bookmarks win when there are only two or three favorite tools and no shared context. A persistent workspace is only better if it reduces tool hunting *and* repeated setup.

That yields an important product rule:

> Do not measure success by “number of tools installed.” Measure whether profile/presets/recent history reduce time-to-completion compared with the user's existing bookmark/search habit.

## Falsification: evidence that should kill or radically narrow the thesis

The persistent-workspace thesis should be rejected, not merely repositioned, if controlled product tests show most of the following:

1. Onboarding-generated workspaces do not reduce median time-to-first-correct-tool versus search/catalog browsing.
2. Users rarely reuse Work Profile values; fewer than a meaningful minority of repeat sessions benefit from saved defaults/presets.
3. Repeat users overwhelmingly enter through Google to an individual tool and do not return through “Your Tools.”
4. Pack installation/removal does not correlate with repeat use and users cannot explain what a pack gives them.
5. Users prefer keeping 2–5 bookmarks or Raycast commands and report no meaningful switching/setup pain.
6. File/data utilities dominate usage but users still prefer Excel/Sheets/ChatGPT because UtilityOS does not materially shorten the task.
7. Tool-to-tool handoff is rarely used, or users copy/download/re-upload anyway.
8. Local processing is appreciated in surveys but does not affect actual choice/retention.
9. The most-used utilities are one-off commodity converters with almost zero profile leverage, making the persistent shell unnecessary.
10. 30-day retention is no better for personalized/preset users than anonymous one-off-tool users after controlling for acquisition source.

### Minimum validation design before scaling to hundreds of tools

The product should prove three deltas with a small Gold set before catalog expansion:

| Hypothesis | Test | Pass signal |
|---|---|---|
| Role-aware setup beats browsing | Randomize generated 10–15-tool home vs catalog-first | Faster correct-tool completion and less search/backtracking for generated-home users. |
| Work Profile matters | Compare repeated tasks with defaults on vs defaults absent | Measurable setup-step/time reduction; high override accuracy rather than frequent correction. |
| Workspace retains better than one-off pages | Track entry surface and 7/30-day return | A meaningful cohort returns via Your Tools/Recent rather than only via fresh search landings. |

No numeric threshold is invented here; thresholds should be set before the experiment using the expected task time and acquisition model.

## Decision implications for the existing roadmap

1. **Do not equate foundational engineering primitives with first-market priorities.** JSON formatter and UUID generator may be cheap foundational tools but should not crowd out stronger wedge validation.
2. **Build families, not SEO clones.** A shared engine can expose focused tools while preserving one underlying context/preset model.
3. **Make profile leverage observable.** Show reused timezone/currency/rate/schema/preset and let the user override it in place.
4. **Make local deterministic execution a product behavior, not marketing wallpaper.** It matters most for files, sensitive client data and reproducibility.
5. **Keep regulatory/live-data tools out of the first wedge.** They add maintenance without proving the workspace thesis.
6. **Use individual tool pages as acquisition, not identity.** The conversion question is whether a useful one-off result leads to a repeatable personal setup.
7. **Instrument the falsification metrics from day one.** Zero-result searches, tool removals, profile override rates, repeat use, pack churn and handoff usage should decide catalog expansion.

## Source register

All URLs below were retrieved during this lane's research pass or were first-party pages already verified in the repository research and re-used here. Reachability is re-checked before lane completion; any failed check is marked rather than silently dropped.

Reachability verification on 2026-09-23 used both direct HTTP retrieval and the research web channel. Direct `curl -L` returned HTTP 200 for the majority of first-party/competitor/HN pages. Several bot-protected sites (notably Reddit, OpenAI Help, Adobe, Canva and timeanddate) returned HTTP 403 to curl; those URLs were then checked through the web research channel, which retrieved the pages or their structured Reddit result. **No source URL in the final register remained unverified/inaccessible.**

### Primary / first-party capability and specification sources

| ID | Source | Date/context | URL | Used for |
|---|---|---|---|---|
| P01 | OpenAI — Data analysis with ChatGPT | Updated 2026 | https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt | AI alternative can transform/analyze uploaded structured data. |
| P02 | OpenAI — File Uploads FAQ | Updated 2026 | https://help.openai.com/en/articles/8555545-file-uploads-faq | AI file/document alternative. |
| P03 | Raycast Manual — Extensions | Current 2026 | https://manual.raycast.com/extensions | Thousands of installable commands/extensions. |
| P04 | Raycast Manual — Quicklinks | Current 2026 | https://manual.raycast.com/quicklinks | Bookmark/URL launcher alternative. |
| P05 | Raycast Manual — Snippets | Current 2026 | https://manual.raycast.com/snippets | Repeated-text/preset alternative. |
| P06 | Google Sheets — Split text, remove duplicates, trim whitespace | Current | https://support.google.com/docs/answer/6325535?hl=en-GB | Spreadsheet cleanup incumbent. |
| P07 | Microsoft Excel — Import data with Power Query | Current | https://support.microsoft.com/en-us/excel/import-data-from-data-sources-power-query | CSV/folder import + transformation incumbent. |
| P08 | Zotero — Duplicate Detection | Current | https://www.zotero.org/support/duplicate_detection | Citation duplicate incumbent/capability. |
| P09 | Zotero — Importing Standardized Formats | Current | https://www.zotero.org/support/kb/importing_standardized_formats | RIS/BibTeX import/export ecosystem. |
| P10 | Reddit for Business — How Reddit Ads work for SMBs | Current 2026 | https://www.business.reddit.com/learning-hub/articles/how-reddit-ads-work-for-smbs | Campaign naming discipline. |
| P11 | Reddit for Business — Image ad specs | 2026-01-27 | https://www.business.reddit.com/learning-hub/articles/reddit-image-ad-specs | Current asset size/aspect/file constraints. |
| P12 | Canva Help — Resize designs and size limits | Current 2026 | https://www.canva.com/help/resize/ | Strong image-resize incumbent. |
| P13 | Adobe Acrobat — Split PDFs | Current 2026 | https://helpx.adobe.com/acrobat/desktop/edit-documents/organize-pages/split-pdfs.html | Strong PDF incumbent. |
| P14 | timeanddate — Meeting Planner | Current | https://www.timeanddate.com/worldclock/meeting.html | Timezone planning incumbent. |
| P15 | timeanddate — Business Date Calculator | Current | https://www.timeanddate.com/date/workdays.html | Business-day incumbent. |
| P16 | Google — AI Mode usage/insights | 2026-05-19 | https://blog.google/products-and-platforms/products/search/ai-mode-us-insights/ | Search/AI substitute strength. |
| P17 | Reddit for Business — Dynamic Product Ads | 2025-12-30 | https://www.business.reddit.com/learning-hub/articles/run-dynamic-product-ads-reddit-smb | Current performance-marketing metrics (ROAS, CPA, CPC, conversion rate) and UTM workflow context. |
| P18 | Google Analytics — URL builders and UTM best practices | Current 2026 | https://support.google.com/analytics/answer/10917952?hl=en-LV | Official UTM fields, standardized naming guidance, dynamic-parameter automation and manual-error reduction. |

### Community sources

| ID | Community signal | Published | URL | Use / limitation |
|---|---|---|---|---|
| C01 | r/freelance — timezone conversion / missed meetings | 2024-10-11 | https://www.reddit.com/r/freelance/comments/1g1gxhi | Concrete recurring coordination pain; one thread, not prevalence. |
| C02 | r/freelance — fixed project scope expanded 20h→43h | 2025-11-17 | https://www.reddit.com/r/freelance/comments/1ozc3zq | Concrete economic scope-creep pain. |
| C03 | r/freelancing — “would a tool for scope creep be useful?” | 2026-07-08 | https://www.reddit.com/r/freelancing/comments/1uqunn8/would_a_tool_for_scope_creep_be_useful_or_more_as/ | Counterevidence: at least one respondent explicitly says a dedicated tool is unnecessary; calculation/software is not the whole problem. |
| C04 | r/PPC — UTM automation/manual-error question | 2024-07-05 | https://www.reddit.com/r/PPC/comments/1dvzbgx | Exact recurring manual-tagging pain. |
| C05 | r/zotero — mass smart deduplication | 2025-05-19 | https://www.reddit.com/r/zotero/comments/1kqddhv | Large-library dedupe pain; specialized user. |
| C06 | r/zotero — mass duplicate merging | 2025-11-26 | https://www.reddit.com/r/zotero/comments/1p7l1hv/mass_duplicate_merging/ | Thousands of duplicates / manual effort signal. |
| C07 | r/zotero — metadata cleanup tooling | 2026-06-13 | https://www.reddit.com/r/zotero/comments/1u4s1en/zotmeta_20_is_out/ | Current pain language, but maker-promoted post. |
| C08 | r/smallbusiness — invoicing via Excel macros vs subscription SaaS | 2026-06-14 | https://www.reddit.com/r/smallbusiness/comments/1u5afqn/how_do_you_guys_handle_invoicing_i_got_tired_of/ | “Too much SaaS for a small repetitive job” pattern; single user. |
| C09 | r/smallbusiness — invoice PDF data entry to Excel | 2025-11-21 | https://www.reddit.com/r/smallbusiness/comments/1p2of5v/how_do_you_guys_handle_data_entry_from/ | File/data-entry pain; one reported workflow. |
| C10 | r/raycastapp — Quicklinks used as bookmarks | 2026-03-23 | https://www.reddit.com/r/raycastapp/comments/1s1gwrx/raycast_quicklinks_as_bookmarks/ | Shows launcher/bookmark alternative and organization friction. |
| C11 | r/freelanceuk — freelance rates in 2026 | 2026-01-30 | https://www.reddit.com/r/freelanceuk/comments/1qr47tz/what_are_your_freelance_rates_in_2026/ | Rate sense-checking is recurring discussion; not a demand metric. |
| C12 | r/PhD — citation manager used for thesis | 2025-01-04 | https://www.reddit.com/r/PhD/comments/1htmmiq/what_citation_manager_did_you_use_for_your_thesis/ | Strong incumbent usage plus metadata/detail caveats. |
| C13 | Hacker News — UFreeTools | 2025-04-04 | https://news.ycombinator.com/item?id=43585750 | Developer repeats JSON/UUID/color tasks; low-engagement product post. |
| C14 | Hacker News — DevUtils | 2020 | https://news.ycombinator.com/item?id=24604291 | Developer utility demand + counterpoint that browser console already solves many jobs. |
| C15 | Hacker News — Prism.Tools | 2026 | https://news.ycombinator.com/item?id=46511469 | Current high-attention client-side developer utility hub; competition signal, not population survey. |

### Direct competitors / category evidence

| ID | Product | URL | Observed relevance |
|---|---|---|---|
| D01 | ToopTools | https://tooptools.com/ | 200+ tools, client-side/no-signup, local personalized workspace: kills “many local tools + workspace” as unique pitch. |
| D02 | SolveKit | https://usesolvekit.com/ | Large utility catalog and “whole jobs” / connected-flow positioning. |
| D03 | FreelTools | https://freeltools.com/ | Broad freelancer-utility/OS territory already occupied. |
| D04 | smarterfaster | https://www.smarterfaster.app/ | Profession-aware workspace/packs concept exists. |
| D05 | TinyWow | https://tinywow.com/tools | Broad free utility catalog and file-tool incumbent. |
| D06 | IT-Tools (GitHub) | https://github.com/CorentinTh/it-tools | Large open-source developer-utility collection; ~40.6k stars observed during this pass, reinforcing saturation/interest in the category. |
| D07 | BrowseryTools (GitHub) | https://github.com/aghyad97/browserytools | 130+ client-side browser utilities across developer/data/file/image categories; “client-side + privacy + breadth” is not unique. |
| D08 | Product Hunt — Developer Tools, January 2026 | https://www.producthunt.com/products?parentTopic=development&period=2026-1&topic=developer-tools | 1,528 products listed in the broad January 2026 developer-tools archive; used only as saturation/landscape evidence. |

## Evidence quality and remaining uncertainty

What is strong:

- Alternatives are verified directly from first-party docs.
- Several task clusters have independent community examples across different roles.
- File/data and profile-reuse logic can be tested behaviorally; it is not dependent on subjective branding.
- Competitor research clearly falsifies several weak differentiation claims.

What is still weak:

- No representative survey or behavioral dataset proves frequency across the addressable market.
- Community posts overrepresent people with problems severe enough to post.
- The 30-day generic research pass did not produce a solid current cluster.
- Some strongest community evidence is from 2024–2025; it is used as pain-language/history, not claimed as September 2026 prevalence.
- We do not yet have UtilityOS-specific retention evidence, because no product exists.

Therefore this report is sufficient to choose **what to validate first**, not to claim product-market fit.

## Final answer to the mission

UtilityOS should solve **recurring deterministic boundary jobs** before commodity lookup jobs: cleaning data for the next system, preparing client/campaign/research files, recomputing work economics with the same personal defaults, and normalizing/validating artifacts before handoff.

The persistent workspace beats Googling only when it compounds context:

> **same person + recurring trigger + reusable defaults/presets + real file/data + deterministic output + fast next-step handoff.**

If one or more of those ingredients are absent, the default assumption should be that Google, ChatGPT, Raycast, a native app or a spreadsheet is already good enough.
