# 326 — File privacy secret and metadata-risk upgrades

**What to build:** Deepen secret-token scanner, metadata-risk inspector and safe-share checklist with evidence-based findings, local-only disclosure and explicit false-positive/unsupported scope.

**Traces to:** US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 96 — Migrate file privacy shared renderers to Result v2.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → inclusive-design

- [x] Secret and text-metadata findings expose local file/line/column/category evidence while returning only redacted or categorical evidence; no source content is sent to a network service.
- [x] Secret-pattern results carry `classification: potential` / `evidenceCategory: potential-secret-pattern` and explicitly state that a pattern match is not confirmation of a real credential.
- [x] Safe-share combines detected file facts with two explicit, non-persisted user confirmations for intended recipient/audience and sensitive-context review; the result remains guidance rather than a safety guarantee.

**Verification:** `tests/file-privacy-engine.test.ts` covers redacted exact spans/categories, metadata evidence categories, clean/flagged checklist paths and explicit user context. All operations remain inside the existing LOCAL/network-forbidden file-privacy routes and shared Result v2 workspace.
