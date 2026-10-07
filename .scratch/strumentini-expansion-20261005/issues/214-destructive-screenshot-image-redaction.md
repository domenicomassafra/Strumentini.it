# 214 — Destructive screenshot image redaction

**What to build:** Add rectangle/pixel redaction that rewrites exported pixels with preview, multiple regions and pre-export undo; reversible overlay-only output must never count as redaction.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 213.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → qa-browser

- [x] Solid and pixelated redaction regions are applied inside the exact crop/rotate/tonal pixel pipeline before PNG export; solid mode overwrites source RGBA bytes rather than drawing a reversible UI overlay.
- [x] Export already passes the shared PNG signature/dimension verifier and is additionally rescanned for PNG `eXIf`/`tEXt`/`zTXt`/`iTXt` metadata chunks; a redacted export fails closed if any remain.
- [x] The canonical image-crop workspace supports multiple regions, pointer/touch drag placement, coordinate-entry keyboard alternative, per-region removal, undo and reset through the same bounded transform history.

**Verification:** `tests/image-transform-workspace.test.ts` proves destructive pixel replacement, multiple-region pipeline disclosure and deterministic undo/reset. Browser controls use Pointer Events plus native keyboard inputs; final integration acceptance covers the canonical 390px image-crop route and verified PNG download.
