/**
 * #349 — Private, opt-in, one-day R2 handoff.
 * A random capability is kept exclusively by the browser. R2 stores its hash,
 * so object identifiers alone never grant read or delete access.
 */
export const TEMP_FILE_LIMIT_349 = 1_048_576;
export const TEMP_FILE_TTL_MS_349 = 86_400_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);

export interface TemporaryFileObject349 {
  readonly size: number;
  readonly customMetadata?: Record<string, string>;
  readonly body?: ReadableStream;
}
export interface TemporaryFileBucket349 {
  head(key: string): Promise<TemporaryFileObject349 | null>;
  get(key: string): Promise<TemporaryFileObject349 | null>;
  put(
    key: string, value: Uint8Array,
    options: { onlyIf: { etagDoesNotMatch: string }; customMetadata: Record<string, string> },
  ): Promise<TemporaryFileObject349 | null>;
  delete(key: string): Promise<void>;
}

function reply(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function denied(status: number): Response {
  return reply({ error: status === 403 ? "Accesso non consentito." : "File non disponibile." }, status);
}

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  return (origin === null || origin === new URL(request.url).origin)
    && site !== "cross-site" && site !== "same-site";
}

function keyFor(id: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)
    ? `temporary/v1/${id}`
    : null;
}

async function digest(value: string | Uint8Array): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalHex(a: string | undefined, b: string): boolean {
  if (typeof a !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < b.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function boundedBody(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > TEMP_FILE_LIMIT_349) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length === 0) return null;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function temporaryFileRequest349(
  request: Request, bucket: TemporaryFileBucket349 | undefined, id: string,
  nowMs = Date.now(),
): Promise<Response> {
  const key = keyFor(id);
  if (key === null) return denied(404);
  if (!allowedOrigin(request)) return denied(403);
  if (bucket === undefined) return reply({ error: "Archivio temporaneo non disponibile." }, 503);
  const token = request.headers.get("x-temporary-file-token") ?? "";
  if (!/^[a-f0-9]{64}$/u.test(token)) return denied(403);
  const tokenHash = await digest(token);
  if (request.method === "POST") {
    // The gesture is also enforced in the UI, but a missing consent header is
    // refused here before reading even one byte.
    if (request.headers.get("x-temporary-file-consent") !== "yes") return denied(403);
    const type = request.headers.get("x-temporary-file-type") ?? "";
    if (!TYPES.has(type)) return reply({ error: "Formato non supportato." }, 415);
    const name = request.headers.get("x-temporary-file-name") ?? "";
    if (!/^[\w .()-]{1,100}$/u.test(name) || name.startsWith(".")) {
      return reply({ error: "Nome del file non valido." }, 400);
    }
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (!Number.isSafeInteger(declared) || declared > TEMP_FILE_LIMIT_349) return reply({ error: "Limite di 1 MiB superato." }, 413);
    const bytes = await boundedBody(request);
    if (bytes === null) return reply({ error: "File vuoto o superiore a 1 MiB." }, 413);
    const fileHash = await digest(bytes);
    const existing = await bucket.head(key);
    if (existing !== null) {
      if (!equalHex(existing.customMetadata?.tokenHash, tokenHash)) return denied(403);
      if (existing.customMetadata?.fileHash !== fileHash || existing.customMetadata?.type !== type) return reply({ error: "Tentativo ripetuto con contenuto diverso." }, 409);
      const expires = Number(existing.customMetadata?.expires);
      if (!Number.isFinite(expires) || expires <= nowMs) return denied(404);
      return reply({ id, bytes: existing.size, expiresAt: new Date(expires).toISOString(), retry: true }, 200);
    }
    const expires = nowMs + TEMP_FILE_TTL_MS_349;
    const stored = await bucket.put(key, bytes, {
      onlyIf: { etagDoesNotMatch: "*" },
      customMetadata: { tokenHash, fileHash, type, filename: name, expires: String(expires) },
    });
    if (stored === null) return reply({ error: "Caricamento già in corso: riprova con lo stesso file." }, 409);
    return reply({ id, bytes: bytes.length, expiresAt: new Date(expires).toISOString(), retry: false }, 201);
  }
  const object = await bucket.head(key);
  if (object === null) return denied(404);
  if (!equalHex(object.customMetadata?.tokenHash, tokenHash)) return denied(403);
  const expires = Number(object.customMetadata?.expires);
  if (!Number.isFinite(expires) || expires <= nowMs) {
    await bucket.delete(key);
    return denied(404);
  }
  if (request.method === "DELETE") {
    await bucket.delete(key);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  if (request.method !== "GET") return denied(404);
  const content = await bucket.get(key);
  if (content?.body === undefined || !equalHex(content.customMetadata?.tokenHash, tokenHash)) return denied(404);
  return new Response(content.body, {
    status: 200,
    headers: {
      "content-type": content.customMetadata?.type && TYPES.has(content.customMetadata.type)
        ? content.customMetadata.type : "application/octet-stream",
      "content-length": String(content.size),
      "content-disposition": `attachment; filename="${content.customMetadata?.filename ?? "download"}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
