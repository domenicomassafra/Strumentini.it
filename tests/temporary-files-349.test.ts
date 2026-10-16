import { describe, expect, it } from "vitest";
import { TEMP_FILE_LIMIT_349, TEMP_FILE_TTL_MS_349, temporaryFileRequest349 } from "../worker/temporary-files-349";
import type { TemporaryFileBucket349, TemporaryFileObject349 } from "../worker/temporary-files-349";

const ORIGIN = "https://strumentini.example.test";
const ID = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN = "1".repeat(64);
const WRONG_TOKEN = "2".repeat(64);

class Bucket implements TemporaryFileBucket349 {
  readonly objects = new Map<string, { bytes: Uint8Array; metadata: Record<string, string> }>();
  async head(key: string): Promise<TemporaryFileObject349 | null> {
    const found = this.objects.get(key);
    return found ? { size: found.bytes.length, customMetadata: found.metadata } : null;
  }
  async get(key: string): Promise<TemporaryFileObject349 | null> {
    const found = this.objects.get(key);
    return found ? {
      size: found.bytes.length,
      customMetadata: found.metadata,
      body: new Blob([found.bytes.slice()]).stream(),
    } : null;
  }
  async put(key: string, bytes: Uint8Array, options: { onlyIf: { etagDoesNotMatch: string }; customMetadata: Record<string, string> }) {
    if (options.onlyIf.etagDoesNotMatch !== "*" || this.objects.has(key)) return null;
    this.objects.set(key, { bytes: bytes.slice(), metadata: { ...options.customMetadata } });
    return await this.head(key);
  }
  async delete(key: string) { this.objects.delete(key); }
}

function request(method: string, token = TOKEN, body?: Uint8Array, consent = true, id = ID): Request {
  return new Request(`${ORIGIN}/api/temporary-files/${id}`, {
    method,
    headers: {
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
      "x-temporary-file-token": token,
      ...(method === "POST" ? {
        "x-temporary-file-consent": consent ? "yes" : "no",
        "x-temporary-file-type": "image/jpeg",
        "x-temporary-file-name": "test.jpg",
      } : {}),
    },
    ...(body === undefined ? {} : { body: body.slice() }),
  });
}

describe("#349 opt-in R2 object retention and deletion", () => {
  it("denies missing consent, invalid IDs, absent binding and hostile origins before storing", async () => {
    const bucket = new Bucket();
    const file = new TextEncoder().encode("small image fixture");
    expect((await temporaryFileRequest349(request("POST", TOKEN, file, false), bucket, ID)).status).toBe(403);
    expect((await temporaryFileRequest349(request("POST", TOKEN, file), undefined, ID)).status).toBe(503);
    expect((await temporaryFileRequest349(request("POST", TOKEN, file), bucket, "../../other")).status).toBe(404);
    const cross = request("POST", TOKEN, file);
    cross.headers.set("origin", "https://untrusted.example.test");
    expect((await temporaryFileRequest349(cross, bucket, ID)).status).toBe(403);
    expect(bucket.objects.size).toBe(0);
  });

  it("stores only the chosen bytes, supports exact retry, blocks other tokens and deletes immediately", async () => {
    const bucket = new Bucket();
    const file = new TextEncoder().encode("local bytes; privacy matters");
    const saved = await temporaryFileRequest349(request("POST", TOKEN, file), bucket, ID, 1_000);
    expect(saved.status).toBe(201);
    expect(await saved.json()).toMatchObject({ id: ID, bytes: file.length, retry: false });
    expect(bucket.objects.size).toBe(1);
    expect(JSON.stringify([...bucket.objects.values()][0]?.metadata)).not.toContain(TOKEN);

    const retry = await temporaryFileRequest349(request("POST", TOKEN, file), bucket, ID, 2_000);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ retry: true });
    expect((await temporaryFileRequest349(request("POST", TOKEN, new TextEncoder().encode("changed")), bucket, ID, 2_000)).status).toBe(409);
    expect((await temporaryFileRequest349(request("GET", WRONG_TOKEN), bucket, ID, 2_000)).status).toBe(403);
    expect((await temporaryFileRequest349(request("DELETE", WRONG_TOKEN), bucket, ID, 2_000)).status).toBe(403);
    expect(bucket.objects.size).toBe(1);

    const downloaded = await temporaryFileRequest349(request("GET"), bucket, ID, 2_000);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-disposition")).toBe('attachment; filename="test.jpg"');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(file);
    expect((await temporaryFileRequest349(request("DELETE"), bucket, ID, 2_000)).status).toBe(204);
    expect(bucket.objects.size).toBe(0);
    expect((await temporaryFileRequest349(request("GET"), bucket, ID, 2_000)).status).toBe(404);
  });

  it("limits input by actual read bytes and enforces logical TTL plus physical deletion upon first expired access", async () => {
    const bucket = new Bucket();
    expect((await temporaryFileRequest349(request("POST", TOKEN, new Uint8Array(TEMP_FILE_LIMIT_349 + 1)), bucket, ID)).status).toBe(413);
    expect(bucket.objects.size).toBe(0);
    expect((await temporaryFileRequest349(request("POST", TOKEN, new Uint8Array([1])), bucket, ID, 1_000)).status).toBe(201);
    expect((await temporaryFileRequest349(request("GET"), bucket, ID, 1_000 + TEMP_FILE_TTL_MS_349 - 1)).status).toBe(200);
    expect((await temporaryFileRequest349(request("GET"), bucket, ID, 1_000 + TEMP_FILE_TTL_MS_349)).status).toBe(404);
    expect(bucket.objects.size).toBe(0);
  });

  it("fails concurrent conditional uploads closed and leaves the original good bytes untouched", async () => {
    const bucket = new Bucket();
    const file = new Uint8Array([5, 6, 7]);
    const [one, two] = await Promise.all([
      temporaryFileRequest349(request("POST", TOKEN, file), bucket, ID, 1_000),
      temporaryFileRequest349(request("POST", TOKEN, new Uint8Array([1, 2, 3])), bucket, ID, 1_000),
    ]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
    expect(bucket.objects.size).toBe(1);
  });
});
