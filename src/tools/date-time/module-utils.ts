import type { ToolExecutionContext } from "../../runtime/types";

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}

export function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error("INVALID_INPUT");
  return value;
}

export function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error("INVALID_INPUT");
  return value;
}

export function numberValue(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("INVALID_INPUT");
  return value;
}

export function integerValue(record: Record<string, unknown>, key: string): number {
  const value = numberValue(record, key);
  if (!Number.isSafeInteger(value)) throw new Error("INVALID_INPUT");
  return value;
}

export function booleanValue(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("INVALID_INPUT");
  return value;
}

export function defaultValue<T>(context: ToolExecutionContext, key: string): T | undefined {
  const entry = context.defaults[key];
  return entry === undefined ? undefined : entry.value as T;
}

export function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}
