import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import {
  canReceiveFocus,
  focusableElements,
  isEscapeKey,
  isTabKey,
  restoreFocus,
  wrapFocus,
} from "./accessibility";
import styles from "./primitives.module.css";

export interface FocusRef {
  readonly current: HTMLElement | null;
}

export interface A11yDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly titleId: string;
  readonly describedBy?: string;
  readonly onClose: () => void;
  readonly initialFocusRef?: FocusRef;
  readonly returnFocusRef?: FocusRef;
  readonly closeLabel?: string;
  readonly children: ComponentChildren;
}

export function A11yDialog({
  open,
  title,
  titleId,
  describedBy,
  onClose,
  initialFocusRef,
  returnFocusRef,
  closeLabel = "Close dialog",
  children,
}: A11yDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  const openStateRef = useRef(false);
  const hasFocusedRef = useRef(false);
  const closeNotifiedRef = useRef(false);
  const mountedRef = useRef(true);

  function restoreInvoker(): void {
    const explicitTarget = returnFocusRef?.current;
    if (explicitTarget !== null && explicitTarget !== undefined) {
      if (restoreFocus(explicitTarget)) {
        invokerRef.current = null;
        return;
      }
    }
    restoreFocus(invokerRef.current);
    invokerRef.current = null;
  }

  function notifyClose(): void {
    if (!mountedRef.current || closeNotifiedRef.current) return;
    closeNotifiedRef.current = true;
    restoreInvoker();
    onClose();
  }

  function closeDialog(): void {
    const dialog = dialogRef.current;
    openStateRef.current = false;
    hasFocusedRef.current = false;
    if (dialog?.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
    notifyClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const wasOpen = openStateRef.current;
    openStateRef.current = open;

    if (open && !wasOpen) {
      closeNotifiedRef.current = false;
      hasFocusedRef.current = false;
      const activeElement = typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      invokerRef.current = returnFocusRef?.current ?? activeElement;
      if (typeof dialog.showModal === "function") {
        try {
          dialog.showModal();
        } catch {
          if (!dialog.open) dialog.setAttribute("open", "");
        }
      } else {
        dialog.setAttribute("open", "");
      }
    }

    if (open && !hasFocusedRef.current) {
      const preferred = initialFocusRef?.current;
      const target = preferred !== null && canReceiveFocus(preferred)
        ? preferred
        : focusableElements(dialog)[0] ?? null;
      if (target !== null && restoreFocus(target)) hasFocusedRef.current = true;
    } else if (!open && wasOpen) {
      closeDialog();
    }
  }, [open, initialFocusRef, returnFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      mountedRef.current = false;
      if (dialog?.open) dialog.close();
      restoreInvoker();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent): void {
    if (isEscapeKey(event.key)) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (!isTabKey(event.key)) return;
    const dialog = dialogRef.current;
    if (dialog === null || !dialog.open) return;
    const activeElement = document.activeElement;
    const containsActive = activeElement !== null && dialog.contains(activeElement);
    const target = wrapFocus(dialog, activeElement, event.shiftKey);
    if (target !== null) {
      event.preventDefault();
      restoreFocus(target);
      return;
    }
    if (!containsActive) {
      event.preventDefault();
      const first = focusableElements(dialog)[0];
      if (first !== undefined) restoreFocus(first);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      class={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      aria-modal={open ? "true" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClose={notifyClose}
      onKeyDown={handleKeyDown}
    >
      <div class={styles.dialogShell}>
        <header class={styles.dialogHeader}>
          <h2 id={titleId} class={styles.dialogTitle}>{title}</h2>
          <button
            class={styles.closeButton}
             type="button"
             data-dialog-initial-focus
             aria-label={closeLabel}

            onClick={closeDialog}
          >
            Close
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
