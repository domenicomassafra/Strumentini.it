import { describe, expect, it } from "vitest";
import {
  PASSWORD_ITERATIONS,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  isExpired,
  needsRehash,
  parseCookies,
  parseStoredPassword,
  readSessionToken,
  sessionCookie,
  sessionExpiryIso,
  sha256Hex,
  verifyPassword,
} from "../worker/auth";
import { MESSAGES, validateEmail, validateName, validatePassword, validateToolId } from "../worker/validation";

describe("password records", () => {
  it("verifies the password it hashed and rejects every other candidate", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.iterations).toBe(PASSWORD_ITERATIONS);
    expect(stored.hash.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("Correct horse battery", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  }, 30_000);

  it("salts each hash, so identical passwords never share a digest", async () => {
    const first = await hashPassword("same-password-twice");
    const second = await hashPassword("same-password-twice");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
    expect(await verifyPassword("same-password-twice", { ...first, hash: second.hash })).toBe(false);
    expect(await verifyPassword("same-password-twice", { ...first, salt: second.salt })).toBe(false);
  }, 30_000);

  it("re-derives with the iteration count stored in the record", async () => {
    const legacy = await hashPassword("raise-me-later", 1_000);
    expect(legacy.iterations).toBe(1_000);
    expect(await verifyPassword("raise-me-later", legacy)).toBe(true);
    const raised = await hashPassword("raise-me-later");
    expect(await verifyPassword("raise-me-later", raised)).toBe(true);
    expect(await verifyPassword("raise-me-later", { ...legacy, iterations: PASSWORD_ITERATIONS })).toBe(false);
  }, 30_000);

  it("asks for a re-hash only when the stored work factor is behind", async () => {
    const current = await hashPassword("current-work-factor");
    expect(needsRehash(current)).toBe(false);
    const legacy = await hashPassword("older-work-factor", 1_000);
    expect(needsRehash(legacy)).toBe(true);
    // An unusable record is not a migration candidate: it is a rejection.
    expect(needsRehash({ hash: "argon2id$AAAA", salt: "AAAA", iterations: 1_000 })).toBe(false);
    expect(needsRehash({ hash: "no-separator", salt: "AAAA", iterations: 1_000 })).toBe(false);
  });

  it("fails closed on unknown algorithms and malformed records", async () => {
    expect(parseStoredPassword({ hash: "no-separator", salt: "AAAA", iterations: 3 })).toBeNull();
    expect(parseStoredPassword({ hash: "pbkdf2-sha256$AAAA", salt: "", iterations: 3 })).toBeNull();
    expect(parseStoredPassword({ hash: "pbkdf2-sha256$AAAA", salt: "AAAA", iterations: 0 })).toBeNull();
    expect(await verifyPassword("anything", { hash: "argon2id$AAAA", salt: "AAAA", iterations: 3 })).toBe(false);
    expect(await verifyPassword("anything", { hash: "pbkdf2-sha256$not base64!", salt: "AAAA", iterations: 3 })).toBe(false);
    expect(await verifyPassword("anything", { hash: "pbkdf2-sha256$AAAA", salt: "AAAA", iterations: 3 })).toBe(false);
  });
});

describe("session tokens", () => {
  it("issues a random raw token and stores only its SHA-256 digest", async () => {
    const token = await createSessionToken();
    expect(token.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(await sha256Hex(token.token)).toBe(token.tokenHash);
    const other = await createSessionToken();
    expect(other.token).not.toBe(token.token);
    expect(other.tokenHash).not.toBe(token.tokenHash);
  });

  it("serialises the cookie attributes the browser relies on", () => {
    expect(sessionCookie("raw-token")).toBe(
      "su_session=raw-token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
    );
    expect(clearSessionCookie()).toBe("su_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  });

  it("reads the session token back out of a request", () => {
    const request = new Request("https://strumentini.it/api/auth/session", {
      headers: { cookie: "theme=dark; su_session=abc123; other=1" },
    });
    expect(readSessionToken(request)).toBe("abc123");
    expect(readSessionToken(new Request("https://strumentini.it/"))).toBeNull();
    expect(readSessionToken(new Request("https://strumentini.it/", { headers: { cookie: "su_session=" } }))).toBeNull();
    expect(parseCookies(null).size).toBe(0);
    expect(parseCookies('a="quoted value"; b=1; a=second').get("a")).toBe("quoted value");
  });

  it("expires sessions thirty days after they are created", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(sessionExpiryIso(created)).toBe("2026-01-31T00:00:00.000Z");
    expect(isExpired(sessionExpiryIso(created), created)).toBe(false);
    expect(isExpired("2025-12-31T23:59:59.999Z", created)).toBe(true);
    expect(isExpired("not-a-date", created)).toBe(true);
  });
});

describe("input validation", () => {
  it("normalises emails and rejects anything unlikely to be deliverable", () => {
    expect(validateEmail("  Alice@Example.COM ")).toEqual({ ok: true, value: "alice@example.com" });
    for (const candidate of ["", "no-at", "a@b", "a b@c.it", "a@b.", "a@.it", 42, null, undefined]) {
      const result = validateEmail(candidate);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(MESSAGES.emailInvalid);
    }
  });

  it("trims names and refuses empty, oversized or control-character ones", () => {
    expect(validateName("  Alice Rossi  ")).toEqual({ ok: true, value: "Alice Rossi" });
    for (const candidate of ["   ", "x".repeat(81), "bad\nname", 7, null]) {
      expect(validateName(candidate).ok).toBe(false);
    }
  });

  it("enforces the ten character password policy", () => {
    expect(validatePassword("123456789").ok).toBe(false);
    expect(validatePassword("1234567890")).toEqual({ ok: true, value: "1234567890" });
    expect(validatePassword("x".repeat(257)).ok).toBe(false);
    expect(validatePassword("").ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
  });

  it("accepts catalog slugs as tool ids and nothing else", () => {
    expect(validateToolId("date-difference")).toEqual({ ok: true, value: "date-difference" });
    expect(validateToolId("csv2json").ok).toBe(true);
    for (const candidate of ["-leading", "trailing-", "UPPER", "sp ace", "a/b", "../../etc/passwd", "a".repeat(65), 12, null]) {
      const result = validateToolId(candidate);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(MESSAGES.toolIdInvalid);
    }
  });
});
