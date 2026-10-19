# STR-284 — EasyPIVA: obiettivo netto e pianificazione 2026

## Provenienza e decisione

- Donor: [TheStreamCode/easypiva](https://github.com/TheStreamCode/easypiva), commit [`c934d2095128355876c7f26a76e492d66a23cec1`](https://github.com/TheStreamCode/easypiva/commit/c934d2095128355876c7f26a76e492d66a23cec1), release `v1.1.1` (8 agosto 2026), repository attivo a settembre 2026.
- Funzioni **forkate/adattate**: `src/lib/calculations/targetNet.ts` (ricerca monotona del fatturato necessario) e `src/lib/calculations/planning.ts` (cumulata mensile, soglie). `forfettario.ts` e `inps.ts` esaminati, **non copiati**: usano coefficiente implicito `78%`, previsione INPS come contributi già versati, e riduzioni automatiche fuori ambito; qui si usano `forfettario-133.ts`, `inps-contributions.ts` e i dati annuali proprietari.
- File locali: `src/engines/italy/{forfettario-2026-284,ateco-2026-284}.ts`. Nessun componente UI, fetch, pacchetto npm o dipendenza transitiva importati dal donor; il codice portato dipende solo dagli engine del repository. MIT copyright Michael Gasperini 2026, testo completo di seguito.
- Altri candidati: [forfettario-kit](https://github.com/MRJonam91/forfettario-kit) (Apache-2.0, dataset 2026 `verified:false`, nessun vantaggio normativo); [pivella](https://github.com/MakhBeth/pivella) (MIT, integrazione fatture fuori perimetro); [opentax-it](https://github.com/kouga00/opentax-it) (AGPL-3.0, non adottato). La valutazione dei candidati, delle release e dell'attività è registrata nella issue #284 e nella mappa fiscale del 19 ottobre in ControlCenter.

## Fonti e validità

- Anno modellato: **1 gennaio–31 dicembre 2026**, solo simulazione condizionata. [Legge 190/2014 commi 54, 64, 65, 71](https://www.normattiva.it/eli/id/2014/12/29/14G00203/CONSOLIDATED/20261019): 85.000 € ricavi precedenti, 100.000 € uscita immediata, imposta sostitutiva 15% o 5% con condizioni dichiarate. Questi criteri non verificano da soli l'ammissibilità del contribuente.
- [D.Lgs. 81/2025 articolo 1](https://www.normattiva.it/eli/id/2025/06/12/25G00090/CONSOLIDATED/20251231) conserva la tabella ATECO2007 fino a nuovi coefficienti. I nove coefficienti già pin a Gazzetta Ufficiale, [Legge 145/2018 Allegato 2 pagina 218](https://www.gazzettaufficiale.it/eli/gu/2018/12/31/302/so/62/sg/pdf), `sha256:19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142` nel pack locale #117.
- [ISTAT tavola bidirezionale 2026 ATECO2025–ATECO2022](https://www.istat.it/classificazione/documenti-ateco/) pubblicata 15 luglio 2026, XLSX [file originale](https://www.istat.it/wp-content/uploads/2026/07/Aggiornamento-2026-Tavola-raccordo-bidirezionale-ATECO-2025-ATECO-2022-italiano.xlsx), `sha256:faf4530a869f1e3d6b68f464520dcddd691f4565d17e92e3988370cf3c808673`. Sottinsieme di 10 codici completi a 6 cifre con copertura `TOTALE` in entrambi i versi e corrispondenza `1:1` (colonne D/H/J/K). La trasposizione alla vecchia tabella fiscale usa l'attività corrispondente ATECO2007. I codici ambigui (es. `69.10.10`, `68.20.01`, `47.11.01`) restano rifiutati. Nessuna mappatura per somiglianza del prefisso.
- Contributi 2026 da `src/reference-data/italy/annual-2026.ts`: [INPS circ. 8/2026](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15153/Allegati/16573_Circolare-numero-8-del-03-02-2026.pdf) (professionisti Gestione Separata 26,07%/24%, massimale 122.295 €) e [circ. 14/2026](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15162/Allegati/16561_Circolare-numero-14-del-09-02-2026.pdf) (artigiani/commercianti, minimale 18.808 €, maggiorazione dal reddito 56.224 €, massimali per anzianità). La provenienza ufficiale completa è nei metadati locali INPS. Le aliquote non includono riduzioni forfettari non pin.

## Differenze, ambito, rollback

Il target netto è ricercato al **centesimo** con bisezione fino a 100.000 €, sul netto **previsionale dopo i contributi INPS dovuti**, e si rifiuta se non raggiungibile entro il perimetro documentato. La pianificazione mensile mostra il superamento 85k/100k; non calcola un'imposta per ricavi oltre 100k. Il versato è sempre quello **dichiarato** (anche zero), dedotto dal reddito imponibile; il dovuto INPS resta una previsione distinta dal versato. Il motore restituisce anche il netto dopo i soli versamenti dichiarati, senza confonderlo con la base dell'obiettivo. Nessuna addizionale locale inventata, nessuna esclusione personale o contribuzione agevolata presunta; nessuna certificazione fiscale. Non è una release pubblica.

Per rollback rimuovere i due engine e i relativi test/documento mediante normale revert della PR; nessuna route esistente o motore 2025 è stato sostituito e non ci sono migrazioni, dati persistiti o richieste di rete. Misura riproducibile: `esbuild src/engines/italy/forfettario-2026-284.ts --bundle --platform=browser --format=esm --minify` → **52.668 byte**, **15.512 byte gzip** (inclusi gli import fiscali esistenti). La prova browser locale usa lo stesso engine e nega le richieste esterne. Dopo `npm run build`, nessun JS/HTML in `dist/` contiene gli identificatori del nuovo motore: **0 byte aggiunti al bundle pubblico**, finché nessuna route lo importa.

## MIT notice (codice originale adattato)

Copyright (c) 2026 Michael Gasperini (TheStreamCode)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
