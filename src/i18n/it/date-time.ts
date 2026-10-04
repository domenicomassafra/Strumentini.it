const FIELD_LABELS: Readonly<Record<string, string>> = {
  start: "Inizio",
  end: "Fine",
  timeZone: "Fuso orario",
  startDate: "Data iniziale",
  amount: "Giorni da aggiungere",
  value: "Valore",
  sourceTimeZone: "Fuso orario di origine",
  targetTimeZone: "Fuso orario di destinazione",
  disambiguation: "Gestione dell'ora ambigua",
  date: "Data",
  durationMinutes: "Durata in minuti",
  participants: "Partecipanti",
  limit: "Numero massimo di finestre",
  direction: "Direzione",
  entries: "Voci",
  weekYear: "Anno della settimana",
  week: "Numero di settimana",
  weekSystem: "Sistema delle settimane",
  year: "Anno",
  quarter: "Trimestre",
  deadline: "Scadenza",
  reference: "Istante di riferimento",
  count: "Occorrenze",
  frequency: "Frequenza",
  interval: "Intervallo",
  weekdays: "Giorni della settimana (CSV 0–6)",
  endDate: "Data finale",
  monthOverflowPolicy: "Gestione fine mese",
  birthDate: "Data di nascita o iniziale",
  asOfDate: "Data di riferimento",
  stepDays: "Passo in giorni",
  summary: "Titolo dell'evento",
  allDay: "Tutto il giorno",
  description: "Descrizione",
  location: "Luogo",
  text: "Testo ICS",
  values: "Valori epoch",
  unit: "Unità di ingresso",
  country: "Paese",
};

const FIELD_HELP: Readonly<Record<string, string>> = {
  start: "Usa una data o una data-ora ISO.",
  end: "Usa una data o una data-ora ISO.",
  timeZone: "Usa un nome di fuso orario IANA; le date senza ora restano date di calendario.",
  amount: "Usa un numero negativo per sottrarre giorni.",
  participants: "Una persona per riga: fuso IANA|inizio|fine.",
  entries: "Una voce per riga: data|inizio|fine|minuti di pausa facoltativi.",
};

const OPTION_LABELS: Readonly<Record<string, string>> = {
  reject: "Rifiuta gli orari ambigui",
  earlier: "Usa il primo istante",
  later: "Usa il secondo istante",
  "time-to-decimal": "Da ore:minuti a ore decimali",
  "decimal-to-time": "Da ore decimali a ore:minuti",
  "date-to-week": "Da data a settimana",
  "week-to-date": "Da settimana a data",
  iso: "ISO",
  us: "Stati Uniti",
  "date-to-quarter": "Da data a trimestre",
  "quarter-to-dates": "Da trimestre a date",
  daily: "Giornaliera",
  weekly: "Settimanale",
  monthly: "Mensile",
  yearly: "Annuale",
  skip: "Salta il mese non valido",
  clamp: "Usa l'ultimo giorno del mese",
  false: "No",
  true: "Sì",
  seconds: "Secondi",
  milliseconds: "Millisecondi",
  US: "Stati Uniti",
  CA: "Canada",
  GB: "Regno Unito",
  IT: "Italia",
};

export interface DateTimeUiCopy {
  readonly eyebrow: string;
  readonly placeholder: string;
  readonly submit: string;
}

export const DATE_TIME_UI_IT: Readonly<Record<string, DateTimeUiCopy>> = {
  "date-difference": { eyebrow: "Differenza tra date", placeholder: "Qui apparirà la differenza con segno.", submit: "Confronta date" },
  "add-subtract-days": { eyebrow: "Data risultante", placeholder: "Qui apparirà la data di calendario risultante.", submit: "Calcola data" },
  "working-hours": { eyebrow: "Tempo di lavoro trascorso", placeholder: "Qui appariranno durata e ore decimali.", submit: "Calcola ore" },
  "timezone-converter": { eyebrow: "Istante convertito", placeholder: "Qui appariranno le rappresentazioni nei due fusi orari.", submit: "Converti fuso orario" },
  "meeting-time-planner": { eyebrow: "Finestre condivise", placeholder: "Qui appariranno gli orari di riunione compatibili.", submit: "Trova orari" },
  "duration-calculator": { eyebrow: "Durata", placeholder: "Qui appariranno le unità di tempo trascorse.", submit: "Calcola durata" },
  "decimal-hours-converter": { eyebrow: "Ore decimali", placeholder: "Qui apparirà il valore convertito.", submit: "Converti" },
  "timesheet-totaler": { eyebrow: "Totale foglio ore", placeholder: "Qui appariranno totali giornalieri e complessivi.", submit: "Calcola totale" },
  "week-number-converter": { eyebrow: "Numero di settimana", placeholder: "Qui apparirà la corrispondenza tra data e settimana.", submit: "Converti settimana" },
  "quarter-date-mapper": { eyebrow: "Trimestre", placeholder: "Qui appariranno i limiti del trimestre.", submit: "Calcola trimestre" },
  "deadline-countdown": { eyebrow: "Tempo alla scadenza", placeholder: "Qui apparirà il tempo rimanente o trascorso.", submit: "Calcola scadenza" },
  "recurring-date-generator": { eyebrow: "Serie di date", placeholder: "Qui appariranno le date generate.", submit: "Genera date" },
  "age-date-anniversary": { eyebrow: "Età e anniversario", placeholder: "Qui appariranno età e prossimo anniversario.", submit: "Calcola età" },
  "calendar-date-list-generator": { eyebrow: "Elenco date", placeholder: "Qui apparirà l'elenco di calendario.", submit: "Genera elenco" },
  "ics-event-builder": { eyebrow: "Evento ICS", placeholder: "Qui apparirà l'evento RFC 5545.", submit: "Crea evento ICS" },
  "ics-viewer": { eyebrow: "Analisi ICS", placeholder: "Qui apparirà la struttura dell'evento analizzato.", submit: "Analizza ICS" },
  "epoch-batch-converter": { eyebrow: "Conversione epoch", placeholder: "Qui appariranno le righe convertite.", submit: "Converti valori" },
  "public-holiday-lookup": { eyebrow: "Festività pubbliche", placeholder: "Qui apparirà il calendario incorporato.", submit: "Cerca festività" },
};

export function dateTimeFieldLabelIt(key: string, fallback: string): string {
  return FIELD_LABELS[key] ?? fallback;
}

export function dateTimeFieldHelpIt(key: string): string | undefined {
  return FIELD_HELP[key];
}

export function dateTimeOptionLabelIt(value: string): string {
  return OPTION_LABELS[value] ?? value;
}

const directionIt = (value: string | undefined): string => ({
  forward: "in avanti",
  backward: "indietro",
  equal: "uguali",
  remaining: "rimanenti",
  overdue: "scaduti",
}[value ?? ""] ?? value ?? "risultato");

export function dateTimeResultHeadlineIt(toolId: string, result: unknown): string {
  const value = (result ?? {}) as Record<string, unknown>;
  if (toolId === "date-difference") {
    const days = Number(value.days ?? 0);
    return `${directionIt(String(value.direction ?? ""))} · ${days} ${Math.abs(days) === 1 ? "giorno" : "giorni"}`;
  }
  if (toolId === "add-subtract-days") return String(value.resultDate ?? "");
  if (toolId === "working-hours") return `${String(value.decimalHours ?? "0")} ore`;
  if (toolId === "timezone-converter") return String(value.target ?? "");
  if (toolId === "meeting-time-planner") return `${Array.isArray(value.windows) ? value.windows.length : 0} finestre`;
  if (toolId === "duration-calculator") return `${Number(value.days ?? 0)} g · ${Number(value.hours ?? 0)} h · ${Number(value.minutes ?? 0)} min`;
  if (toolId === "decimal-hours-converter") return String(value.decimalHours ?? value.time ?? "");
  if (toolId === "timesheet-totaler") return `${String(value.totalDecimalHours ?? "0")} ore`;
  if (toolId === "week-number-converter") return `${String(value.weekYear ?? "")}-W${String(value.week ?? "").padStart(2, "0")}`;
  if (toolId === "quarter-date-mapper") return `T${String(value.quarter ?? "")} ${String(value.year ?? "")}`;
  if (toolId === "deadline-countdown") return `${directionIt(String(value.status ?? ""))} · ${Number(value.days ?? 0)} giorni`;
  if (toolId === "recurring-date-generator") return `${Array.isArray(value.dates) ? value.dates.length : 0} date`;
  if (toolId === "age-date-anniversary") return `${Number(value.years ?? 0)} anni · prossimo ${String(value.nextAnniversary ?? "")}`;
  if (toolId === "calendar-date-list-generator") return `${Array.isArray(value.dates) ? value.dates.length : 0} date`;
  if (toolId === "ics-event-builder") return "Testo ICS locale valido";
  if (toolId === "ics-viewer") return `${Array.isArray(value.events) ? value.events.length : 0} eventi`;
  if (toolId === "epoch-batch-converter") return `${Array.isArray(value.rows) ? value.rows.length : 0} righe`;
  if (toolId === "public-holiday-lookup") return `${Array.isArray(value.holidays) ? value.holidays.length : 0} festività`;
  return "";
}

const RESULT_KEYS: Readonly<Record<string, string>> = {
  days: "giorni",
  hours: "ore",
  minutes: "minuti",
  seconds: "secondi",
  direction: "direzione",
  resultDate: "data_risultante",
  decimalHours: "ore_decimali",
  source: "origine",
  target: "destinazione",
  windows: "finestre",
  time: "ora",
  entries: "voci",
  totalDecimalHours: "ore_decimali_totali",
  weekYear: "anno_settimana",
  week: "settimana",
  weekSystem: "sistema_settimane",
  year: "anno",
  quarter: "trimestre",
  startDate: "data_inizio",
  endDate: "data_fine",
  status: "stato",
  dates: "date",
  years: "anni",
  months: "mesi",
  nextAnniversary: "prossimo_anniversario",
  events: "eventi",
  rows: "righe",
  holidays: "festività",
  country: "paese",
  date: "data",
  name: "nome",
  observed: "sostitutiva",
  actualDate: "data_originale",
  statutory: "nazionale",
  text: "testo",
  unit: "unità",
  value: "valore",
  input: "ingresso",
  ok: "valido",
  error: "errore",
  engineVersion: "versione_motore",
};

export function localizeDateTimeResultIt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(localizeDateTimeResultIt);
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") return directionIt(value);
    return value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    RESULT_KEYS[key] ?? key,
    localizeDateTimeResultIt(item),
  ]));
}
