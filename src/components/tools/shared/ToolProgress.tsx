import type { ComponentChildren } from "preact";

export interface ToolProgressProps {
  value: number;
  max?: number;
  label: string;
  status: string;
}

export function ToolProgress({ value, max = 1, label, status }: ToolProgressProps) {
  const fraction = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div class="field" role="status" aria-live="polite" aria-atomic="true">
      <span>{label}</span>
      <progress value={fraction} max={1} aria-label={label} />
      <small>{status}</small>
    </div>
  );
}

export interface ToolStatusProps {
  children: ComponentChildren;
  className?: string;
}

export function ToolStatus({ children, className = "" }: ToolStatusProps) {
  const classes = ["tool-status", className].filter(Boolean).join(" ");
  return <p class={classes} role="status" aria-live="polite" aria-atomic="true">{children}</p>;
}
