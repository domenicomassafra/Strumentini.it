import { unlockPdfBytes320 } from "./password-engine-320";

interface Request320 {
  readonly bytes: Uint8Array;
  readonly password: string;
}

self.addEventListener("message", async (event: MessageEvent<Request320>) => {
  try {
    const result = await unlockPdfBytes320(event.data.bytes, event.data.password);
    self.postMessage({ ok: true, ...result }, { transfer: [result.bytes.buffer] });
  } catch (error) {
    // The engine sanitizes qpdf errors; never echo request input or passwords.
    const message = error instanceof Error ? error.message : "UNSUPPORTED_CAPABILITY: Sblocco non riuscito.";
    self.postMessage({ ok: false, message });
  }
});
