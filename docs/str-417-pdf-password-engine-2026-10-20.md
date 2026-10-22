# STR-417 — motore PDF con password legittima

Data ricerca e verifica: **20 ottobre 2026**. Ticket [#170](https://github.com/domenicomassafra/strumentini-it/issues/170); dipendenza [#129 / STR-369](https://github.com/domenicomassafra/strumentini-it/issues/129) chiusa. La decisione storica **REFUSED** per #242 e #320 resta storica; questa è una nuova implementazione, senza ripristinare PDFStudio/QPDF ritirati in #126.

## Riuso, fonti e licenze

| Candidato | Versione / fonte primaria | Licenza e decisione |
| --- | --- | --- |
| [PDFSmaller encrypt](https://github.com/smither777/pdf-encrypt) | npm `@pdfsmaller/pdf-encrypt@1.2.0`; upstream `2b085fafdc240e85827fd3ef552faa3595d66e4a` (28 luglio 2026) | MIT, `LICENSE` incluso; **ADOPT** limitato alla scrittura AES-256 R6. Versioni 1.0.x dichiarate difettose dal maintainer, non usate. |
| [PDFSmaller decrypt](https://github.com/smither777/pdf-decrypt) | npm `@pdfsmaller/pdf-decrypt@1.0.1`; upstream `c2c328a71be852f0d3e4bb10f5be6262ef3cc524` (25 febbraio 2026) | MIT, `LICENSE` incluso; **ADOPT** lettura AES-256 e vecchi RC4 con credenziale corretta. AES-128 non supportato, rifiuto. |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | dipendenza già presente `1.17.1` | MIT; il core non implementa crittografia. È il peer già installato dei due moduli. |
| [qpdf](https://github.com/qpdf/qpdf) / [PDFStudio](https://github.com/fayazara/pdfstudio) | donor WASM ex #126; consultare `docs/str-294-qpdf-donor-evaluation-2026-10-19.md` | QPDF Apache-2.0, ma provenienza binaria/transitive NOTICE non completamente verificati: **NO_ADOPT**. |
| [MuPDF](https://mupdf.com/) / [pikepdf](https://github.com/pikepdf/pikepdf) | alternative già valutate in #369 | MuPDF AGPL/commerciale senza licenza: **NO_ADOPT**; pikepdf MPL-2.0 richiederebbe clearance e runtime server: **NO_ADOPT**. |

I due moduli PDFSmaller non hanno dipendenze runtime proprie; entrambi dichiarano `pdf-lib` peer già presente. Tarball npm esatti fissati nel `package-lock.json` con integrità SHA-512:

- encrypt 1.2.0: `sha512-fIS3Ld+hOpoxmwmgoAnPjVC+9CN6/wbineumJ9ZOlJXZcuXft8OvdcSGqUDCpRSVJilrhYHsnJg626j06eM85g==`
- decrypt 1.0.1: `sha512-UO5KyC+jvcXPTuxfTcEDODHBqO5+YFyuYz/f8tQfiRw5hqZTYTh0ea72OjGw6kuYEUiCyT+A/Ymg2A948Vwx0w==`

Le rispettive licenze MIT risultano dai file LICENSE reali estratti. L'identità del pacchetto, i tag upstream e il corretto funzionamento della coppia non costituiscono un audit crittografico indipendente dell'intero sorgente. Nessuna dipendenza GPL, LGPL, MPL o AGPL viene aggiunta da STR-417.

## Contratto ammesso

- Input e output locali, senza backend o network, password inserita dall'utente e mai conservata nel profilo. Protezione obbligatoriamente AES-256 R6 Web Crypto; nessuna generazione RC4 o downgrade automatico.
- Sblocco soltanto con user/owner password valida per AES-256/RC4 supportati; senza password, solo copia già in chiaro. Errore netto su password assente/errata, formato non supportato (compreso AES-128), PDF non valido e doppia protezione.
- File 8 MiB e risultato 24 MiB al massimo, input a firma `%PDF-`, passphrase massimo 127 byte UTF-8; in browser il parsing avviene in Worker terminato su annullamento o dopo 20 s. Gli originali non sono alterati.
- Nessuna promessa di preservazione di firme PDF digitali, allegati, form avanzati, PDF ibridi/xref-stream, resa visuale identica o enforcement dei flag di stampa/copia. Password AES-256 **non** è redazione sicura.

## Prove e limiti

Prova preliminare MiniPC Node 26.12.0, input `quality/fixtures/pdf-gold/simple-2page.pdf` 907 byte: encrypt 1,761 byte, Poppler `pdfinfo -upw <password>` riapre **2 pagine, cifrato AES-256**, `pdftotext -upw <password>` legge `alpha` e `beta`. Poppler con password errata restituisce exit 1. Decrypt 1,635 byte, `pdfinfo` lo dichiara non cifrato e con due pagine. Questa è una lettura **indipendente** dai moduli PDFSmaller. La suite `tests/regroom-str-417.test.ts` usa anche PDF.js come lettore indipendente e regressioni negative.

**Validazione della patch al 20 ottobre 2026 (commit `f4a8a878`, MiniPC Node 26.12.0 sotto `/tmp/strumentini-heavy.lock`):** `vitest run tests/regroom-str-417.test.ts tests/pdf-password-capability.test.ts --maxWorkers=1` **6/6 PASS**, inclusi password assente/errata, PDF malformato, 8 MiB, annullamento con Worker volutamente bloccato. `npm run check` **exit 0, zero errori** e `npm run build` **exit 0, 306 pagine statiche**, build inspection PASS. `node tests/regroom-str-417.browser.mjs` **STR417_COMPILED_BROWSER_PASS**: Chrome preesistente su MiniPC tramite CDP, viewport 390 px, 907 byte input, ~1.762 byte AES-256, 1.635 byte decifrati, 2 pagine `alpha`/`beta` rilette dal lettore esterno Poppler, password errata rifiutata, zero richieste offsite e zero eccezioni JS. Nessun browser o profilo nuovo avviato. **Mobile fisico: NOT_RUN.** La prova browser è del consumer compilato, non del solo modulo JavaScript.

**NOT_RUN / NO_GO dove mancano prove:** sicurezza formale da reviewer indipendente, hardware iOS Safari / Android Chrome fisico, misure di picco RAM su grandi PDF reali, corpus ampio di compatibilità, accuratezza grafica e firme digitali. I receipt Gold e i gate di release restano invariati; il merge del sorgente non equivale al deploy produzione.
