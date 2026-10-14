import type { FactoryToolManifest } from "../../tool-factory/manifest";

/**
 * Copy pubblica canonica di Strumentini.it.
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
  readonly searchTerms?: readonly string[];
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
  "ai-code-fence-bundle": {
    name: "Blocchi di codice AI → file ZIP",
    summary: "Trasforma in locale i code fence incollati in file con nomi sicuri e deterministici, mostra l'albero previsto e scarica lo ZIP esatto.",
    searchTerms: ["chatgpt codice in file", "code fence zip", "blocchi codice in file", "risposta ai zip", "markdown code files"],
  },
  "archive-checksum-manifest": {
    name: "Checksum di un archivio",
    summary: "Calcola gli SHA-256 di un archivio ZIP o di più file e crea un elenco verificabile da conservare o condividere.",
  },
  "aspect-ratio-calculator": {
    name: "Calcola proporzioni immagine",
    summary: "Trova il rapporto d'aspetto di un'immagine e calcola le dimensioni per adattarla a un'area.",
  },
  "audio-generator": {
    name: "Generatore di tono, metronomo e rumore",
    summary: "Genera tono, metronomo con tap tempo e rumore bianco, rosa o brown tramite Web Audio, con avvio esplicito e limiti dichiarati.",
    searchTerms: ["generatore tono", "metronomo online", "tap tempo", "rumore bianco", "rumore rosa", "rumore brown"],
  },
  "browser-text-to-speech": {
    name: "Sintesi vocale del browser",
    summary: "Legge testo con le voci SpeechSynthesis realmente disponibili, filtrando quelle italiane e mostrando i limiti della piattaforma.",
    searchTerms: ["text to speech italiano", "sintesi vocale", "leggi testo", "voce browser", "tts italiano"],
  },
  "microphone-recorder": {
    name: "Test microfono e registratore locale",
    summary: "Controlla livello e stato del microfono e registra in locale con il formato realmente supportato dal browser, mostrando tipo, byte e durata misurati.",
    searchTerms: ["test microfono", "registratore vocale", "registra audio", "microfono online", "voice recorder"],
  },
  "base-converter": {
    name: "Convertitore di base 2–36",
    summary: "Converte interi con segno tra basi da 2 a 36 senza perdere precisione e segnala esattamente le cifre non valide.",
  },
  "base64-codec": {
    name: "Codifica e decodifica Base64",
    summary: "Codifica o decodifica rigorosamente testo UTF-8 con Base64 o Base64url secondo RFC 4648.",
  },
  "barcode-generator": {
    name: "Crea barcode EAN-13 e Code 128",
    summary: "Genera o verifica EAN-13 e crea Code 128 B per il solo subset ASCII stampabile dichiarato, con download SVG e PNG interamente locali.",
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
  "chmod-permission-helper": {
    name: "Convertitore permessi chmod",
    summary: "Converte permessi Unix tra notazione rwx e ottale, inclusi setuid, setgid e sticky bit, senza modificare file.",
  },
  "cidr-calculator": {
    name: "Calcolatore CIDR IPv4 e IPv6",
    summary: "Calcola rete, intervallo e quantità di indirizzi per CIDR IPv4 e IPv6 con aritmetica intera esatta.",
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
  "color-blindness-image-simulation": {
    name: "Simula il daltonismo su un'immagine",
    summary: "Applica localmente le matrici complete di protanopia, deuteranopia o tritanopia del modello Machado e crea un PNG verificato da confrontare con l'originale.",
    searchTerms: ["simula daltonismo", "protanopia immagine", "deuteranopia immagine", "tritanopia immagine", "simulazione visione colori"],
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
    summary: "Crea contact sheet, stack e griglie con ordine modificabile oppure divide un'immagine in slice carousel con nomi deterministici e ZIP STORE verificato.",
  },
  "contrast-checker": {
    name: "Controlla contrasto colori",
    summary: "Verifica se testo e sfondo rispettano i rapporti di contrasto WCAG.",
  },
  "conversion-rate-scenario": {
    name: "Simula un nuovo tasso di conversione",
    summary: "Confronta conversione attuale e obiettivo e mostra quante conversioni otterresti con lo stesso traffico.",
  },
  "connection-device-info": {
    name: "Informazioni browser e dispositivo",
    summary: "Mostra dati utili per assistenza direttamente dal browser e cerca l'IP pubblico solo quando scegli di contattare un servizio esterno.",
    searchTerms: ["browser info", "device info", "viewport", "dpr", "public ip", "user agent"],
  },
  "css-design-helper": {
    name: "Genera gradiente, ombra e raggio CSS",
    summary: "Crea in locale gradienti lineari, box-shadow e border-radius validati usando lo stesso valore canonico per anteprima e CSS copiato.",
    searchTerms: ["gradiente css", "box shadow", "border radius", "generatore css", "ombra css"],
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
    searchTerms: ["rimuovi duplicati csv", "elimina duplicati csv", "deduplica csv"],
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
  "csv-splitter": {
    name: "Dividi un CSV grande",
    summary: "Divide un CSV locale per numero di righe o dimensione approssimativa, ripetendo l'intestazione in ogni parte e leggendo i file grandi a blocchi.",
  },
  "csv-sort": {
    name: "Ordina righe di un CSV",
    summary: "Ordina una tabella CSV per una colonna di testo, numeri o date e gestisce esplicitamente i valori vuoti.",
    searchTerms: ["ordina csv", "ordina righe csv", "metti in ordine csv"],
  },
  "csv-to-json": {
    name: "Converti CSV in JSON",
    summary: "Trasforma le righe di un CSV in record JSON gestendo intestazioni duplicate e celle mancanti.",
    searchTerms: ["csv in json", "converti csv json"],
  },
  "csv-to-sql": {
    name: "Converti CSV in SQL",
    summary: "Genera in locale CREATE TABLE e INSERT per PostgreSQL, MySQL o SQLite con tipi e valori quotati esplicitamente, senza eseguire SQL.",
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
    summary: "Mostra i gruppi di metadati prima e dopo, ricrea un PNG pulito e reinspeziona metadati e pixel RGBA prima di dichiararlo riuscito.",
    searchTerms: ["togli exif foto", "rimuovi geolocalizzazione foto", "rimuovi metadati foto", "pulisci dati exif"],
  },
  "favicon-app-icon-size-generator": {
    name: "Crea favicon e icone app",
    summary: "Genera PNG quadrati verificati in ordine deterministico e crea un ZIP STORE che contiene esattamente le varianti mostrate in anteprima.",
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
  "file-size-analyzer": {
    name: "Analizzatore dimensione file",
    summary: "Misura file immagine, ZIP, Office, MP4 e WAV in locale. Riporta solo byte e metadati verificati, non risparmi ipotetici.",
    searchTerms: ["perché file pesa tanto", "analizza dimensione file", "immagine pesante", "zip pesante", "file grande"],
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
    searchTerms: ["hash sha256", "calcola sha256", "genera sha-256"],
  },
  "hmac-generator": {
    name: "Calcola HMAC",
    summary: "Genera un HMAC-SHA-2 da chiave e messaggio direttamente nel browser.",
  },
  "html-entity-codec": {
    name: "Codifica e decodifica entità HTML",
    summary: "Converte entità di carattere HTML come testo distinguendo chiaramente decodifica e sanificazione.",
  },
  "iban-validator": {
    name: "Verifica IBAN",
    summary: "Controlla localmente struttura e checksum MOD-97 di IBAN supportati; per l'Italia separa CIN, ABI, CAB e conto senza verificarne l'esistenza bancaria.",
    searchTerms: ["controlla iban", "verifica iban", "iban italiano", "cin abi cab", "mod 97 iban"],
  },
  "italian-document-expiry": {
    name: "Calcola scadenza CIE o passaporto",
    summary: "Calcola la scadenza secondo regole italiane ufficiali versionate per CIE e passaporto, senza presentarla come verifica del documento.",
    searchTerms: ["scadenza cie", "scadenza carta identità", "scadenza passaporto", "validità cie", "validità passaporto"],
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
    summary: "Confronta due immagini con slider, overlay e diff, senza stirarle, e misura differenze RGBA campionate con soglia dichiarata.",
  },
  "image-compression": {
    name: "Compressione immagine",
    summary: "Comprime un'immagine locale nel formato supportato scelto e verifica il risultato.",
    searchTerms: ["comprimi immagine", "riduci peso immagine", "compressione foto"],
  },
  "image-crop": {
    name: "Ritaglia e modifica immagine",
    summary: "Ritaglia e modifica immagini oppure rettifica un documento fotografato da quattro angoli validati usando la stessa pipeline pixel locale dell'export PNG.",
    searchTerms: ["ritaglia immagine", "ruota immagine", "ritaglia rotondo", "ribalta immagine", "luminosità contrasto saturazione", "bordo sfondo immagine", "raddrizza prospettiva documento", "correggi prospettiva foto"],
  },
  "image-dimensions-batch-inspector": {
    name: "Controlla dimensioni di più immagini",
    summary: "Mostra larghezza, altezza, tipo e peso di più immagini locali in una sola volta.",
  },
  "image-format-conversion": {
    name: "Converti formato immagine",
    summary: "Converte JPEG, PNG e WebP in locale, verifica firma e decode e richiede uno sfondo esplicito quando l'alpha deve diventare JPEG.",
    searchTerms: ["converti jpg png", "jpg in png", "png in jpg", "webp in jpg", "converti immagine", "converti heic", "foto iphone heic jpg"],
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
  "video-inspector": {
    name: "Ispeziona MP4 e calcola il bitrate",
    summary: "Legge in locale i metadati MP4 disponibili e calcola un budget teorico di bitrate per una dimensione obiettivo, senza convertire il video.",
    searchTerms: ["metadati video", "codec mp4", "dimensione video mb", "rotazione mp4", "video bitrate"],
  },
  "images-to-pdf": {
    name: "Immagini in PDF",
    summary: "Trasforma JPG/JPEG, PNG, WebP, AVIF o il primo frame GIF in PDF con ordine, rotazioni, A4/Letter/originale, margini e contain/cover. HEIC/HEIF non disponibili finché mancano verifiche su foto iPhone reali e dispositivi mobili.",
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
  "json-repair": {
    name: "Ripara JSON senza indovinare",
    summary: "Corregge solo errori sintattici non ambigui e mostra ogni modifica applicata con posizione e motivo.",
  },
  "json-path-playground": {
    name: "Prova percorsi JSONPath",
    summary: "Interroga JSON con un sottoinsieme limitato di JSONPath e mostra ogni percorso e valore restituito.",
  },
  "json-structural-diff": {
    name: "Confronta la struttura di due JSON",
    summary: "Distingue aggiunte, rimozioni, cambi di tipo o valore e riordini degli array con percorsi JSON Pointer stabili.",
  },
  "json-to-csv": {
    name: "Converti JSON in CSV",
    summary: "Trasforma un array JSON di oggetti in CSV scegliendo come costruire le intestazioni.",
    searchTerms: ["json in csv", "converti json csv"],
  },
  "json-yaml-converter": {
    name: "Convertitore JSON e YAML",
    summary: "Converte tra JSON e un sottoinsieme YAML sicuro e limitato mostrando direzione e modello dei valori.",
  },
  "json-type-schema-inference": {
    name: "Da JSON a TypeScript e JSON Schema",
    summary: "Inferisce tipi e schema da un esempio JSON dichiarando i limiti e gestendo in sicurezza anche chiavi ostili.",
  },
  "jwt-inspector": {
    name: "Analizzatore JWT",
    summary: "Ispeziona parti, claim, timestamp e avvisi di un JWT senza attribuirgli validità crittografica.",
  },
  "keyboard-event-diagnostic": {
    name: "Diagnostica eventi tastiera",
    summary: "Mostra key, code, posizione, modificatori, repeat e composizione mentre l'area di test ha il focus, senza salvare ciò che digiti.",
    searchTerms: ["keyboard event", "key code", "keydown", "keyup", "tastiera", "modifier keys"],
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
  "text-markup-converter": {
    name: "Converti TXT, Markdown e HTML",
    summary: "Converte in locale tra Markdown, HTML e testo semplice tramite un modello normalizzato, mostrando anteprima sanitizzata e perdite strutturali dichiarate.",
    searchTerms: ["markdown html", "html markdown", "markdown txt", "html txt", "txt html", "convertitore markdown html"],
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
    searchTerms: ["controlla meta seo", "anteprima seo", "titolo meta descrizione"],
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
  "ooxml-media-compression": {
    name: "Comprimi immagini dentro DOCX, PPTX e XLSX",
    summary: "Comprimi immagini nei file DOCX, PPTX e XLSX senza alterarne XML o collegamenti. JPEG e ridimensionamento solo con consenso esplicito.",
    searchTerms: ["ridurre dimensione docx", "comprimi immagini word", "comprimi pptx", "comprimi immagini excel", "office ottimizzazione immagini"],
  },
  "open-graph-preview": {
    name: "Anteprima Open Graph",
    summary: "Estrae tag Open Graph e Twitter Card da HTML incollato senza recuperarlo dalla rete né eseguirlo.",
  },
  "palette-extractor": {
    name: "Estrai palette da un'immagine",
    summary: "Trova una palette di colori rappresentativa da un'immagine direttamente nel browser.",
  },
  "partita-iva-validator": {
    name: "Verifica Partita IVA italiana",
    summary: "Normalizza e controlla formato e cifra di controllo di una Partita IVA italiana, interamente in locale, senza verificare l'esistenza nel registro.",
    searchTerms: ["verifica partita iva", "controlla partita iva", "checksum partita iva", "p iva"],
  },
  "password-pin-passphrase-generator": {
    name: "Genera password, PIN e passphrase italiane",
    summary: "Genera in locale password, PIN numerici e passphrase italiane usando WebCrypto e selezione casuale senza distorsione da modulo.",
    searchTerms: ["generatore password", "genera pin", "passphrase italiana", "password sicura"],
  },
  "password-strength-estimator": {
    name: "Stima la robustezza di una password",
    summary: "Valuta in locale lunghezza e pattern osservabili e spiega ogni fattore del punteggio, senza consultare database di password violate.",
    searchTerms: ["forza password", "robustezza password", "password strength", "controllo password offline"],
  },
  "random-picker-team-coupon-generator": {
    name: "Genera numeri, estrazioni, team e coupon casuali",
    summary: "Genera in locale numeri casuali, estrazioni da liste, team bilanciati e coupon unici con WebCrypto oppure con un seed riproducibile dichiarato non sicuro.",
    searchTerms: ["numero casuale", "estrazione casuale", "sorteggio", "dividi squadre", "generatore coupon", "random picker"],
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
    searchTerms: ["comprimi pdf", "compressione pdf", "riduci peso pdf"],
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
    summary: "Estrae per pagina i byte JPEG originali quando sono sicuri, conserva pagina/oggetto e segnala i filtri immagine non supportati.",
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
    summary: "Distingue campi Info riconosciuti e sconosciuti, segnala gli stream XMP e mostra struttura e pagine del PDF.",
  },
  "pdf-metadata-remover": {
    name: "Rimuovi metadati PDF",
    summary: "Rimuove i metadati Info/XMP supportati, riapre il PDF prodotto e verifica che pagine e testo supportato restino stabili.",
  },
  "pdf-multi-text-search": {
    name: "Cerca testo in più PDF",
    summary: "Cerca una frase in più PDF locali e mostra file, pagina e contesto senza interrompere il batch se un documento è illeggibile, cifrato o privo di testo.",
    searchTerms: ["cerca in più pdf", "trova testo pdf", "ricerca multipla pdf"],
  },
  "pdf-page-citation-helper": {
    name: "Crea citazione di una pagina PDF",
    summary: "Formatta una citazione di pagina o intervallo dai dati che inserisci. APA, MLA e Chicago sono preset locali, non guide di stile ufficiali.",
  },
  "pdf-page-count-verifier": {
    name: "Conta e verifica pagine PDF",
    summary: "Conta le pagine del PDF e, se inserisci un numero atteso, verifica che corrisponda.",
  },
  "pdf-page-numbers": {
    name: "Numerare le pagine PDF",
    summary: "Aggiungi numeri a pagine PDF scelte, con intervalli, offset, font, dimensione, margini e anteprima locale sulle pagine reali.",
    searchTerms: ["numero pagine pdf", "numerare pdf", "aggiungere numerazione pdf"],
  },
  "pdf-watermark": {
    name: "Aggiungere una filigrana PDF",
    summary: "Sovrapponi testo o JPEG RGB visibili alle pagine PDF selezionate, con opacità, rotazione, scala e posizione. Non elimina dati.",
    searchTerms: ["watermark pdf", "filigrana pdf", "sovrapporre testo pdf"],
  },
  "pdf-crop-normalize": {
    name: "Ritaglia PDF e uniforma le dimensioni",
    summary: "Ritaglia visivamente le pagine senza cancellare contenuti oppure adatta e centra pagine di dimensioni diverse in A4, Letter o formato libero.",
    searchTerms: ["ritaglia pdf", "crop pdf", "uniforma dimensioni pagine pdf", "adatta pdf ad A4"],
  },
  "pdf-booklet-interleave": {
    name: "Crea booklet PDF e intercala fronte/retro",
    summary: "Prepara pagine PDF per opuscoli piegati o intercala scansioni fronte/retro. Ordine, duplex e pagine bianche sono dichiarati prima del download.",
    searchTerms: ["booklet pdf", "opuscolo piegato pdf", "intercala fronte retro pdf", "stampa duplex pdf"],
  },
  "pdf-fill-overlays": {
    name: "Scrivi, evidenzia e compila PDF (appiattito)",
    summary: "Scrivi o evidenzia una pagina e compila solo campi PDF testuali semplici. L'output verificato è appiattito: niente campi modificabili o redazione sicura.",
    searchTerms: ["scrivere su pdf", "evidenziare pdf", "compila modulo pdf", "annotazione pdf appiattita"],
  },
  "pdf-tables-to-xlsx": {
    name: "Estrai tabelle PDF in Excel",
    summary: "Seleziona una griglia PDF con linee reali, controlla le celle e scarica un XLSX con provenienza verificata. Non usa OCR e rifiuta tabelle ambigue.",
    searchTerms: ["pdf tabella excel", "pdf a xlsx", "esporta tabella pdf", "estrai griglia da pdf"],
  },
  "pdf-n-up": {
    name: "Metti più pagine PDF su un foglio",
    summary: "Disponi più pagine PDF su ogni foglio con ordine e margini dichiarati, anteprima e download locale. Il risultato appiattito non conserva il testo selezionabile.",
    searchTerms: ["pdf 2 pagine su un foglio", "pdf quattro pagine su A4", "pdf n up", "impaginazione pdf"],
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
  "printable-pdf-from-text": {
    name: "Converti testo, Markdown, HTML e CSV in PDF",
    summary: "Impagina testo e tabelle in PDF con margini e pagine verificati. I caratteri non supportati vengono segnalati, mai sostituiti di nascosto.",
    searchTerms: ["testo in pdf", "markdown in pdf", "html in pdf", "csv in pdf", "crea pdf da testo"],
  },
  "pdf-password-check-remove": {
    name: "Controlla e sblocca PDF con password",
    summary: "Controlla la cifratura e crea una copia senza protezione solo con una password valida autorizzata, in locale e senza tentare di indovinarla.",
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
    summary: "Estrae pagine selezionate con separatori espliciti e modalità dichiarata, segnalando i filtri PDF non supportati.",
  },
  "pdf-to-markdown": {
    name: "Converti PDF in Markdown",
    summary: "Esporta soltanto il testo PDF estraibile con marker di pagina espliciti e dichiara le perdite di tabelle, immagini, colonne e stile.",
    searchTerms: ["pdf markdown", "converti pdf md", "pdf in markdown"],
  },
  "pdf-to-images": {
    name: "PDF in immagini",
    summary: "Renderizza pagine PDF selezionate in JPG, PNG o WebP in locale, con scala/DPI e qualità; i risultati multipagina includono uno ZIP verificato.",
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
    summary: "Calcola il ritaglio per formati social/app oppure esporta un PNG reale con dimensioni esatte del preset, senza stretch e con fonte dichiarata.",
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
    summary: "Aggiunge bordo/sfondo, watermark o overlay con preview identica all'export e unisce screenshot solo dopo conferma manuale dell'overlap suggerito.",
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
  "sitemap-xml-generator": {
    name: "Genera sitemap.xml",
    summary: "Crea in locale una sitemap XML da URL HTTP(S) validati, aggiungendo lastmod, changefreq e priority solo quando li fornisci.",
    searchTerms: ["sitemap xml", "generatore sitemap", "crea sitemap", "sitemap url"],
  },
  "subtitle-srt-vtt-transform": {
    name: "Converti SRT e WebVTT, correggi timing e crea trascrizioni",
    summary: "Converte SRT e WebVTT in locale, applica offset o rescale, esporta la trascrizione e segnala overlap e velocità di lettura con soglie configurabili.",
    searchTerms: ["srt vtt", "converti sottotitoli", "offset sottotitoli", "trascrizione sottotitoli", "velocità lettura sottotitoli"],
  },
  "table-transpose": {
    name: "Scambia righe e colonne",
    summary: "Trasforma le colonne in righe preservando il contenuto delle celle.",
  },
  "table-compare": {
    name: "Confronta due tabelle CSV",
    summary: "Confronta due CSV usando chiavi e colonne esplicite, segnala chiavi duplicate ambigue e mostra da quale riga e colonna arriva ogni cambiamento.",
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
    searchTerms: ["fuso orario", "converti fuso orario", "converti orario tra paesi"],
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
    searchTerms: ["tsv csv", "tabulazioni in csv", "converti testo tabulato csv"],
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
  "vcf-viewer-csv-export": {
    name: "Apri VCF e vCard ed esporta in CSV",
    summary: "Legge contatti VCF/vCard in locale, conserva valori ripetuti e proprietà non supportate e crea un CSV protetto dalle formule.",
    searchTerms: ["apri vcf", "vcard csv", "vcf csv", "contatti vcard"],
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
  "x509-csr-inspector": {
    name: "Ispeziona certificati X.509 e CSR",
    summary: "Legge in locale certificati e richieste CSR PEM/DER e mostra nomi, SAN, validità, chiave, firma e fingerprint senza inferire fiducia o revoca.",
    searchTerms: ["certificato x509", "csr inspector", "pem certificate", "fingerprint certificato"],
  },
  "xml-formatter-validator": {
    name: "Valida, formatta e minifica XML",
    summary: "Elabora XML in locale senza risolvere DTD o entità esterne e conserva gli spazi significativi nel testo.",
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
  "semantic-text-chunker": {
    name: "Dividi testo in chunk reversibili",
    summary: "Divide il testo su confini stabili e conserva gli intervalli necessari per ricostruire esattamente l'originale.",
  },
  "fact-sensitive-text-diff": {
    name: "Trova cambi a numeri, date e link nei testi",
    summary: "Evidenzia cambi lessicali a numeri, date, URL e identificativi tra una versione originale e una riscritta, senza dichiararne la verità.",
  },
  "stable-placeholder-anonymizer": {
    name: "Anonimizza e ripristina con segnaposto",
    summary: "Sostituisce valori scelti con segnaposto stabili locali e li ripristina solo quando la mappatura coincide esattamente.",
  },
  "italian-gulpease-readability": {
    name: "Calcola indice Gulpease",
    summary: "Calcola l'indice Gulpease mostrando lettere, parole, frasi e le frasi che contribuiscono di più alla difficoltà.",
  },
  "mojibake-repair": {
    name: "Ripara testo con codifica errata",
    summary: "Ripara in modo conservativo comuni errori UTF-8 e Windows-1252, mostrando la trasformazione e rifiutando i casi ambigui.",
  },
  "pdf-copy-text-reflow": {
    name: "Ricompone testo copiato da PDF",
    summary: "Ricompone gli a capo del testo copiato da PDF con regole esplicite e segnala le sillabazioni che restano ambigue.",
  },
  "phone-link-hashtag-mention-extractor": {
    name: "Estrai telefoni, link, hashtag e mention",
    summary: "Estrae corrispondenze tipizzate con intervalli esatti, regole di sovrapposizione deterministiche ed esportazione CSV.",
  },
  "css-minifier": {
    name: "Minifica CSS con parser",
    summary: "Analizza e compatta CSS con un parser, preserva stringhe e proprietà personalizzate e mostra il risparmio in byte.",
  },
  "html-minifier": {
    name: "Minifica HTML preservando la semantica",
    summary: "Compatta HTML con un parser e conserva gli spazi significativi, inclusi pre, textarea, script e style.",
  },
  "scientific-calculator": {
    name: "Calcolatrice scientifica",
    summary: "Calcola espressioni con parentesi, potenze, funzioni e costanti tramite un parser locale che non esegue codice.",
  },
  "fraction-integer-toolkit": {
    name: "Frazioni e interi esatti",
    summary: "Calcola frazioni, MCD e MCM, fattori primi, combinazioni, permutazioni e numeri romani con aritmetica intera esatta.",
  },
  "statistics-grade-calculator": {
    name: "Statistiche, medie e completamento",
    summary: "Calcola media, mediana, moda, varianza, deviazione standard, media pesata e percentuale di completamento.",
  },
  "interest-savings-calculator": {
    name: "Interessi e obiettivo di risparmio",
    summary: "Calcola interesse semplice o composto, crescita con versamenti periodici e il versamento richiesto per raggiungere un obiettivo.",
  },
  "basic-unit-converter": {
    name: "Convertitore di unità di base",
    summary: "Converte lunghezza, massa, temperatura, area e volume e blocca le conversioni tra dimensioni incompatibili.",
  },
  "engineering-unit-converter": {
    name: "Convertitore di unità tecniche",
    summary: "Converte velocità, tempo, angoli, energia, pressione, potenza, forza, coppia, frequenza, densità, portata e illuminamento.",
  },
  "storage-download-calculator": {
    name: "Spazio digitale e tempo di download",
    summary: "Distingue MB da MiB e bit da byte e stima il download usando soltanto velocità e overhead inseriti da te.",
  },
  "battery-vehicle-power-helper": {
    name: "Batteria, consumi auto e potenza",
    summary: "Converte mAh e Wh con tensione, L/100 km, km/L e MPG US/Imperial distinti, oltre a kW, CV e hp.",
  },
  "reference-size-converter": {
    name: "Formati carta, scale e dimensioni TV",
    summary: "Calcola formati ISO, scale di modellismo e geometria TV senza inventare equivalenze di vestibilità non documentate.",
  },
  "mortgage-amortization-calculator": {
    name: "Mutuo e ammortamento alla francese",
    summary: "Stima rata, interessi e totale rimborsato dal TAN e crea il piano mensile completo scaricabile in CSV.",
    searchTerms: ["mutuo", "rata mutuo", "ammortamento francese", "piano ammortamento"],
  },
  "geometry-equation-motion-helper": {
    name: "Geometria, equazioni e moto",
    summary: "Calcola aree, perimetri, volumi, Pitagora, radici quadratiche reali e relazioni tra velocità, distanza e tempo.",
    searchTerms: ["geometria", "equazione secondo grado", "pitagora", "velocità distanza tempo"],
  },
  "everyday-cost-calculator": {
    name: "Calcola costi quotidiani",
    summary: "Confronta prezzi unitari, divide conti, annualizza abbonamenti e stima energia, viaggio e salario orario con ipotesi dichiarate.",
    searchTerms: ["prezzo unitario", "dividi conto", "costo energia", "costo viaggio", "salario orario"],
  },
  "inps-artigiani-commercianti": {
    name: "Contributi INPS artigiani e commercianti 2026",
    summary: "Calcola il profilo standard 2026 con minimale, fasce, massimale e fonti INPS dichiarate, senza applicare riduzioni non coperte.",
    searchTerms: ["inps artigiani 2026", "inps commercianti 2026", "contributi artigiano", "contributi commerciante"],
  },
  "gestione-separata-contributi": {
    name: "Contributi Gestione Separata 2026",
    summary: "Calcola i due profili professionista 2026 coperti dalla circolare INPS con aliquota, base, massimale e soglia per l'accredito annuo.",
    searchTerms: ["gestione separata 2026", "contributi professionista", "aliquota 26,07", "aliquota 24"],
  },
  "ponti-ferie-optimizer": {
    name: "Ponti e ferie 2026",
    summary: "Trova ponti deterministici usando festività nazionali ufficiali 2026, ferie disponibili e la settimana lavorativa che indichi.",
    searchTerms: ["ponti 2026", "ferie 2026", "ottimizza ferie", "calendario ponti"],
  },
  "fatturapa-reader": {
    name: "Leggi una FatturaPA XML",
    summary: "Legge una FatturaPA supportata interamente in locale e mostra schema, parti, documento, righe ed eventuali errori di campo isolati.",
    searchTerms: ["lettore fatturapa", "leggi fattura elettronica xml", "fatturapa xsd"],
  },
  "fatturapa-batch-csv": {
    name: "FatturaPA batch in CSV",
    summary: "Legge più FatturePA XML in locale, isola gli errori per file e crea una tabella CSV completa con schema e riconciliazione dei totali rappresentati.",
    searchTerms: ["fatturapa csv", "fatture elettroniche batch", "xml fatture tabella"],
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
    ...(copy.searchTerms ?? []),
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
