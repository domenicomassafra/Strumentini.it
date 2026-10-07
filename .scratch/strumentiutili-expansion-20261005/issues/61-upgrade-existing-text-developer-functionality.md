# 61 — Upgrade existing text/developer functionality

**What to build:** Deepen current text and developer tools with the modes users actually need: bidirectional format/encode actions, precise validation locations, regex flags/test sets, JWT header/payload/time interpretation, cron next-run lists/timezone, UUID versions, hash/HMAC file/text variants, URL/query helpers, diff options, Markdown preview/export and safe copy/download.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-07, C-EXP-09

**Constraints:** Inspection is not cryptographic verification where keys/signatures are absent; regex execution needs time/input bounds; developer outputs remain deterministic/local.

**Blocked by:** 164, 178, 179, 180, 181, 182, 196.

**Status:** completed

- [x] Ticket 196 records the original developer/text route audit and the concrete `ALREADY_COMPLETE`/`UPGRADED` decisions, while tickets 164/178–182 close the missing developer modes with bounded implementations.
- [x] Structured validators return exact diagnostic context where parsers provide it; naturally bidirectional encoders now expose reverse/swap modes, including raw-byte Base64/Base64url.
- [x] Text/diff/list upgrades were added only where semantics stay explicit (for example lexical fact-sensitive diff and disclosed transforms), while unsupported/ambiguous behavior fails closed instead of adding opaque switches.

**Verification:** Existing developer/text Gold plus focused regex worker, UUID RFC 9562, JWT temporal, timezone-aware cron, Base64 raw-byte, structured-parser and original-route audit suites cover the upgraded surface.
