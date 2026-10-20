import {
  DeveloperWebError,
  MAX_TOML_DEPTH,
  assertInputSize,
  invalid,
  type JsonRecord,
} from "./types";

/**
 * Pinned full-TOML donor boundary (#277).
 *
 * `smol-toml` is imported lazily, only when the TOML formatter actually runs, so the
 * other developer/web tools keep their current chunk. Parsed tables are copied into
 * plain records (dates normalized to their TOML-authored string form) because the donor
 * returns null-prototype tables and `TomlDate` instances.
 */
export interface TomlDonorResult {
  readonly value: JsonRecord;
  readonly formatted: string;
  readonly warnings: string[];
}

/** Raised only when the lazy donor chunk cannot be loaded (offline/stale asset cache). */
export class TomlDonorUnavailableError extends Error {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = "TomlDonorUnavailableError";
  }
}

type TomlDonor = typeof import("smol-toml");

let donorPromise: Promise<TomlDonor> | undefined;

export function loadTomlDonor(): Promise<TomlDonor> {
  if (donorPromise === undefined) {
    donorPromise = import("smol-toml").catch((cause: unknown) => {
      donorPromise = undefined;
      throw new TomlDonorUnavailableError("TOML_DONOR_UNAVAILABLE", { cause });
    });
  }
  return donorPromise;
}

function abortSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

function defineRecordValue(record: JsonRecord, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
}

function normalizeTomlValue(value: unknown, donor: TomlDonor): unknown {
  if (value instanceof donor.TomlDate) return value.toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeTomlValue(item, donor));
  if (value !== null && typeof value === "object") {
    const output: JsonRecord = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      defineRecordValue(output, key, normalizeTomlValue(child, donor));
    }
    return output;
  }
  return value;
}

function donorError(error: unknown, donor: TomlDonor): never {
  if (error instanceof donor.TomlError) {
    throw new DeveloperWebError("INVALID_TOML", error.message, {
      cause: error,
      diagnostic: { line: error.line, column: error.column },
    });
  }
  if (error instanceof RangeError) invalid("TOML_TOO_DEEP", "TOML nesting exceeds the local safety limit.");
  throw error;
}

export async function parseAndFormatTomlWithDonor(
  input: string,
  signal?: AbortSignal,
): Promise<TomlDonorResult> {
  assertInputSize(input);
  abortSignal(signal);
  const donor = await loadTomlDonor();
  abortSignal(signal);
  let table: ReturnType<TomlDonor["parse"]>;
  try {
    table = donor.parse(input, {
      // Match the previous engine (JS numbers, no BigInt leaking into the JSON preview).
      integersAsBigInt: false,
      // `keep` preserves `__proto__` as an own key (the donor defines it safely);
      // copying below re-defines every key, so no prototype is ever traversed.
      unsafeKeyBehaviour: "keep",
      maxDepth: MAX_TOML_DEPTH,
    });
  } catch (error) {
    donorError(error, donor);
  }
  abortSignal(signal);
  let formatted: string;
  try {
    formatted = donor.stringify(table, { maxDepth: MAX_TOML_DEPTH });
  } catch (error) {
    donorError(error, donor);
  }
  return {
    value: normalizeTomlValue(table, donor) as JsonRecord,
    formatted,
    warnings: [],
  };
}
