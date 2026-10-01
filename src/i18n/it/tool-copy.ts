import type { FactoryToolManifest } from "../../tool-factory/manifest";

/**
 * Copy pubblica canonica di StrumentiUtili.it.
 *
 * Gli identificatori, i token di protocollo e i termini tecnici standard
 * (JSON, CSV, PDF, SHA-256, MIME, UUID...) restano invariati. Nome,
 * descrizione e attività esposte all'utente sono invece sempre in italiano.
 *
 * Le vecchie parole chiave inglesi dei manifest vengono conservate soltanto
 * nell'indice tecnico di ricerca: non sono renderizzate nell'interfaccia.
 */
export interface ItalianToolCopy {
  readonly name: string;
  readonly summary: string;
}

export const TOOL_COPY_IT: Readonly<Record<string, ItalianToolCopy>> = {
  "add-subtract-days": {
    name: "Aggiungi o sottrai giorni",
    summary: "Sposta una data ISO di un numero positivo o negativo di giorni senza fare supposizioni sul fuso orario.",
  },
  "age-date-anniversary": {
    name: "Calcola età e prossimo anniversario",
    summary: "Calcola anni, mesi e giorni trascorsi e mostra la data del prossimo anniversario.",
  },
  "archive-checksum-manifest": {
    name: "Checksum di un archivio",
    summary: "Calcola gli SHA-256 di un archivio ZIP o di più file e crea un elenco verificabile da conservare o condividere.",
  },
  "aspect-ratio-calculator": {
    name: "Calcola proporzioni immagine",
    summary: "Trova il rapporto d'aspetto di un'immagine e calcola le dimensioni per adattarla a un'area.",
  },
  "base64-codec": {
    name: "Codifica e decodifica Base64",
    summary: "Codifica o decodifica rigorosamente testo UTF-8 con Base64 o Base64url secondo RFC 4648.",
  },
  "batch-checksum-manifest": {
    name: "Checksum di più file",
    summary: "Calcola gli SHA-256 di più file in locale e crea un elenco checksum portabile.",
  },
  "batch-rename-preview": {
    name: "Anteprima rinomina multipla",
    summary: "Mostra in anteprima una rinomina deterministica e nomi di uscita sicuri anche in caso di collisioni.",
  },
  "bibtex-deduplicator": {
    name: "Rimuovi duplicati BibTeX",
    summary: "Elimina voci BibTeX duplicate usando DOI oppure titolo, autore e anno.",
  },
  "bibtex-formatter": {
    name: "Formatta BibTeX",
    summary: "Riordina e formatta voci BibTeX in una forma coerente e leggibile.",
  },
  "break-even": {
    name: "Quando vai in pareggio",
    summary: "Calcola quante unità devi vendere e quanto devi fatturare per coprire costi fissi e variabili.",
  },
  "bulk-domain-extractor": {
    name: "Estrai domini da una lista",
    summary: "Estrae i domini univoci da URL o testo incollato e separa subito gli elementi non validi.",
  },
  "business-day": {
    name: "Conta giorni lavorativi",
    summary: "Conta o aggiunge giorni lavorativi usando la tua settimana di lavoro e date escluse facoltative.",
  },
  "calendar-date-list-generator": {
    name: "Crea una lista di date",
    summary: "Genera una sequenza di date a intervalli regolari tra un inizio e una fine.",
  },
  "campaign-name": {
    name: "Crea nome campagna",
    summary: "Crea nomi di campagna coerenti partendo dai campi e dal separatore che scegli.",
  },
  "canonical-url-helper": {
    name: "Crea URL canonico",
    summary: "Costruisce l'URL canonico assoluto e il relativo tag link a partire dall'URL della pagina.",
  },
  "capacity-planner": {
    name: "Quante ore puoi davvero vendere",
    summary: "Trasforma le ore disponibili in capacità fatturabile e capacità reale di consegna.",
  },
  "case-converter": {
    name: "Cambia maiuscole e stile del testo",
    summary: "Converte testo in minuscolo, maiuscolo, titolo, camelCase, PascalCase, kebab-case, snake_case o CONSTANT_CASE.",
  },
  "checksum-verifier": {
    name: "Verifica integrità dei file",
    summary: "Confronta gli SHA-256 dei file con un elenco checksum atteso per verificare che non siano cambiati.",
  },
  "citation-deduplicator": {
    name: "Rimuovi citazioni duplicate",
    summary: "Elimina citazioni duplicate usando identificatore oppure titolo, autore e anno.",
  },
  "citation-key-generator": {
    name: "Crea chiavi per citazioni",
    summary: "Genera chiavi stabili autore-anno-titolo per BibTeX e gestisce automaticamente i duplicati.",
  },
  "clean-zip-creator": {
    name: "Creatore ZIP pulito",
    summary: "Crea un archivio ZIP con percorsi relativi ripuliti e metodo di memorizzazione interamente locale.",
  },
  "client-handoff-index-generator": {
    name: "Indice dei file da consegnare",
    summary: "Crea un indice ordinato dei file da consegnare con nomi sicuri, dimensioni e checksum facoltativi.",
  },
  "color-converter": {
    name: "Converti HEX, RGB e HSL",
    summary: "Converte un colore tra formato esadecimale, RGB e HSL direttamente nel browser.",
  },
  "color-picker": {
    name: "Selettore colore",
    summary: "Sceglie un colore con il controllo nativo del browser e mostra i valori RGB, HSL ed esadecimali esatti.",
  },
  "column-type-profiler": {
    name: "Riconosci i tipi delle colonne",
    summary: "Riconosce quali colonne contengono testo, numeri, date, booleani o valori misti.",
  },
  "contact-sheet-generator": {
    name: "Crea un foglio di anteprime immagini",
    summary: "Unisce più immagini in un unico foglio di anteprime generato localmente nel browser.",
  },
  "contrast-checker": {
    name: "Controlla contrasto colori",
    summary: "Verifica se testo e sfondo rispettano i rapporti di contrasto WCAG.",
  },
  "conversion-rate-scenario": {
    name: "Simula un nuovo tasso di conversione",
    summary: "Confronta conversione attuale e obiettivo e mostra quante conversioni otterresti con lo stesso traffico.",
  },
  "cpa-cpc-cpm-calculator": {
    name: "Calcola CPA, CPC o CPM",
    summary: "Calcola il costo per acquisizione, clic o mille impression partendo dalla spesa pubblicitaria.",
  },
  "cron-explainer": {
    name: "Spiega una regola cron",
    summary: "Traduce una regola cron POSIX nei suoi campi, intervalli, liste e giorni coinvolti.",
  },
  "cron-next-run": {
    name: "Prossime esecuzioni di una cron",
    summary: "Calcola quando scatterà una regola cron POSIX nelle prossime occorrenze UTC.",
  },
  "csv-cleaner": {
    name: "Pulisci un CSV",
    summary: "Normalizza terminatori di riga e BOM UTF-8 di un CSV senza caricare il file online.",
  },
  "csv-column-map": {
    name: "Mappa e riordina colonne CSV",
    summary: "Seleziona, rinomina e riordina colonne CSV tramite indice sorgente con anteprima dello schema prima dell'output.",
  },
  "csv-column-selector": {
    name: "Scegli e riordina colonne CSV",
    summary: "Seleziona le colonne da mantenere, cambia il loro ordine e mostra quali vengono escluse.",
  },
  "csv-column-to-list": {
    name: "Colonna CSV in elenco",
    summary: "Estrae una colonna CSV per nome o numero in un elenco su più righe preservando correttamente le virgolette.",
  },
  "csv-dedupe": {
    name: "Rimuovi righe duplicate dal CSV",
    summary: "Elimina righe duplicate usando l'intera riga o le colonne chiave che scegli.",
  },
  "csv-delimiter-detector": {
    name: "Trova il separatore di un CSV",
    summary: "Riconosce se un file usa virgola, punto e virgola, tabulazione o barra verticale come separatore.",
  },
  "csv-encoding-fixer": {
    name: "Correggi la codifica di un CSV",
    summary: "Riconosce codifiche comuni, rimuove il BOM e produce un CSV UTF-8 normalizzato.",
  },
  "csv-filter": {
    name: "Filtra righe di un CSV",
    summary: "Mostra solo le righe che rispettano la regola scelta per colonna, testo o valore vuoto.",
  },
  "csv-group-count": {
    name: "Raggruppa e conta righe CSV",
    summary: "Raggruppa le righe per una o più colonne e calcola conteggi o aggregazioni numeriche.",
  },
  "csv-join": {
    name: "Unisci due CSV",
    summary: "Unisce due tabelle usando le colonne chiave che scegli, con join interno, sinistro, destro o completo.",
  },
  "csv-pivot-lite": {
    name: "Crea una tabella pivot da CSV",
    summary: "Raggruppa righe e aggrega valori per creare una tabella pivot direttamente nel browser.",
  },
  "csv-sort": {
    name: "Ordina righe di un CSV",
    summary: "Ordina una tabella CSV per una colonna di testo, numeri o date e gestisce esplicitamente i valori vuoti.",
  },
  "csv-to-json": {
    name: "Converti CSV in JSON",
    summary: "Trasforma le righe di un CSV in record JSON gestendo intestazioni duplicate e celle mancanti.",
  },
  "csv-viewer": {
    name: "Apri e controlla un CSV",
    summary: "Mostra struttura, separatore, eventuali problemi e prime righe di un CSV senza caricarlo online.",
  },
  "currency-scenario": {
    name: "Converti valuta con un cambio manuale",
    summary: "Applica a un importo il tasso di cambio che inserisci tu, senza usare quotazioni online.",
  },
  "date-difference": {
    name: "Differenza tra due date e orari",
    summary: "Mostra quanto tempo passa tra due date o istanti, distinguendo giorni di calendario e tempo effettivamente trascorso.",
  },
  "date-source-normalizer": {
    name: "Uniforma le date delle fonti",
    summary: "Trasforma date scritte in formati diversi in una forma ISO coerente per anno, mese o giorno.",
  },
  "deadline-countdown": {
    name: "Quanto manca alla scadenza",
    summary: "Calcola giorni, ore, minuti e secondi rimanenti oppure già trascorsi rispetto a una scadenza.",
  },
  "decimal-hours-converter": {
    name: "Converti ore e minuti in ore decimali",
    summary: "Converte HH:MM in ore decimali e viceversa senza errori di arrotondamento intermedi.",
  },
  "discount-impact": {
    name: "Impatto dello sconto",
    summary: "Mostra prezzo unitario, ricavo e ricavo perso quando viene applicato uno sconto dichiarato.",
  },
  "document-handoff-manifest": {
    name: "Indice dei documenti da consegnare",
    summary: "Crea un indice JSON dei documenti con nome, dimensione, struttura PDF e SHA-256.",
  },
  "doi-isbn-normalizer": {
    name: "Pulisci e verifica DOI e ISBN",
    summary: "Uniforma i DOI e verifica sintassi e cifre di controllo degli ISBN-10 e ISBN-13.",
  },
  "doi-link-builder": {
    name: "Trasforma un DOI in link",
    summary: "Crea l'URL doi.org a partire da un DOI valido senza effettuare richieste di rete.",
  },
  "doi-normalizer": {
    name: "Pulisci e verifica un DOI",
    summary: "Uniforma un DOI e controlla localmente che la sua sintassi sia valida.",
  },
  "domain-frequency-counter": {
    name: "Conta le fonti per dominio",
    summary: "Mostra quante fonti provengono da ciascun dominio e ordina il risultato per frequenza.",
  },
  "domain-subdomain-grouper": {
    name: "Raggruppa URL per dominio",
    summary: "Raggruppa domini e sottodomini correlati mantenendo visibili i sottodomini osservati.",
  },
  "dominant-color-extractor": {
    name: "Trova il colore dominante",
    summary: "Trova il colore principale di un'immagine elaborandola direttamente nel browser.",
  },
  "duplicate-file-finder": {
    name: "Trova file duplicati",
    summary: "Trova file identici confrontando dimensione e SHA-256 senza caricarli online.",
  },
  "duplicate-row-profiler": {
    name: "Trova righe duplicate",
    summary: "Individua righe duplicate o valori duplicati nelle colonne chiave e mostra conteggi ed esempi.",
  },
  "duration-calculator": {
    name: "Calcola durata tra due date e orari",
    summary: "Misura quanto tempo passa tra due istanti e mostra il risultato in unità leggibili.",
  },
  "effective-hourly-rate": {
    name: "Quanto guadagni davvero all'ora",
    summary: "Calcola il guadagno orario effettivo partendo da ricavi, costi e tempo lavorato.",
  },
  "email-domain-extractor": {
    name: "Estrai email e domini dal testo",
    summary: "Trova indirizzi email e domini univoci nel testo incollato e separa ciò che non riconosce.",
  },
  "epoch-batch-converter": {
    name: "Converti timestamp Unix in blocco",
    summary: "Converte più valori Unix in secondi o millisecondi in date e orari ISO leggibili.",
  },
  "evidence-table-builder": {
    name: "Crea tabella delle fonti",
    summary: "Trasforma record di fonti ed evidenze in una tabella CSV ordinata e verificabile.",
  },
  "exif-remover": {
    name: "Rimuovi metadati EXIF",
    summary: "Crea una nuova copia dell'immagine senza i metadati EXIF che possono contenere informazioni personali.",
  },
  "favicon-app-icon-size-generator": {
    name: "Crea favicon e icone app",
    summary: "Genera da un'immagine le principali dimensioni PNG quadrate per favicon e icone app.",
  },
  "file-hash": {
    name: "Hash file e verifica checksum",
    summary: "Calcola SHA-256 in locale e può verificare un checksum atteso senza caricare il file.",
  },
  "file-list-diff": {
    name: "Confronto elenchi di file",
    summary: "Confronta due selezioni locali di file per percorso relativo, dimensione e SHA-256 facoltativo.",
  },
  "file-signature-detector": {
    name: "Controlla il vero tipo di un file",
    summary: "Confronta la firma interna del file con la sua estensione per evidenziare incongruenze.",
  },
  "filename-sanitizer": {
    name: "Pulizia nomi file",
    summary: "Mostra in anteprima nomi portabili senza modificare i file originali.",
  },
  "find-replace-preview": {
    name: "Anteprima trova e sostituisci",
    summary: "Mostra sostituzioni letterali o con espressioni regolari e ogni corrispondenza prima di copiare il risultato.",
  },
  "folder-compare": {
    name: "Confronto cartelle",
    summary: "Confronta due selezioni locali di cartelle per percorso relativo, dimensione e SHA-256 facoltativo.",
  },
  "folder-inventory": {
    name: "Inventario cartella",
    summary: "Elenca i metadati dei file selezionati da una cartella locale entro limiti espliciti.",
  },
  "folder-size-type-summary": {
    name: "Riepilogo contenuto cartella",
    summary: "Riassume i file di una cartella per estensione, tipo e spazio occupato.",
  },
  "hash-generator": {
    name: "Calcola hash di un testo",
    summary: "Calcola SHA-256, SHA-384 o SHA-512 di un testo UTF-8 direttamente nel browser.",
  },
  "hmac-generator": {
    name: "Calcola HMAC",
    summary: "Genera un HMAC-SHA-2 da chiave e messaggio direttamente nel browser.",
  },
  "html-entity-codec": {
    name: "Codifica e decodifica entità HTML",
    summary: "Converte entità di carattere HTML come testo distinguendo chiaramente decodifica e sanificazione.",
  },
  "http-status-reference": {
    name: "Significato dei codici HTTP",
    summary: "Cerca cosa significa un codice HTTP come 200, 404 o 500 usando un riferimento locale.",
  },
  "ics-event-builder": {
    name: "Crea file calendario ICS",
    summary: "Crea un evento calendario .ics compatibile con RFC 5545 da titolo, data, luogo e descrizione.",
  },
  "ics-viewer": {
    name: "Apri e controlla un file ICS",
    summary: "Legge e valida un evento iCalendar senza importarlo nel calendario né modificarlo.",
  },
  "image-compare-slider": {
    name: "Confronto immagini",
    summary: "Confronta due immagini locali con un riepilogo deterministico delle differenze pixel e dei metadati.",
  },
  "image-compression": {
    name: "Compressione immagine",
    summary: "Comprime un'immagine locale nel formato supportato scelto e verifica il risultato.",
  },
  "image-crop": {
    name: "Ritaglio immagine",
    summary: "Ritaglia un'immagine locale in un rettangolo limitato con risultato prodotto interamente nel browser.",
  },
  "image-dimensions-batch-inspector": {
    name: "Controlla dimensioni di più immagini",
    summary: "Mostra larghezza, altezza, tipo e peso di più immagini locali in una sola volta.",
  },
  "image-format-conversion": {
    name: "Converti formato immagine",
    summary: "Converte un'immagine tra JPEG, PNG e WebP direttamente nel browser.",
  },
  "image-metadata-viewer": {
    name: "Vedi informazioni di un'immagine",
    summary: "Mostra tipo, dimensioni, firma e peso di un'immagine locale senza caricarla online.",
  },
  "image-rename-batch-preview": {
    name: "Anteprima rinomina multipla immagini",
    summary: "Mostra modifiche deterministiche dei nomi delle immagini senza scrivere né caricare alcun file.",
  },
  "image-resize": {
    name: "Ridimensiona immagine",
    summary: "Ridimensiona o ritaglia JPEG, PNG e WebP in locale producendo un JPEG o WebP entro limiti definiti.",
  },
  "images-to-pdf": {
    name: "Immagini in PDF",
    summary: "Trasforma immagini JPEG locali in un PDF con una pagina per immagine senza convertitore lato server.",
  },
  "invisible-character-detector": {
    name: "Trova caratteri invisibili",
    summary: "Individua caratteri Unicode invisibili, a larghezza zero o direzionali e mostra dove si trovano.",
  },
  "invoice-math-validator": {
    name: "Controlla i calcoli di una fattura",
    summary: "Ricalcola sconti, imposte e totale e segnala se i conti della fattura non tornano.",
  },
  "invoice-number-generator": {
    name: "Crea numero fattura",
    summary: "Genera un numero fattura coerente usando prefisso, anno, sequenza e formato scelti.",
  },
  "isbn-validator-converter": {
    name: "Validatore e convertitore ISBN",
    summary: "Verifica le cifre di controllo ISBN-10 e ISBN-13 e converte localmente gli ISBN-10 validi.",
  },
  "json-formatter": {
    name: "Formattatore e validatore JSON",
    summary: "Valida e formatta JSON in modo deterministico senza caricare il documento.",
  },
  "json-path-playground": {
    name: "Prova percorsi JSONPath",
    summary: "Interroga JSON con un sottoinsieme limitato di JSONPath e mostra ogni percorso e valore restituito.",
  },
  "json-to-csv": {
    name: "Converti JSON in CSV",
    summary: "Trasforma un array JSON di oggetti in CSV scegliendo come costruire le intestazioni.",
  },
  "json-yaml-converter": {
    name: "Convertitore JSON e YAML",
    summary: "Converte tra JSON e un sottoinsieme YAML sicuro e limitato mostrando direzione e modello dei valori.",
  },
  "jwt-inspector": {
    name: "Analizzatore JWT",
    summary: "Ispeziona parti, claim, timestamp e avvisi di un JWT senza attribuirgli validità crittografica.",
  },
  "language-aware-text-statistics": {
    name: "Statistiche del testo e lingua",
    summary: "Conta parole, frasi e caratteri e indica in modo euristico la lingua del testo.",
  },
  "late-payment-interest": {
    name: "Calcola interessi di mora",
    summary: "Calcola interesse semplice e totale dovuto per un pagamento in ritardo.",
  },
  "line-deduplicator": {
    name: "Rimuovi righe duplicate",
    summary: "Elimina righe duplicate scegliendo se ignorare spazi ai bordi e differenze di normalizzazione Unicode.",
  },
  "line-sorter": {
    name: "Ordina righe di testo",
    summary: "Ordina un elenco di righe in ordine crescente o decrescente con controllo su maiuscole e minuscole.",
  },
  "list-compare": {
    name: "Confronta e deduplica liste",
    summary: "Confronta, interseca, sottrae e deduplica liste di righe con regole di uguaglianza esplicite.",
  },
  "list-difference": {
    name: "Differenza tra liste",
    summary: "Sottrae una lista di righe da un'altra con una regola di uguaglianza esplicita e ordine di uscita stabile.",
  },
  "list-intersection": {
    name: "Intersezione tra liste",
    summary: "Trova le righe presenti in entrambe le liste mantenendo stabile l'ordine della prima occorrenza.",
  },
  "lorem-sample-data-generator": {
    name: "Crea dati di esempio",
    summary: "Genera parole, frasi, paragrafi, nomi, email, numeri o righe di esempio riproducibili.",
  },
  "margin-markup": {
    name: "Calcola margine e ricarico",
    summary: "Calcola margine e ricarico partendo da prezzo e costo e mostra chiaramente la differenza tra i due.",
  },
  "markdown-preview": {
    name: "Anteprima Markdown",
    summary: "Renderizza in locale un sottoinsieme sicuro di Markdown neutralizzando HTML grezzo e link non sicuri.",
  },
  "markdown-table-formatter": {
    name: "Formatta tabella Markdown",
    summary: "Allinea colonne, intestazioni e separatori di una tabella Markdown senza cambiare il contenuto.",
  },
  "meeting-time-planner": {
    name: "Trova un orario comune per una riunione",
    summary: "Trova finestre compatibili tra persone che lavorano in fusi orari diversi.",
  },
  "meta-preview": {
    name: "Anteprima titolo e descrizione meta",
    summary: "Misura titolo e descrizione e produce un'anteprima escapata senza renderizzare contenuto attivo.",
  },
  "metadata-risk-inspector": {
    name: "Controlla metadati prima di condividere",
    summary: "Segnala metadati e nomi file che potrebbero rivelare informazioni indesiderate prima della condivisione.",
  },
  "mime-type-lookup": {
    name: "Trova il tipo MIME di un file",
    summary: "Cerca il tipo MIME da un'estensione o da una piccola firma del file.",
  },
  "missing-value-profiler": {
    name: "Trova celle vuote",
    summary: "Mostra quante celle vuote ci sono in ogni colonna e la loro percentuale.",
  },
  "notes-deduplicator": {
    name: "Rimuovi note duplicate",
    summary: "Elimina note di ricerca duplicate normalizzando spazi e maiuscole/minuscole.",
  },
  "open-graph-preview": {
    name: "Anteprima Open Graph",
    summary: "Estrae tag Open Graph e Twitter Card da HTML incollato senza recuperarlo dalla rete né eseguirlo.",
  },
  "palette-extractor": {
    name: "Estrai palette da un'immagine",
    summary: "Trova una palette di colori rappresentativa da un'immagine direttamente nel browser.",
  },
  "payment-fee-gross-up": {
    name: "Calcola il lordo per ottenere un netto",
    summary: "Calcola quanto devi addebitare per ricevere un netto preciso dopo le commissioni.",
  },
  "pdf-compare-lite": {
    name: "Confronta due PDF",
    summary: "Confronta due PDF per pagine, dimensioni, rotazioni e testo che lo strumento riesce a estrarre.",
  },
  "pdf-compression-lite": {
    name: "Alleggerisci un PDF",
    summary: "Crea una copia più pulita rimuovendo metadati e riducendo contenuti testuali non compressi quando possibile.",
  },
  "pdf-flatten": {
    name: "Rimuovi elementi interattivi dal PDF",
    summary: "Crea una copia del PDF senza collegamenti interattivi e moduli che lo strumento supporta.",
  },
  "pdf-form-inspector": {
    name: "Vedi i campi di un modulo PDF",
    summary: "Mostra nomi, tipi, valori e stato dei campi AcroForm senza compilare né inviare il documento.",
  },
  "pdf-image-extractor": {
    name: "Estrai immagini JPEG da PDF",
    summary: "Estrae le immagini JPEG incorporate direttamente nel PDF quando la struttura del file lo consente.",
  },
  "pdf-link-extractor": {
    name: "Estrai link da PDF",
    summary: "Elenca gli URL presenti nelle annotazioni e nelle azioni del PDF senza aprirli.",
  },
  "pdf-merge": {
    name: "Unisci PDF",
    summary: "Combina più PDF locali in un unico documento senza caricarne le pagine su un server.",
  },
  "pdf-metadata-inspector": {
    name: "Vedi metadati PDF",
    summary: "Mostra metadati, dimensioni pagine, rotazioni e indicatori di cifratura del PDF.",
  },
  "pdf-metadata-remover": {
    name: "Rimuovi metadati PDF",
    summary: "Crea una copia del PDF rimuovendo i metadati Info e quelli incorporati che lo strumento può raggiungere.",
  },
  "pdf-page-citation-helper": {
    name: "Crea citazione di una pagina PDF",
    summary: "Formatta una citazione di pagina o intervallo usando i dati bibliografici che inserisci.",
  },
  "pdf-page-count-verifier": {
    name: "Conta e verifica pagine PDF",
    summary: "Conta le pagine del PDF e, se inserisci un numero atteso, verifica che corrisponda.",
  },
  "pdf-page-delete-extract": {
    name: "Elimina o estrai pagine PDF",
    summary: "Elimina o estrae pagine indicate esplicitamente da un PDF locale usando numerazione a partire da uno.",
  },
  "pdf-page-reorder": {
    name: "Riordina pagine PDF",
    summary: "Riordina tutte le pagine di un PDF locale usando una sequenza esplicita numerata a partire da uno.",
  },
  "pdf-page-size-inspector": {
    name: "Vedi dimensioni delle pagine PDF",
    summary: "Mostra larghezza, altezza e rotazione di ogni pagina del PDF.",
  },
  "pdf-password-check-remove": {
    name: "Controlla se un PDF è protetto",
    summary: "Verifica se il PDF dichiara cifratura; non prova a forzare o aggirare password.",
  },
  "pdf-rotate": {
    name: "Ruota PDF",
    summary: "Ruota localmente le pagine selezionate di 90, 180 o 270 gradi in modo esplicito.",
  },
  "pdf-split": {
    name: "Dividi PDF",
    summary: "Divide un PDF locale in file per intervalli di pagine con controlli su memoria e pagine.",
  },
  "pdf-text-extraction": {
    name: "Estrai testo da PDF",
    summary: "Estrae il testo dai flussi PDF supportati e segnala quando la struttura richiede capacità non disponibili.",
  },
  "pdf-to-images": {
    name: "PDF in immagini",
    summary: "Estrae flussi JPEG incorporati direttamente nel PDF senza fingere di renderizzare pagine non supportate.",
  },
  "percentage-helper": {
    name: "Calcola IVA e percentuali",
    summary: "Aggiunge una percentuale a un importo oppure ricava il netto da un totale che la include già.",
  },
  "perceptual-duplicate-finder": {
    name: "Trova immagini quasi duplicate",
    summary: "Confronta immagini locali per trovare copie molto simili usando dimensioni e firme cromatiche.",
  },
  "platform-size-presets": {
    name: "Dimensioni immagini per social e app",
    summary: "Mostra formati comuni per social, favicon e app e calcola come adattare un'immagine.",
  },
  "project-profitability": {
    name: "Quanto rende un progetto",
    summary: "Mostra costo, profitto, margine e guadagno orario effettivo di un progetto.",
  },
  "proposal-budget-checker": {
    name: "Controlla il margine di un preventivo",
    summary: "Verifica se il prezzo copre ore di lavoro, costi, imprevisti e margine desiderato.",
  },
  "public-holiday-lookup": {
    name: "Trova festività pubbliche",
    summary: "Mostra le festività pubbliche disponibili per paese e anno usando calendari incorporati.",
  },
  "qr-generator": {
    name: "Crea QR code",
    summary: "Crea un QR code SVG da testo o URL direttamente nel browser.",
  },
  "qr-reader": {
    name: "Leggi QR code",
    summary: "Legge il contenuto di un QR da matrice, SVG o immagine quando il browser supporta la decodifica.",
  },
  "quarter-date-mapper": {
    name: "Trova trimestre e relative date",
    summary: "Scopri a quale trimestre appartiene una data oppure trova inizio e fine di un trimestre.",
  },
  "query-string-editor": {
    name: "Modifica i parametri di un URL",
    summary: "Aggiunge, rimuove, modifica e riordina i parametri della query di un URL.",
  },
  "quick-chart": {
    name: "Crea un grafico da una tabella",
    summary: "Crea un grafico a barre da una colonna di etichette e una colonna di valori.",
  },
  "quote-counter": {
    name: "Conteggio parole e caratteri",
    summary: "Conta parole, punti di codice Unicode, caratteri non spazi, righe e tempo di lettura.",
  },
  "rate-converter": {
    name: "Converti tariffa oraria, giornaliera e a progetto",
    summary: "Converte una tariffa tra ora, giornata e progetto usando le ore di lavoro che definisci.",
  },
  "reading-list-deduplicator": {
    name: "Rimuovi duplicati dalla lista di lettura",
    summary: "Elimina riferimenti duplicati usando DOI, ISBN, URL oppure titolo, autore e anno.",
  },
  "reading-time-estimator": {
    name: "Stima tempo di lettura",
    summary: "Stima il tempo di lettura da una velocità configurabile in parole al minuto senza caricare il testo.",
  },
  "recurring-date-generator": {
    name: "Crea date ricorrenti",
    summary: "Genera una sequenza di date giornaliera, settimanale, mensile o annuale.",
  },
  "redirect-chain-inspector": {
    name: "Controlla una catena di redirect",
    summary: "Analizza una catena di reindirizzamenti incollata e segnala stati, destinazioni e cicli.",
  },
  "reference-list-sorter": {
    name: "Ordina riferimenti bibliografici",
    summary: "Ordina riferimenti per autore, anno o titolo mantenendo stabile l'ordine a parità di valore.",
  },
  "regex-tester": {
    name: "Prova una regex",
    summary: "Testa un'espressione regolare sul testo e mostra corrispondenze e gruppi trovati.",
  },
  "research-pack-manifest": {
    name: "Indice verificabile di un pacchetto di ricerca",
    summary: "Crea un indice ordinato con checksum per i file di un pacchetto di ricerca.",
  },
  "research-url-cleaner": {
    name: "Pulizia URL di ricerca",
    summary: "Rimuove parametri comuni di tracciamento e ordina le chiavi della query negli URL di ricerca.",
  },
  "retainer-capacity": {
    name: "Quanti clienti continuativi puoi seguire",
    summary: "Stima quanti clienti ricorrenti puoi gestire con le ore di lavoro che hai davvero disponibili.",
  },
  "ris-bibtex-converter": {
    name: "Convertitore RIS e BibTeX",
    summary: "Converte in locale tra record RIS e BibTeX senza interrogare metadati esterni né caricare dati.",
  },
  "roas-calculator": {
    name: "Calcolatore ROAS",
    summary: "Calcola il ritorno sulla spesa pubblicitaria con aritmetica decimale esatta e arrotondamento solo finale.",
  },
  "robots-directive-helper": {
    name: "Assistente direttive robots.txt",
    summary: "Analizza gruppi robots.txt, percorsi consentiti o vietati, sitemap e righe malformate in un risultato verificabile.",
  },
  "safe-share-checklist": {
    name: "Controlla i file prima di condividerli",
    summary: "Cerca file vuoti, possibili segreti, metadati e nomi temporanei prima della condivisione.",
  },
  "scope-creep-cost": {
    name: "Costo extra fuori preventivo",
    summary: "Quantifica quanto costa il lavoro aggiuntivo che esce dal preventivo iniziale.",
  },
  "screenshot-border-background-helper": {
    name: "Bordo e sfondo per screenshot",
    summary: "Aggiunge bordo e sfondo misurati a uno screenshot locale usando un canvas con limiti definiti.",
  },
  "secret-token-pattern-scanner": {
    name: "Ricerca pattern di segreti e token",
    summary: "Analizza testo locale per pattern comuni di segreti e mostra i risultati con i valori sensibili oscurati.",
  },
  "slug-generator": {
    name: "Generatore slug",
    summary: "Crea slug leggibili e compatibili con Unicode con separatore, maiuscole/minuscole e lunghezza configurabili.",
  },
  "smart-quote-normalizer": {
    name: "Normalizzatore virgolette tipografiche",
    summary: "Converte in modo deterministico virgolette dritte in tipografiche o viceversa.",
  },
  "social-character-limit": {
    name: "Controllo limite caratteri social",
    summary: "Conta punti di codice Unicode rispetto a un limite dichiarato mostrando caratteri rimanenti o eccedenti.",
  },
  "table-transpose": {
    name: "Scambia righe e colonne",
    summary: "Trasforma le colonne in righe preservando il contenuto delle celle.",
  },
  "target-income-rate": {
    name: "Tariffa necessaria per il tuo reddito obiettivo",
    summary: "Calcola quale tariffa oraria ti serve per raggiungere il reddito desiderato dopo costi e tempo non fatturabile.",
  },
  "text-diff": {
    name: "Confronto testi",
    summary: "Confronta due testi riga per riga distinguendo in modo esplicito parti invariate, rimosse e aggiunte.",
  },
  "text-to-csv-rows": {
    name: "Testo in righe CSV",
    summary: "Converte righe di testo delimitato in CSV correttamente escapato con intestazioni generate o esplicite.",
  },
  "timeline-sorter": {
    name: "Ordinamento cronologia",
    summary: "Ordina cronologicamente eventi di ricerca datati con ordine stabile e segnalazione delle date non valide.",
  },
  "timesheet-totaler": {
    name: "Somma le ore del timesheet",
    summary: "Somma turni e pause di più giornate e mostra il totale in minuti e ore decimali.",
  },
  "timezone-converter": {
    name: "Converti tra fusi orari",
    summary: "Converte una data e ora tra fusi IANA tenendo conto automaticamente dell'ora legale.",
  },
  "timezone-overlap": {
    name: "Trova ore comuni tra due fusi orari",
    summary: "Trova le fasce lavorative che si sovrappongono tra due fusi orari, inclusa l'ora legale.",
  },
  "toml-formatter": {
    name: "Formattatore e validatore TOML",
    summary: "Analizza e formatta in locale un sottoinsieme TOML sicuro con limiti di annidamento e controllo chiavi duplicate.",
  },
  "tracking-cleaner": {
    name: "Rimuovi parametri di tracciamento",
    summary: "Pulisce un URL dai parametri noti di campagna e tracciamento senza toccare quelli utili.",
  },
  "tsv-to-csv": {
    name: "Converti TSV in CSV",
    summary: "Converte valori separati da tabulazioni in un CSV normalizzato, incluse celle tra virgolette.",
  },
  "unicode-normalizer": {
    name: "Normalizzatore Unicode",
    summary: "Applica esplicitamente normalizzazione NFC, NFD, NFKC o NFKD al testo senza altre modifiche.",
  },
  "unix-timestamp": {
    name: "Convertitore timestamp Unix",
    summary: "Converte tra secondi o millisecondi Unix e una data-ora UTC esplicita.",
  },
  "url-bulk-normalizer": {
    name: "Pulisci e uniforma più URL",
    summary: "Normalizza un elenco di URL HTTP(S) e segnala gli errori riga per riga.",
  },
  "url-codec": {
    name: "Codifica e decodifica URL",
    summary: "Codifica o decodifica percentualmente testo secondo regole WHATWG per componente, query, percorso o credenziali.",
  },
  "url-comparison": {
    name: "Confronto URL",
    summary: "Confronta due URL componente per componente con modalità esatta o semantica scelta esplicitamente.",
  },
  "user-agent-parser": {
    name: "Analizzatore User-Agent",
    summary: "Analizza indizi su browser, sistema operativo, dispositivo e motore senza usarli per decidere le capacità.",
  },
  "utilization-calculator": {
    name: "Percentuale di ore fatturabili",
    summary: "Mostra quale percentuale del tuo tempo disponibile è davvero fatturabile e quanto resta non fatturato.",
  },
  "utm-builder": {
    name: "Crea URL con UTM",
    summary: "Aggiunge parametri UTM a un URL di campagna senza modificare il resto dell'indirizzo.",
  },
  "utm-parser": {
    name: "Leggi i parametri UTM",
    summary: "Estrae source, medium, campaign e gli altri parametri UTM da un URL.",
  },
  "uuid-generator": {
    name: "Generatore UUID",
    summary: "Genera UUIDv4 o UUIDv7 secondo RFC 9562 usando Web Crypto e maiuscole facoltative.",
  },
  "vocabulary-frequency-analyzer": {
    name: "Parole più usate nel testo",
    summary: "Mostra quali parole compaiono più spesso e quante volte ricorrono nel testo.",
  },
  "week-number-converter": {
    name: "Trova numero settimana",
    summary: "Trova il numero di settimana di una data oppure ricava le date da una settimana ISO o statunitense.",
  },
  "whitespace-normalizer": {
    name: "Normalizzatore spazi",
    summary: "Normalizza terminatori di riga e spazi Unicode preservando la struttura significativa del testo.",
  },
  "word-character-line-counter": {
    name: "Contatore parole, caratteri e righe",
    summary: "Conta localmente parole, caratteri, punti di codice, righe, paragrafi e byte UTF-8.",
  },
  "working-hours": {
    name: "Calcola ore lavorate",
    summary: "Calcola quanto hai lavorato tra un orario di inizio e fine usando il fuso orario indicato.",
  },
  "yaml-formatter": {
    name: "Formattatore e validatore YAML",
    summary: "Analizza un sottoinsieme YAML limitato e lo formatta segnalando esplicitamente le funzionalità non supportate.",
  },
  "zero-byte-orphan-finder": {
    name: "Ricerca file vuoti e riferimenti mancanti",
    summary: "Trova file vuoti e percorsi referenziati assenti da una selezione locale entro limiti definiti.",
  },
  "zip-contents-inspector": {
    name: "Analisi contenuto ZIP",
    summary: "Legge la directory centrale di un ZIP e ispeziona nomi, dimensioni, metodi e indicatori di rischio delle voci.",
  },
  "zip-creator": {
    name: "Creatore ZIP",
    summary: "Crea un archivio ZIP limitato con metodo store a partire da file locali selezionati.",
  },
};

export function italianToolCopy(toolId: string): ItalianToolCopy | undefined {
  return TOOL_COPY_IT[toolId];
}

/**
 * Proietta un manifest nella forma pubblica italiana senza perdere i termini
 * storici usati come segnali di ricerca interni.
 */
export function localizeToolManifestIt(manifest: FactoryToolManifest): FactoryToolManifest {
  const copy = italianToolCopy(manifest.id);
  if (copy === undefined) return manifest;
  const hiddenSearchTerms = [
    manifest.name,
    manifest.summary,
    ...manifest.aliases,
    ...manifest.jobs,
    ...manifest.keywords,
  ];
  return {
    ...manifest,
    name: copy.name,
    summary: copy.summary,
    aliases: [copy.name],
    jobs: [`Usa ${copy.name}`],
    keywords: [...new Set(hiddenSearchTerms)],
  };
}

export function missingItalianToolCopy(toolIds: readonly string[]): string[] {
  return toolIds.filter((id) => TOOL_COPY_IT[id] === undefined);
}
