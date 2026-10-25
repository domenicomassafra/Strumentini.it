import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}));

import worker from "../worker/index";

const url = "https://strumentini.it/api/vies/check";
const execution = { waitUntil() {} } as unknown as ExecutionContext;
const env = {
  ASSETS: { fetch: async () => new Response("static") },
  AUTH_DB: { prepare() { throw new Error("VIES JSON gate must not touch D1"); } },
} as unknown as Parameters<typeof worker.fetch>[1];

describe("#470 public HTTP JSON payload boundary", () => {
  it("rejects over 4096 UTF-8 bytes even if their character count fits", async () => {
    const payload = JSON.stringify({ vatNumber: "€".repeat(1500) });
    expect(payload.length).toBeLessThan(4096);
    expect(new TextEncoder().encode(payload).byteLength).toBeGreaterThan(4096);
    const response = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    }), env, execution);
    expect(response.status).toBe(413);
  });

  it("stops reading a body stream as soon as the byte quota is exceeded", async () => {
    let pulled = 0;
    const bytes = new TextEncoder().encode("A".repeat(2048));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(bytes);
        if (pulled === 20) controller.close();
      },
    });
    const request = new Request(url, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await worker.fetch(request, env, execution);
    expect(response.status).toBe(413);
    expect(pulled).toBeLessThan(20);
  });

  it("continues to handle normal JSON on the real VIES route", async () => {
    const response = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vatNumber: "invalid" }),
    }), env, execution);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Partita IVA italiana non valida per la verifica VIES." });
  });
});
