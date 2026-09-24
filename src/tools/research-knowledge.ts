import type { UnknownRecord } from "../engines/research-knowledge";

export function recordInput(value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as UnknownRecord;
}

export function stringInput(value: unknown, keys: readonly string[], required = true): string {
  const record = recordInput(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      if (required && candidate.trim() === "") throw new Error("INVALID_INPUT");
      return candidate;
    }
    if (candidate !== undefined && candidate !== null) throw new Error("INVALID_INPUT");
  }
  if (required) throw new Error("INVALID_INPUT");
  return "";
}

export function arrayInput(value: unknown, keys: readonly string[]): unknown[] {
  const record = recordInput(value);
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate !== undefined) throw new Error("INVALID_INPUT");
  }
  throw new Error("INVALID_INPUT");
}

export function booleanInput(value: unknown, keys: readonly string[], fallback: boolean): boolean {
  const record = recordInput(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "boolean") return candidate;
    if (candidate === "true") return true;
    if (candidate === "false") return false;
    if (candidate !== undefined) throw new Error("INVALID_INPUT");
  }
  return fallback;
}

export function numberInput(value: unknown, keys: readonly string[], fallback: number): number {
  const record = recordInput(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim() !== "" && Number.isFinite(Number(candidate))) return Number(candidate);
    if (candidate !== undefined) throw new Error("INVALID_INPUT");
  }
  return fallback;
}

export function modeInput<T extends string>(value: unknown, keys: readonly string[], choices: readonly T[], fallback: T): T {
  const record = recordInput(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && choices.includes(candidate as T)) return candidate as T;
    if (candidate !== undefined) throw new Error("INVALID_INPUT");
  }
  return fallback;
}
