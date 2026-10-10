# 40 — Italy utilities beyond CalcolaTutto

**What to build:** Add the broader Italy utility pack captured in research: ponti/ferie optimizer, FatturaPA XML reader, batch FatturaPA→table, P7M document extraction/inspection where supported, invoice stamp-duty reference helper, CAP↔comune lookup, identity-document/passport expiry helper, enriched Italian holiday/bridge views, and vehicle-registration-period estimate only if a reliable bounded source is approved.

**Traces to:** US-EXP-07, US-EXP-09, US-EXP-10; AC-07.1, AC-09.1, AC-10.1; DEC-EXP-02, DEC-EXP-04, DEC-EXP-06; C-EXP-03, C-EXP-05, C-EXP-06, C-EXP-08

**Constraints:** Every administrative rule/dataset names source/version/coverage; P7M extraction is not signature-validity certification unless a separate verified trust-chain implementation exists.

**Blocked by:** 152 only — the invoice stamp-duty helper still lacks the complete versioned fiscal source pack required by ticket 117. Tickets 148/149/151/153 are complete; 150 and 157 are terminal documented REFUSE outcomes under their own feasibility/source gates.

**Status:** blocked

- [x] FatturaPA reader/table export covers documented invoice fields and isolates malformed files.
- [x] CAP/comune and document-expiry branches expose versioned provenance: document expiry is implemented from official rules, while CAP↔Comune is explicitly REFUSED by the versioned source-feasibility decision instead of being replaced with scraped data.
- [x] Ponti/ferie works as deterministic calendar optimization with explicit holiday set.
- [x] No vehicle-registration/targa estimator is exposed because no maintainable bounded source was approved in this program.

**Verification:** Official-format/rule fixtures, real anonymized/synthetic FatturaPA/P7M corpus, dataset version tests, and local-file privacy assertions.

**Progress (2026-10-06):** The implementable/approved children are reconciled: FatturaPA single and batch routes are local, oracle-bound and browser-tested; ponti/ferie is source-versioned and browser-tested; document expiry is complete; P7M remains a deliberate production REFUSE after its heavy-feasibility gate; CAP↔Comune remains a deliberate source REFUSE. Ticket 152 is still genuinely blocked by fiscal source-pack 117, so umbrella 40 remains `blocked` even though its four explicit acceptance bullets now have terminal truthful outcomes. No bollo rules, legal conclusion, CAP dataset or vehicle-registration estimate were invented to force closure.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #396, #397.

**Next actionable AC:** Verify the original outstanding requirements and dated source evidence before closing. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
