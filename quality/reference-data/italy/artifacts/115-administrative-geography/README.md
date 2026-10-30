# Frozen official geography inputs (#115, #500)

The original ISTAT/SITUAS and ANPR textual inputs are tracked as `.json.gz`,
`.csv.gz` and `.md.gz`. The two original ISTAT `.xlsx` workbooks remain
unchanged, because XLSX is already a ZIP container. Each gzip was created
with a fixed zero timestamp; decompression returns the exact source bytes.

The original filenames and SHA-256 hashes are pinned in:

- `quality/reference-data/italy/115-administrative-geography-evidence.json`
- `quality/reference-data/italy/115-situas-date-exact-20261010-evidence.json`
- `quality/reference-data/italy/115-anpr-historical-supplement-evidence.json`

The normalized JSON snapshots deliberately retain **original logical
source paths** and hashes. At build time, `scripts/lib/read-official-input-500.mjs`
reads the corresponding `<original path>.gz` and verifies the original bytes
through the three existing generators. No download is needed. The archive
does not change source licences or the limitations of their date coverage.

From the repository root, with Node 26 and dependencies installed:

```sh
gzip -dc quality/reference-data/italy/artifacts/115-administrative-geography/situas-date-exact-20261010/situas-51-1900-01-01.json.gz | shasum -a 256
node scripts/build-italy-geography-115.mjs --check
node scripts/build-italy-geography-115-date-exact-20261010.mjs --check
node scripts/build-anpr-historical-115.mjs --check
```

The pinned original hash for that example is
`bf0686aa6759fbba1f2015d383c95bf86ad7fcb4a0014219b99e8d193be655ee`.
Omit `--check` to regenerate the same normalized snapshots offline.
