# STR-289 — Registro donor Office e dati (20 ottobre 2026)

Allegato del [report funzionale STR-289](reuse-office-data-289-2026-10-20.md). Nessuna adozione nasce da questo registro. `checkedAt: 2026-10-20`; base `origin/main` `885bc875801907ce418b60a73943c9874e3d51b2`.

## Candidati e donor osservati

**Metodologia:** ★ = `stargazers_count` restituito il **20/10/2026** da `GET /repos/{owner}/{repo}` della GitHub REST API; sulle librerie originarie GitLab le stelle sono del **mirror GitHub**, non dell'upstream ufficiale. Licenza = SPDX `license.spdx_id` GitHub osservata o licenza del tarball/pin già documentata nel repository quando l'API segnala `NOASSERTION`; non considerare questa etichetta un parere legale. Versioni installate = `package.json` + `package-lock.json` al commit sopra; versioni candidate/tag e date dell'ultima release **dall'audit primario 19/10 o dai donor doc 20/10**, indicati come tali, senza asserire una nuova scansione npm release. Runtime `B` browser, `W` Cloudflare Worker JS candidato **non collaudato**, `N` Node, `P` Python, `BW` browser WASM. Una compatibilità teorica non costituisce acceptance consumer.

| Donor (fonte) | ★ (REST 20/10) | Versione osservata / licenza | Runtime / stato sul prodotto |
|---|---:|---|---|
| [PapaParse](https://github.com/mholt/PapaParse) | 13.590 | **installato 5.7.0** MIT; release 2026-08-24 (audit 19/10) | B/N; **TIENI**, import esistente (dichiarato `devDependency` ma incluso nei moduli bundle) |
| [fflate](https://github.com/101arrowz/fflate) | 3.059 | **installato 0.8.3** MIT; release 2026-05-16 | B/N; **TIENI** OOXML/archivi |
| [read-excel-file](https://gitlab.com/catamphetamine/read-excel-file) ([mirror](https://github.com/catamphetamine/read-excel-file)) | 330 mirror | **installato 9.3.10** MIT; candidata release 9.3.12 (audit 19/10) | B/N; **TIENI** value-only |
| [write-excel-file](https://gitlab.com/catamphetamine/write-excel-file) ([mirror](https://github.com/catamphetamine/write-excel-file)) | 34 mirror | **installato 4.1.1** MIT; release 2026-06-08 | B/N; **TIENI** writer una sheet |
| [docx](https://github.com/dolanmiu/docx) | 5.965 | **installato 9.12.0** MIT; release/tag 2026-10-16, [fonte #290](donor-docx-290-2026-10-19.md) | B/N; **ADOTTATO** writer semantico; #290 |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | 3.138 | **installato 5.11.2** MIT, release 2026-09-29, [fonte #291](donor-fast-xml-parser-291.md) | B/N; **ADOTTATO** nel solo XML tabellare; #291 |
| [smol-toml](https://github.com/squirrelchat/smol-toml) | 316 | **installato 1.9.1** BSD-3-Clause, release 2026-10-09, [fonte #277](donor-smol-toml-277.md) | B/N; **ADOTTATO** lazy; #277 |
| [Turndown](https://github.com/mixmark-io/turndown) | 11.479 | **installato 7.2.4** MIT, release 2026-04-03, [fonte #293](donor-turndown-293.md) | B/N (route B); **ADOTTATO** HTML→Markdown; #293 |
| [yaml](https://github.com/eemeli/yaml) | 1.697 | **transitivo 2.9.1** ISC; release 2026-09-11 (doc #275/#276) | B/N; **NO_GO** formatter/converter, senza import produttivo |
| [ExcelJS](https://github.com/exceljs/exceljs) | 15.489 | candidato v4.4.0 MIT (release 2023-10-19, audit storico) | B/N; **NON ADOTTATO** per promessa workbook/fidelity #146/#148 |
| [SheetJS CE](https://github.com/SheetJS/sheetjs) | 36.344 | CE 0.20.3 upstream / **spike npm 0.18.5**, Apache-2.0 CE; caveat canali diversi | B/N; **NO_GO** perdita 2 media + 1 chart e npm legacy, [#130](donor-spreadsheets-370-2026-10-11.md) |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) | 6.328 | candidato 1.13.0 BSD-2-Clause (npm 2026-09-26 audit) | B/N; **NO_GO** rich fidelity / HTML non sanificato #128 |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | 6.294 | candidato 4.0.1 MIT (release 2025-06-26 audit) | B/N; **NO_GO** rich fidelity #128 |
| [arquero](https://github.com/uwdata/arquero) | 1.542 | candidato 8.0.3 BSD-3-Clause, release 2025-05-29 | B/N; **NON ADOTTATO**, #292 closed con donor assente |
| [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm) | 2.144 | candidato GitHub 1.33.0 MIT (audit 19/10) | BW/N; **RINVIA** #150, limite memoria e download estensioni da verificare |
| [AG Grid](https://github.com/ag-grid/ag-grid) Community | 15.647 | candidato release-36.2.0, **MIT solo Community** (fonte storica; API license `NOASSERTION`) | B UI; **RINVIA** #148; Enterprise fuori licenza di questo audit |
| [Univer](https://github.com/dream-num/univer) OSS | 22.688 | candidato 1.1.0, Apache-2.0 OSS (audit 19/10) | B UI; **RINVIA** #148, servizi premium separati |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | 2.409 | candidato 3.15.0 ISC da metadata npm storico; GitHub SPDX `NOASSERTION` | B/N; **TIENI** parser owner, upstream #171 output invalido |
| [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) | 5.349 | candidato 0.7.6 MIT (audit 19/10) | B/N; **TIENI** diff owner e sue semantiche |
| [AJV](https://github.com/ajv-validator/ajv) | 14.863 | candidato 8.20.0 MIT (audit 19/10) | B/N; **TIENI**, validate ≠ infer schema |
| [Marked](https://github.com/markedjs/marked) | 37.250 | candidato 18.1.1 MIT npm (audit; GitHub SPDX `NOASSERTION`) | B/N; **TIENI**, non sanifica HTML |
| [sql.js](https://github.com/sql-js/sql.js) | 13.675 | candidato 1.15.0 MIT npm (audit; GitHub SPDX `NOASSERTION`) | BW/N; **TIENI** export SQL semplice, nessun DB in browser |
| [zip.js](https://github.com/gildas-lormeau/zip.js) | 3.900 | candidato 2.24.0 BSD-3-Clause (audit 19/10) | B/N; **TIENI** `fflate` presente |
| [OpenPyXL](https://pypi.org/project/openpyxl/) | n.d. (fonte ufficiale PyPI) | candidato/oracle 3.1.5 MIT (PyPI 2024-06-28 storico) | P; **solo oracle indipendente** XLSX, non runtime browser |
| [python-docx](https://github.com/python-openxml/python-docx) | 5.746 | candidato/oracle 1.2.0 MIT (PyPI 2025-06-16 storico) | P; **solo oracle indipendente**, non backend |
| [python-pptx](https://github.com/scanny/python-pptx) | 3.559 | candidato/oracle 1.0.2 MIT (PyPI 2024-08-07 storico) | P; **solo oracle**, non runtime browser |
| [pandas](https://github.com/pandas-dev/pandas) | 50.247 | candidato 3.0.6 BSD-3-Clause (snapshot 19/10) | P; **RINVIA** #150, backend non implementato |
