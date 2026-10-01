import { describe, expect, it } from "vitest";
import { friendlyToolErrorIt } from "../src/i18n/it/errors";

describe("errori pubblici italiani", () => {
  it("traduce codici macchina comuni in istruzioni utili", () => {
    expect(friendlyToolErrorIt("INVALID_TIMEZONE")).toContain("fuso orario");
    expect(friendlyToolErrorIt("TABLE_TOO_MANY_ROWS")).toContain("troppe righe");
    expect(friendlyToolErrorIt("INVALID_PDF_SIGNATURE: missing %PDF header")).toContain("PDF valido");
    expect(friendlyToolErrorIt("UNSUPPORTED_CAPABILITY: object streams")).toContain("non supporta ancora");
    expect(friendlyToolErrorIt("RUNTIME_ERROR")).not.toContain("RUNTIME_ERROR");
  });

  it("mantiene messaggi italiani già comprensibili", () => {
    expect(friendlyToolErrorIt("Inserisci un numero valido.")).toBe("Inserisci un numero valido.");
  });
});
