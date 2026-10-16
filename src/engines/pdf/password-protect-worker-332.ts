import { protectPdfBytes332 } from "./password-protect-332";

self.addEventListener("message", async (event: MessageEvent<{ bytes: Uint8Array; password: string }>) => {
  try {
    const result = await protectPdfBytes332(event.data.bytes, event.data.password);
    self.postMessage({ ok: true, ...result }, { transfer: [result.bytes.buffer] });
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : "PDF_PROTECTION_FAILED" });
  }
});
