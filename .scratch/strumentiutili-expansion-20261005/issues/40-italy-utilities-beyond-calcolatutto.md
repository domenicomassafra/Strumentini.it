# 40 — Italy utilities beyond CalcolaTutto

**What to build:** Add the broader Italy utility pack captured in research: ponti/ferie optimizer, FatturaPA XML reader, batch FatturaPA→table, P7M document extraction/inspection where supported, invoice stamp-duty reference helper, CAP↔comune lookup, identity-document/passport expiry helper, enriched Italian holiday/bridge views, and vehicle-registration-period estimate only if a reliable bounded source is approved.

**Traces to:** US-EXP-07, US-EXP-09, US-EXP-10; AC-07.1, AC-09.1, AC-10.1; DEC-EXP-02, DEC-EXP-04, DEC-EXP-06; C-EXP-03, C-EXP-05, C-EXP-06, C-EXP-08

**Constraints:** Every administrative rule/dataset names source/version/coverage; P7M extraction is not signature-validity certification unless a separate verified trust-chain implementation exists.

**Blocked by:** 01, 07, 34.

**Status:** blocked

- [ ] FatturaPA reader/table export covers documented invoice fields and isolates malformed files.
- [ ] CAP/comune and document-expiry data/rules expose dataset/version provenance.
- [ ] Ponti/ferie works as deterministic calendar optimization with explicit holiday set.
- [ ] Any targa estimate is omitted if maintainable evidence cannot bound the claim honestly.

**Verification:** Official-format/rule fixtures, real anonymized/synthetic FatturaPA/P7M corpus, dataset version tests, and local-file privacy assertions.

