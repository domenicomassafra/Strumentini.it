import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PASSWORD_ITERATIONS,
  hashPassword,
  needsRehash,
  parseStoredPassword,
  verifyPassword,
} from "../worker/auth";

describe("#328 real edge PBKDF2 100k-per-call compatibility", () => {
  it("verifies existing standard 600k PBKDF2-HMAC-SHA256 records without format migration", async () => {
    const salt = Buffer.alloc(16, 0x5a);
    const password = "synthetic-rfc8018-compatibility";
    const digest = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
    const previousRecord = {
      hash: `pbkdf2-sha256$${digest.toString("base64url")}`,
      salt: salt.toString("base64url"),
      iterations: PASSWORD_ITERATIONS,
    };
    expect(await verifyPassword(password, previousRecord)).toBe(true);
    expect(await verifyPassword("different", previousRecord)).toBe(false);
    expect(needsRehash(previousRecord)).toBe(false);
  }, 30_000);

  it("keeps all newly minted hashes at 600k, identical to independent Node PBKDF2", async () => {
    const password = "synthetic-staging-test-not-a-user-password";
    const record = await hashPassword(password);
    expect(record.iterations).toBe(600_000);
    const salt = Buffer.from(record.salt, "base64url");
    const digest = pbkdf2Sync(password, salt, 600_000, 32, "sha256");
    expect(record.hash).toBe(`pbkdf2-sha256$${digest.toString("base64url")}`);
    expect(await verifyPassword(password, record)).toBe(true);
  }, 30_000);

  it("preserves native 100k and lower legacy verification without implicit cost downgrade", async () => {
    const old = await hashPassword("synthetic-older-factor", 100_000);
    expect(await verifyPassword("synthetic-older-factor", old)).toBe(true);
    expect(needsRehash(old)).toBe(true);
    expect(parseStoredPassword({ ...old, iterations: 1_000_001 })).toBeNull();
    await expect(hashPassword("no", 1_000_001)).rejects.toThrow("Unsupported password iteration factor");
  });
  it("yields to other requests while the full 600k-iteration hash is computing", async () => {
    const completion = hashPassword("synthetic-probe-not-a-real-password");
    const nextEventLoopTurn = new Promise<"yield">((resolve) => setTimeout(() => resolve("yield"), 0));
    expect(await Promise.race([completion.then(() => "complete"), nextEventLoopTurn])).toBe("yield");
    expect((await completion).iterations).toBe(600_000);
  }, 30_000);
});
