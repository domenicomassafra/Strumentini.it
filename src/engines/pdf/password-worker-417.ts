import { runPasswordCodec417, type PasswordOperation417 } from "./password-417";

type PasswordRequest = { readonly bytes: Uint8Array; readonly password: string; readonly operation: PasswordOperation417 };
const worker = self as DedicatedWorkerGlobalScope;
worker.onmessage = async (event: MessageEvent<PasswordRequest>) => {
  try {
    const { bytes, password, operation } = event.data;
    const result = await runPasswordCodec417(bytes, operation, password);
    worker.postMessage({ ok: true, bytes: result }, [result.buffer]);
  } catch (error) {
    worker.postMessage({ ok: false, error: error instanceof Error ? error.message : "PDF_PASSWORD_UNSUPPORTED_417" });
  }
};
