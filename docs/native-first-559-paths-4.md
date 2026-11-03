# Native-first #559 — path inventory 4/5

Source review completed 2026-11-03, per file SHA and native behavior below; source references: [main inventory](native-first-559-inventory.md).

| Path | Tool/category | Class | Source check (2026-11-03) |
| --- | --- | --- | --- |
| `scripts/acceptance-office-print-56.browser.mjs` | Product acceptance | GAP |
| `scripts/acceptance-onboarding.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `5019a4dce9` |
| `scripts/acceptance-original-200-result-v2-457.mjs` | Node subprocess/CLI | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `1a7a5dee0f` |
| `scripts/acceptance-partita-iva-vies.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `bf3c579be4` |
| `scripts/acceptance-password-security.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `f0530275c5` |
| `scripts/acceptance-password-strength-donor-304.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `bdf00fcec3` |
| `scripts/acceptance-pdf-booklet-interleave-251.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `a3de57bd4a` |
| `scripts/acceptance-pdf-comparison.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `aab6812429` |
| `scripts/acceptance-pdf-engine-369.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `c4059545b6` |
| `scripts/acceptance-pdf-export-compression.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `d686d04ee2` |
| `scripts/acceptance-pdf-fill-overlays-243.ts` | Product acceptance | GAP |
| `scripts/acceptance-pdf-form-flatten.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `e2c514627e` |
| `scripts/acceptance-pdf-image-aware-218.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `2e583c40a7` |
| `scripts/acceptance-pdf-page-reorder-strict.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `21a6b5a14d` |
| `scripts/acceptance-pdf-page-selection.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `784897c931` |
| `scripts/acceptance-pdf-project-138.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `952d77584e` |
| `scripts/acceptance-pdf-redaction-237-dev.browser.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `d4ab6f5726` |
| `scripts/acceptance-pdf-repair-418.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `a1a4cda63c` |
| `scripts/acceptance-pdf-repair-418.ts` | Node subprocess/CLI | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `11a3bc5ed4` |
| `scripts/acceptance-pdf-rotated-236.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `4788e8cc6c` |
| `scripts/acceptance-pdf-search-markdown.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `23ed5b3275` |
| `scripts/acceptance-pdf-size-split-249.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `cf8e4ddd3f` |
| `scripts/acceptance-pdf-table-xlsx-254.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `1ab08d5aec` |
| `scripts/acceptance-pdf-target-batch-219.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `1754f32cef` |
| `scripts/acceptance-pdf-text-stale-result.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `9a55e358dc` |
| `scripts/acceptance-pdf-thumbnails.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `64342e9ff3` |
| `scripts/acceptance-pdf-upgrades.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `d36befc7d0` |
| `scripts/acceptance-pdf-visual-signature-241.ts` | Product acceptance | GAP |
| `scripts/acceptance-pdf-workspace-372.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `9f5fb3deb8` |
| `scripts/acceptance-pdf.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `880c32efef` |
| `scripts/acceptance-printable-pdf-256.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `26cf356927` |
| `scripts/acceptance-printable-pdf-all-pages-256.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `67e69456bb` |
| `scripts/acceptance-qr-reader-279-safari.mjs` | Node subprocess/CLI | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `fa5b5b5965` |
| `scripts/acceptance-qr-reader-279.mjs` | Node subprocess/CLI | GAP | Native Node net/HTTP fixture and Playwright; domain-specific browser assertions; source SHA256 `b30e15f24c` |
| `scripts/acceptance-research-knowledge.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `db5c4c0769` |
| `scripts/acceptance-result-accessibility.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `eff5975335` |
| `scripts/acceptance-result-operation-control.ts` | Product acceptance | GAP |
| `scripts/acceptance-result-state-matrix.tsx` | Product acceptance | GAP |
| `scripts/acceptance-result-v2-a11y.tsx` | Product acceptance | GAP |
| `scripts/acceptance-result-v2-conformance.ts` | Product acceptance | GAP |
| `scripts/acceptance-result-v2-exemplars.ts` | Product acceptance | GAP |
| `scripts/acceptance-result-v2-performance.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `160c162172` |
| `scripts/acceptance-result-v2-privacy-network.ts` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `d93eb3df47` |
| `scripts/acceptance-str-375-crop.ts` | Node subprocess/CLI | GAP | native subprocess tool used directly; product-specific exit check, fixture or receipt; source SHA256 `eea3c6be91` |
| `scripts/acceptance-str-375.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `fa1d059c69` |
| `scripts/acceptance-subtitle-transform.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `46925c962b` |
| `scripts/acceptance-svg-donor-059.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `b9b5762940` |
| `scripts/acceptance-table-handoff.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `49bbee4c84` |
| `scripts/acceptance-telemetry.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `a074357eb7` |
| `scripts/acceptance-text-data-certification.ts` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `7339066a83` |
| `scripts/acceptance-text-diff-300.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `07a7de9170` |
| `scripts/acceptance-text-markup-converter.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `92e3e8aa41` |
| `scripts/acceptance-text-research.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `ea7e75c1f9` |
| `scripts/acceptance-text-writing.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `556cc138f5` |
| `scripts/acceptance-turndown-293.mjs` | Product acceptance | GAP |
| `scripts/acceptance-url-marketing-upgrades.mjs` | Product acceptance | GAP |
| `scripts/acceptance-user-agent-281.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `7acd578460` |
| `scripts/acceptance-video-transform-bounds-234.browser.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `ca9a4c864e` |
| `scripts/acceptance-xml-adoption-291.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `1659160298` |
| `scripts/acceptance/browser-performance-matrix.mjs` | Playwright/HTTP server | GAP | Python stdlib HTTP server + Playwright; standalone browser assertions, fixtures and receipts (native Playwright webServer requires runner migration); source SHA256 `cf468d9ca3` |
| `scripts/acceptance/browser-performance-siblings.mjs` | Node subprocess/CLI | GAP | Node child_process used directly; product-specific exit check, fixture or receipt; source SHA256 `3a3c35b1e5` |
| `scripts/acceptance/browser-performance-verdict.mjs` | Product acceptance | GAP |
| `scripts/arquero-browser-gate-292.mjs` | Node subprocess/CLI | GAP | Native Node net/HTTP fixture and Playwright; domain-specific browser assertions; source SHA256 `117cf3dd2c` |
| `scripts/arquero-built-ui-gate-292.mjs` | Node subprocess/CLI | GAP | Native Playwright browser API; product-specific fixture, assertions or matrix; source SHA256 `0f1ca9d4e6` |
| `scripts/arquero-gate-292.mts` | Source certification/build | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `c1b2721b1f` |
| `scripts/audit-expansion-routes-458.py` | Source certification/build | GAP | Python standard APIs; deterministic domain fixture or check; source SHA256 `497f03fb3e` |
| `scripts/audit-gold-source-binding-347.ts` | Source certification/build | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `f93f33e303` |
| `scripts/audit-legacy-result-primary.ts` | Source certification/build | GAP | Node native fs/crypto/JSON; product-specific source, artifact or provenance verification; source SHA256 `b8f3168e3d` |
