import { describe, expect, it } from "vitest";
import { FilePrivacyError, runFilePrivacyOperation } from "../src/engines/file-privacy";
import { filePrivacyErrorIt } from "../src/components/tools/file-privacy/FilePrivacyTool";

describe("STR-359 rifiuti: nessun completamento ingannevole", () => {
  it("rifiuta input vuoto e archivio ZIP corrotto con istruzioni in italiano", async () => {
    await expect(runFilePrivacyOperation("filename-sanitizer", { names: [] }))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(runFilePrivacyOperation("zip-contents-inspector", {
      files: [new File(["not a zip"], "rotto.zip", { type: "application/zip" })],
    })).rejects.toMatchObject({ code: "CORRUPT_ARCHIVE" });
    expect(filePrivacyErrorIt(new FilePrivacyError("INVALID_INPUT", "internal"))).toMatch(/Controlla.*dati/);
    expect(filePrivacyErrorIt(new FilePrivacyError("CORRUPT_ARCHIVE", "internal"))).toMatch(/archivio/);
    expect(filePrivacyErrorIt(new FilePrivacyError("UNSUPPORTED_INPUT", "internal"))).toMatch(/non è supportato/);
  });

  it("un'operazione interrotta non restituisce un risultato", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runFilePrivacyOperation("file-hash", {
      files: [new File(["privato"], "locale.txt")],
    }, controller.signal)).rejects.toMatchObject({ code: "CANCELLED" });
    expect(filePrivacyErrorIt(new FilePrivacyError("CANCELLED", "internal"))).toBe("Operazione annullata.");
  });
});
