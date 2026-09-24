export const DEVELOPER_WEB_ENGINE_VERSION = "developer-web-v1";

export const MAX_DEVELOPER_INPUT = 1_000_000;
export const MAX_YAML_DEPTH = 32;
export const MAX_TOML_DEPTH = 16;
export const MAX_JSON_PATH_MATCHES = 1_000;

export type JsonRecord = Record<string, unknown>;

export interface DeveloperWebResult {
  readonly engineVersion?: string;
  readonly [key: string]: unknown;
}

export interface DeveloperWebErrorOptions {
  readonly cause?: unknown;
}

export class DeveloperWebError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options: DeveloperWebErrorOptions = {}) {
    const runtimeCode = code.startsWith("INVALID_") ? code : `INVALID_${code}`;
    super(`${runtimeCode}: ${message}`, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DeveloperWebError";
    this.code = code;
  }
}

export function invalid(code: string, message: string): never {
  throw new DeveloperWebError(code, message);
}

export function assertInputSize(value: string, maximum = MAX_DEVELOPER_INPUT): void {
  if (value.length > maximum) invalid("INPUT_TOO_LARGE", `Input exceeds the ${maximum}-character local limit.`);
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid("INVALID_INPUT", "Expected an object input.");
  return value as Record<string, unknown>;
}

export function stringField(value: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") return candidate;
  }
  invalid("INVALID_INPUT", `Expected a string field: ${keys[0] ?? "input"}.`);
}

export function optionalStringField(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "string") return candidate;
    invalid("INVALID_INPUT", `Expected a string field: ${key}.`);
  }
  return undefined;
}

export function optionalNumberField(value: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    const parsed = typeof candidate === "number" ? candidate : typeof candidate === "string" && candidate.trim() !== "" ? Number(candidate) : Number.NaN;
    if (!Number.isFinite(parsed)) invalid("INVALID_INPUT", `Expected a finite number field: ${key}.`);
    return parsed;
  }
  return undefined;
}

export function booleanField(value: Record<string, unknown>, fallback: boolean, ...keys: string[]): boolean {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "boolean") return candidate;
    if (candidate === "true") return true;
    if (candidate === "false") return false;
    invalid("INVALID_INPUT", `Expected a boolean field: ${key}.`);
  }
  return fallback;
}

export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

export function withVersion<T extends Record<string, unknown>>(value: T): T & DeveloperWebResult {
  return { ...value, engineVersion: DEVELOPER_WEB_ENGINE_VERSION };
}
