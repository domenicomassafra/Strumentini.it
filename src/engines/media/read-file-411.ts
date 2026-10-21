/** STR-411. Native FileReader/Blob slices: no dependency or media upload.
 * Reports only complete, byte-verified local chunks; cancelling aborts an
 * active FileReader and stops future slices. Caller owns memory limits.
 * Browser API reference: https://developer.mozilla.org/en-US/docs/Web/API/FileReader/abort
 */
const CHUNK_BYTES = 256 * 1024;
const READ_DEADLINE_MS = 20_000;
const MAX_ALLOWED_BYTES = 50 * 1024 * 1024;

function abortError(): DOMException {
  return new DOMException("Lettura locale annullata; nessun risultato prodotto.", "AbortError");
}

function readChunk411(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = typeof FileReader === "undefined" ? null : new FileReader();
    let completed = false;
    const end = (error?: Error, bytes?: ArrayBuffer) => {
      if (completed) return;
      completed = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", aborted);
      if (error) reject(error);
      else if (bytes) resolve(bytes);
      else reject(new Error("MEDIA_411_READ_FAILED: Lettura non verificabile. Riprova con il file locale."));
    };
    const aborted = () => {
      if (reader?.readyState === FileReader.LOADING) reader.abort();
      end(abortError());
    };
    const deadline = setTimeout(() => {
      // Finish with timeout BEFORE FileReader.abort() fires its own AbortError.
      // A hung/suspended browser read is a recoverable timeout, not a user cancel.
      end(new Error("MEDIA_411_READ_TIMEOUT: Lettura sospesa o bloccata; torna alla scheda e riprova."));
      if (reader?.readyState === FileReader.LOADING) reader.abort();
    }, READ_DEADLINE_MS);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    if (reader) {
      reader.onload = () => end(undefined, reader.result instanceof ArrayBuffer ? reader.result : undefined);
      reader.onerror = () => end(new Error("MEDIA_411_READ_FAILED: Il browser non riesce a leggere questo blocco."));
      reader.onabort = () => end(abortError());
      try { reader.readAsArrayBuffer(blob); }
      catch { end(new Error("MEDIA_411_READ_FAILED: Lettura locale non disponibile.")); }
    } else {
      void blob.arrayBuffer().then((bytes) => end(undefined, bytes),
        () => end(new Error("MEDIA_411_READ_FAILED: File locale non leggibile.")));
    }
  });
}

export interface MediaReadOptions411 {
  readonly maxBytes: number;
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((loadedBytes: number, totalBytes: number) => void) | undefined;
}

export async function readMediaFile411(file: Blob, options: MediaReadOptions411): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(file.size) || file.size < 1 || !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes < 1 || options.maxBytes > MAX_ALLOWED_BYTES || file.size > options.maxBytes) {
    throw new Error("MEDIA_411_INPUT_LIMIT: Dimensione non supportata; riduci il file locale.");
  }
  if (options.signal?.aborted) throw abortError();
  const output = new Uint8Array(file.size);
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    if (options.signal?.aborted) throw abortError();
    const end = Math.min(file.size, offset + CHUNK_BYTES);
    const chunk = await readChunk411(file.slice(offset, end), options.signal);
    if (options.signal?.aborted) throw abortError();
    if (chunk.byteLength !== end - offset) {
      throw new Error("MEDIA_411_SHORT_READ: File locale incompleto; nessun risultato esportato.");
    }
    output.set(new Uint8Array(chunk), offset);
    options.onProgress?.(end, file.size);
    if (options.signal?.aborted) throw abortError();
  }
  return output.buffer;
}
