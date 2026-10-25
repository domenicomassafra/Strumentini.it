/** Bounded parser for JSON object request bodies at the public Worker boundary. */
export type JsonObjectBodyResult =
  | { readonly ok: true; readonly body: Record<string, unknown> }
  | { readonly ok: false; readonly status: 400 | 413 };

export async function parseJsonObjectBody(request: Request, maxBytes: number): Promise<JsonObjectBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413 };
  }

  let text: string;
  try {
    const bytes = new Uint8Array(maxBytes);
    const reader = request.body?.getReader();
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength > maxBytes - size) {
          // Stop consuming the request before allocating or decoding an oversized body.
          void reader.cancel().catch(() => undefined);
          return { ok: false, status: 413 };
        }
        bytes.set(value, size);
        size += value.byteLength;
      }
    }
    text = new TextDecoder().decode(bytes.subarray(0, size));
  } catch {
    return { ok: false, status: 400 };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { ok: true, body: parsed as Record<string, unknown> };
    }
  } catch {
    // Invalid JSON uses the same 400 response as non-object JSON.
  }
  return { ok: false, status: 400 };
}
