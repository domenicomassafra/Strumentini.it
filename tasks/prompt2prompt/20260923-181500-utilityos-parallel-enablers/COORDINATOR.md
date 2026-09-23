# Prompt2Prompt coordinator — UtilityOS parallel enablers

Created: 2026-09-23T18:15:00+02:00

Repository: `/Users/domenico/Code/UtilityOS`

Run these lanes **in parallel** with the closure/spec/tickets lane.

They intentionally avoid canonical product/spec/design ownership and instead produce reusable technical assets that remain valuable even if the closure changes v1 scope.

## Parallel lanes

1. OSS/GitHub donor census and adoption matrix
2. Core deterministic engine spikes
3. Gold test-oracle and adversarial fixture factory
4. Heavy browser-tool dependency and WASM/PDF/image spike

## Shared constraints

- Do not edit `PRODUCT-SPEC.md`, `DESIGN.md`, `PRODUCT-MARKETING-CONTEXT.md`, `IMPLEMENTATION-PLAN.md`, `.scratch/utilityos-v1/issues/`, or any closure-lane output.
- Do not edit lane-04 design artifacts.
- Preserve concurrent changes and stage only lane-owned paths.
- Experimental code must live under `spikes/` until the closure/ticket DAG explicitly promotes it.
- Research must distinguish reusable source/library adoption from copying application code.
- Licenses, provenance, maintenance and security are first-class acceptance criteria.
- No vendoring/copying third-party source into production in this wave.

These lanes may commit their own disjoint paths to `main` if cleanly scoped.

