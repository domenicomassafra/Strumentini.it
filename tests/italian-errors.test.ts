import { describe, expect, it } from "vitest";
import { friendlyToolErrorIt } from "../src/i18n/it/errors";

describe("errori pubblici italiani", () => {
  it("traduce codici macchina comuni in istruzioni utili", () => {
    expect(friendlyToolErrorIt("INVALID_TIMEZONE")).toContain("fuso orario");
    expect(friendlyToolErrorIt("TABLE_TOO_MANY_ROWS")).toContain("troppe righe");
    expect(friendlyToolErrorIt("INVALID_PDF_SIGNATURE: missing %PDF header")).toContain("PDF valido");
    expect(friendlyToolErrorIt("UNSUPPORTED_CAPABILITY: object streams")).toContain("non supporta ancora");
    expect(friendlyToolErrorIt("RUNTIME_ERROR")).not.toContain("RUNTIME_ERROR");
    const oversizedPage = friendlyToolErrorIt("PDF_SINGLE_PAGE_TOO_LARGE: Page 7 needs 654321 bytes; requested ceiling 204800. Remove that page or raise the ceiling.");
    expect(oversizedPage).toContain("pagina 7");
    expect(oversizedPage).toContain("654321 byte");
    expect(oversizedPage).toContain("204800 byte");
    expect(oversizedPage).toContain("nessun PDF parziale");
  });

  it("mantiene messaggi italiani già comprensibili", () => {
    expect(friendlyToolErrorIt("Inserisci un numero valido.")).toBe("Inserisci un numero valido.");
  });
});
