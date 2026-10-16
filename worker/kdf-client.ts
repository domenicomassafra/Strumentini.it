import type { PasswordDeriver } from "./auth";

/** Narrow structural interface, allowing isolated negative tests without a provider. */
export interface PrivateKdfNamespace {
  getByName(name: string): { fetch(request: Request): Promise<Response> };
}

export class PasswordKdfUnavailable extends Error {
  constructor() { super("Password KDF backend unavailable"); }
}

/** Bound remote stalls without moving the expensive KDF back to HTTP Workers. */
const REMOTE_KDF_TIMEOUT_MS = 20_000;

export function remotePasswordDeriver(binding: PrivateKdfNamespace | undefined): PasswordDeriver {
  return async (password, salt, iterations) => {
    if (!binding) throw new PasswordKdfUnavailable();
    try {
      // 32 bounded, stateless shards avoid both a single global CPU queue and
      // an unbounded number of SQLite object identities per login attempt.
      const bucket = crypto.getRandomValues(new Uint8Array(1))[0]! % 32;
      const result = await binding.getByName(`password-kdf-v1-shard-${String(bucket).padStart(2, "0")}`).fetch(new Request("https://password-kdf.internal/derive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, salt: [...salt], iterations }),
        signal: AbortSignal.timeout(REMOTE_KDF_TIMEOUT_MS),
      }));
      if (!result.ok) throw new PasswordKdfUnavailable();
      const value: unknown = await result.json();
      if (typeof value !== "object" || value === null || Array.isArray(value) ||
          !("key" in value) || !Array.isArray(value.key) || value.key.length !== 32 ||
          !value.key.every((v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255)) {
        throw new PasswordKdfUnavailable();
      }
      return new Uint8Array(value.key as number[]);
    } catch {
      // No local CPU-heavy fallback on Workers Free; credentials stay unavailable,
      // not accepted, while the private binding or its CPU budget is exhausted.
      throw new PasswordKdfUnavailable();
    }
  };
}
