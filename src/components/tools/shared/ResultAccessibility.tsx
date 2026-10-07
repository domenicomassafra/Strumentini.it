import type { JSX } from "preact";
import { StatusMark, type StatusMarkKind } from "./StatusMark";

export type AccessibleResultStatus =
  | "idle"
  | "running"
  | "success"
  | "warning"
  | "partial"
  | "error"
  | "cancelled"
  | "info";

export type ResultAnnouncementPriority = "polite" | "assertive";

export interface ResultAccessibilityDescriptor {
  readonly label: string;
  readonly announcement: string;
  readonly priority: ResultAnnouncementPriority;
  readonly mark: StatusMarkKind;
  readonly tone: "success" | "warning" | "error" | "info";
}

const RESULT_ACCESSIBILITY: Readonly<Record<Exclude<AccessibleResultStatus, "idle">, ResultAccessibilityDescriptor>> = {
  running: {
    label: "In elaborazione",
    announcement: "Elaborazione in corso.",
    priority: "polite",
    mark: "info",
    tone: "info",
  },
  success: {
    label: "Completato",
    announcement: "Operazione completata. Il risultato è disponibile.",
    priority: "polite",
    mark: "ok",
    tone: "success",
  },
  warning: {
    label: "Completato con avviso",
    announcement: "Operazione completata con un avviso. Controlla i dettagli.",
    priority: "polite",
    mark: "warn",
    tone: "warning",
  },
  partial: {
    label: "Risultato parziale",
    announcement: "Risultato parziale disponibile. Controlla cosa è stato completato.",
    priority: "polite",
    mark: "info",
    tone: "warning",
  },
  error: {
    label: "Errore",
    announcement: "Operazione non riuscita. Controlla l'errore e riprova.",
    priority: "assertive",
    mark: "error",
    tone: "error",
  },
  cancelled: {
    label: "Annullata",
    announcement: "Operazione annullata. Puoi riprovare.",
    priority: "polite",
    mark: "missing",
    tone: "info",
  },
  info: {
    label: "Informazione",
    announcement: "Informazione sul risultato aggiornata.",
    priority: "polite",
    mark: "info",
    tone: "info",
  },
};

export function resultAccessibilityFor(status: AccessibleResultStatus): ResultAccessibilityDescriptor | null {
  return status === "idle" ? null : RESULT_ACCESSIBILITY[status];
}

export interface ResultStateCueProps {
  status: AccessibleResultStatus;
  atomic?: boolean;
}

/**
 * Shared result-state semantics.
 *
 * The visible cue carries text plus an authored shape, so state never depends on
 * colour alone. Two pre-existing live regions announce only the concise state
 * sentence; the potentially large result payload is deliberately outside them.
 */
export function ResultStateCue({ status, atomic = true }: ResultStateCueProps): JSX.Element {
  const descriptor = resultAccessibilityFor(status);
  const polite = descriptor?.priority === "polite" ? descriptor.announcement : "";
  const assertive = descriptor?.priority === "assertive" ? descriptor.announcement : "";

  return (
    <>
      {descriptor !== null && (
        <p class="gutter-note" data-state={descriptor.tone} data-result-state={status}>
          <StatusMark kind={descriptor.mark} />
          <strong>Stato:</strong> {descriptor.label}
        </p>
      )}
      <p
        class="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic={atomic ? "true" : "false"}
        data-result-announcement="polite"
      >
        {polite}
      </p>
      <p
        class="visually-hidden"
        role="alert"
        aria-live="assertive"
        aria-atomic={atomic ? "true" : "false"}
        data-result-announcement="assertive"
      >
        {assertive}
      </p>
    </>
  );
}

export type RecoveryFocusStatus = Extract<AccessibleResultStatus, "error" | "cancelled">;

export interface RecoveryFocusRoot {
  querySelector(selector: string): { focus(options?: FocusOptions): void } | null;
}

/**
 * Error focus lands on the inline error summary. Cancellation returns focus to
 * the normal run/retry control. Both targets are shared attributes, so keyboard
 * recovery stays deterministic without per-tool refs.
 */
export function focusToolOperationRecovery(root: RecoveryFocusRoot, status: RecoveryFocusStatus): boolean {
  const selector = status === "error" ? "[data-tool-error]" : "[data-tool-run-control]";
  const target = root.querySelector(selector);
  if (target === null) return false;
  target.focus({ preventScroll: true });
  return true;
}
