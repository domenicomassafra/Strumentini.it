# Strumentini.it — specification: base, advanced, future gates

Status: OWNER-CONFIRMED REQUIREMENTS; PLANNING ARTIFACT, NOT IMPLEMENTED/RELEASED. Frozen owner choices: docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md; historical US/C remain in PRODUCT-SPEC.md. Current catalog inventory 269, no deletion by this specification.

## Problem and outcome

Daily and weekly computer work is fragmented over one-off file sites; outcomes are hard to trust and repeat on phone or desktop. Offer a complete base utility for the operation *actually declared*, not a toy demo, plus later professional PDF, image and spreadsheet workspaces; do not promise any donor or advanced feature as shipped. Every job has a deterministic user-facing supported/unsupported result.

## Constitution

- C-EXP-01: Local-first anonymous completion; no file content or name leaves the device by default; no unconsented background upload, logging, AI or remote database of documents.
- C-EXP-02: All existing catalog manifest IDs and deep links remain searchable; curating front door is not destructive catalog deletion.
- C-EXP-03: Result must be correct, independently reopened/verified in declared scope; honest refusal for unsatisfied formats, stale sources, missing fonts or legal/rights uncertainty.
- C-EXP-04: Each file/op has bounded input size, memory, progress, cancel, reattempt and no-corrupt-original behavior; mobile physical compatibility is a target both base and advanced.
- C-EXP-05: Stored documents survive only in-session or on explicit local-device opt-in; account sync only non-document favorites unless a new owner decision; no hidden cloud archive.
- C-EXP-06: Optional server mode requires per-operation consent and demonstrable zero ADDITIONAL initial cost, hard quota and lifecycle; if cap exhausted show local equivalent or unavailability.
- C-EXP-07: Proprietary product; license compliance for donor wrapper, transitive runtime, codec, patent, font, CDN, WASM and vendor subscription before integration; no GPL/AGPL compatibility assumed.
- C-EXP-08: WCAG 2.2 AA floor, keyboard/touch/reduced-motion; sound OFF default, opt-in. New visual identity only after three comparable UX directions and dated owner decision.
- C-EXP-09: Fiscal norms, administrative names, and official checks bound to primary evidence/date/version/region and unsupported windows; no legal/payroll guarantee beyond proved scenarios.
- C-EXP-10: Historic ticket/receipt/refusal/certification statuses are independent of planning. Evidence, source revision, physical devices, security reviews and release/rollback cannot be simulated.

## User stories and acceptance

| Story | User outcome and exact happy-path acceptance | Failure, edge or exclusion acceptance | Backlog routing |
|---|---|---|---|
| US-EXP-01 | Anonymous visitor can search any existing real tool by name/capability; curated starting set includes a provenance label, no popularity claim | Missing query, deep link, browser back, unsupported tool and disconnected session retain working search/valid notice | #345 #355 #365 #413 |
| US-EXP-02 | A chosen local PDF/JPEG/CSV file produces only operations compatible with its detected true type and actual engine | Spoofed extension, empty/oversize/polyglot bytes and unsupported format refuse without network transfer | #333 #334 #335 #336 |
| US-EXP-03 | A supported file operation ends in preview/copy/download and independent byte re-open showing exact output | Canceled, failed preview, wrong MIME, blocked download, quota and offline provide recoverable no-false-success UI | #337 #338 #339 #408 |
| US-EXP-04 | User repeats next compatible operation on same bounded result with typed handoff and optionally local session history | Expired buffer, 64MiB existing handoff bound, browser reload and incompatible target cannot appear successful | #337 #340 #345 #410 |
| US-EXP-05 | User may voluntarily retain local file, export preferences and remove saved/history objects independently | Denied storage, eviction, malicious import, logout and duplicate names never autosave/private cloud sync | #330 #331 #332 #341 #342 #343 |
| US-EXP-06 | Three comparable actual UX/IA solutions demonstrate the same PDF/CSV/UTM jobs; owner chooses documented option prior to rebuilding shared UI | Visual owner approval absent means design token/skin mutation held, but live bug fixes not held | #351 #352 #353 #354–361 #364 |
| US-EXP-07 | PDF editor base/advanced page, text (when native semantic), image, form, annotation and history each produce independently reopened artifact on supported source model | Signed/encrypted/font/AcroForm/XFA/hostile source cases decline rather than silently flatten or falsify edit ability | #369 #372–380 #412 |
| US-EXP-08 | PDF redaction candidate renders fresh source-only output proven devoid of covered bytes across independent viewers before any public entry | Unknown signatures, hidden content, metadata, incremental revisions and OOM refuse; independent signoff and physical tests mandatory | #237 #378 #406 |
| US-EXP-09 | Image editor produces layer/mask/adjustment/project/export with pixel-level output and phone interaction under measured limits | ICC/profile/memory/touch gesture cancellation provides non-destructive recovery; no parity claim | #381–386 #393 #412 |
| US-EXP-10 | Excel/CSV workflows handle formulas/locale precision, join/filter/compare and reproduce steps in saved local pipeline | Injection, unsupported macro, external formulas, imprecise number, duplicate key/empty sheet are typed refused or safely handled | #370 #387–391 |
| US-EXP-11 | Two Italian fiscal paths choose tax year/context, show source, formula and valid window per supported IVA/IRPEF/netto/forfettario/TFR case | Missing or stale official rule, unknown contributions, old municipality, 2025/2026 gap reject rather than guessing | #115 #117 #396–402 #409 |
| US-EXP-12 | File format/OCR/Office donor selected only after a reproducible native-vs-donor study and sound legal/mobile evidence | AGPL, unknown runtime license, 49MB heavy Office or unsupported language/direction remains NO-GO | #366–371 #392 #395 #414 |
| US-EXP-13 | Every changed scope has current receipt/dependency identity, independent output proof, protected device and staged rollback before promotion | Open historical refusal, outdated Gold, simulated phone, missing legal source or backend drift cannot be marked PASS | #347 #362 #404–408 #415 |
| US-EXP-14 | Local adaptive area explains recent job/favorite suggestions with no file content, option to clear them; account stays optional | No telemetry cohort or popularity fabricated, Turnstile blocked/error and denied storage show accessible recovery | #328–332 #344 #346 #350 #358 |
| US-EXP-15 | Opted-in server capability only when free cost budget is provably bounded with consent and TTL/delete | No nonconsensual upload, uncontrolled R2/Workers usage, silent server fallback, leaked archived documents or fake file deletion | #348 #349 |

## Highest useful testing seams

- SEAM-01: real user route and resulting observable output (PDF/PNG/CSV/Office) reopened in an independent consumer, checks US-EXP-01–05/07–10.
- SEAM-02: local storage and page history across two independent browser sessions with denied/private mode and real account Worker/D1 staging, checks US-EXP-04/05/14/15.
- SEAM-03: exact source-pack byte/hash + tax-year/effective date + independently derived mathematical cases, checks US-EXP-11.
- SEAM-04: version-pinned donor build/browser runtime, license inventory, hostile corpus, process memory, iOS/Android physical output and cancellation, checks US-EXP-07–12.
- SEAM-05: source/worker/asset identity, Gold selector, CI, staging preview/rollback with physically observed receipt, checks US-EXP-13.

## Non-goals for planning now

No implementation/refactor, account/social-login expansion, recurring paid service, purchase, DNS/Cloudflare promotion, premature visual selection, copy of proprietary closed engines, purported all-format fidelity, immutable cloud file archive or blanket certification. Future ads/donations are unapproved options; no marketing tracking or paywall implied.

## Trace and acceptance authority

Every canonical new issue #328 onward carries AC-ID; old C/US/AC in the 327 original files remain binding. Full OWN-01..20 index: .scratch/strumentini-expansion-20261005/OWNER-DECISION-COVERAGE.md. Format direction index: FORMAT-OPERATION-COVERAGE.md. All 269 manifest IDs and exact gap/provenance: TOOL-CAPABILITY-COVERAGE.csv and product worker source. Future execution packets: EXECUTION-PROMPTS.md. Current technical state is in generated CURRENT-TICKET-DASHBOARD, not the visual status of this document.
