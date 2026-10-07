# Toolbox opportunity evidence — 2026-09-23

Scope: evidence for a possible low-ops, static-first/browser-first utility product. This file is evidence, not a PROMOTE decision and not an implementation plan.

## 1. Generic browser toolbox is already crowded

- ToolBox (193 browser tools, 14 categories, no signup, no uploads): https://toolbox-online.app/
- omne (90 privacy-first browser tools): https://github.com/freezer71/omne
- Toolbox.computer (browser/WASM file processing): https://toolbox.computer/
- LocalTools (PDF, image, documents, calculators, local-only): https://localtools.io/
- DuneTools (40+ local/WASM tools): https://www.dunetools.com/
- DailyToolbox (100+ utilities across text/math/dev/PDF/image/audio/video/business): https://dailytoolbox.app/
- ClientSideKit (document/image/PDF/AI-local utilities): https://clientsidekit.com/

Conclusion: “many free tools + privacy + no upload + client-side” is a useful architecture, not a novel product thesis.

## 2. Italy-specific calculator/toolbox space is also crowded

- CalcolaTutto: https://calcolatutto.it/
- Cifrel: https://cifrel.it/
- Strumentini.it: https://strumentini.it/
- CalcoloFiscale: https://calcolofiscale.it/
- Ciro Agizza toolbox: https://www.ciroagizza.it/strumenti/toolbox.html

Strumentini.it is especially important as a novelty blocker: it already combines Italy-specific fiscal calculators, FatturaPA/XML, mortgage/TAEG, IRPEF, IMU, ravvedimento, payslip OCR, notice-period tools and local browser processing.

Conclusion: “Italian IT-Tools” is not enough.

## 3. Transparent/source-backed/versioned calculators are not novel by themselves

- PureUtil uses versioned JSON rule files, archived historical versions and source-change monitoring: https://www.pureutil.org/methodology
- TaxTools Network retains historical tax years and source hierarchy: https://taxtools.network/methodology/
- Nations Tax Calculator publishes its ruleset/open data and provenance: https://nationstaxcalculator.com/data/
- UK Tax Drag exposes client-side formulas and sources: https://uktaxdrag.co.uk/methodology.html
- CalcBadger explicitly uses “show the work”: https://calcbadger.com/about/

Conclusion: formula visibility, source citations, rule versioning, time travel and client-side calculation are desirable quality properties but not sufficient differentiation.

## 4. Workflow chaining exists in technical toolboxes

CyberChef already implements composable browser-side “recipes” where operations can be chained, reordered and shared:
https://github.com/gchq/CyberChef

Conclusion: “CyberChef for everything” needs a much stronger nontechnical/domain-specific job-to-be-done to be novel.

## 5. Strong pain signal: people do not trust simple salary/tax calculators

Community examples:
- different salary calculators give materially different answers: https://www.reddit.com/r/ItaliaCareerAdvice/comments/1u3o4i7/
- “why do salary calculators get it wrong?”: https://www.reddit.com/r/ItaliaPersonalFinance/comments/1428xwr/
- users question whether payslips should be checked every month: https://www.reddit.com/r/ItaliaPersonalFinance/comments/1qiyh8z/
- recurring confusion around forfettario taxes, thresholds, advances and invoices: https://www.reddit.com/r/commercialisti/

This suggests a stronger job than CALCULATE: CHECK / RECONCILE / EXPLAIN DIFFERENCES.

## 6. Payslip checking exists, but as fragmented vertical products

- Cedolingo: paid expert-assisted payslip checking: https://www.cedolingo.com/
- GioIA: AI payslip analysis: https://www.chiediagioia.it/analizza-busta-paga
- Laborio: HR/payroll ingestion and AI extraction: https://laborio.it/

Conclusion: “payslip checker” alone is not novel. A broader deterministic, local-first personal-admin verification workbench may still be differentiated, but must be novelty-checked as a whole.

## 7. Reconciliation/checking is an established B2B pattern but fragmented by document/workflow

- InvoiceReconcile: https://invoicereconcile.com/
- SettlePair: https://settlepair.com/
- Reconcile Locally: https://usereconly.com/
- SupplierRecon: https://supplierrecon.com/
- FormatForge invoice tools / three-way matching: https://formatforge.org/

Conclusion: verification/reconciliation is valuable, but the novelty opportunity is not “invoice matching”. The candidate angle is consumer/personal-admin + Italy-first + multiple document classes + deterministic local verification.

## 8. “One local profile, many calculators” also exists

- Money Considered: one browser-local money profile: https://moneyconsidered.com/money-profile
- Civometry: one household profile feeding many calculators: https://civometry.com/my-household
- interest.sg: one financial profile for Singapore-specific tools: https://interest.sg/

Conclusion: reusable local profile is a useful UX primitive, not a standalone novelty moat.

## 9. Distribution changed: commodity calculators are more exposed to AI search

Google’s 2026 Search guidance explicitly recommends unique, non-commodity content and says generative-AI search remains grounded in core ranking/quality systems:
https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

Google reports AI Overviews above 2.5B monthly active users and AI Mode above 1B monthly active users:
https://blog.google/products-and-platforms/products/search/new-controls-website-owners/

Implication: a generic percentage/IVA/date calculator is easy for search/AI itself to answer. Tools requiring interaction, local files, scenario comparison, document checking or nontrivial deterministic computation are more defensible.

## 10. Static-first economics are excellent

Cloudflare Pages states static asset requests are free and unlimited on free and paid plans:
https://developers.cloudflare.com/pages/functions/pricing/

Workers Free currently provides 100,000 requests/day for dynamic Worker/Function calls:
https://developers.cloudflare.com/workers/platform/limits/

Cloudflare Pages has a 25 MiB per-static-asset limit; larger WASM assets can be served through R2:
https://developers.cloudflare.com/pages/platform/limits/

R2 free tier currently includes 10 GB-month storage, 1M Class A and 10M Class B operations monthly, with no egress charge:
https://developers.cloudflare.com/r2/pricing/

Conclusion: a static/client-side architecture can plausibly keep infrastructure near domain-only cost at substantial traffic. Heavy OCR/media WASM should be loaded lazily; large binaries may need R2.

## 11. Current strongest hypothesis — not yet PROMOTE

Do NOT build a generic toolbox.

Investigate an **Italy-first personal admin verification workbench** whose verbs are:

1. CALCOLA — deterministic calculators;
2. CONTROLLA — upload/paste an existing document or numbers and reconcile them;
3. CONFRONTA — job offer, employee vs freelance, tariff, loan, year-to-year rules;
4. CONVERTI — only file transformations that support the above workflows;
5. ESPORTA PROVA — local receipt/report describing inputs, rule version, formula and checks.

Candidate initial audience: Italian workers + freelancers / people evaluating a work or tax change, not “everyone”.

Candidate high-value tasks:
- salary/job-offer comparison rather than only RAL→net;
- payslip arithmetic/check consistency rather than only payslip explanation;
- forfettario cash/tax reserve and threshold scenarios rather than only annual tax estimate;
- invoice / payment / VAT consistency checks;
- TFR / notice / leave calculations;
- loan/mortgage quote reconciliation;
- document redaction/conversion only when part of a real admin workflow.

The product should remain:
- no account by default;
- no server-side user file processing;
- no LLM in the normal calculation path;
- rules/data separated from UI;
- deterministic;
- source-backed;
- testable against official worked examples where possible;
- historical rules retained rather than overwritten;
- graceful about uncertainty: “cannot verify” is preferable to fake precision.

## 12. Novelty gate for next research

The candidate must be rejected or narrowed if a direct incumbent is found that already combines:

1. Italy-specific personal/work/fiscal tools;
2. local/browser-only sensitive document processing;
3. deterministic document checking/reconciliation, not just extraction;
4. shared local profile/context across tools;
5. scenario comparison;
6. source/rule provenance;
7. low/no-login static-first UX.

No evidence collected so far proves uniqueness. The research only shows that the *combination* is less obviously occupied than generic toolbox/calculator/file-converter categories.

## 13. Scope correction after review

The worker/freelancer/personal-admin direction is too vertical to define the product. Keep it only as one source of tasks.

The research should now search for **universal moments**, not categories:

- before I share something;
- after I download something;
- when I migrate between apps/devices;
- when a file/data export is broken;
- when I must hand off a clean bundle;
- when I must compare two versions;
- when I must clean/normalize/deduplicate data.

The candidate product can accept heterogeneous inputs (text, URLs, images, PDFs, CSV, VCF, ICS, bookmark HTML, ZIP/folders) and expose context-specific operations, but "drop anything + many tools" is still not sufficient novelty by itself.

Current novelty warning: horizontal utility catalogs are extremely commoditized. TinyWow publicly advertises 200+ online tools, while current tool directories/catalogs include systems exposing hundreds or even >1,000 deterministic CPU utilities. Individual local-first cleanup functions (CSV cleaner, vCard dedupe, location-history parsing, zero-width character cleaning, QIF/OFX conversion, etc.) already exist. The opportunity, if any, is therefore in a coherent moment/workflow and exceptional UX, not feature count.

Promising research archetypes:

1. **Share Preflight** — inspect/sanitize/prepare anything before sending or publishing.
2. **Personal Data Repair Shop** — clean and migrate exports between apps/devices.
3. **Digital Handoff Builder** — turn a messy folder/files into a clean, portable, checksummed delivery bundle.
4. **File/Data Doctor** — diagnose why a file/export will not open/import and repair safe classes locally.
5. **Contextual Utility Surface** — one input box/dropzone; infer input type and reveal only relevant deterministic operations.

All five require deeper incumbent search before being treated as original.
