# Gold oracle registry

This directory is the machine-readable correctness-oracle contract for Strumentini.it tools.

Stable source IDs and dated generated records created before the Strumentini.it rebrand retain the former `Strumentini.it` name where it records historical authority or provenance. Do not rename those identifiers without regenerating and re-certifying the evidence graph.

It deliberately separates:

- **normative sources** in `sources.json`;
- **tool/family oracle plans** in `registry.json`;
- **validation** in `validate.py`.

The version-controlled `sources.json`, `registry.json`, fixture `index.json`, and fixture payloads are the current authority. The original 200-candidate bootstrap was retired from the working tree; its historical implementation remains available in Git history. Never regenerate expected values from the implementation under test.

Expected values must come from published vectors, hand-worked literals, a second independent implementation, or explicit project policy. A future tool implementation must not generate its own expected values.

Run:

```bash
npm run certification:check
```

The certification check runs the existing fail-closed oracle/fixture validator before verifying the generated certification index without rewriting it. The validator rejects fewer than 80 registry entries, fewer than 25 fixture families, broken source references, missing fixture provenance, and missing/invalid indexed fixtures. For a standalone oracle/fixture check, run `python3 quality/oracles/validate.py`.
