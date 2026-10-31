import type { ToolModule } from "../../runtime/types";

export function ensureRunning(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

export function inputObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}

export function requiredText(value: unknown, field = "text"): string {
  const object = inputObject(value);
  if (typeof object[field] !== "string") throw new Error("INVALID_INPUT");
  return object[field] as string;
}

export function optionalText(value: unknown, field: string): string | undefined {
  const object = inputObject(value);
  const candidate = object[field];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string") throw new Error("INVALID_INPUT");
  return candidate;
}

export function optionalStringArray(value: unknown, field: string): string[] | undefined {
  const object = inputObject(value);
  const candidate = object[field];
  if (candidate === undefined) return undefined;
  if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  return [...candidate] as string[];
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  const object = inputObject(value);
  const candidate = object[field];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) throw new Error("INVALID_INPUT");
  return candidate;
}

export function requiredNumber(value: unknown, field: string): number {
  const candidate = optionalNumber(value, field);
  if (candidate === undefined) throw new Error("INVALID_INPUT");
  return candidate;
}

export function optionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  const object = inputObject(value);
  const candidate = object[field];
  if (candidate === undefined) return fallback;
  if (typeof candidate !== "boolean") throw new Error("INVALID_INPUT");
  return candidate;
}

export function requiredIndexes(value: unknown, field: string): number[] {
  const object = inputObject(value);
  const candidate = object[field];
  if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== "number" || !Number.isInteger(item))) throw new Error("INVALID_INPUT");
  return candidate as number[];
}

export function optionalIndexes(value: unknown, field: string): number[] | undefined {
  const object = inputObject(value);
  const candidate = object[field];
  if (candidate === undefined) return undefined;
  return requiredIndexes(value, field);
}

export function requiredEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const object = inputObject(value);
  const candidate = object[field];
  if (typeof candidate !== "string" || !allowed.includes(candidate as T)) throw new Error("INVALID_INPUT");
  return candidate as T;
}

export function optionalEnum<T extends string>(value: unknown, field: string, allowed: readonly T[], fallback: T): T {
  const object = inputObject(value);
  if (object[field] === undefined) return fallback;
  return requiredEnum(value, field, allowed);
}

export function tableModule(run: (value: unknown, signal?: AbortSignal) => unknown): ToolModule {
  return { run: (value, _context, signal) => { ensureRunning(signal); return run(value, signal); } };
}
