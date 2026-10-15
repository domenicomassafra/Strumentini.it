import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../worker/auth";
import { PasswordKdfUnavailable, remotePasswordDeriver } from "../worker/kdf-client";
import type { PrivateKdfNamespace } from "../worker/kdf-client";

function testNamespace(overrides?: { status?: number; key?: unknown; reject?: boolean }): PrivateKdfNamespace {
  return {
    getByName(id) {
      expect(id).toMatch(/^password-kdf-v1-shard-(?:0[0-9]|[12][0-9]|3[01])$/u);
      return {
        async fetch(request) {
          expect(request.method).toBe("POST");
          expect(new URL(request.url).pathname).toBe("/derive");
          if (overrides?.reject) throw new Error("backend unavailable");
          const data = await request.json() as { password: string; salt: number[]; iterations: number };
          const key = overrides && "key" in overrides
            ? overrides.key
            : [...pbkdf2Sync(data.password, Buffer.from(data.salt), data.iterations, 32, "sha256")];
          return Response.json({ key }, { status: overrides?.status ?? 200 });
        },
      };
    },
  };
}

describe("#328 private Free-plan Durable Object KDF seam", () => {
  it("preserves the exact PBKDF2-SHA256 600k stored format and legacy verification", async () => {
    const offload = remotePasswordDeriver(testNamespace());
    const record = await hashPassword("synthetic-rpc-compatibility", 600_000, offload);
    expect(record.iterations).toBe(600_000);
    expect(record.hash).toMatch(/^pbkdf2-sha256\$[A-Za-z0-9_-]{43}$/u);
    expect(await verifyPassword("synthetic-rpc-compatibility", record, offload)).toBe(true);
    expect(await verifyPassword("wrong", record, offload)).toBe(false);
    const previous = await hashPassword("legacy", 1_000, offload);
    expect(await verifyPassword("legacy", previous, offload)).toBe(true);
  });

  it("refuses missing binding, broken transport, CPU exhaustion and corrupt replies", async () => {
    const record = await hashPassword("synthetic", 1_000);
    const cases = [
      remotePasswordDeriver(undefined),
      remotePasswordDeriver(testNamespace({ reject: true })),
      remotePasswordDeriver(testNamespace({ status: 503 })),
      remotePasswordDeriver(testNamespace({ key: [1] })),
      remotePasswordDeriver(testNamespace({ key: Array(32).fill(256) })),
      remotePasswordDeriver(testNamespace({ key: "not bytes" })),
    ];
    for (const remote of cases) {
      await expect(hashPassword("new", 1_000, remote)).rejects.toBeInstanceOf(PasswordKdfUnavailable);
      // Infrastructure failure must not be mistaken for a wrong password.
      await expect(verifyPassword("synthetic", record, remote)).rejects.toBeInstanceOf(PasswordKdfUnavailable);
    }
  });

  it("rejects unknown password algorithms before contacting a remote KDF", async () => {
    const offload = remotePasswordDeriver(undefined);
    expect(await verifyPassword("anything", { hash: "disabled$google", salt: "disabled", iterations: 1 }, offload)).toBe(false);
  });
});
