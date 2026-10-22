/** STR-411: cancel a browser task that exposes a Promise but no AbortSignal
 * (WebAudio decodeAudioData, SubtleCrypto.digest). Late completion is discarded;
 * underlying browser work may continue until the browser releases it.
 */
export function awaitMediaTask411<T>(
  work: Promise<T>, signal: AbortSignal | undefined,
  options: { readonly timeoutMs: number; readonly timeoutMessage: string; readonly abortMessage: string },
): Promise<T> {
  if (signal?.aborted) {
    void work.catch(() => undefined);
    return Promise.reject(new DOMException(options.abortMessage, "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve(value as T);
    };
    const aborted = () => finish(new DOMException(options.abortMessage, "AbortError"));
    const deadline = setTimeout(() => finish(new Error(options.timeoutMessage)), options.timeoutMs);
    signal?.addEventListener("abort", aborted, { once: true });
    // Attach rejection handling even if abort/timeout already settled the wrapper.
    void work.then((value) => finish(undefined, value),
      (error) => finish(error instanceof Error ? error : new Error(options.timeoutMessage)));
    if (signal?.aborted) aborted();
  });
}
