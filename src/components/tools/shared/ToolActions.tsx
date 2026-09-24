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
    <button
      class={classes}
      type="submit"
      disabled={disabled && !busy}
      aria-disabled={busy || disabled ? "true" : undefined}
      aria-busy={busy ? "true" : undefined}
      onClick={(event) => {
        if (busy || disabled) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {busy ? busyLabel ?? children : children}
    </button>
  );
}

export interface ToolResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: ComponentChildren;
}

export function ToolResetButton({ onClick, disabled = false, children = "Reset" }: ToolResetButtonProps) {
  return <button type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}

export interface ToolCancelButtonProps {
  onCancel: () => void;
  disabled?: boolean;
  children?: ComponentChildren;
}

export function ToolCancelButton({ onCancel, disabled = false, children = "Cancel" }: ToolCancelButtonProps) {
  return <button type="button" onClick={onCancel} disabled={disabled}>{children}</button>;
}
