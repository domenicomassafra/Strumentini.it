/**
 * Copy — Italian-first, one table.
 *
 * PRODUCT.md requires every user-facing string to ship Italian-first; WORLD.md
 * requires that a surface is identified by its heading rather than by a
 * duplicated all-caps eyebrow. The strings that onboarding and the settings
 * page share live here once instead of in two inline copies.
 *
 * Where a term has a settled Italian equivalent it is used directly. Where it
 * does not — toolchain nouns like checksum, ZIP, JSON — the established form is
 * kept, because inventing a translation would be worse than the loanword.
 *
 * Certification is described in the words the rest of the site uses
 * ("Verificato" / "In verifica"); the internal "Gold" label is not public copy.
 */

import type { DayCode, WorkProfile } from "../../profile/work-profile";

/** Monday-first, Italian abbreviations. */
export const WEEKDAYS: ReadonlyArray<{ readonly code: DayCode; readonly label: string }> = [
  { code: "MON", label: "Lun" },
  { code: "TUE", label: "Mar" },
  { code: "WED", label: "Mer" },
  { code: "THU", label: "Gio" },
  { code: "FRI", label: "Ven" },
  { code: "SAT", label: "Sab" },
  { code: "SUN", label: "Dom" },
];

export const COPY = {
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
    save: "Salva il profilo di lavoro",
    compactRows: "Righe strumenti compatte",
  },

  onboarding: {
    title: "Benvenuto su Strumenti Utili!",
    lede: "Quattro domande rapide per preparare i tuoi strumenti: potrai cambiarli quando vuoi.",
    skip: "Salta — sfoglia tutti gli strumenti",
    start: "Inizia",
    steps: {
      1: "Benvenuto",
      2: "Cosa vuoi fare?",
      3: "Quali categorie usi di più?",
      4: "I tuoi strumenti consigliati",
    } as Record<1 | 2 | 3 | 4, string>,
    stepCount: (stage: number) => `${stage} di 4`,
    progressLabel: "Avanzamento della preparazione",
    counters: {
      context: (count: number) => `${count}/3 scelti`,
      jobs: (count: number) => `${count} scelte`,
    },
    prompts: {
      2: "Cosa vuoi fare?",
      3: "Quali categorie usi di più?",
      4: "Ecco i tuoi strumenti consigliati!",
    } as Record<2 | 3 | 4, string>,
    hints: {
      2: "Scegli fino a tre contesti: la prima scelta pesa di più sul set iniziale. Serve almeno una scelta per continuare.",
      3: "Scegli quelle che ti riguardano. Sono segnali di attività, non una promessa di strumenti necessari.",
      4: "Ogni motivazione proviene dai metadati del contesto o dell'attività scelta. Togli ciò che non ti serve, o cerca nel catalogo un'aggiunta precisa.",
    } as Record<2 | 3 | 4, string>,
    jobSignals: (terms: string) => `Parole chiave: ${terms}`,
    back: "Indietro",
    nextJobs: "Scegli le categorie",
    nextReview: "Vedi gli strumenti consigliati",
    save: "Salva il set iniziale",
    saving: "Salvataggio in locale…",
    add: "Aggiungi",
    verifiedBadge: "Verificato",
    manualBadge: "Aggiunto manualmente",
    alternativesTitle: "Aggiungi dal catalogo",
    searchCatalog: "Cerca fra gli strumenti",
    searchPlaceholder: "es. JSON, immagine, calendario",
    searchHint: "Cerca fra gli strumenti del catalogo. Solo quelli verificati entrano automaticamente nel set generato.",
    noResultsQuery: "Scrivi un'attività, uno strumento o un formato.",
    noMatch: "Nessuno strumento corrispondente.",
    verifiedCount: (count: number) => `${count} strumenti verificati`,
    saved: "Salvato su questo dispositivo. Apertura della home…",
    storageWarning: "La preparazione resta utilizzabile.",
    footnote: "Non serve un account: la preparazione resta su questo dispositivo. Il contenuto delle tue attività non fa parte di questa preparazione.",
  },
} as const;

/** The numeric keys the settings page needs for the work-profile selects. */
export type ProfileSelectKey = keyof Pick<
  WorkProfile,
  "dateFormat" | "numberFormat" | "preferredUnits"
>;
