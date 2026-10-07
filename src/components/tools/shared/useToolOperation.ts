import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ToolRunResult } from "../../../runtime/types";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import {
  focusToolOperationRecovery,
  type AccessibleResultStatus,
  type RecoveryFocusRoot,
} from "./ResultAccessibility";

export type ToolOperationStatus = Exclude<AccessibleResultStatus, "info">;

export type ToolOperationState<T> =
  | { status: "idle" | "running"; result: null; error: "" }
  | { status: "success"; result: T; error: "" }
  | { status: "warning" | "partial"; result: T; error: ""; notice: string }
  | { status: "error" | "cancelled"; result: null; error: string };

export interface ToolOperationOptions {
  cancelledMessage?: string;
  formatError?: (result: Extract<ToolRunResult, { ok: false }>) => string;
  formatThrownError?: (error: unknown) => string;
}

export type ToolOperationExecutor = (signal: AbortSignal) => Promise<ToolRunResult>;

export type ToolOperationController<T> = ToolOperationState<T> & {
  isRunning: boolean;
  canRetry: boolean;
  run: () => Promise<void>;
  retry: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

// Italian-first, per WORLD.md: this string is shown on every cancellable tool.
const DEFAULT_CANCELLED_MESSAGE = "Operazione annullata. Nessun risultato è stato prodotto.";

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== "undefined"
    && error instanceof DOMException
    && error.name === "AbortError";
}

export function idleToolOperation<T>(): ToolOperationState<T> {
  return { status: "idle", result: null, error: "" };
}

export function startToolOperation<T>(): ToolOperationState<T> {
  return { status: "running", result: null, error: "" };
}

export function settleToolOperation<T>(
  result: ToolRunResult,
  options: ToolOperationOptions = {},
): ToolOperationState<T> {
  if (result.ok) return { status: "success", result: result.value as T, error: "" };
  if (result.code === "CANCELLED") {
    return {
      status: "cancelled",
      result: null,
      error: options.cancelledMessage ?? DEFAULT_CANCELLED_MESSAGE,
    };
  }
  return {
    status: "error",
    result: null,
    error: options.formatError?.(result) ?? friendlyToolErrorIt(`${result.code}:${result.message}`),
  };
}

export function warningToolOperation<T>(result: T, notice: string): ToolOperationState<T> {
  return { status: "warning", result, error: "", notice };
}

export function partialToolOperation<T>(result: T, notice: string): ToolOperationState<T> {
  return { status: "partial", result, error: "", notice };
}

export function cancelToolOperation<T>(message = DEFAULT_CANCELLED_MESSAGE): ToolOperationState<T> {
  return { status: "cancelled", result: null, error: message };
}

export function shouldCommitToolOperation(
  generation: number,
  currentGeneration: number,
  aborted = false,
): boolean {
  return generation === currentGeneration && !aborted;
}

export function useToolOperation<T>(
  execute: ToolOperationExecutor,
  options: ToolOperationOptions = {},
): ToolOperationController<T> {
  const cancelledMessage = options.cancelledMessage ?? DEFAULT_CANCELLED_MESSAGE;
  const formatError = options.formatError;
  const formatThrownError = options.formatThrownError;
  const [state, setState] = useState<ToolOperationState<T>>(() => idleToolOperation<T>());
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const focusRootRef = useRef<RecoveryFocusRoot | null>(null);

  const captureFocusRoot = useCallback(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (active instanceof Element) {
      const root = active.closest<HTMLElement>("[data-tool-operation]");
      if (root !== null) {
        focusRootRef.current = root;
        return;
      }
    }
    const roots = document.querySelectorAll<HTMLElement>("[data-tool-operation]");
    if (roots.length === 1) focusRootRef.current = roots[0] ?? null;
  }, []);

  useLayoutEffect(() => {
    if (state.status !== "error" && state.status !== "cancelled") return;
    const root = focusRootRef.current;
    if (root !== null) focusToolOperationRecovery(root, state.status);
  }, [state.status]);

  const run = useCallback(async (): Promise<void> => {
    if (controllerRef.current !== null) return;
    captureFocusRoot();
    const generation = ++generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(startToolOperation<T>());

    try {
      const result = await execute(controller.signal);
      if (generation !== generationRef.current) return;
      if (controller.signal.aborted) {
        setState(cancelToolOperation<T>(cancelledMessage));
        return;
      }
      const settleOptions: ToolOperationOptions = { cancelledMessage };
      if (formatError !== undefined) settleOptions.formatError = formatError;
      setState(settleToolOperation<T>(result, settleOptions));
    } catch (error) {
      if (generation !== generationRef.current) return;
      if (controller.signal.aborted || isAbortError(error)) {
        setState(cancelToolOperation<T>(cancelledMessage));
        return;
      }
      setState({
        status: "error",
        result: null,
        error: formatThrownError?.(error) ?? friendlyToolErrorIt(error),
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [cancelledMessage, captureFocusRoot, execute, formatError, formatThrownError]);

  const cancel = useCallback(() => {
    const controller = controllerRef.current;
    if (controller === null) return;
    generationRef.current += 1;
    controller.abort();
    controllerRef.current = null;
    setState(cancelToolOperation<T>(cancelledMessage));
  }, [cancelledMessage]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(idleToolOperation<T>());
  }, []);

  const retry = run;

  return {
    ...state,
    isRunning: state.status === "running",
    canRetry: state.status === "error" || state.status === "cancelled" || state.status === "warning" || state.status === "partial",
    run,
    retry,
    cancel,
    reset,
  };
}
