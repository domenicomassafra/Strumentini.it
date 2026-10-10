import { placeVisualSignature241, type VisualSignature241Options } from "./visual-signature-241";

type SignatureJob241 = { readonly source: Uint8Array; readonly options: VisualSignature241Options };

self.addEventListener("message", (event: MessageEvent<SignatureJob241>) => {
  try {
    const result = placeVisualSignature241(event.data.source, event.data.options);
    // The dedicated Worker is disposed by the caller after this one response.
    self.postMessage({ ok: true, bytes: result.artifact.bytes, plan: result.plan },
      { transfer: [result.artifact.bytes.buffer as ArrayBuffer] });
  } catch (reason) {
    const raw = reason instanceof Error ? reason.message : "";
    // Never echo arbitrary source bytes, embedded PDF strings or stack traces.
    const safe = /^PDF241_[A-Z_]+:/u.test(raw) ? raw.slice(0, 240)
      : "PDF241_UNSAFE_SOURCE: impossibile applicare una firma visiva sicura a questo PDF";
    self.postMessage({ ok: false, message: safe });
  }
});
