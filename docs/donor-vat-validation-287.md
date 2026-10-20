# STR #287 — Riuso VAT europeo formale (19 ottobre 2026)

## Pacchetto e provenienza

Adottato **[ProtonMail/vat-validation](https://github.com/ProtonMail/vat-validation)**, fork attivo di [jsvat](https://github.com/se-panfilov/jsvat) (quest'ultimo archiviato il 18 marzo 2026). Pacchetto [`vat-validation@3.0.0`](https://www.npmjs.com/package/vat-validation), rilasciato l'8 aprile 2026, sorgente upstream al commit [`97d7991b5f7ed497a067b15cd4e6074ef85a0db2`](https://github.com/ProtonMail/vat-validation/commit/97d7991b5f7ed497a067b15cd4e6074ef85a0db2). Il tarball npm è pin nel lockfile con integrità SRI **`sha512-ZLWm10HYJIBiLsMoPme/gxveslXplkrpkL507csIMTSrYdrNgTVe02LoJmfsxgXWS0QghKHedYQZjY/O6wfHSA==`**. Licenza **MIT**, copyright **2026 Alexey Karpov**: notice completo in [`public/licenses/vat-validation-287-MIT.txt`](../public/licenses/vat-validation-287-MIT.txt), distribuito col sito statico. **Nessuna dipendenza transitiva runtime** dichiarata dal pacchetto.

Confronti pre-adozione: `jsvat@2.5.4` archiviato, non idoneo a manutenzione runtime; `python-stdnum@2.2` LGPL usato unicamente come oracle separato da CLI (nessun sorgente o pacchetto copyleft distribuito); nessun motore UE equivalente nell'app. La differenza di comportamento e il vincolo sulla modalità IT giustificano solo un adapter locale, non la riscrittura dei controlli nazionali.

## Comportamento e limiti

`src/tools/partita-iva-validator/eu-validation.ts` importa solo paesi IVA UE e prefisso **XI** (Irlanda del Nord). Richiede prefisso nazionale per l'estero, riconosce **EL** per la Grecia e rifiuta **GR**, GB e tutti i paesi fuori ambito. Rimuove solo gli spazi e converte le lettere in maiuscolo: separatori e caratteri non autorizzati generano un errore esplicito. Distingue prefisso sconosciuto, dato incompleto, formato invalido e fallimento della regola nazionale. I risultati sono **solo formali**, senza rete, senza lookup né attestazione di esistenza. L'opzione VIES esistente rimane accessibile solo al flusso italiano già supportato dalla sua API.

La P.IVA **italiana**, sia con `IT` sia con sole 11 cifre, continua attraverso `normalizePartitaIva` in `src/engines/research-reference/index.ts`; conserva le stesse regole `character`, `length`, `checksum`, cifra attesa e normalizzazione. Esempio di differenza misurata: l'input sintetico `IT12345678903` supera il checksum del nostro tool ma il donor lo respinge; preserviamo il contratto italiano. La funzione non pretende di verificare la validità fiscale e non corregge la [issue donor #2](https://github.com/ProtonMail/vat-validation/issues/2) ancora aperta per alcuni NIF spagnoli.

## Oracle indipendente e costi misurati

`tests/partita-iva-validator.test.ts`: 23 casi, inclusi 200 numeri IT generati più i negativi legacy, 16 fixture di nove e più paesi UE con esito confrontato direttamente tramite `python-stdnum==2.2` (`from stdnum.eu import vat; vat.is_valid(value)`) il 19/10/2026. Fixture valide fra le altre: `BE0411905847`, `DE136695976`, `FR40303265045`, `ATU10223006`, `EL094259216`, `ESB99286320`, `NL004495445B01`, `DK13585628`, `IE6388047V`, `PT501964843`, `SE556016068001`, `LU26375245`, `PL5261040828`, `FI09853608`; `BE0897221791` e `DE136695977` sono negative in entrambi gli oracle. La corrispondenza resta sul **controllo formale**, senza verifiche VIES.

Con `esbuild --bundle --minify --platform=browser --format=esm --target=es2022` sull'entrypoint del tool:

| Misura | Baseline IT da `origin/main` | Nuovo IT+UE |
| --- | ---: | ---: |
| JS minificato | 1.111 byte | 16.015 byte |
| Gzip (livello 9) | 639 byte | 5.563 byte |

Benchmark caldo Node 24.18.0 sul Mac Studio, 100.000 chiamate (dopo 1.000 di warmup): IT nativo **0,232 µs/chiamata**, IT via adapter **0,574 µs/chiamata**, UE Belgio **0,691 µs/chiamata**. Questa è una stima di esecuzione locale, non una misura su dispositivo fisico. Il chunk dello strumento è lazy; le altre route non importano il donor in anticipo. Nessuna richiesta HTTP è emessa dal suo calcolo.

## Rollback

Ripristinare in `src/tools/partita-iva-validator/module.ts` l'import di `normalizePartitaIva` da `../../engines/research-reference` e il suo uso diretto; rimuovere il modulo `eu-validation.ts`, i testi UE e il notice dalla distribuzione, quindi `npm uninstall vat-validation` per allineare `package.json` e lockfile. Rigenerare catalogo e indice certificazione con i loro comandi nativi, verificare la suite IT, e distribuire con il normale gate di release. Nessun deploy di produzione è autorizzato da questo ticket.
