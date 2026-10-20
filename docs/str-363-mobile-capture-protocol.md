# STR-363: raccolta raw su simulatori (WIP)

Issue #124, PR draft #380. La receipt di riferimento mantiene **36/36
NOT_RUN**: la procedura raccoglie campioni verificabili, ma non completa
automaticamente alcun caso di acceptance.

## Esclusività e preparazione

Prima di agire sul dispositivo, verificare rilascio del precedente owner,
assenza di sessioni concorrenti e acquisire una riserva esclusiva sullo stesso
host. L'argomento --exclusive-lease-ack STR-363 è soltanto una
dichiarazione dell'operatore, **non dimostra un lock**. Non avviare,
spegnere o controllare simulatori impegnati da #106, #105, #111 o dFarming.

Usare Node 26, checkout dedicato con HEAD noto e consumer compilato in dist/
nello stesso checkout. Sul MiniPC serializzare build e test con
flock -w 1800 /tmp/strumentini-it-heavy.lock. Servire il sito statico da
un host raggiungibile dal dispositivo. Le route reali sono
/tools/pdf-rotate/, /tools/image-resize/, /tools/csv-cleaner/.

La cattura non pilota il browser. Occorrono inoltre workflow S/M/L per
ogni formato e fase cold/warm, eventi UI misurati, background/cancel/retry,
preflight di limite, file scaricato e suo reopen indipendente. Associare
sempre gli hash dei byte reali e le prove della sessione ai log.

## Raccolta e parser indipendente

Su MiniPC, mentre un vero workflow del browser compilato è in corso:

    ANDROID_HOME=/home/udodo/Android/Sdk node scripts/capture-mobile-memory-363.mjs --platform ANDROID_EMULATOR --device emulator-5554 --format image --size S --phase cold --samples 15 --interval-ms 1000 --exclusive-lease-ack STR-363

Su Mac Studio, **solo dopo** un'assegnazione iOS esclusiva:

    node scripts/capture-mobile-memory-363.mjs --platform IOS_SIMULATOR --device UDID_REALE --format pdf --size M --phase warm --samples 15 --interval-ms 1000 --exclusive-lease-ack STR-363

Il collector non effettua boot, tap, upload né download. Scrive una
directory univoca sotto quality/receipts/mobile-memory-363/observed/raw/,
con manifest.json, log raw immutabili, SHA-256 per ogni snapshot, SHA
dell'HTML compilato e del collector e revisione Git. Non sovrascrive dati.

    node scripts/parse-mobile-memory-363-raw.mjs quality/receipts/mobile-memory-363/observed/raw/NOME_CATTURA

Il parser indipendente verifica i byte dei log e la provenance del
checkout. Quando Android emette la riga TOTAL, calcola soltanto un
**massimo PSS campionato del processo principale** com.android.chrome.
La memoria di renderer/GPU e degli altri processi non è compresa
automaticamente. Per iOS, simctl ps produce una lista raw di processi;
non viene dichiarata una misura attendibile del totale Safari.

Il tempo necessario a eseguire il campionatore non è latenza di input,
tempo elaborazione o pacing dei frame. Il parser termina con exit 1 se
incontra incongruenze, exit 2 con INCOMPLETE_REVIEW_REQUIRED in caso
di campioni coerenti. **Mai PASS o exit 0**. Anche hash e identità
coerenti non autenticano la sessione: un reviewer distinto deve
confrontare lease, schermate, tracce, operazioni e output riaperti.
Il controllo ufficiale compilato resta
npx tsx scripts/check-mobile-memory-363.ts (BLOCKED sino a prove complete).

## Disponibilità osservata il 20 ottobre 2026

L'iPhone 18 Pro iOS 27, UDID
8C23729B-8544-4182-AD28-75B08E9722E6, è stato avviato dalla
chat #106 sotto lock desktop esclusivo (conferma del coordinatore).
Nessuna interazione #124 è stata eseguita. L'AVD str277-api35,
emulator-5554, è attivo sul MiniPC: #105 è chiusa e un audit #111
lo riserva a #124, ma anche qui vanno verificati i processi e
l'esclusività live prima di usare il browser. Finché non esistono
prove dei 36 workflow, la receipt mantiene NOT_RUN.
