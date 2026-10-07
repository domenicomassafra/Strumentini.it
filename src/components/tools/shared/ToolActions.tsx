import type { ComponentChildren } from "preact";

export interface ToolActionsProps {
  children: ComponentChildren;
  className?: string;
}

export function ToolActions({ children, className = "" }: ToolActionsProps) {
  const classes = ["actions", className].filter(Boolean).join(" ");
  return <div class={classes}>{children}</div>;
}

export interface ToolSubmitButtonProps {
  children: ComponentChildren;
  busy?: boolean;
  busyLabel?: ComponentChildren;
  disabled?: boolean;
  className?: string;
}

export function ToolSubmitButton({
  children,
  busy = false,
  busyLabel,
  disabled = false,
  className = "",
}: ToolSubmitButtonProps) {
  const classes = ["primary", className].filter(Boolean).join(" ");
  return (
    <button class={classes} type="submit" data-tool-run-control disabled={disabled || busy}>
      {busy ? busyLabel ?? children : children}
    </button>
  );
}

export interface ToolResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: ComponentChildren;
}

export function ToolResetButton({ onClick, disabled = false, children = "Reimposta" }: ToolResetButtonProps) {
  return <button type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}

export interface ToolCancelButtonProps {
  onCancel: () => void;
  disabled?: boolean;
  children?: ComponentChildren;
}

export function ToolCancelButton({ onCancel, disabled = false, children = "Annulla" }: ToolCancelButtonProps) {
  return <button type="button" onClick={onCancel} disabled={disabled}>{children}</button>;
}
