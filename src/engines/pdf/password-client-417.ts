import { PASSWORD_417_MAX_INPUT, PASSWORD_417_MAX_OUTPUT, runPasswordCodec417, validatePassword417, type PasswordOperation417 } from "./password-417";

/** Isolate untrusted PDF parsing on the browser; hard cancellation and deadline. */
export async function runPasswordJob417(input: Blob, operation: PasswordOperation417, password: string, signal?: AbortSignal): Promise<Uint8Array> {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  if (input.size > PASSWORD_417_MAX_INPUT) throw new Error("PDF_LIMIT: Dimensione PDF fuori dal limite locale di 8 MiB.");
  const bytes = new Uint8Array(await input.arrayBuffer());
  validatePassword417(bytes, password);
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  if (typeof window === "undefined") {
    const result = await runPasswordCodec417(bytes, operation, password);
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    return result;
  }
  if (typeof Worker === "undefined") throw new Error("PDF_PASSWORD_UNSUPPORTED_417: Worker locale non disponibile.");
  return new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(new URL("./password-worker-417.ts", import.meta.url), { type: "module" });
    let settled = false;
    let deadline: ReturnType<typeof setTimeout>;
    function finish(error?: Error, result?: Uint8Array) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (error !== undefined) reject(error);
      else if (result !== undefined) resolve(result);
      else reject(new Error("PDF_PASSWORD_UNSUPPORTED_417"));
    }
    function abort() { finish(new DOMException("Operazione annullata", "AbortError")); }
    signal?.addEventListener("abort", abort, { once: true });
    deadline = setTimeout(() => finish(new Error("PDF_LIMIT: Limite di tempo locale di 20 secondi superato.")), 20_000);
    worker.onerror = () => finish(new Error("PDF_PASSWORD_UNSUPPORTED_417: Worker PDF non disponibile."));
    worker.onmessage = (event: MessageEvent<{ ok: boolean; error?: string; bytes?: Uint8Array }>) => {
      const { ok, error, bytes: result } = event.data;
      if (!ok) return finish(new Error(error ?? "PDF_PASSWORD_UNSUPPORTED_417"));
      if (!(result instanceof Uint8Array) || result.length > PASSWORD_417_MAX_OUTPUT || result.length < 8) {
        return finish(new Error("PDF_LIMIT: Risultato PDF non valido."));
      }
      finish(undefined, result);
    };
    if (signal?.aborted) return abort();
    worker.postMessage({ bytes, operation, password }, [bytes.buffer]);
  });
}
