# Worker A — handoff al coordinatore (proposte di prodotto)

## Risultato e write set

Proposte depositate **solo** in `tasks/prompt2prompt/20261010-233813-strumentini-ticket-finalization/native-work/product/`; nessun ticket ufficiale, file applicativo, test, dipendenza o release modificato da questa lane. Il coordinatore integra e sceglie gli ID ufficiali in continuità con l'archivio unico.

| File | Uso concreto |
|---|---|
| `PRODUCT-CATALOG-269.csv` | Matrice machine-ingestible di **tutti i 269** manifest: ID, route, definizione manifest/factory e hash, job, engine, famiglia, input, output esplicito quando dichiarato, runtime/network, base, gap, advanced o non applicabile, mobile, fonti audit, ticket originali e proposal keys |
| `PRODUCT-CATALOG-269.json` | Stesse 269 righe più snapshot completo di **327 issue originali** con ID, path, stato, titolo, SHA-256 e contatori manifest/audit |
| `PRODUCT-ISSUE-PROPOSALS.json` | **32 aggiornamenti** motivati di originali e **29 candidati nuovi** con key provvisorie `product-A01`…`product-A29`, scope, trace OWN, AC e ID dei prerequisiti/parent esistenti |
| `PRODUCT-REFUSAL-17.csv` | Tutti i **17 completed-with-refusal** dell'attuale dashboard per ID, path/hash originale e gap non dichiarabile shipped |
| `PRODUCT-FISCAL-SCOPE.md` | Percorsi privati/dipendenti e partita IVA, fonti ufficiali 2025/2026 e limiti reali, anno effettivo e rollover |
| `build_catalog_proposals.py` | Rigenerazione locale delle tre tabelle macchina a partire da manifest, audit, originali e dashboard; solo utility per documentazione |

## Copertura osservata (checkout del worker)

- Manifest `src/tools/*/manifest.ts`: 269. Audit inventory `docs/audit-2026-10-10/catalog-review.csv`: 269. Insiemi ID uguali, **269 route uniche**; input, job e oracle manifest presenti per 269/269. La fonte audit per tool dice *inventario-non-certificazione*, dunque non certifica da sola capacità operative.
- Ticket originali ID 001–327: letti e indicizzati per testo e hash. **1.592 riferimenti** distribuiti fra manifest e issue: combinazione di parent famiglia, issue specifici e **138 tool con almeno una menzione testuale diretta** in un originale. Queste associazioni sono *proposte trace*, non dimostrano che ogni parent copra completamente ogni AC.
- Dalla dashboard prima del lavoro contemporaneo di integrazione: 327/327 originali, 284 completed, 43 open, 17 closed-with-refusal. Questi 17 sono estratti meccanicamente da `refusedClosures`, non scelti per parole chiave nei corpi.
- Famiglie catalogo: developer 36, business-math 32, documents 31, text 29, data 25, files 23, date-time 22, research 21, files-assets 16, marketing 13, web-operations 9, media 5, image-visual 5, client-work-math 2. Runtime inventariato: LOCAL 267, REFERENCE 2.
- Le righe segnano chiaramente `NOT_EXTRACTED_from_manifest_or_factory` quando il formato di output o la network policy non sono dichiarati in modo direttamente analizzabile in TS: non sostituire l'assenza di metadati con un claim. Esiste `output_kind_expected_not_proven` come aspettativa di risultato, distinto da output formato manifest.

## Aggiornamenti prioritari e nuove slice

**Base**: originali #018/#028/#031/#032/#040/#046/#047/#049/#056/#058/#062, con verifiche conservative. Il catalogo resta ricercabile integralmente. Il percorso da file e lo stato risultati sono già trattati da issue appena creati dal coordinatore: verificare i duplicati prima di assegnare nuovi ID a `product-A01…A03`, e riusare `#333–345` per `product-A02`. Per avanzato mobile, verificare `#362–363` prima di usare `product-A18`.

**PDF advanced**, `product-A04…A11`: studio modello e font/editabilità, workspace pagine, editing testo originale distinto da overlay, oggetti immagine, annotazioni, moduli, scansioni/OCR, storia e file progetto. Priorità prima di editor immagini secondo OWN-05. Continuare a bloccare l'oscura-mento venduto come irreversibile finché #237 non prova la non recuperabilità dopo export.

**Immagini advanced**, `product-A12…A17` e mobile `A18`: studio modelli, layer e alpha, maschere, regolazioni non distruttive, composizione, progetto persistente/undo. Niente promessa di parità Photoshop spedita; i singoli AC si verificano su input/output reale e dispositivi. L'editor PDF e immagini restano inclusi nell'obiettivo mobile, con eccezioni misurate, anziché etichettarli in blocco desktop-only.

**Dati**, `product-A19…A23`: workbook/CSV fidelity, stili e formule quando supportati, join/split/confronto/trasformazioni, ricette ripetibili e journey ufficio completo. #161 e #169 completati per core delimitati non certificano automaticamente ogni route pubblica o ogni cella in roundtrip.

**Italia**, `product-A24…A28`: percorso privati/dipendenti, percorso P.IVA, fonte ufficiale ogni formula/anno/data, rollover e profili contributivi mancanti. Resta fondamentale mantenere #117 e #115 `blocked` per gli AC globali non provati; sottoprove IRPEF gross nazionale, finestra Tabella A dal 13 dicembre 2025, 9/9 coefficienti ATECO2007 2025 e INPS 2026 non consentono di compilare un calcolo universale da dati misti. #152 bollo ha riferimento storico limitato. #134/#135 TFR mantengono layer distinti.

**Media**, `product-A29`: capacità e rifiuti per codec/browser/memory, proposte future solo se giustificate dai lavori quotidiani; i 5 tool `media` attuali non certificano capacità per tutti gli audio/video sul telefono.

## Decisioni di integrazione per il coordinatore

1. Congelare l'identità dei 327 originali nel ledger: durante la nostra esecuzione il coordinatore ha creato almeno #328–365. `build_catalog_proposals.py` usa **solo ID <=327** per evitare che la generazione del worker inizi a citare in modo instabile i ticket nuovi mentre nascono. Le proposte A devono essere riconciliate contro **la nuova HEAD/issue list** prima di creare children aggiuntivi.
2. Trattare le proposte come **candidate keys**, non numeri di ticket. `product-A02` ha ampia sovrapposizione a #333–345; `product-A18` a #362–363. Incrociare anche i nuovi issue di design/eng/quality. Un parent completed o refused resta storico; il child apre solo la nuova capacità, senza falsare l'originale.
3. Il gap più importante della matrice è la **prova per route**, non il conteggio pagine. La mediazione automatica dai manifest fornisce input, job e trace, ma non sostituisce trial output, verifiche indipendenti e acceptance mobile per ogni caso ad alto rischio.
4. Controllare la fonte `docs/11-format-operation-matrix.md` per direzioni/formati e completare la proposta con i ticket A, distinguendo SVG vettoriale, GIF animata, HEIC e AVIF, XLSX con formule, PDF semantic-edit, OCR layer e fidelity Office.

## Validazione e limiti

Il generatore richiede uguaglianza esatta degli insiemi `269 manifest == 269 audit IDs`, gli ID originali 1…327 senza buchi e la lista dashboard delle 17 refusal, fallendo in caso di drift. Il report è un **artefatto di pianificazione** e non prova full test/Gold/live. La `native-work/product` non è sorgente autoritativa: dopo integrazione il coordinatore rigenera dashboard, DAG, spec e controlla il diff dell'intero repo.
