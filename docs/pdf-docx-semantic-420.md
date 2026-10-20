# STR-420 — ricostruzione semantica PDF → DOCX

Stato al 19 ottobre 2026. Ambito: PDF locali con testo selezionabile in una colonna o una tabella rettangolare a griglia completamente tracciata, fino a 8 MiB / 12 pagine. Le tabelle diventano celle Word native; il testo resta modificabile in paragrafi Word. Nome e SHA-256 dell'originale e identificativo di ogni pagina vengono inclusi nell'output. Colonne affiancate, immagini, PDF scansionati, griglie incomplete, rotazioni o grafica arbitraria sono rifiutati esplicitamente, senza output raster spacciato per semantico.

## Riuso effettivo e alternative

- [Mozilla PDF.js](https://github.com/mozilla/pdf.js), pdfjs-dist 6.4.299, Apache-2.0, release 3 ottobre 2026. Già installato. Riutilizzati lettore degli operatori, trasformazioni geometriche e worker browser.
- [docx](https://github.com/dolanmiu/docx), 9.12.0, MIT, release npm 16 ottobre 2026. Già integrato dalla issue #290. Riutilizzati Document, Paragraph, TextRun, Table, TableCell e Packer: il DOCX contiene vere strutture Word.
- Motore esistente del progetto per riconoscimento PDF a griglia delimitata, issue #254, in src/engines/pdf/pdf-table-xlsx-254.ts. Verifica margini, linee orizzontali e verticali, testo e celle. Riutilizzato senza fork.
- [PyMuPDF](https://github.com/pymupdf/PyMuPDF) / MuPDF: licenza AGPL-3.0 o commerciale. Escluso (nessuna adozione). LibreOffice: licenze MPL/LGPL e dipendenze native, escluso dal runtime browser. [Mammoth](https://github.com/mwilliamson/mammoth.js), BSD-2-Clause: legge DOCX e non genera la geometria PDF; nel test #128 ha perso impaginazione. I candidati, con release, attività e altri limiti, sono documentati nelle mappe reuse-str-pdf.md e reuse-str-office.md del 19 ottobre.

Codice specifico nuovo: verifica di contenuto per ciascuna pagina, classificazione delle geometrie ambigue, composizione dei blocchi Word e confronto di riapertura. Non esiste un donor browser che fornisca la stessa garanzia bounded/fail-closed per una conversione generica da PDF.

## Test, outcome indipendente e layout diff

Comando: npx vitest run tests/regroom-str-420.test.ts --maxWorkers=1.

Sorgente delle fixture: PDF selezionabile prodotto dal writer PDF locale e PDF con testo, tabella, colonne e immagine prodotti da pdf-lib 1.17.1 (MIT), con file indipendenti e verificabili in PDF.js. Consumer DOCX indipendente: Python 3 standard library zipfile + xml.etree.ElementTree. Riapre word/document.xml, compara testo e celle di tabella 2x2, verifica che un valore w:t si possa cambiare e risalvare/reaprire, confronta MediaBox PDF e w:pgSz Word in punti, e verifica interruzioni pagina. Questo è un diff strutturale di layout, non un raster pixel diff.

PASS per paragrafo e tabella con vero w:tbl, contenuto modificabile senza immagine. NO_GO esplicito su colonne affiancate, scansioni senza testo, immagine incollata su pagina testuale, linea singola senza griglia. Fedeltà di font, stili, celle complesse, elementi grafici e confronto visivo al pixel: NOT_RUN/NO_GO; nessuna dichiarazione di roundtrip completo. Le prove browser sul build compilato appartengono alla verifica della PR e non costituiscono un deploy produzione.

Privacy: elaborazione in locale, nessun upload del PDF. Limiti e perdita di fedeltà sono visibili nella UI prima della conversione.
