# Offline FatturaPA oracle — issue #288

- Donor: [azuki-beans/fatturapa](https://github.com/azuki-beans/fatturapa), tag `v0.2.0` at commit `cd8263a59e4fd8dfc8fa564fda6935dfe5587f1c` (MIT, copyright 2026 azuki-beans). [PyPI 0.2.0](https://pypi.org/project/fatturapa/0.2.0/) released 2026-07-26. Last upstream push observed 2026-09-26; no upstream issues or PRs at verification on 2026-10-19. Alternative: [Truelite/python-a38](https://github.com/Truelite/python-a38) v0.1.8 (2024-01-10), Apache-2.0.
- Archived exact `fatturapa-0.2.0-py3-none-any.whl` in `quality/donors/fatturapa/` (11 KB), SHA-256 `7ad63dd1f7a8d0c7e362699ee99019fd00c3917de74e237c6a70515efea820cb`. Hash matches PyPI wheel and `SHA256SUMS`; upstream wheel embeds its full MIT LICENSE. Python >=3.11; no runtime or transitive dependencies (only the standard library). Wheel is redistributable under MIT with attribution/license preserved.
- PyPI attestation PEP 740 is present (GitHub publisher `azuki-beans/fatturapa`, workflow `publish.yml`). Independently verified the actual vendored bytes and signing identity using `uvx --from pypi-attestations pypi-attestations verify pypi --repository https://github.com/azuki-beans/fatturapa quality/donors/fatturapa/fatturapa-0.2.0-py3-none-any.whl` → `OK: fatturapa-0.2.0-py3-none-any.whl` (2026-10-19).
- CI uses Python 3.13.9 and installs this exact wheel with `pip --no-index --no-deps` after verifying its hash. The Vitest suite invokes the installed donor through `tests/fatturapa-oracle-288.py` via stdin. No network access or package download occurs when running the oracle or the tests; invoice files stay local.
- Comparison is intentionally limited to FPR12/FPA12. The donor does **not** handle FSM10: existing TypeScript-only fixture tests continue to cover simplified invoices. The TS browser parser checks namespace/version, rejects DTD/entities and reports typed invalid fields; the donor ignores namespaces and is **not** a validator. It does not validate AdE XSD or P7M signatures. The reference AdE 1.4 schemas in `quality/reference-data/italy/artifacts/119-fatturapa-v1.4/` and the anonymized XML fixtures are the corpus baseline.
- The donor formats amounts to 2 decimals and dates as `DD/MM/YYYY`; the adapter converts display values back to canonical values solely for comparisons. Except for unit prices (which preserve source precision up to 8 places), donor display rounding may lose higher precision. The TypeScript parser keeps original decimal precision and remains authoritative. When `ImportoTotaleDocumento` is absent, donor derives a value from VAT summaries and stamp duty; TypeScript deliberately returns `null` because that total was not explicitly declared. Regression tests document this difference. Donor payment extraction uses the first `DatiPagamento` block; the browser reads every block and remains authoritative for multiple blocks.
- The browser still parses XML locally; Python and wheel are CI-only. The new stamp duty and payment fields extend the TS result for independent comparison without replacing the original parser. No backend, uploads, XSD validation, P7M guarantees or browser wheel.

## Repeat locally and rollback

```sh
shasum -a 256 quality/donors/fatturapa/fatturapa-0.2.0-py3-none-any.whl
python3 -m venv /tmp/fatturapa-288-venv
/tmp/fatturapa-288-venv/bin/python -m pip install --no-index --no-deps quality/donors/fatturapa/fatturapa-0.2.0-py3-none-any.whl
PATH="/tmp/fatturapa-288-venv/bin:$PATH" npx vitest run tests/fatturapa-oracle-288.test.ts tests/italy-2026-consumers.test.ts --maxWorkers=1
```

Rollback: revert the issue #288 commit/PR, removing CI setup, adapter, regression corpus and wheel. The TypeScript local XML parser remains the runtime for all environments. No runtime deployment or persisted user invoices to migrate.
