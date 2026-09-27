import type { ComponentChildren } from "preact";
import { PreviousValue } from "./PreviousValue";

export { GUTTER_PREVIOUS_MS } from "./PreviousValue";

export type GutterState = "idle" | "running" | "success" | "error" | "warning" | "info";

/**
 * Maps a shared tool operation status onto the gutter's semantic rule.
 * `cancelled` is a user action, not a failure, so it reads as idle rather
 * than stamping the red error rule on a result nobody asked to lose.
 */
export function gutterStateFor(status: string): GutterState {
  switch (status) {
    case "running":
      return "running";
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

/**
 * The gutter rule for a tool that keeps its own result and error state
 * instead of going through the shared operation hook.
 */
export function gutterStateFromResult(
  result: unknown,
  error: string,
  running = false,
): GutterState {
  if (running) return "running";
  if (error !== "") return "error";
  return result === null || result === undefined ? "idle" : "success";
}

export interface GutterEntry {
  readonly label: string;
  readonly value: string;
  /** Distinguishes repeated equal values (a row of timestamps) that must not flicker. */
  readonly key?: string;
}

export interface ToolGutterProps {
  /** Result eyebrow — names what the column holds, not the product. */
  label: string;
  state?: GutterState;
  /** Shown while there is nothing to report yet. */
  placeholder?: string;
  /** The headline value, set in red. One per tool surface. */
  value?: string;
  unit?: string;
  /** Secondary ruled rows beneath the headline. */
  entries?: readonly GutterEntry[];
  /** Raw output, for tools whose result is text rather than a number. */
  children?: ComponentChildren;
  busy?: boolean;
}

/**
 * The running gutter: a fixed-position right column where every produced value
 * lands in the same place, in tabular lining numerals, with the previous value
 * still dimmed and readable for four seconds after it changes.
 */
export function ToolGutter({
  label,
  state = "idle",
  placeholder = "Nessun risultato. Compila i campi e avvia lo strumento.",
  value,
  unit,
  entries,
  children,
  busy = false,
}: ToolGutterProps) {
  const hasValue = value !== undefined && value !== "";
  const hasRows = entries !== undefined && entries.length > 0;

  return (
    <aside
      class="gutter"
      data-state={state}
      aria-live="polite"
      aria-atomic="false"
      aria-busy={busy ? "true" : "false"}
    >
      <p class="gutter-label">{label}</p>

      {hasValue ? (
        <>
          <PreviousValue value={value} />
          {unit !== undefined && unit !== "" && <span class="gutter-unit">{unit}</span>}
        </>
      ) : (
        <p class="gutter-placeholder">{placeholder}</p>
      )}

      {hasRows && (
        <dl class="gutter-rows">
          {entries.map((entry) => (
            <div key={entry.key ?? entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}
    </aside>
  );
}
