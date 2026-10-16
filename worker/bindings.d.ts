/**
 * Minimal ambient typings for the Cloudflare Workers runtime.
 *
 * The repository deliberately ships no runtime dependency on
 * `@cloudflare/workers-types`; only the surface the auth backend actually
 * touches is declared here. `Request`, `Response`, `Headers`, `crypto` and the
 * base64 helpers come from the DOM lib.
 */

interface D1Meta {
  readonly changes: number;
  readonly last_row_id: number;
  readonly duration: number;
  readonly rows_read: number;
  readonly rows_written: number;
  readonly success: boolean;
}

interface D1Result<T = unknown> {
  readonly results: T[];
  readonly success: boolean;
  readonly meta: D1Meta;
  readonly error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ readonly count: number; readonly duration: number }>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Runtime-supplied DurableObject base, not a bundled or paid dependency. */
declare module "cloudflare:workers" {
  export class DurableObject {
    constructor(ctx: unknown, env: unknown);
  }
}
