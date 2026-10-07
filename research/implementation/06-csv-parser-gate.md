# Ticket 06 — CSV parser gate

Decision: **Papa Parse 5.7.0** for the first browser-local CSV vertical.

- Papa Parse 5.7.0 — MIT, zero direct runtime deps, current donor census marks active; explicit browser File/stream/Web Worker support; malformed quotes expose `MissingQuotes`; minified browser comparison bundle measured about 19.6 KB.
- csv-parse 7.0.2 — MIT, zero direct runtime deps, actively maintained, strong TypeScript/browser ESM entry and stricter parse defaults; equivalent minified browser comparison bundle measured about 52.1 KB.
- Root `npm audit` at selection time: 0 vulnerabilities.
- Both candidates match the canonical RFC-style exact vectors and reject/flag the malformed-quote adversarial case.

Papa wins this bounded v1 lane because browser streaming/abort ergonomics and the materially smaller browser bundle outweigh csv-parse's stronger type surface. Strumentini.it does not trust Papa's permissive defaults: the production wrapper promotes quote errors to typed fatal failures, preserves duplicate headers as warnings, flags ragged rows, and independently reparses cleaned output to prove cell semantics were not changed.

The losing `csv-parse` evaluation dependency was removed from the shared package files after integration; the decision remains recorded here and in Git history.
