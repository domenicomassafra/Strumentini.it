/*
 * Vocabolario pubblico unico dell'applicazione.
 *
 * StrumentiUtili.it è un prodotto in italiano: non manteniamo una seconda
 * versione inglese delle etichette perché rischierebbe di diventare di nuovo la
 * fonte implicita della UI. I token tecnici (JSON, SHA-256, MIME...) restano
 * invariati; il testo rivolto alla persona è italiano.
 */

export interface ControlLabel {
  readonly it: string;
}

function label(it: string): ControlLabel {
  return { it };
}

/** The actions row every tool form ends with. */
export const CONTROL = {
  submit: label("Calcola"),
  working: label("Elaborazione in corso…"),
  reset: label("Reimposta"),
  cancel: label("Annulla"),
  copy: label("Copia risultato"),
  copied: label("Copiato negli appunti."),
  copyFailed: label("Copia non riuscita. Seleziona il testo e copialo manualmente."),
  download: label("Scarica risultato"),
  clear: label("Svuota"),
  useProfileDefault: label("Usa il valore del profilo"),
  profileDefault: label("Valore predefinito dal profilo"),
  taskOverride: label("Valore specifico per questa attività"),
  profileLoading: label("Caricamento del profilo…"),
  /** Shown in the gutter before anything has been produced. */
  gutterIdle: label("Nessun risultato. Compila i campi e avvia lo strumento."),
  gutterRunning: label("Elaborazione in corso…"),
  localResult: label("Risultato locale"),
} as const satisfies Record<string, ControlLabel>;

/** The Italian string — the source form every control renders. */
export function it(value: ControlLabel): string {
  return value.it;
}
