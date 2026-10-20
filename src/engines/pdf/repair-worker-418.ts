import { PdfRepair418Error, repairPdf418 } from "./repair-418";

self.addEventListener("message", async (event: MessageEvent<{ readonly source: Uint8Array }>) => {
  try {
    const result = await repairPdf418(event.data.source);
    self.postMessage({ kind: "STR418_REPAIR_RESULT", ok: true, ...result }, { transfer: [result.bytes.buffer as ArrayBuffer] });
  } catch (reason) {
    const code = reason instanceof PdfRepair418Error ? reason.code : "VERIFICATION_FAILED";
    self.postMessage({ kind: "STR418_REPAIR_RESULT", ok: false, code, message: "Recupero PDF rifiutato: impossibile verificarne il contenuto." });
  }
});
