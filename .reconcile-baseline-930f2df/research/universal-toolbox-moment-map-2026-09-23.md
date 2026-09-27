# Universal toolbox — moment map e novelty research

Data: 2026-09-23

Stato: RESEARCH ONLY. Nessuna PROMOTE decision.

## Domanda

Non: “quali calculator/converter aggiungere?”

Ma:

> Quali momenti digitali universali richiedono oggi piccoli lavori ripetitivi, possono essere risolti quasi interamente nel browser, hanno costo marginale quasi nullo e possono diventare un asset utile per anni?

## Regola di selezione

Un candidato è interessante se:

1. il bisogno è comprensibile senza spiegazione tecnica;
2. l’utente porta già l’input (file, cartella, export, testo, lista);
3. il lavoro può essere deterministico o fail-closed;
4. il file/dato può restare sul dispositivo;
5. il server può restare quasi statico;
6. non richiede moderazione, community o contenuti quotidiani;
7. il valore non dipende da una chiamata LLM per ogni uso;
8. il core rimane utile per anni;
9. il risultato è più utile di una risposta generativa testuale;
10. esiste un “done” chiaro.

## 100 momenti universali

### A. Prima di condividere / pubblicare

1. Controllare se una foto contiene GPS/EXIF sensibili.
2. Controllare se un Office contiene commenti, revisioni o autore.
3. Controllare se un PDF ha testo nascosto o redazioni inefficaci.
4. Rimuovere metadata prima di inviare un file.
5. Redigere visivamente uno screenshot.
6. Cercare token/API key/segreti in testo o file prima di pubblicarli.
7. Rendere portabile un nome file prima di inviarlo.
8. Ridurre dimensione senza distruggere qualità utile.
9. Creare una copia “safe to share” lasciando intatto l’originale.
10. Generare un report di ciò che è stato rimosso.

### B. Prima di upload / submit / deliver

11. Verificare limite byte.
12. Verificare tipo reale del file, non solo estensione.
13. Verificare dimensioni pixel/aspect ratio.
14. Verificare numero pagine.
15. Verificare naming rules.
16. Preparare una copia compatibile con un requisito dichiarato.
17. Verificare di nuovo l’output effettivo dopo la trasformazione.
18. Costruire ZIP pulito senza .DS_Store/Thumbs/junk.
19. Generare manifest/checksum della consegna.
20. Verificare che il pacchetto contenga tutti i file attesi.

### C. Dopo download / export

21. Capire che file è davvero.
22. Vedere cosa contiene un archivio senza fidarsi del nome.
23. Controllare se lo ZIP è estraibile.
24. Inventariare file, dimensioni e tipi.
25. Trovare file duplicati.
26. Trovare nomi in conflitto.
27. Normalizzare encoding.
28. Trovare record malformati.
29. Controllare che un export abbia le categorie attese.
30. Creare un manifest del download appena ricevuto.

### D. Quando un file non apre / non importa

31. Diagnosticare MIME/estensione incoerente.
32. Diagnosticare BOM/line endings/quote CSV.
33. Diagnosticare JSON/XML/YAML invalido.
34. Diagnosticare VCF malformato.
35. Diagnosticare ICS malformato.
36. Diagnosticare encoding testo.
37. Diagnosticare ZIP/archivio danneggiato.
38. Riparare soltanto trasformazioni conservative.
39. Mostrare esattamente cosa verrebbe cambiato.
40. Produrre copia riparata e report.

### E. Quando cambio app / servizio / device

41. Deduplicare contatti.
42. Normalizzare numeri telefonici.
43. Convertire contatti fra varianti VCF/CSV.
44. Unire calendari ICS.
45. Deduplicare eventi.
46. Riparare timezone/recurrence quando deterministico.
47. Pulire bookmark export.
48. Normalizzare URL e tracking params.
49. Convertire password CSV fra gestori supportati.
50. Ispezionare grandi export personali come Takeout.

### F. Verificare una migrazione

51. Confrontare conteggi source/target.
52. Confrontare identità/logical IDs quando disponibili.
53. Verificare che i contatti non siano spariti.
54. Verificare che eventi/recurrence siano sopravvissuti.
55. Verificare gerarchia dei bookmark.
56. Verificare file foto/video e metadata essenziali.
57. Verificare membership di album/collezioni quando esportabile.
58. Verificare allegati.
59. Elencare missing/extra/transformed.
60. Generare un receipt di migrazione.

### G. Prima di cancellare / resettare / vendere

61. Verificare che esista davvero una seconda copia.
62. Verificare che la copia sia leggibile.
63. Confrontare cartella originale e backup.
64. Confrontare originale e archivio ZIP/TAR.
65. Verificare checksums.
66. Aprire/campionare formati critici.
67. Trovare cartelle locali non incluse nel backup noto.
68. Registrare cosa non è verificabile.
69. Produrre una checklist “safe to delete?”.
70. Bloccare un verdict positivo se la prova è incompleta.

### H. Dopo conversione / trasformazione

71. Verificare che il numero di pagine sia rimasto coerente.
72. Verificare che il testo essenziale sia sopravvissuto.
73. Verificare tabelle/righe/colonne.
74. Verificare immagini/media embedded.
75. Verificare link.
76. Verificare dimensioni e risoluzione.
77. Verificare metadata richiesti.
78. Evidenziare perdite inevitabili del formato target.
79. Comparare source e output semanticamente.
80. Generare un conversion receipt.

### I. Ripulire / organizzare dati locali

81. Sort/dedupe liste.
82. Set difference/intersection fra liste.
83. Rimuovere caratteri invisibili.
84. Normalizzare Unicode.
85. Normalizzare date/timezone.
86. Rinominare batch file con preview.
87. Trovare duplicati byte-identici.
88. Trovare near-duplicate immagini con perceptual hash.
89. Inventariare folder size/type.
90. Trovare file orfani/zero-byte/nomi problematici.

### J. Verificare / provare

91. Hash singolo file.
92. Hash intera cartella.
93. Verificare SHA256SUMS.
94. Confrontare due versioni di cartella.
95. Confrontare due file binari.
96. Confrontare testo/JSON/CSV/XML.
97. Verificare che una copia sia byte-identica.
98. Verificare che una copia trasformata sia semanticamente equivalente.
99. Esportare un report self-contained HTML/JSON.
100. Conservare un receipt locale con engine/ruleset/version.

## Novelty blockers trovati

La ricerca 2026 mostra che NON sono abbastanza originali come core:

- toolbox con 50–300+ utility client-side;
- “Drop Anything Here” con auto-detection e suggerimenti;
- safe-to-share / metadata stripping generalista;
- upload preflight generico;
- social/platform image presets;
- folder compare/hash;
- ZIP pulito + manifest/checksum;
- bookmark cleaner;
- CSV repair;
- Google Takeout viewer/processor;
- source-backed calculator;
- recipe chaining tipo CyberChef;
- generic file inspector.

Molte di queste restano ottime primitive interne.

## Pattern emergente: da UTILITY a PROOF

Le aree più affollate rispondono a:

- “trasforma questo”;
- “converti questo”;
- “comprimi questo”;
- “fammi questo calcolo”.

La zona meno ovvia risponde invece a:

> “Posso fidarmi del risultato abbastanza da fare il passo irreversibile successivo?”

Esempi:

- posso cancellare l’originale?;
- la migrazione ha portato davvero tutto?;
- questa conversione ha perso contenuto?;
- questo export è abbastanza completo da chiudere l’account?;
- questo backup è leggibile, non solo presente?;
- il nuovo servizio contiene davvero ciò che c’era nel vecchio?

## Shortlist v1

### 1. MoveProof / Migration Verifier — STRONG CANDIDATE

Input: source export/folder + target export/folder.

Output:

- inventory;
- missing/extra;
- byte-level matches;
- semantic matches;
- per-format checks;
- uncertainty;
- self-contained receipt.

La parte originale non può essere “folder diff”, già commodity. Deve essere **semantic migration verification for normal people**.

Moduli possibili:

- Contacts: identities, duplicates, fields lost;
- Calendar: events, recurrence, timezone;
- Bookmarks: URL identity + hierarchy;
- Photos: file presence, date/location metadata, album membership when available;
- Mail: folder/message/attachment counts where parseable;
- generic files: path/size/hash.

### 2. DeleteSafe / “Can I delete the original?” — STRONG CANDIDATE

Un prodotto costruito attorno al momento irreversibile.

Non crea il backup: verifica la prova disponibile prima della cancellazione.

Possible flow:

1. scegli ORIGINAL;
2. scegli BACKUP / EXPORT / DESTINATION;
3. local inventory;
4. hash/semantic checks;
5. unreadable/missing/extra;
6. confidence per categoria;
7. verdict solo su ciò che è realmente provato;
8. receipt.

Questo potrebbe essere la UX consumer sopra lo stesso engine di MoveProof.

### 3. RoundTrip / Conversion Proof — CANDIDATE

Input: originale + output convertito.

Verifica non soltanto pixel o bytes, ma proprietà pertinenti:

- text coverage;
- page count/order;
- headings/tables;
- image count;
- hyperlinks;
- sheet/row/column counts;
- dimensions/duration;
- metadata explicitly expected.

Esistono soluzioni enterprise per conversion QA; la possibile originalità è un’esperienza consumer/local/browser-first.

### 4. Portability Repair Lab — CANDIDATE

Ripara export personali anziché file generici:

- Takeout;
- VCF;
- ICS;
- bookmark HTML;
- password CSV;
- photo metadata sidecars;
- app/service CSV/JSON.

Rischio: ogni adapter aumenta manutenzione. Deve essere limitato a formati stabili e molto usati.

### 5. Everyday Preflight — UMBRELLA, NON ANCORA CORE

Organizzazione per momenti:

- BEFORE SHARE;
- BEFORE UPLOAD;
- BEFORE MOVE;
- BEFORE DELETE;
- AFTER CONVERT;
- AFTER EXPORT.

Come architettura/brand può essere forte, ma molti singoli preflight hanno incumbent diretti. Non è ancora sufficiente per PROMOTE.

## Perché MoveProof/DeleteSafe sembrano migliori

### Originalità relativa

La ricerca restituisce:

- molti folder diff/hash locali;
- molte guide “controlla il backup prima di cancellare”;
- strumenti enterprise di migration validation;
- molta frustrazione consumer su export incompleti.

Non è emerso nel primo passaggio un incumbent consumer generalista che:

1. confronti source e destination/export;
2. capisca più domini personali;
3. faccia semantic verification;
4. lavori local-first;
5. produca un receipt comprensibile;
6. sia costruito esplicitamente attorno alla decisione irreversibile “ora posso cancellare?”.

Questo NON prova unicità assoluta. È il migliore spazio ancora aperto nel corpus attuale.

## Evidence di problema particolarmente forte

Google Takeout / photo migration produce discussioni ricorrenti su:

- album o foto mancanti;
- metadata separati/difficili da ricostruire;
- esportazioni parziali;
- persone che cancellano l’originale e scoprono dopo il problema.

La stessa logica vale più in generale per device reset, account deletion e cambio servizio.

## Architettura low-ops candidata

Static site/PWA:

- HTML/CSS/JS;
- Web Workers;
- File System Access API dove disponibile;
- webkitdirectory fallback;
- streaming hashing;
- parsers per ZIP/VCF/ICS/CSV/JSON/HTML/MBOX dove ragionevole;
- IndexedDB/OPFS solo locale e opzionale;
- WASM lazy-loaded solo per formati pesanti;
- nessun upload di default;
- nessun account;
- nessun DB remoto;
- zero LLM nel normal path.

Backend:

- idealmente nessuno;
- analytics privacy-safe opzionali e separati;
- update manifest/static rules soltanto.

Costo marginale: vicino a zero.

## Cosa NON fare

- non partire da 300 tool;
- non competere su feature count;
- non fare “iLovePDF ma privacy-first”;
- non promettere “safe” quando il browser non può provarlo;
- non usare AI per decidere completezza;
- non fare semantic guessing quando manca una corrispondenza deterministica;
- non dire che una migrazione è completa se si è verificato solo un sample.

## Falsification test successivo

Prima di PROMOTE:

1. cercare almeno 20 competitor/adjacent prodotti specifici per migration/backup verification consumer;
2. raccogliere almeno 20 pain evidence indipendenti su perdita post-migrazione/export/backup;
3. definire 5 coppie di formati ad alta frequenza;
4. costruire manualmente un “migration receipt” su 5 casi reali/sintetici senza software;
5. verificare se il receipt scopre errori che un normale folder compare non scopre;
6. stop se il valore aggiunto rispetto a folder diff/hash è marginale.

## Decisione corrente

Generic toolbox: REJECT AS CORE.

Everyday Preflight: KEEP-RESEARCHING.

Portability Repair Lab: KEEP-RESEARCHING.

RoundTrip / Conversion Proof: KEEP-RESEARCHING.

MoveProof / DeleteSafe: **strongest current research candidate, still NOT PROMOTED**.

## 2026-09-23 scope correction — adaptive toolbox for knowledge workers

The previous proof-tool direction is too specific to define the whole product. Keep proof/migration utilities as possible modules, not as the core identity.

New candidate thesis:

> a personal utility workspace that configures itself around what the user does for work, then remains modular and editable.

The product is not a static directory of 200 tools. It starts with onboarding:

1. role / kind of work;
2. country and locale;
3. employee / freelancer / business / student / mixed;
4. recurring task types;
5. common file/data formats;
6. preferred currency/timezone;
7. optional profile values reused across tools.

It then produces a small default workspace (for example 10-15 tools) and allows the user to add/remove modules from a larger catalog.

### Competitor blockers

- ToopTools already offers 200+ client-side tools with a personalized workspace, pinning and rearrangement.
- Moderrno already uses role selection + modular workspace installation, but is oriented to planning/management modules rather than deterministic micro-utilities.
- Freelancer Toolkit / Freelero / Athynex already group utilities by freelancer job-to-be-done.
- ToolsByRole and similar directories organize external AI tools by profession.

Therefore none of the following are enough novelty:

- favorites/pinning;
- categories;
- a freelancer tools page;
- role tabs;
- privacy-first/client-side;
- “all tools in one place”.

### Possible differentiator to falsify

The combination to research is:

1. **role-aware onboarding** that creates the initial toolbox automatically;
2. **profile-aware tools** that share safe user defaults (locale, currency, timezone, working hours, hourly/day rate, company data, recurring preferences);
3. **tool packs by profession**, installable/removable as modules;
4. **deterministic local execution** for the normal path;
5. **one command palette / search surface** across all tools;
6. **no forced SaaS workflow**: tools are small, single-purpose and finish a task;
7. **optional account only for sync**, not required to process files/data;
8. **portable toolbox configuration** that can be exported/imported.

The intended feeling is closer to a browser-based “utility OS” for work than to a calculator directory.

### Candidate target hierarchy

Best initial wedge to research:

1. independent knowledge workers: freelancers, consultants, solopreneurs, small-agency operators;
2. broader knowledge workers;
3. profession-specific packs (marketing, creators, research/academia, developers, office/admin, finance-lite);
4. eventual general consumer packs only if they fit.

Reason: independent workers have a wider mix of small cross-domain tasks and less enterprise tooling standardization, while remaining broad enough to avoid an Italy-only fiscal-tool identity.

### Example catalog shape

Universal core:

- PDF/image/file transforms;
- text cleanup;
- table/CSV cleanup;
- list diff/dedupe;
- date/time/timezone;
- URL/UTM/QR;
- unit/currency helpers;
- screenshot/image preparation;
- document metadata inspection;
- hash/checksum;
- quick charts;
- simple calculators.

Independent-work pack:

- project/day/hour rate;
- effective hourly rate;
- scope-creep cost;
- payment-fee gross-up;
- late-payment calculator;
- invoice helper;
- proposal budget sanity check;
- utilization/capacity;
- client timezone overlap;
- deadline/business-days;
- margin/markup;
- retainer capacity.

Research/knowledge pack:

- DOI/ISBN cleanup;
- citation format conversion;
- bibliography dedupe;
- CSV/table cleanup;
- text comparison;
- word/token counts;
- PDF page/extraction utilities;
- timeline/date normalization.

Marketing/content pack:

- UTM builder;
- campaign naming;
- aspect-ratio/image sizing;
- social text length checks;
- URL cleanup;
- CSV audience cleanup;
- simple ROAS/CPA/CPC calculators.

Developer/data pack:

- JSON/YAML/TOML;
- regex;
- JWT;
- hashes;
- UUID;
- cron;
- epoch/date;
- CSV/JSON;
- diff;
- URL encoding.

### UX hypothesis

Avoid a home page with 200 cards.

Default home should show:

- “Your tools”;
- recent tools;
- recommended additions based on role;
- command palette;
- category/library drawer.

Google account can be offered during onboarding for cross-device sync, but anonymous/local mode should remain possible. Sensitive file processing stays local even for signed-in users.

### Current decision

Adaptive role-aware utility workspace: **KEEP-RESEARCHING**.

The concept is more aligned with the desired breadth than the earlier worker/fiscal or migration-proof direction, but direct novelty is not yet proven because ToopTools and modular role-based workspaces cover parts of the idea.
