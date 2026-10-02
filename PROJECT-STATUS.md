# StrumentiUtili.it — Current Project Status

Date: **2026-10-03**

This is the short, live map of the repository. It exists so old worker waves, ticket ledgers and handoffs cannot be mistaken for the current project state.

## Canonical repository state

- Checkout: `/Users/domenico/Code/StrumentiUtili.it`
- Branch: `main`
- Current checkpoint before this closure tranche: `aaa0c7f` (`certify pdf/document batch (20 Gold) and repair browser acceptance Italian copy`)
- Local `main` and `origin/main`: aligned at audit time
- Remote branches: only `main`
- Worktrees: one primary worktree only
- Stashes: none
- Active WIP branches: none
- Deliberate archive tags: three, all prefixed `archive/2026-09-24-` and explicitly not active work (`performance-wip`, `a11y-wip`, `browser-acceptance-wip`).

Historical worker branches are already merged into `main` or deleted. `.scratch/` and `tasks/prompt2prompt/` are provenance, not queues.

## Product / code state

- Astro 7 + Preact + TypeScript, static build.
- 200 manifest-backed public tool routes; 200 corresponding tool pages.
- Normal tools execute locally/deterministically; all current catalog entries are local-runtime tools.
- Generated Tool Factory catalog and lazy tool loaders feed the runtime registry.
- Workbench and Work Profile persist locally through IndexedDB.
- Onboarding, Library and search use catalog + certification metadata.
- 35 tools consume Work Profile fields.
- 71 tools expose typed handoff metadata.
- No exact duplicate implementation/page/component copies were found in the main tool surface audit.

## Quality frontier

Machine authority: `quality/receipts/expanded-catalog-certification.json`.

- **119 Gold**
- **1 Partial**: `image-resize`
- **80 Implemented Unverified**
- 200/200 bound to oracle + fixture authorities
- Fresh automated checkpoint: **334/334 tests across 48 files**
- `astro check`: **0 errors / 0 warnings / 0 hints**
- Static build: **204 pages**, build inspection PASS

Remaining implemented-unverified engines:

| Engine | Remaining |
|---|---:|
| research-knowledge | 20 |
| file-privacy | 19 |
| image | 14 |
| url-marketing | 12 |
| image-visual | 5 |
| text-writing | 4 |
| marketing-math | 3 |
| qr-local | 2 |
| date-time | 1 |

The PDF/document family is already 20/20 Gold.

## Release status

`scripts/validate-release.ts --no-write-receipt` returns **BLOCKED, not failed**: 0 errors, 6 blockers.

1. browser evidence source fingerprint is stale;
2. 80 tools are missing Gold certification receipts;
3. `image-resize` is not Gold;
4. physical Android Chrome evidence for `image-resize` is missing;
5. physical iOS Safari evidence for `image-resize` is missing;
6. rollback remains explicitly unproven before a verified deployment/rollback exercise.

Do not synthesize external browser/device/rollback evidence.

## Real technical debt still worth addressing

- The old `scripts/build-catalog.ts` / `scripts/lib/catalog-compiler.ts` path is legacy beside the active Tool Factory generator; its remaining consumers and generated-banner wording need consolidation in a source-changing tranche.
- The Library contains a visible “Richiedi questo strumento” affordance whose submission is intentionally not wired. It should either gain a real bounded destination or be removed.
- Tool Factory and legacy catalog manifest schemas overlap; the legacy summary path drops richer metadata and should be consolidated before adding non-local/runtime variants.
- Some Factory indexes/inventories are produced but not consumed by the product outside tests; either make them canonical inputs or remove the dead surface.
- A historical unreachable performance/catalog WIP series and accessibility-hardening commit were discovered during Git closure. They must be reviewed/salvaged before irreversible Git object pruning; see the closure record in `docs/history/` once finalized.
- The old `quality/receipts/catalog-performance.json` was not valid evidence for current `main`: it described projected generated catalogs and `src/engines/table/io.ts` that only existed in the orphaned performance WIP. It has been moved to `docs/history/2026-09-24-catalog-performance-wip-receipt.json` and must not be used as a current PASS receipt.

## UI/UX / brand audit

The public name **StrumentiUtili.it** is already coherent and should remain unless the owner explicitly decides otherwise. The useful rebrand is visual/verbal, not necessarily a rename.

Keep: warm light/dark palette, restrained red accent, Archivo + Source Sans 3 + Mono, thin rules, compact professional density, centralized icons, visible focus and reduced-motion support.

Change in the next design tranche:

- reduce the literal accounting-ledger language (`registro`, `libro delle scritture`, accountant/red-pen framing) and move toward a precise **workbench / ready tools** identity;
- simplify navigation to a stable Workbench + Library model with one search paradigm;
- make Library search-first, collapse 13 internal categories into 5–7 public groups, and move secondary filters behind an advanced disclosure;
- replace public internal jargon such as `Gold`, `contratto operativo`, `utilità deterministica` with user language (`Verificato`, `In verifica`, `Come funziona`, `Locale`);
- fix tool-route active navigation and breadcrumb/category semantics;
- finish Italian UI cleanup in the file/privacy and research wrappers;
- make icons operation-first (compare, convert, extract, clean, inspect, generate, calculate), not only file-type-first;
- use 16px form/body text and >=44px primary controls on touch/coarse-pointer layouts.

Suggested top-level message: **“I tuoi strumenti, già pronti.”**

## Authority map

- `PROJECT-STATUS.md` — current repository/product snapshot and closure map.
- `HANDOFF.md` — operational handoff and product direction.
- `ROADMAP.md` — current priorities.
- `PRODUCT.md` / `PRODUCT-SPEC.md` — product contract and acceptance criteria, not volatile status counters.
- `quality/receipts/expanded-catalog-certification.json` — machine-readable global certification truth.
- `DESIGN.md`, `docs/05-brand-positioning.md` — structural/brand constraints; `design/WORLD.md` records the current ledger visual experiment but is now subject to the 2026-10-03 UI/UX audit above.
- `.scratch/`, `tasks/prompt2prompt/`, `docs/history/` — historical provenance only.

## Next source-changing tranche

Do not mix it with this documentation/WIP closure. Source/test/script changes alter the evidence fingerprint and therefore require deliberate recertification. The next tranche should combine only compatible work: salvage the valuable orphaned performance/a11y deltas, remove dead catalog plumbing, fix the fake request CTA and then run the full certification/build/browser evidence flow before committing.
