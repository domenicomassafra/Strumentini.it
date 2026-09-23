# 02 — Local Workbench, Work Profile, and portable configuration

**What to build:** Turn the single Gold tracer into a persistent local Personal Workbench: Your Tools first, Recent without raw task content, add/remove/reorder, versioned local state, Work Profile editing/provenance, safe override behavior, and versioned export/import of configuration with non-destructive validation failure. Keep the entire experience account-free.

**Traces to:** US-03 / AC-03.1 / AC-03.2 / AC-03.3 / AC-03.4 / US-06 / AC-06.1 / AC-06.2 / AC-06.3 / US-09 / AC-09.1 / AC-09.2 / AC-09.3 / US-14 / AC-14.2 / DEC-01 / DEC-02 / DEC-07 / DEC-14 / DEC-20

**Constraints:** C-02 / C-03 / C-05 / C-07 / C-13 / C-15 / C-16 / C-20 / C-22

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** ready-for-agent

- [ ] Workbench opens with Your Tools as primary content; the full Library is not rendered by default and no KPI/streak/dashboard furniture is added.
- [ ] Installed state and manual ordering survive reload through a versioned persistence interface; raw IndexedDB handles do not leak into feature callers.
- [ ] Recent stores tool-level activity only by default and can be cleared; no pasted text, files, URLs, or calculation inputs are silently retained.
- [ ] Work Profile exposes only canonical safe fields, shows “from Work Profile” provenance at use sites, and explicit current-task overrides remain authoritative.
- [ ] Storage-denied/quota failure preserves current in-memory use/result and displays a recoverable persistence warning rather than failing the tool.
- [ ] Export produces a versioned configuration containing installed tools, pack selections when present, order/layout, safe profile values, and preferences but no task files/input/output.
- [ ] Import validates schema/version, previews material changes, applies atomically, and leaves existing local state unchanged on malformed/unsupported input.
- [ ] Add/remove/reorder, profile edit, export, and import are keyboard-operable and meet the current mobile/touch affordance contract.
- [ ] There is no account, sync status, disabled login placeholder, or server dependency in this slice.

**Verification:** Run unit/integration tests through the persistence and Work Profile public seams, browser acceptance covering reload/add/remove/reorder/profile override/export/import, storage-denial/quota failure injection, and an exported-artifact inspection proving task content is absent.
