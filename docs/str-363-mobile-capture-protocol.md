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

Usare Node 26, checkout dedicato sul Mac Studio con HEAD noto e consumer
compilato in dist/ nello stesso checkout. Il MiniPC rimane riservato ai servizi
e ai runtime che richiedono Linux: non usarlo per npm, test o build. Acquisire
un lock esclusivo per il dispositivo e servirgli il sito statico. Le route sono
/tools/pdf-rotate/, /tools/image-resize/, /tools/csv-cleaner/.

La cattura `capture-mobile-memory-363.mjs` non pilota il browser: rimane
un campionatore raw separato. Il consumer `tests/str-363-consumer.browser.mjs`
supporta anche Android Chrome **già avviato** tramite
`STR363_ANDROID_SERIAL`, CDP su ADB forward e server compilato raggiungibile
via ADB reverse. Riutilizza i workflow PDF/image/CSV del consumer e il download
reale da Android DownloadManager (non il picker nativo). I file vengono
riaperti indipendentemente con pdf-lib, Sharp/libvips o Python CSV, gli input
conservano il loro SHA-256. La prova resta *parziale*: cancel/retry e preflight
sono globali, non convalidati in ogni caso; mancano background e iOS.

Sul Mac Studio, eseguire `npm ci && npm run check && npm run build`, poi i test
mirati. La prova funzionale Chromium **desktop**, distinta da quella mobile, è:

    STR363_LOCAL_CHROMIUM=1 node tests/str-363-consumer.browser.mjs

Questo avvio usa il Chromium Playwright già installato, con profilo effimero
isolato. Riporta heap JS, rAF e frame di input, completa i 18 workflow desktop
e riapre gli output; **non fornisce misure iOS/Android**.

Su macOS, dopo aver verificato il lock Android, il seriale effettivo,
Chrome installato e **solo se l'AVD è già booted**, eseguire nel checkout:

    ANDROID_HOME="$HOME/Library/Android/sdk" STR363_ANDROID_SERIAL=emulator-5554 \
      node tests/str-363-consumer.browser.mjs

L'acquisizione del lock e il boot del dispositivo precedono **separatamente**
il comando: la variabile `STR363_ANDROID_SERIAL` non prende un lock.

L'output Android, se veramente eseguito, deve dichiarare
`STR363_ANDROID_EMULATOR_PARTIAL_REVIEW_REQUIRED` e salvare il JSON parziale,
gli stdout `dumpsys meminfo` per caso, gli SHA e la revisione HTML in una
nuova directory `quality/receipts/mobile-memory-363/observed/raw/android-consumer-*`.
Il PSS riguarda il solo processo Chrome principale; il JS heap CDP
riguarda il renderer collegato, e il rAF risente dell'automazione. I download
originali restano nella directory temporanea della sessione sul Mac Studio
per il revisore. Nessuna attribuzione fisica né modifica della receipt 36/36
NOT_RUN. L'iOS Simulator richiede un workflow nativo Safari separato, lock
esclusivo e audit di output/recupero. Il consumer Android non promuove
automaticamente alcun caso a PASS.

Riuso: runner Android precedenti ai commit
`9355993243416c27488193492daf8237051277fc` (immagini) e
`f30dcd4ce7bda4d319ff714ec8727b58a88264c3` (PDF/CSV), Playwright
Apache-2.0, pdf-lib MIT, Sharp Apache-2.0; libvips è una dipendenza
transitiva già presente con licenza LGPL-2.1-or-later (nessuna nuova
adozione): https://www.libvips.org/. CDP e Android
`dumpsys meminfo` ufficiali. L'adattamento era necessario perché il
consumer della PR #380 usava solo Chromium desktop, senza file Android nativi.


## Raccolta e parser indipendente

Su Mac Studio, mentre un vero workflow Android compilato è in corso:

    ANDROID_HOME="$HOME/Library/Android/sdk" node scripts/capture-mobile-memory-363.mjs --platform ANDROID_EMULATOR --device emulator-5554 --format image --size S --phase cold --samples 15 --interval-ms 1000 --exclusive-lease-ack STR-363

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

## Disponibilità e prove del 23 ottobre 2026

Nel worktree Mac Studio PR #380 (HEAD `337a8ced`) `npm ci` ha installato
582 pacchetti; Vitest acceptance/refusals 6/6, `npm run check` e `npm run
build` sono riusciti (309 pagine, 307 metadata), così come i 18 workflow
Chromium desktop (S/M/L, cold/warm, PDF/image/CSV e output riaperti).
La connessione Playwright al Chrome remoto CDP è fallita (timeout sul
CDP locale 17630, ECONNRESET sul tunnel 17629): la nuova modalità Chromium
locale isola il consumer dai processi condivisi.

L'iPhone 18 Pro iOS 27 è stato avviato sul Mac sotto lock esclusivo; Appium
3.8.0 e XCUITest 12.19.1 hanno riconosciuto il dispositivo, ma la creazione
della sessione Safari è rimasta in `Setting up simulator` sino al timeout
del client. Anche `simctl openurl` ha restituito NSPOSIXErrorDomain 60
(timeout). Il simulatore è stato spento, il lock rilasciato e i processi
avviati per il test chiusi senza modificare il profilo. **Nessun workflow iOS
è stato osservato**, né sono disponibili memoria/frame/input Safari validi.

Per Android, il download Homebrew è rimasto bloccato senza installare
pacchetti. Gli archivi ufficiali hanno permesso di eseguire ADB 37.0.1,
Temurin JDK 17.0.21 e sdkmanager 20.0 in una cartella temporanea di sessione.
L'installazione dell'emulatore 37.2.12, SDK Platform 35 e immagine Google Play
ARM64 (Android 35) è stata **rifiutata dal gestore per licenze non accettate**:
la shell ha ricevuto exit 0, ma sdkmanager ha indicato esplicitamente
`Skipping following packages as the license is not accepted`. Occorre una
decisione dell'owner sui termini SDK Google prima di proseguire; non sono
disponibili un emulatore Android booted o Chrome Android locale. Nessun
workflow Android è stato osservato. Lo stato ufficiale resta 36/36 NOT_RUN.

## Osservazioni storiche del 20 ottobre 2026

L'iPhone 18 Pro iOS 27, UDID
8C23729B-8544-4182-AD28-75B08E9722E6, è stato avviato dalla
chat #106 sotto lock desktop esclusivo (conferma del coordinatore).
Nessuna interazione #124 è stata eseguita. L'AVD str277-api35,
emulator-5554, è attivo sul MiniPC: #105 è chiusa e un audit #111
lo riserva a #124, ma anche qui vanno verificati i processi e
l'esclusività live prima di usare il browser. Finché non esistono
prove dei 36 workflow, la receipt mantiene NOT_RUN.
