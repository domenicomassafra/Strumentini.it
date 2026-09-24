import type { ComponentChildren } from "preact";

export interface ToolResultPanelProps {
  eyebrow: string;
  placeholder: string;
  children?: ComponentChildren;
  className?: string;
  bare?: boolean;
  atomic?: boolean;
  busy?: boolean;
}

export function ToolResultPanel({
  eyebrow,
  placeholder,
  children,
  className = "",
  bare = false,
  atomic = true,
  busy = false,
}: ToolResultPanelProps) {
  const classes = [bare ? "" : "result-panel", className].filter(Boolean).join(" ");
  const hasContent = children !== undefined && children !== null && children !== false;
  const content = hasContent
    ? children
    : <p class="result-placeholder">{placeholder}</p>;
  return (
    <section
      class={classes}
      aria-live="polite"
      aria-atomic={atomic ? "true" : "false"}
      aria-busy={busy ? "true" : "false"}
    >
      <p class="eyebrow">{eyebrow}</p>
      {content}
    </section>
  );
}
