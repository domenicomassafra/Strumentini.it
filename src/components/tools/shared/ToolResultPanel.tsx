import type { ComponentChildren } from "preact";

export interface ToolResultPanelProps {
  eyebrow: string;
  placeholder: string;
  children?: ComponentChildren;
  className?: string;
  bare?: boolean;
  atomic?: boolean;
  busy?: boolean;
  /** `success` and `error` set the 3px semantic rule inside the panel's edge. */
  state?: "idle" | "running" | "success" | "error" | "warning" | "info";
}

/**
 * The result column, in the gutter vocabulary.
 *
 * Carries `result-panel` (its own frame) and `gutter` (the fixed gutter column
 * semantics) together: every tool that used this primitive already sits in the
 * right-hand column, so the two vocabularies have to agree on the same class
 * rather than each renderer re-deriving a look.
 */
export function ToolResultPanel({
  eyebrow,
  placeholder,
  children,
  className = "",
  bare = false,
  atomic = true,
  busy = false,
  state = "idle",
}: ToolResultPanelProps) {
  const classes = ["result-panel", "gutter", className].filter(Boolean).join(" ");
  const hasContent = children !== undefined && children !== null && children !== false;
  const content = hasContent
    ? children
    : <p class="gutter-placeholder result-placeholder">{placeholder}</p>;
  if (bare) {
    return (
      <section class={["gutter", className].filter(Boolean).join(" ")} data-state={state} aria-live="polite" aria-atomic={atomic ? "true" : "false"} aria-busy={busy ? "true" : "false"}>
        <p class="eyebrow">{eyebrow}</p>
        {content}
      </section>
    );
  }
  return (
    <section
      class={classes}
      data-state={state}
      aria-live="polite"
      aria-atomic={atomic ? "true" : "false"}
      aria-busy={busy ? "true" : "false"}
    >
      <p class="gutter-label eyebrow">{eyebrow}</p>
      {content}
    </section>
  );
}
