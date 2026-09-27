# Deterministic core-engine spikes

Isolated TypeScript spikes for UtilityOS deterministic primitive engines. This
directory is deliberately framework-neutral and has zero third-party runtime
dependencies.

## Run

```sh
cd spikes/core-engines
deno task check
deno task test
deno fmt --check
deno lint
```

The tests use Deno's built-in test runtime plus the built-in
`node:assert/strict` compatibility module. Source modules themselves import no
Node, npm, JSR, HTTP, framework, server, or network package.

## Runtime assumptions

- source is standards-based ES modules written in strict TypeScript;
- browser/Web Platform primitives are preferred: `URL`, `URLSearchParams`,
  `TextEncoder`, `TextDecoder`, `crypto.subtle`, `btoa`/`atob`, `Date`, and
  `JSON`;
- no module performs I/O, fetches data, starts a server, reads environment
  variables, or owns mutable global state;
- results are deterministic for the declared semantics; locale-dependent
  sorting/tokenization is intentionally avoided;
- async behavior exists only for native Web Crypto digest operations.

## Deliberate ceilings

- `diffText` uses a straightforward LCS matrix and rejects matrices above
  1,000,000 cells with `DIFF_TOO_LARGE`; a production large-text diff should use
  a different algorithm and likely a worker.
- `addBusinessDays` means Monday-Friday only. Holiday calendars require
  versioned external data and belong elsewhere.
- Web Crypto digest is appropriate for in-memory values. Large-file incremental
  hashing needs a focused worker/library spike because `SubtleCrypto.digest` is
  not streaming.
- filename sanitization and rename planning are pure preview/planning
  primitives. Actual filesystem mutation and target-filesystem byte limits
  belong in a file adapter.
- JSON helpers validate JSON syntax only. They do not replace schema validation
  at real trust boundaries.
- profile-default resolution proves precedence, requested-field filtering,
  provenance, and sensitive-field suppression. Production integration should
  bind fields to the canonical Work Profile schema.

See `DESIGN.md` for the public seams and
`../../research/lanes/07-core-engine-spike-results.md` for promotion decisions
and verification receipts.
