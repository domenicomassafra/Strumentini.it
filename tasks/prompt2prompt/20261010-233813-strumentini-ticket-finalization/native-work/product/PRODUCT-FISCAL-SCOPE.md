# Fiscalità italiana — proposte Worker A per il coordinatore

**Authority:** OWN-11, OWN-01, OWN-03, OWN-06 e decisioni di `docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md`. Sono proposte di pianificazione e non attestazioni di validità fiscale o capacità pubblicate. L'owner ha confermato l'investimento importante in normativa italiana e due percorsi prioritari. Non ripristinare la vecchia raccomandazione di sospendere fiscalità e Codice Fiscale.

## Percorso 1 — privato / dipendente

Ingresso per lavoro: “Controllo il mio Codice Fiscale”, “Capisco la mia retribuzione netta”, “Simulo il TFR”, “Confronto IRPEF per un anno”, “Verifico IBAN e scadenze”. Base: selezione di anno/contesto e profilo previdenziale supportato; input minimizzati; importi con valuta e arrotondamenti dichiarati; formula riga per riga; validità geografica e fiscale localizzata; origine normativa e data controllo; risultato storico riproducibile; download/copia; refusals non cancellati. La vista dei risultati deve distinguere **simulazione**, **validazione formale** e **riscontro ufficiale**, senza attribuire ad alcuna funzione la certezza di un cedolino, identità o diritto spettante. Necessaria mobile parity con input semplici e tabelle accessibili.

Traccia originale: #008/#115/#121/#122 Codice Fiscale, #009 IBAN, #012/#127/#128 IRPEF, #013/#118/#129/#130 stipendio, #015/#134/#135 TFR, #016 mutuo, #116/#151 festività/ponti, #153 documenti. Core IRPEF nazionale lordo 2025/2026 circoscritto a casistiche provate **non equivale** a risultato completo con addizionali/detrazioni. #129 dimostra soltanto un profilo contributivo agricolo 2026 esplicitamente delimitato; non estenderlo a un dipendente genericamente. #115 conserva lacune di codici Belfiore in comuni soppressi: la generazione/decodifica CF deve mostrare ambiguità, non costruire un'identità univoca.

## Percorso 2 — partita IVA, autonomo e professionista

Ingresso per lavoro: “Controllo una partita IVA”, “Aggiungo/scorporo IVA”, “Stimo imposte e contributi forfettario”, “Esamino una FatturaPA”, “Controllo il bollo”, “Confronto scenari annuali”. Base: anno fiscale, tipo attività e codice ATECO dichiarato, gestione previdenziale supportata, incassi, imponibile e contributi **documentati dall'utente** quando il calcolo automatico non è provato; limite esplicito per regime, esenzioni, limiti reddituali e casi fuori perimetro. Mostrare un flusso verificabile fatturato → coefficiente fonte-backed → reddito → contributi → base imposta → imposta → scenario netto, segnalando omissioni e anno. Usare l'attuale FatturaPA XML locale (#119/#148/#149) con risultato leggibile; non trasformarlo in consulenza o registrazione fiscale.

Traccia originale: #010/#123 checksum P.IVA e #124 VIES opzionale sono due verifiche differenti; #011/#126 IVA (rate custom matematiche non dimostrano la classificazione legale); #014/#117/#133 regime forfettario; #118/#131/#132 INPS **2026** per soli profili autorizzati; #040/#148/#149 FatturaPA; #152 bollo; #158 rollover. L'ATECO2007 **2025 9/9** dai coefficienti originali della Gazzetta Ufficiale 31-12-2018, Allegato 2 a p. 218 del PDF è un sottoinsieme verificato; non ricava automaticamente tutti i requisiti legali d'accesso o contributi INPS 2025. Le modifiche ATECO 2025 e le date di efficacia devono essere rese esplicite.

## Tabella di coverage normativa: cosa è provato e cosa manca

| Sottoambito | Evidenza locale corrente nell'originale | Stato permesso nel piano |
|---|---|---|
| IRPEF nazionale | #117, #127, Normattiva Legge 207/2024 e Legge 199/2025, test su bande **solo lordo** per 2025/2026 | Sottoinsieme isolato; #117/#127 e #128 restano aperti per annuo completo e detrazioni/addizionali |
| IVA add/scorporo | #117, #126: fonte MEF/DEF Art. 16 e Tabella A 13 pagine; tabella A recuperata valida **13/12/2025–01/01/2027**, matematica custom separata | Per il 2025 prima del 13/12 non importare retroattivamente la tabella. Rifiuto per data/beni/esenzioni senza evidenza e attestazioni di perimetro |
| Forfettario | #117/#133: G.U. L. 145/2018 Allegato 2, 9 righe ATECO2007 per 2025, Normattiva L. 190/2014, D.Lgs. 81/2025 | 9/9 coefficienti e calcolo isolato 2025 limitato; condizione 5% dichiarata, INPS 2025 e altre eligibility non compiute |
| INPS | #118, #129, #131, #132: snapshot ufficiale 2026 per soli profili riportati dai ticket | Non riutilizzare 2026 per 2025, né profilo lavoratore agricolo per generico subordinato |
| Comuni/Belfiore | #115: ISTAT SITUAS 2026-10-09, comuni correnti, soppressi, estero | Copertura parziale; 16 comuni soppressi distinti senza `COD_CATASTO`, CF #121/#122 blocked |
| TFR | #134/#135: necessità serie ISTAT, anni decorrenza, rivalutazione e layer fiscale distinto | Bloccato fino a indice/documento per il periodo richiesto e verifica delle formule |
| Bollo fatture | #117/#152: guida Agenzia delle Entrate novembre 2024, soglie/casi espressamente limitati | Riferimento storico delimitato, non preset normativo corrente automatico |
| FatturaPA | #119/#148/#149: specifiche/XSD e lettura locale; batch isolato | Viewer/esportazione delimitati; nessun invio a SdI o validazione legale implicita |
| VIES | #123/#124: controllo matematico locale e controllo europeo da attivare dall'utente | Validità formale, esistenza autoritativa, timeout/indisponibile sono stati separati |

**Autorità e sorgenti da preservare al livello di versione/hash:** `quality/reference-data/italy/117-fiscal-annual-evidence.json`, `quality/reference-data/italy/artifacts/117-fiscal-annual/`, `src/reference-data/italy/{source-packs.ts,fiscal-annual-117.ts,fiscal-annual-vat-117.ts}`, `src/reference-data/italy/geography-115.snapshot.json`, originali #115/#117/#118/#119/#127/#131/#132/#133/#134/#152/#158. Fonti primarie registrate: Normattiva, Gazzetta Ufficiale, MEF/DEF documentazione tributaria, Agenzia delle Entrate, INPS, ISTAT e Commissione europea VIES. I nuovi ticket verificano eventuali variazioni, oltre a preservare i file già hash-pinned; nessuna nuova aliquota si assume verificata senza atto ufficiale esatto, intervallo efficace e test indipendente.

## Regola anno e rollover (#117, #158 e proposte product-A26/A27)

Il modello deve identificare `taxYear`, `effectiveFrom/To`, fonte, SHA-256 dei byte archiviati, `checkedAt`, coverage per articolo/aliquota/coefficiente/profilo, ultimo anno sostenuto e prossimo trigger verifica. L'anno del **modello dichiarativo** non si converte automaticamente nell'anno **di imposta**: `Redditi PF 2026` include materiale per imposta 2025. Se la norma cambia in corso d'anno, i risultati richiedono anche la data dell'operazione e si bloccano per intervalli scoperti. Nessun fallback silenzioso ai numeri dell'anno successivo o alla versione più recente.

L'accettazione del ticket sul rollover deve provare almeno: due versioni di fonte mantenute riproducibili, un test di bordo della finestra efficace per ogni regola, un rifiuto prima dell'inizio / dopo la fine, formula e unità controllate su campioni indipendenti, un report di stale coverage per ogni strumento annuale, e una sessione mobile che rende leggibile anno/fonte/limite senza dover scavare in una nota nascosta. Il risultato insufficiente può restituire **parziale** o **non supportato**, ma non completato con numeri sostitutivi non documentati.

## Sequenza proposta senza gate globali

1. Fonte ufficiale delimitata, con verifica per singolo modulo (separare IVA, IRPEF, forfettario, INPS, TFR, CF) mantenendo #117 come umbrella ancora aperto.
2. Engine sottostante per profilo/anno provato, fixture sui limiti normativi; niente completezza universale allargata.
3. Due percorsi utente compatti (#012/#013/#014 e product-A24/A25), con risultati utili anche parziali, e disclosure fonte/anno/assunzioni.
4. Rollover #158 e gate fonte fresh per ogni strumento, test fisici mobile e distinta implementazione/live/Gold.

Tutte queste specifiche sono modifiche **proposte**, da integrare nei ticket ufficiali dal coordinatore; nessun ID nuovo viene assegnato da Worker A.
