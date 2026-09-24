import type { DefaultProvenance, ResolvedDefault, ToolExecutionContext, ToolModule } from "../runtime/types";
import { runBusinessOperation, type BusinessOperation } from "../engines/business-math";

export function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

export function inputRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}

export function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error("INVALID_INPUT");
  return value;
}

export function requiredDecimal(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return requiredString(input, key);
}

export function optionalDecimal(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return optionalInputString(input, key);
}

export function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("INVALID_INPUT");
  return value;
}

export function optionalInputString(input: Record<string, unknown>, key: string): string | undefined {
  const value = optionalString(input, key);
  return value === undefined || value.trim() === "" ? undefined : value;
}

export function requiredRecord(input: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = input[key];
  return inputRecord(value);
}

export function resolvedValue(context: ToolExecutionContext, field: string): unknown {
  return context.defaults[field]?.value;
}

export function resolvedProvenance(context: ToolExecutionContext, field: string): DefaultProvenance {
  return context.defaults[field]?.provenance ?? "tool-default";
}

export function currencyDecoration(context: ToolExecutionContext): { currency: string; currencyProvenance: DefaultProvenance } {
  const currency = resolvedValue(context, "currency");
  if (typeof currency !== "string" || currency.trim() === "") throw new Error("INVALID_DEFAULTS");
  return { currency: currency.trim().toUpperCase(), currencyProvenance: resolvedProvenance(context, "currency") };
}

export function createBusinessModule<TInput>(
  operation: BusinessOperation,
  normalize: (input: Record<string, unknown>, context: ToolExecutionContext) => TInput,
  decorate?: (value: unknown, context: ToolExecutionContext) => unknown,
): ToolModule {
  return {
    run(rawInput, context, signal) {
      assertNotAborted(signal);
      const input = normalize(inputRecord(rawInput), context);
      const value = runBusinessOperation(operation, input);
      return decorate === undefined ? value : decorate(value, context);
    },
  };
}

export type { ResolvedDefault };
