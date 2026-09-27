/*
 * Italian-first control labels.
 *
 * WORLD.md: "Every user-facing string ships Italian-first. English exists as a
 * secondary, not as the source." The strings the *controls* carry — the buttons
 * a worker presses on every one of the 200 tools — used to be per-renderer
 * English literals, which is why the same button read "Reset" on one tool and
 * "Clear" on the next. They now come from one table, so the vocabulary is
 * consistent and a translator changes one file.
 *
 * The `it` form is the source. `en` is the secondary form, kept for the
 * `<html lang>` swap W1 owns; it is not authored from the English control name.
 */

export interface ControlLabel {
  readonly it: string;
  readonly en: string;
}

function label(it: string, en: string): ControlLabel {
  return { it, en };
}

/** The actions row every tool form ends with. */
export const CONTROL = {
  submit: label("Calcola", "Calculate"),
  working: label("Elaborazione in corso…", "Working…"),
  reset: label("Reimposta", "Reset"),
  cancel: label("Annulla", "Cancel"),
  copy: label("Copia output", "Copy output"),
  copied: label("Copiato negli appunti.", "Copied to the clipboard."),
  copyFailed: label("Copia non riuscita. Seleziona il testo e copialo a mano.", "Copy failed. Select the text and copy it manually."),
  download: label("Scarica risultato", "Download result"),
  clear: label("Svuota", "Clear"),
  useProfileDefault: label("Usa il valore del profilo", "Use Work Profile default"),
  profileDefault: label("Valore predefinito dal profilo", "Work Profile default"),
  taskOverride: label("Sovrascrittura per questa attività", "Current task override"),
  profileLoading: label("Caricamento del profilo…", "Loading Work Profile…"),
  /** Shown in the gutter before anything has been produced. */
  gutterIdle: label("Nessun risultato. Compila i campi e avvia lo strumento.", "No result yet. Fill the fields and run the tool."),
  gutterRunning: label("Elaborazione in corso…", "Working…"),
  localResult: label("Risultato locale", "Local result"),
} as const satisfies Record<string, ControlLabel>;

/** The Italian string — the source form every control renders. */
export function it(value: ControlLabel): string {
  return value.it;
}

/** The secondary string, for an English-locale consumer. */
export function en(value: ControlLabel): string {
  return value.en;
}
