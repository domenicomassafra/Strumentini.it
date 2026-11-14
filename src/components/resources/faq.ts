/** Static, Italian-first answers for the resource hub. */
export const faqs: readonly { readonly question: string; readonly answer: string }[] = [
  {
    question: "Serve un account?",
    answer: "No. Tutti gli strumenti funzionano senza registrazione. L'account serve solo a ritrovare gli strumenti preferiti su un altro dispositivo.",
  },
  {
    question: "Gli strumenti sono davvero gratuiti?",
    answer: "Sì: non c'è un piano a pagamento, un limite di utilizzo o una funzione riservata. Non esiste nemmeno un pulsante per acquistare qualcosa.",
  },
  {
    question: "Conservate i miei file?",
    answer: "Gli strumenti locali elaborano i file nel browser, senza archiviarli sul nostro server. I risultati temporanei non sono recuperabili dopo aver chiuso la scheda. Se scegli espressamente «Conserva questo PDF nel browser», una copia resta nel database locale separato finché non la elimini o il browser non la cancella: non viene sincronizzata con l'account. Il server conserva solo dati dell'account e identificativi dei preferiti, non documenti.",
  },
  {
    question: "Funziona senza rete?",
    answer: "Le operazioni dichiarate locali possono continuare dopo il caricamento dei loro componenti, ma nuove pagine, account e controlli verso servizi esterni richiedono rete. La possibilità di continuare senza connessione dipende anche dai dati e dalle librerie già caricati.",
  },
  {
    question: "Posso usare i risultati per scopi commerciali?",
    answer: "Sì. Quello che produci con gli strumenti è tuo: non rivendichiamo nessun diritto sul risultato e non chiediamo nessuna attribuzione.",
  },
  {
    question: "Cosa succede ai miei dati se svuoto il browser?",
    answer: "I dati memorizzati solo in questo browser, inclusi recenti, preferenze, ultimi risultati brevi ed eventuali PDF conservati volontariamente, possono andare persi. I preferiti già sincronizzati e i dati dell'account possono restare sul server finché non elimini anche l'account: svuotare il browser non li cancella.",
  },
  {
    question: "Esiste un'API?",
    answer: "No. L'unico modo per usare uno strumento è aprirne la pagina: non ci sono endpoint pubblici da chiamare da un tuo script. Puoi però installare l'area di lavoro come app dal browser, perché il manifest è già pubblicato.",
  },
  {
    question: "Perché alcuni strumenti risultano in verifica?",
    answer: "L'indice mostra quali strumenti hanno una certificazione registrata e quali sono ancora in verifica. Una prova precedente non garantisce che ogni variante, browser o nuova versione sia stata verificata: valgono i limiti dichiarati per la singola operazione.",
  },
];
