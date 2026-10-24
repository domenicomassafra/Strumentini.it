# #458 — New-route acceptance inventory

Authority: [#458](https://github.com/domenicomassafra/Strumentini.it/issues/458) and the [original AC-046](10-tool-expansion-result-system-v2.md). The immutable original set is the **200 unique IDs** in `quality/functional-audit/original-200.assignments.json`, not the first 200 alphabetically sorted manifest rows. The current catalog is rebuilt from `src/tools/*/manifest.ts` by the existing tool factory.

Run on the Mac Studio, in this issue's Orca worktree, through the existing resource guard:

```sh
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py build -- npm run catalog:build
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py build -- npm run build
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py build -- python3 -B scripts/audit-expansion-routes-458.py --write
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py build -- python3 -B scripts/audit-expansion-routes-458.py --check
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py build -- node scripts/acceptance-expansion-routes-458.mjs
```

The generated, source-bound matrix lives in `quality/expansion-458/routes-*.jsonl` (each file below 20 KB) and `summary.json`. `--check` detects source drift by byte comparison. The 274-entry legacy certification index is indexed by stable tool ID and never treated as a live Gold claim. Every row includes manifest/engine/runtime, oracle and fixture identities, indexed provenance, test references, historical receipt, compiled route byte digest and explicit gaps.

A compiler's presence, checked-in test path, historical receipt hash, runtime declaration or route HTTP 200 cannot prove an operation. The smoke test checks the real compiled HTTP route, runtime declaration, initial network requests and mobile overflow for all delta entries; **positive input, refusal, independent exported-byte/file readback, physical mobile and Gold remain NOT_RUN** until separate executable evidence supports them. This report does not change `#457`, Gold records, original-200 inventory, withdrawn donor decisions, the PDF engine, or the release gate. Deploy requires #162 admission.
