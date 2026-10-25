# #458 — New-route acceptance inventory

Authority: [#458](https://github.com/domenicomassafra/Strumentini.it/issues/458) and the [original AC-046](10-tool-expansion-result-system-v2.md). The immutable original set is the **200 unique IDs** in `quality/functional-audit/original-200.assignments.json`, not the first 200 alphabetically sorted manifest rows. The current catalog is rebuilt from `src/tools/*/manifest.ts` by the existing tool factory.

Run on the Mac Studio, in this issue's Orca worktree, through the existing resource guard:

```sh
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- npm run catalog:build
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- npm run build
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- python3 -B scripts/audit-expansion-routes-458.py --write
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- python3 -B scripts/audit-expansion-routes-458.py --check
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- node scripts/acceptance-expansion-routes-458.mjs
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- node scripts/acceptance-expansion-routes-458.mjs --http-only
python3 /Users/domenico/.local/share/controlcenter/resource-guard/workload_launcher.py --max-wait 300 build -- node scripts/acceptance-expansion-operations-458.mjs
```

The browser runner connects directly to a page-target CDP WebSocket in the
dedicated Studio automation Chrome (`http://127.0.0.1:17630`, or
`STRUMENTINI_ACCEPTANCE_CDP` for another authorized endpoint). Playwright's
browser-wide CDP handshake can time out on this shared Chrome even though a
page-target connection works. The runner creates one tab, reuses it across all
74 routes and closes it; it does not create a separate Chrome profile.
The `--http-only` mode independently reopens each compiled file and compares its
SHA-256 with the local HTTP response without opening a browser. Its output explicitly
marks browser, operations, export and physical checks `NOT_RUN`; it is useful when
the shared Chrome refuses CDP page-domain initialization and cannot substitute
for acceptance with user inputs or network observation.

The generated, source-bound matrix lives in `quality/expansion-458/routes-*.jsonl` (each file below 20 KB) and `summary.json`. `--check` detects source drift and obsolete matrix partitions; `--write` replaces only its own obsolete route partitions. The 274-entry legacy certification index is indexed by stable tool ID and never treated as a live Gold claim. Every row includes manifest/engine/runtime, oracle and fixture identities, indexed provenance, test references, historical receipt, compiled route byte digest and explicit gaps.

A compiler's presence, checked-in test path, historical receipt hash, runtime declaration or route HTTP 200 cannot prove an operation. The smoke test checks the real compiled HTTP route, byte-for-byte SHA-256 identity of the reopened `dist` HTML and its served HTTP response, runtime declaration, initial network requests (blocking offsite and non-read requests) and mobile overflow for all delta entries. Its own output marks positive operations, refusals and exports `NOT_RUN`, as they require the separate operation runner. Physical mobile and Gold remain `NOT_RUN`/`NO_GO`. This report does not change `#457`, Gold records, original-200 inventory, withdrawn donor decisions, the PDF engine, or the release gate. Deploy requires #162 admission.

The operation runner verifies a representative compiled route in each of the 18 new engines with one positive and one refusal/unsafe-input scenario. It uses the dedicated Chrome page-target CDP socket, native pointer dispatch, original synthetic fixture files and a request interception log. The `research-reference` route is the sole declared reference-only exception: its public-IP lookup is deliberately triggered, then blocked by the test harness, and the user-facing failure is observed. `--only=<engine-or-id>` selects a diagnostic case. The printable-PDF example reads the exported blob back from disk with independent PDF.js parsing, checking page count and content. These browser probes are current per-family evidence; **they do not convert the remaining 15 historic receipt gaps, 4 test-file mapping gaps, all 74 per-tool positive/refusal gaps, or physical/release NO_GO into passes**.
