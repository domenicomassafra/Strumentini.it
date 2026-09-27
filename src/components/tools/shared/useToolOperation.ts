import { useCallback, useRef, useState } from "preact/hooks";
import type { ToolRunResult } from "../../../runtime/types";

export type ToolOperationStatus = "idle" | "running" | "success" | "error" | "cancelled";

export interface ToolOperationState<T> {
  status: ToolOperationStatus;
  result: T | null;
  error: string;
}

export interface ToolOperationOptions {
  cancelledMessage?: string;
  formatError?: (result: Extract<ToolRunResult, { ok: false }>) => string;
  formatThrownError?: (error: unknown) => string;
}

export type ToolOperationExecutor = (signal: AbortSignal) => Promise<ToolRunResult>;

export interface ToolOperationController<T> extends ToolOperationState<T> {
  isRunning: boolean;
  run: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

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
    error: options.formatError?.(result) ?? result.message,
  };
}

export function cancelToolOperation<T>(message = DEFAULT_CANCELLED_MESSAGE): ToolOperationState<T> {
  return { status: "cancelled", result: null, error: message };
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

  const run = useCallback(async (): Promise<void> => {
    if (controllerRef.current !== null) return;
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
        error: formatThrownError?.(error) ?? (error instanceof Error ? error.message : "Operazione non riuscita."),
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [cancelledMessage, execute, formatError, formatThrownError]);

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

  return {
    ...state,
    isRunning: state.status === "running",
    run,
    cancel,
    reset,
  };
}
