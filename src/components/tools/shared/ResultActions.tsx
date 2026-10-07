import type { ResultAction, ResultActionId } from "../../../runtime/result-actions";

export interface ResultActionsProps {
  readonly actions: readonly ResultAction[];
  readonly onAction: Readonly<Partial<Record<ResultActionId, () => void | Promise<void>>>>;
}

export function ResultActions({ actions, onAction }: ResultActionsProps) {
  if (actions.length === 0) return null;
  return (
    <div class="actions" aria-label="Azioni sul risultato">
      {actions.map((action) => {
        const handler = onAction[action.id];
        if (handler === undefined) return null;
        return (
          <button
            key={action.id}
            type="button"
            class={action.primary ? "primary" : undefined}
            aria-label={action.primary ? action.label + " — azione principale" : action.label}
            data-result-action={action.id}
            data-primary-action={action.primary ? "true" : "false"}
            onClick={() => void handler()}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
