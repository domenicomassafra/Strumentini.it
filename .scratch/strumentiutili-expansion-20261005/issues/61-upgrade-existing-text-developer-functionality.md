# 61 — Upgrade existing text/developer functionality

**What to build:** Deepen current text and developer tools with the modes users actually need: bidirectional format/encode actions, precise validation locations, regex flags/test sets, JWT header/payload/time interpretation, cron next-run lists/timezone, UUID versions, hash/HMAC file/text variants, URL/query helpers, diff options, Markdown preview/export and safe copy/download.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-07, C-EXP-09

**Constraints:** Inspection is not cryptographic verification where keys/signatures are absent; regex execution needs time/input bounds; developer outputs remain deterministic/local.

**Blocked by:** 01, 03, 25, 27.

**Status:** blocked

- [ ] Each existing developer/text route is audited for missing common modes and receives a concrete upgrade/refusal record.
- [ ] Validators point to exact position/rule; encoders expose swap/reverse when naturally bidirectional.
- [ ] Diff/list/text tools add whitespace/case/order options only when their semantics stay understandable.

**Verification:** Existing Gold plus adversarial invalid inputs, regex bounds, JWT/cron/UUID/hash standards vectors and generated route checklist.

