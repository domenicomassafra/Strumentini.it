/**
 * One-shot private Cloudflare Free feasibility probe for #328.
 * No public fetch route, no user credentials, no AUTH_DB, no sessions, no assets.
 * Keep this experimental resource separate from staging and production.
 */
import { DurableObject } from "cloudflare:workers";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const SYNTHETIC_PASSWORD = "str-328-private-synthetic-only";
const SYNTHETIC_SALT = new TextEncoder().encode("0123456789abcdef");
const EXPECTED = "b96def08079d71231df8402dcf0f1308de840cc2f7e44188769334cfe3bbcfbe";

interface ProbeState {
  storage: {
    get(key: string): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
}
interface ProbeEnv {
  KDF_PROBE: {
    getByName(name: string): { fetch(req: Request): Promise<Response> };
  };
}

export class PrivateKdfProbe extends DurableObject {
  private readonly state: ProbeState;

  constructor(ctx: ProbeState, env: unknown) {
    super(ctx, env);
    this.state = ctx;
  }

  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST" || new URL(req.url).pathname !== "/run") {
      return new Response(null, { status: 404 });
    }
    if (await this.state.storage.get("started")) return Response.json({ status: "ALREADY_ATTEMPTED" });

    // Set before CPU-heavy work: a failed attempt must not run repeatedly.
    await this.state.storage.put("started", new Date().toISOString());
    const started = performance.now();
    try {
      const key = await pbkdf2Async(sha256, new TextEncoder().encode(SYNTHETIC_PASSWORD),
        SYNTHETIC_SALT, { c: 600_000, dkLen: 32, asyncTick: 3 });
      const digest = Array.from(key, (n) => n.toString(16).padStart(2, "0")).join("");
      const result = { status: digest === EXPECTED ? "MATCH" : "MISMATCH", wallMs: Math.round(performance.now() - started) };
      await this.state.storage.put("result", result.status);
      console.log("KDF_PRIVATE_PROBE", JSON.stringify(result));
      return Response.json(result);
    } catch (error) {
      // Sanitized only; no password, key, request body or stack telemetry.
      console.log("KDF_PRIVATE_PROBE", JSON.stringify({ status: "FAIL", type: error instanceof Error ? error.name : "unknown" }));
      return Response.json({ status: "FAIL" }, { status: 500 });
    }
  }
}

export default {
  async scheduled(_controller: unknown, env: ProbeEnv): Promise<void> {
    const response = await env.KDF_PROBE.getByName("kdf-private-one-shot-20261016")
      .fetch(new Request("https://kdf-private.internal/run", { method: "POST" }));
    const result = await response.json() as { status?: string; wallMs?: number };
    console.log("KDF_PRIVATE_CRON", JSON.stringify({ http: response.status, status: result.status, wallMs: result.wallMs ?? null }));
  },
};
