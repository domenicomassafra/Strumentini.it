# Gold oracle registry

This directory is the machine-readable correctness-oracle contract for Strumentini.it tools.

Stable source IDs and dated generated records created before the Strumentini.it rebrand retain the former `StrumentiUtili.it` name where it records historical authority or provenance. Do not rename those identifiers without regenerating and re-certifying the evidence graph.

It deliberately separates:

- **normative sources** in `sources.json`;
- **tool/family oracle plans** in `registry.json`;
- **validation** in `validate.py`.

Expected values must come from published vectors, hand-worked literals, a second independent implementation, or explicit project policy. A future tool implementation must not generate its own expected values.

Run:

```bash
python3 quality/oracles/validate.py
```

The validator fails closed if the registry has fewer than 80 entries, the fixture index has fewer than 25 families, source references are broken, fixture provenance is missing, or indexed fixture files are absent/invalid.
