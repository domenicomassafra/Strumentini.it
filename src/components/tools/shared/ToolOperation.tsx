import type { ComponentChildren } from "preact";

export interface ToolOperationProps {
  children: ComponentChildren;
  className?: string;
  busy?: boolean;
}

export function ToolOperation({ children, className = "", busy = false }: ToolOperationProps) {
  const classes = ["tool-operation", className].filter(Boolean).join(" ");
  return <div class={classes} aria-busy={busy ? "true" : undefined}>{children}</div>;
}

export interface ToolFormCardProps {
  children: ComponentChildren;
  className?: string;
}

export function ToolFormCard({ children, className = "" }: ToolFormCardProps) {
  const classes = ["tool-form-card", className].filter(Boolean).join(" ");
  return <div class={classes}>{children}</div>;
}
