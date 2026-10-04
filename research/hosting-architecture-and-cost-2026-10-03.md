
---
kind: owner-provided-llm-conversation
captured: 2026-10-03
sha256: ce00ae3efb8771edb7ad1adb9cbf07272ccfffdcd37ea7cb8c2e6a0212734927
topics: [hosting, costi, cloudflare, minipc, autenticazione, capacity]
---

<!-- Raw owner-provided conversation, kept verbatim below this header. It is
     stage-1 evidence for research/ and for the promoted knowledge in the
     Obsidian vault; the vault itself holds only the distilled claim, because
     raw LLM bodies stay out of it by contract. Do not edit below the rule. -->

---

ma se io compro dominio come strumentiutili.it e dichiarazionipubbliche.it e faccio tipo 300 perosne al gg o 1000 o 10k per dire quanto devo pagare server e dominiod omnio dtipo 14 anno ma tipo invcece server' non puo su mio minipc credo vero?

Elaborato per 31s
Sì, assolutamente: un MiniPC può tecnicamente hostare strumentiutili.it e dichiarazionipubbliche.it, anche con migliaia di visite al giorno. Il punto è che probabilmente non ti conviene usarlo come server pubblico principale, perché oggi per siti di queste dimensioni il cloud può costarti praticamente zero.

La cosa importante è distinguere utenti al giorno da carico computazionale. 10.000 persone che leggono pagine e usano tool leggeri sono niente rispetto a 300 persone che fanno conversione video, AI, OCR o elaborazioni pesanti.

Traffico indicativo   Sito statico / frontend   App con API leggere   VPS classico
300 utenti/giorno   €0/mese   €0/mese probabilmente   ~€6–10/mese
1.000 utenti/giorno   €0/mese   €0–5/mese   ~€6–10/mese
10.000 utenti/giorno   €0/mese   ~€5–20/mese spesso   ~€10–30/mese
100.000+/giorno   può ancora essere €0 per statico   cresce col consumo   da dimensionare
Con Cloudflare Pages, le richieste agli asset statici sono gratuite e illimitate. Le funzioni dinamiche usano Workers: il piano Free arriva a 100.000 richieste Worker al giorno; il piano Paid parte da $5/mese e include 10 milioni di richieste al mese, dopodiché sono $0,30 per milione aggiuntivo.

Quindi potresti tranquillamente avere:

strumentiutili.it → Cloudflare → frontend statico → €0/mese

e magari:

API / database → Cloudflare Workers + D1 → €0 all'inizio, poi eventualmente ~$5/mese.

Anche lo storage è economico: Cloudflare R2 include un free tier di 10 GB, poi lo storage standard costa $0,015/GB/mese, senza costo di traffico in uscita verso Internet.

E il MiniPC?
Puoi farlo. Potresti mettere Docker + Nginx/Caddy sul MiniPC e pubblicarlo tramite Cloudflare Tunnel, quindi neppure necessariamente aprire porte sul router.

E un MiniPC moderno può tranquillamente reggere 10.000 visitatori al giorno se l'app non fa elaborazioni assurde.

Il problema non è tanto la potenza. Sono:

se salta la corrente → sito giù;
se cade Internet a casa → sito giù;
manutenzione e aggiornamenti sono tuoi;
devi pensare a sicurezza, backup e isolamento dalla LAN;
upload/download dipendono dalla tua connessione domestica;
il MiniPC magari ti serve contemporaneamente per altri tuoi servizi.
E soprattutto c'è una cosa buffa: potrebbe costarti più di elettricità tenere il MiniPC acceso 24/7 che mettere il sito su Cloudflare gratis.

Se invece vuoi proprio un Linux server tradizionale, oggi un piccolo Hetzner EU parte circa da €6,53/mese IVA inclusa per CX23, con 2 vCPU, 4 GB RAM e 40 GB NVMe; i server europei includono molto traffico.

Quello che farei per i tuoi due siti
Io farei una struttura del genere:

Dominio
strumentiutili.it → ~€10–15/anno
dichiarazionipubbliche.it → ~€10–15/anno

Hosting
Cloudflare Pages → €0

Backend leggero
Cloudflare Workers → inizialmente €0

Database
Cloudflare D1 → inizialmente €0

File/immagini
R2 → inizialmente €0

Quindi nei primi mesi potresti realmente avere come costo totale:

circa €28/anno per due domini e €0 di server.

Persino arrivando a 10.000 utenti/giorno, se l'architettura è fatta bene e molta roba viene servita dalla cache/CDN, non c'è nessun motivo automatico per passare a un server da €100/mese. Potresti stare ancora nell'ordine di €5–20/mese.

Il MiniPC lo terrei invece per backend privati, job, scraping, automazioni, cron, elaborazioni pesanti, staging, ecc., e non come unico punto da cui dipende il sito pubblico. È un'architettura molto più furba: Cloudflare davanti, MiniPC dietro solo quando serve.

eh ma cerca cper questi due siti il consumo cpu gpu ram ecc di sturmenti o ricerce query ecc come funziona come è faottibile non crdo siano statiche e ppoi se avviene consumo o richeiste deve avvenire sul crhome ram del utente

Elaborato per 4m 33s
Updated the task plan 3 / 3 completed
Sì: hai centrato il punto. “Statico” non significa “non fa nulla”. Significa che il server non esegue il lavoro a ogni click: manda HTML/JS al browser e poi CPU/RAM del Chrome dell’utente fanno il lavoro.

Ho controllato il codice reale dei due progetti e anche il tuo MiniPC reale.

Come sono messi adesso
Operazione   StrumentiUtili.it   DichiarazioniPubbliche.it   Chi paga CPU/RAM
Aprire pagina   statico   statico   CDN + browser
Ricerca nel sito   browser   browser attualmente   PC/telefono utente
Calcoli   browser   quasi nessuno lato pubblico   utente
CSV / testo / JSON   browser   —   utente
Immagini   browser Canvas   —   utente
PDF   browser   —   utente
Hash file   Web Worker + WASM   —   utente
Filtri / ordinamento   browser   browser   utente
Database   nessuno necessario   PostgreSQL   MiniPC/backend
Raccolta fonti   —   backend   MiniPC
Trascrizione / ASR   —   backend/provider   MiniPC + provider
Estrazione claim / AI   —   backend/provider   MiniPC + provider
Generazione record pubblico   —   backend   MiniPC
Visitatori leggono record   —   CDN/browser   non MiniPC
StrumentiUtili: è esattamente come dici tu
Il progetto è già costruito apposta per questo.

Nel wrangler.jsonc attuale non c'è praticamente un backend: Cloudflare riceve semplicemente la cartella dist/ come static assets.

E nel README avete scritto esplicitamente:

deterministic client-side execution for the normal path

Nel codice ho verificato che la ricerca degli strumenti fa questo:

utente scrive "pdf"
       ↓
JavaScript già nel browser
       ↓
cerca nel catalogo locale
       ↓
mostra risultati
Nessuna query va al MiniPC. Nessuna query va a un database.

Persino l'indice di ricerca viene caricato lazy nel Chrome dell'utente.

Quindi:

10.000 utenti
        ↓
10.000 Chrome diversi
        ↓
ognuno usa la propria CPU/RAM
Non:

10.000 utenti
        ↓
il tuo povero MiniPC fa 10.000 elaborazioni
Ed è esattamente l'architettura che sceglierei per StrumentiUtili.

Anche i tool pesanti sono già limitati
Ho controllato i limiti nel codice.

Immagini: massimo 40 MB/file, massimo 16 milioni di pixel. Il resize ha addirittura un controllo esplicito che blocca l'operazione se il working set stimato supera circa 96 MiB di RAM locale.

CSV: massimo 50 MiB, 100.000 righe, 2 milioni di celle.

PDF: massimo 25 MiB per PDF, 200 pagine; alcune operazioni batch arrivano a 100 MiB complessivi.

File hash: viene processato a chunk/Web Worker, quindi non devi necessariamente caricare l'intero file in RAM.

Questi numeri sono importanti perché impediscono che uno apra StrumentiUtili con un telefono da 3 GB e tenti di processare un CSV da 4 GB.

La GPU praticamente non conta. Canvas/browser può sfruttare accelerazione grafica per rendering e immagini, ma non stai facendo AI locale, Stable Diffusion ecc. Non ti serve una GPU server.

Dichiarazioni Pubbliche è più interessante
Qui ci sono due sistemi completamente diversi che non vanno confusi.

1. DichiarazioniPubbliche.it pubblico
È molto più statico di quanto pensavi.

La pagina /esplora/, ad esempio, riceve i dossier e poi React fa:

dossiers.filter(...)
dossiers.sort(...)

direttamente nel browser.

Quindi quando uno cerca:

Meloni immigrazione

attualmente non sta interrogando PostgreSQL.

Fa:

dataset pubblico scaricato
       ↓
RAM del Chrome
       ↓
filter()
       ↓
risultati
Esattamente quello che volevi.

Il bundle pubblico attuale sul MiniPC è minuscolo:

8.908 byte
2 dossier

ovviamente perché siamo ancora all'inizio.

2. Il backend editoriale di Dichiarazioni Pubbliche
Questo invece non può stare nel Chrome dell'utente, e non deve.

Fa cose come:

controllare fonti
      ↓
scaricare contenuti
      ↓
trascrivere
      ↓
estrarre claim
      ↓
cercare evidenze
      ↓
PostgreSQL
      ↓
verification
      ↓
review
      ↓
PUBLIC PROJECTION
Ma la cosa fondamentale è:

questo lavoro non avviene quando Mario Rossi visita DichiarazioniPubbliche.it.

Mario Rossi vede soltanto il prodotto finale.

Quindi puoi avere:

                    TUO MINIPC
                        │
         PostgreSQL + worker + ricerca
                        │
                        │ ogni tanto
                        ▼
               genera projection
                        │
                        ▼
                    CLOUDFLARE
                 HTML + JSON + JS
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       utente 1      utente 2      utente 10.000
       Chrome        iPhone         Chrome
Questa per me è l'architettura giusta per Dichiarazioni Pubbliche.

E il tuo MiniPC?
Qui c'è la sorpresa.

Ho interrogato adesso il tuo MiniPC:

AMD Ryzen 7 5700U
16 thread
30 GiB RAM
~468 GB SSD
AMD Radeon integrata.

Non è affatto un giocattolino.

Il servizio web Dichiarazioni Pubbliche che sta girando adesso consuma circa:

9 MB di RAM.

PostgreSQL sta tranquillamente girando insieme al resto.

Il sistema ha attualmente circa 15 GiB di RAM ancora disponibili su 30 GiB. Il worker Dichiarazioni Pubbliche nel momento della misurazione non era attivo, quindi questo non è un benchmark del workload massimo, ma rende l'ordine di grandezza chiaro.

Per il backend che abbiamo costruito non hai bisogno di GPU.

La GPU diventerebbe interessante solo se decidessimo di fare localmente Whisper grosso, embeddings pesanti, modelli LLM ecc. Attualmente l'architettura usa provider/adattatori per quelle parti.

Quindi 300 / 1.000 / 10.000 visitatori al giorno?
La cosa interessante è questa:

StrumentiUtili.it
300/giorno: irrilevante
1.000/giorno: irrilevante
10.000/giorno: ancora irrilevante dal punto di vista CPU server

Perché il lavoro lo fanno i 10.000 dispositivi degli utenti.

Cloudflare serve soltanto file statici. E Cloudflare conferma che le richieste agli static assets sono gratuite e illimitate.

Quindi potresti avere persino:

100.000 visite/giorno

senza avere un server con 64 GB RAM dietro.

Il problema diventerebbe principalmente banda/CDN, che in questo modello Cloudflare assorbe.

DichiarazioniPubbliche.it
Anche qui 10.000 lettori/giorno non sono il problema.

Perché:

10.000 lettori
≠
10.000 query PostgreSQL
≠
10.000 chiamate AI
≠
10.000 job MiniPC
Possono essere semplicemente:

10.000 × file statici da Cloudflare
Il MiniPC può continuare a fare magari:

50 nuove fonti
200 fetch
20 trascrizioni
100 claim
300 query DB
indipendentemente da quanti lettori arrivano.

C'è però UNA cosa che cambierei in futuro su Dichiarazioni Pubbliche
Oggi /esplora/ manda l'array dei dossier al browser.

Con:

100 dossier → perfetto

1.000 → tranquillissimo

qualche migliaio → probabilmente ancora tranquillo

Ma non voglio arrivare a:

100.000–1.000.000 record

mandando tutto il database pubblico nel JavaScript iniziale.

A quel punto farei:

Chrome
  │
  │ "meloni pensioni"
  ▼
Cloudflare Worker
  │
  ├── indice pubblico/cache
  └── restituisce solo 20 risultati
E comunque non toccherei il MiniPC per la query pubblica.

Cloudflare Workers Free oggi permette fino a 100.000 richieste Worker/giorno, con 128 MB di memoria per invocation; il Paid parte da $5/mese.

Quindi possiamo scalare gradualmente:

FASE 1
100–10k utenti/giorno
↓
tutto static/client side
≈ €0 hosting

FASE 2
dataset Dichiarazioni Pubbliche diventa grosso
↓
search/API su Cloudflare Worker
≈ €0–5/mese

FASE 3
backend editoriale cresce enormemente
↓
MiniPC continua oppure piccolo VPS dedicato
La struttura che sceglierei per noi
StrumentiUtili

strumentiutili.it
      ↓
Cloudflare CDN
      ↓
Astro static
      ↓
Chrome dell'utente
      ↓
CPU + RAM + Canvas + WASM + Web Workers
Dichiarazioni Pubbliche

dichiarazionipubbliche.it
      ↓
Cloudflare CDN
      ↓
Astro static + public projection
      ↓
Chrome dell'utente
   ricerca/filtri

SEPARATAMENTE:

MiniPC
 ├ PostgreSQL
 ├ scheduler
 ├ source watcher
 ├ research
 ├ worker
 ├ AI/provider calls
 └ genera nuova public projection
             ↓
         Cloudflare
Quindi sì, la tua intuizione è giusta: ogni volta che è tecnicamente sensato, vogliamo spostare il consumo su CPU/RAM del browser dell'utente, soprattutto per StrumentiUtili.

E la cosa migliore è che il codice attuale è già sorprendentemente vicino a questa architettura. Non comprerei oggi nessun server per questi due siti. Terrei il MiniPC per il backend privato di Dichiarazioni Pubbliche e metterei entrambi i front-end pubblici su Cloudflare.

vabbè magari inizio free ma anche se una vps o che so server costa tipo 3-5 europ al mese lo compro dai eh. per dire. o su minipc. mgari vedi quanot peserebbe e se reggerebbe quel sito con 100 utenti non so se si possa simulare tipo

Elaborato per 3m 22s
Updated the task plan 3 / 3 completed
Sì, e l’ho simulato davvero sul tuo MiniPC. La conclusione è abbastanza netta: per 100 utenti contemporanei il MiniPC è enormemente sovradimensionato per questi siti, almeno per la parte web.

Ho fatto il test prima col server Python di preview e poi con Caddy, cioè qualcosa di molto più vicino a come lo serviremmo davvero in produzione. Sul MiniPC ho messo temporaneamente anche la build attuale di StrumentiUtili e poi ho ripulito tutto.

Test, 100 concorrenti   Risultato   Throughput   p95   p99   RAM server
Dichiarazioni Pubbliche /esplora/   3000/3000 OK   3129 req/s   46 ms   58 ms   ~40 MB
StrumentiUtili home   3000/3000 OK   3283 req/s   43 ms   53 ms   ~40 MB
StrumentiUtili image-resize   3000/3000 OK   3015 req/s   47 ms   59 ms   ~40 MB
Zero errori.

E considera che il tuo MiniPC è:

Ryzen 7 5700U / 16 thread / 30 GB RAM.

Quindi non siamo nella situazione “forse regge 100 utenti”. Siamo più nella situazione:

100 contemporanei non gli fanno praticamente paura.

Il web server Caddy stava usando circa 40 MB di RAM durante il bombardamento. Non 4 GB, non 10 GB: decine di MB.

Una cosa interessante: con il server Python di preview avevo visto p99 di 2–3 secondi a 100 concorrenti, pur senza errori. Passando a Caddy siamo scesi a circa 50–60 ms p99. Questo conferma che il limite non era il MiniPC ma semplicemente il server di sviluppo.

Però questo test va interpretato bene
L'ho fatto all'interno del MiniPC, quindi non misura:

la tua velocità Internet in upload;
latenza Bari → utente;
eventuale Cloudflare Tunnel;
100 browser completi che scaricano contemporaneamente CSS/font/JS;
utenti che contemporaneamente fanno elaborazioni client-side.
Ma questa è proprio la parte interessante: le elaborazioni di StrumentiUtili — PDF, immagini, CSV, hash ecc. — girano sul computer dell'utente, quindi non aumentano la CPU del MiniPC.

Perciò il primo collo di bottiglia se ospitassimo tutto da casa sarebbe molto probabilmente la connessione Internet, non Ryzen/RAM.

E con Cloudflare davanti anche quello viene enormemente attenuato, perché CSS, JS, immagini, font ecc. vengono cachati sui server Cloudflare e non richiesti ogni volta a casa tua.

100 utenti contemporanei ≠ 100 utenti al giorno
Il test che ho appena fatto è parecchio più cattivo.

Se dicessi:

100 utenti/giorno, è praticamente niente.

1.000 utenti/giorno, niente.

10.000 utenti/giorno, per questi due frontend ancora tranquillissimo.

Persino immaginando decine di richieste per visita, il carico medio è lontanissimo dalle ~3.000 richieste/sec che abbiamo appena osservato in locale.

E una VPS da 3–5 €?
Qui ti do ragione: visto quanto costa poco, non dobbiamo intestardirci a risparmiare €5/mese.

Oggi OVH ha un VPS-1 a €4,65/mese IVA inclusa con:

2 vCore
4 GB RAM
40 GB NVMe
500 Mbps
traffico illimitato
backup giornaliero incluso.

Ed è già enormemente sufficiente per servire questi siti.

Hetzner, dopo l'adeguamento prezzi del giugno 2026, ha per esempio il CX23 a €5,49/mese IVA esclusa e senza IPv4; quindi oggi non è più propriamente nella fascia €3–5 finale per un cliente italiano.

Io farei così
Per StrumentiUtili non comprerei nemmeno una VPS all'inizio:

Cloudflare statico → gratis.

Non perché dobbiamo risparmiare €5, ma perché è proprio tecnicamente migliore. Hai CDN globale, niente server da amministrare e il lavoro pesante lo fanno i browser.

Per Dichiarazioni Pubbliche, invece:

PUBBLICO

dichiarazionipubbliche.it
    ↓
Cloudflare
    ↓
VPS €4,65/mese
    ↓
Caddy
    ↓
sito / public API / projection
e:

PRIVATO

MiniPC
 ├─ PostgreSQL
 ├─ source watcher
 ├─ scheduler
 ├─ worker
 ├─ ricerca
 ├─ trascrizioni
 ├─ AI/provider
 └─ costruzione projection
          ↓
       VPS/CDN
Questa secondo me è la combinazione più bella.

Il tuo MiniPC fa le cose pesanti e private, dove i suoi 8 core/16 thread e 30 GB servono davvero.

La VPS da €4,65 fa la cosa stupida ma importante: essere online 24/7 con datacenter, rete 500 Mbps, IP pubblico e backup, indipendentemente da corrente/router/Internet di casa.

E Cloudflare sta davanti a entrambi.

Quindi con circa:

domini: ~€20–30/anno complessivi
VPS: ~€56/anno
Cloudflare: €0

sei nell'ordine di €7/mese tutto compreso mediamente, e hai già un'architettura che non mi preoccuperebbe affatto neanche con migliaia di visitatori al giorno.

Il dato più utile di oggi comunque è questo: il MiniPC ha superato 100 concorrenti / ~3.000 richieste al secondo senza errori e con ~40 MB di RAM lato web server. Quindi possiamo tranquillamente smettere di preoccuparci della potenza hardware per il traffico iniziale.

si esatto. e claudlfare sicuro? devo implmentare anche login degli uternti

Elaborato per 1m 42s
Ran npm run acceptance:auth
Sì: Cloudflare è una base sensata e abbastanza robusta, ma va configurato bene. Non è “metto Cloudflare e sono invulnerabile”. Sul piano pratico ti dà HTTPS/TLS, CDN, mitigazione del traffico malevolo, WAF e rate limiting; anche il piano Free ha il Free Managed Ruleset e una regola di rate limiting.

E sul login c’è una cosa importante: su StrumentiUtili lo abbiamo già quasi completamente implementato. Ho appena verificato il codice e lanciato i test: 12/12 unit test auth PASS e 121/121 controlli acceptance PASS. Ci sono già registrazione, login/logout, sessioni multiple, cambio password, revoca delle altre sessioni, cancellazione account, preferiti sincronizzati e cookie HttpOnly; Secure; SameSite=Lax.

Quindi io imposterei così:

StrumentiUtili.it: nessun login obbligatorio. I 200 strumenti continuano a funzionare gratis e localmente; login opzionale per preferiti, configurazione e futura sincronizzazione tra dispositivi.
DichiarazioniPubbliche.it pubblico: nessun login per leggere/cercare fact-check e record.
Dichiarazioni Pubbliche Studio/admin: login obbligatorio e separato; qui userei Cloudflare Access davanti a /studio/* o admin.dichiarazionipubbliche.it. Access fa da identity-aware proxy e può essere deny-by-default.
Però non metterei online il login StrumentiUtili esattamente com’è adesso. Prima del deploy sistemerei quattro cose importanti.

La prima è il database production: il Worker è già configurato per D1, ma nel wrangler.jsonc manca ancora il database_id reale. Cloudflare lo richiede per il binding production.

La seconda è Turnstile su registrazione/login e soprattutto su eventuale recupero password. Il token va validato nel Worker server-side; Cloudflare specifica che il controllo solo nel browser non è sufficiente.

La terza è il rate limit. Noi abbiamo già 10 login falliti / 15 minuti / IP nel Worker; aggiungerei anche il rate limit Cloudflare davanti a /api/auth/*, esattamente il tipo di utilizzo per cui Cloudflare documenta la funzione.

La quarta è l'hashing password. Attualmente il nostro codice usa PBKDF2-SHA256 a 210.000 iterazioni. È molto meglio di salvare password normalmente e usa salt casuale, ma l'attuale raccomandazione OWASP per PBKDF2-HMAC-SHA256 è 600.000+ iterazioni; per un'app nuova OWASP preferisce Argon2id quando disponibile. Cloudflare Workers supporta PBKDF2 nativamente, mentre node:crypto su Workers non supporta Argon2.
 Quindi qui semplicemente porterei PBKDF2 almeno a 600k e manterrei il formato versionato che abbiamo già previsto.

La struttura finale sarebbe quindi:

STRUMENTIUTILI.IT

Cloudflare
├─ CDN / WAF / rate limiting
├─ pagine + strumenti statici
│      ↓
│   browser utente
│   CPU/RAM locale
│
└─ /api/auth/*
       ↓
   Worker
       ↓
   D1
   users
   sessions
   favorites
e:

DICHIARAZIONIPUBBLICHE.IT

pubblico
Cloudflare CDN
     ↓
static/public projection
     ↓
nessun login


studio.dichiarazionipubbliche.it
     ↓
Cloudflare Access
     ↓
solo noi/operatori autorizzati
     ↓
backend MiniPC/PostgreSQL
Questa è una struttura che mi piace molto perché anche se introduciamo account, non trasformiamo StrumentiUtili in un SaaS pesante: i file continuano a non essere caricati sul server, la CPU continua a essere quella del cliente e nel database teniamo soltanto cose piccole tipo user, session, favorite, preferenze.

Quindi sì: login utenti sì, ma opzionale per StrumentiUtili; nessun login per i lettori di Dichiarazioni Pubbliche; login molto più protetto per lo Studio privato. E la parte StrumentiUtili non è da costruire da zero: è già funzionante localmente, va principalmente hardennata e collegata al D1 production prima del deploy.




