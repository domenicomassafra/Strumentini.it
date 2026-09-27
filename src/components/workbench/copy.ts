/**
 * Copy — Italian-first, one table.
 *
 * PRODUCT.md and WORLD.md both require that every user-facing string ships
 * Italian-first with English as a secondary. WORLD.md is stricter still: it
 * calls the duplicated all-caps eyebrow a defect and names the ledger,
 * "il total corrente", as the signature moment. So the copy lives here once,
 * in Italian, and the two components read from it rather than each carrying
 * its own inline strings.
 *
 * Where a term has a settled Italian equivalent it is used directly. Where it
 * does not — toolchain nouns like checksum, ZIP, JSON — the established form
 * is kept, because inventing a translation would be worse than the loanword.
 *
 * Section headings deliberately have no eyebrow. WORLD.md requires the eyebrow
 * pattern be removed, so a section is identified by its heading and its count
 * alone. The stage counter is a real index, not an eyebrow, and is owned by
 * the onboarding component rather than this table.
 */

import type { DayCode, WorkProfile } from "../../profile/work-profile";

/** Monday-first, Italian abbreviations, as the ledger shows them. */
export const WEEKDAYS: ReadonlyArray<{ readonly code: DayCode; readonly label: string }> = [
  { code: "MON", label: "Lun" },
  { code: "TUE", label: "Mar" },
  { code: "WED", label: "Mer" },
  { code: "THU", label: "Gio" },
  { code: "FRI", label: "Ven" },
  { code: "SAT", label: "Sab" },
  { code: "SUN", label: "Dom" },
];

export const WEEKDAY_LABELS: Readonly<Record<DayCode, string>> = Object.fromEntries(
  WEEKDAYS.map(({ code, label }) => [code, label]),
) as Readonly<Record<DayCode, string>>;

export const COPY = {
  home: {
    title: "La tua giornata, in colonna",
    lede: "Gli strumenti che usi ogni giorno, con i valori nell'unica colonna in cui li trovi sempre.",
    setupLink: "Prepara il set iniziale",
  },

  yourTools: {
    title: "I tuoi strumenti",
    installedCount: (count: number) => `${count} installati · obiettivo 10–15`,
    open: "Apri",
    manage: "Gestisci",
    moveUp: (name: string) => `Sposta ${name} in alto`,
    moveDown: (name: string) => `Sposta ${name} in basso`,
    remove: "Rimuovi",
    unavailable: "Salvato qui, ma non disponibile nel catalogo attuale.",
    emptyTitle: "Nessuno strumento installato.",
    emptyBody: "Inizia da una sola utilità. Suggerimenti e Libreria completa restano in attesa finché non li chiedi.",
    addFirst: (name: string) => `Aggiungi ${name}`,
    setUpMine: "Prepara i miei strumenti",
    browseLibrary: "Sfoglia la Libreria",
    addTool: "Aggiungi uno strumento",
    hideAvailable: "Nascondi gli strumenti disponibili",
    add: "Aggiungi",
  },

  recent: {
    title: "Recenti",
    clear: "Svuota i recenti",
    empty: "Nessuna attività recente. Input, output, URL e file non vengono conservati qui.",
    runAgain: "Riusa",
    openedTimes: (count: number) => `aperto ${count}×`,
  },

  suggestions: {
    title: "Suggerimenti",
    shown: (count: number) => `${count} suggeriti`,
    empty: "I suggerimenti compaiono quando uno strumento disponibile condivide un'attività, un input, un valore del Profilo di lavoro o un passaggio con i tuoi strumenti.",
    browseFull: "Sfoglia la Libreria completa",
    toolsCount: (count: number) => `${count} strumenti`,
    addLabel: (name: string) => `Aggiungi ${name} alla tua area di lavoro`,
  },

  packs: {
    title: "Pacchetti di lavoro",
    lede: "Ogni pacchetto spiega a chi serve, quali attività copre e perché propone ogni strumento. Aggiunge solo strumenti già certificati Gold.",
    installedCount: (count: number) => `${count} installati`,
    progress: (installed: number, total: number) => `${installed}/${total} presenti`,
    jobs: "Attività",
    defaultReason: (label: string) => `Incluso nel contesto ${label}.`,
    addRecommended: (count: number) => `Aggiungi ${count} consigliati`,
    complete: "Consigliati già presenti",
    remove: "Rimuovi il pacchetto",
    manualRemoval: "Il pacchetto resta comprensibile anche se rimuovi manualmente uno dei suoi strumenti: il tool non viene reinstallato finché non scegli di aggiungere di nuovo i consigliati.",
  },

  workProfile: {
    title: "Profilo di lavoro",
    storedLocally: "Salvato in locale",
    lede: "Gli strumenti compatibili ricevono solo i campi che dichiarano. Un valore cambiato per un'attività resta un override per quell'attività.",
    fields: {
      locale: "Localizzazione",
      timezone: "Fuso orario",
      currency: "Valuta",
      dateFormat: "Formato data",
      numberFormat: "Formato numero",
      preferredUnits: "Unità preferite",
    } as Record<"locale" | "timezone" | "currency" | "dateFormat" | "numberFormat" | "preferredUnits", string>,
    options: {
      system: "Sistema",
      dayFirst: "Giorno prima",
      monthFirst: "Mese prima",
      decimalComma: "Virgola decimale",
      decimalPoint: "Punto decimale",
      metric: "Metrico",
      imperial: "Imperiale",
      mixed: "Misto",
    } as Record<string, string>,
    workweek: "Settimana lavorativa",
    save: "Salva il Profilo di lavoro",
    compactRows: "Righe strumenti compatte",
  },

  portability: {
    title: "Configurazione portabile",
    lede: "L'esportazione include strumenti installati, pacchetti, impaginazione, campi sicuri del Profilo di lavoro e preferenze. Esclude Recenti e il contenuto delle attività.",
    export: "Esporta la configurazione",
    import: "Scegli la configurazione da importare",
    importPreview: "Anteprima importazione",
    applyImport: "Applica l'importazione",
    cancel: "Annulla",
    importRejected: "Importazione non applicata.",
    addedTools: (count: number) => `${count} strumento/i aggiunto/i`,
    removedTools: (count: number) => `${count} strumento/i rimosso/i`,
    profileWillChange: "cambierà",
    preferencesWillChange: "cambieranno",
    packsWillChange: "cambieranno",
    unchanged: "invariato",
  },

  storage: {
    title: "Archiviazione non disponibile.",
    body: "Le modifiche funzionano in questa scheda ma possono andare perse al ricaricamento.",
    retry: "Riprova il salvataggio",
  },

  gutter: {
    /** Shown in the value column when a tool has never produced a value. */
    noValue: "—",
    runtimeState: (label: string) => label,
  },

  runtime: {
    local: "Su questo dispositivo",
    reference: "Solo riferimento",
    network: "Usa la rete",
  },

  provenance: "dal Profilo di lavoro",
  unavailableTool: "Strumento non disponibile — ",

  onboarding: {
    title: "Prepara il tuo set di strumenti",
    lede: "Rispondi solo a ciò che cambia i tuoi strumenti o i valori sicuri. Puoi modificare il risultato prima di salvarlo.",
    skip: "Salta — sfoglia la Libreria",
    stages: {
      1: "Contesto di lavoro",
      2: "Attività ripetute",
      3: "Valori sicuri",
      4: "Revisione del set",
    } as Record<1 | 2 | 3 | 4, string>,
    counters: {
      context: (count: number) => `${count}/3 scelti`,
      jobs: (count: number) => `${count} scelte`,
    },
    prompts: {
      1: "Che lavoro fai?",
      2: "Quali piccoli lavori si ripetono?",
      3: "Imposta i valori sicuri",
      4: "Controlla i tuoi strumenti iniziali",
    } as Record<1 | 2 | 3 | 4, string>,
    hints: {
      1: "Scegli fino a tre contesti. La prima scelta pesa di più sul pacchetto iniziale.",
      2: "Scegli quelle che ti riguardano. Sono segnali di attività, non una promessa di utilità necessarie.",
      3: "Questi valori vengono riusi solo dagli strumenti che li dichiarano. Puoi cambiarli dopo nel Profilo di lavoro.",
      4: "Ogni motivazione proviene dai metadati del contesto o dell'attività scelta. Togli ciò che non ti serve, o cerca nel catalogo un'aggiunta precisa.",
    } as Record<1 | 2 | 3 | 4, string>,
    contextLabel: "Scegli fino a tre contesti",
    jobLabel: "Attività che si ripetono",
    continue: "Continua",
    back: "Indietro",
    review: "Controlla gli strumenti iniziali",
    save: "Salva il set iniziale",
    saving: "Salvataggio in locale…",
    searchLibrary: "Cerca nella Libreria",
    searchPlaceholder: "es. JSON, immagine, calendario",
    searchHint: "Cerca fra gli strumenti del catalogo. Solo quelli con certificazione Gold entrano automaticamente nel set generato.",
    noResultsQuery: "Scrivi un'attività, uno strumento o un formato.",
    noMatch: "Nessuno strumento corrispondente.",
    goldCount: (count: number) => `${count} strumenti certificati Gold`,
    saved: "Salvato in locale. Apertura della tua area di lavoro…",
    storageWarning: "La preparazione resta utilizzabile.",
    footnote: "Nessun accesso, nessun caricamento, nessuna inferenza, nessun account. Il contenuto delle tue attività non fa parte di questa preparazione.",
  },
} as const;

/** Stage index is a real index, not an eyebrow: "02 / 04". */
export function stageIndexLabel(stage: 1 | 2 | 3 | 4): string {
  return `${String(stage).padStart(2, "0")} / 04`;
}

export type ProfileSelectKey = keyof Pick<
  WorkProfile,
  "dateFormat" | "numberFormat" | "preferredUnits"
>;
