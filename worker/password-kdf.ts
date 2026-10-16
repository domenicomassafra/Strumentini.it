/**
 * Private Durable Object CPU boundary for PBKDF2-SHA256. No external route,
 * credential persistence, session authority, salt reuse, or downgrade.
 *
 * Only the auth Worker calls the internal stub. The DO receives password,
 * salt and work factor, but it does not read D1, log passwords, store credentials
 * or handle Turnstile, sessions or user identities. The runtime may make the
 * Worker's bindings accessible as env; no isolation claim about that env.
 */
import { DurableObject } from "cloudflare:workers";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const MAX_ITERATIONS = 1_000_000;
const MAX_BODY_LENGTH = 8192;

export class PasswordKdf extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/derive") {
      return new Response(null, { status: 404 });
    }
    let body: unknown;
    try {
      const source = await request.text();
      if (source.length > MAX_BODY_LENGTH) return new Response(null, { status: 413 });
      body = JSON.parse(source);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return new Response(null, { status: 400 });
    }
    const data = body as Record<string, unknown>;
    if (typeof data.password !== "string" || data.password.length > 4096 ||
        !Number.isSafeInteger(data.iterations) ||
        (data.iterations as number) < 1 || (data.iterations as number) > MAX_ITERATIONS ||
        !Array.isArray(data.salt) || data.salt.length < 1 || data.salt.length > 64 ||
        !data.salt.every((v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255)) {
      return new Response(null, { status: 400 });
    }
    const key = await pbkdf2Async(sha256, new TextEncoder().encode(data.password),
      new Uint8Array(data.salt as number[]), { c: data.iterations as number, dkLen: 32, asyncTick: 3 });
    return Response.json({ key: [...key] }, { headers: { "cache-control": "no-store" } });
  }
}
