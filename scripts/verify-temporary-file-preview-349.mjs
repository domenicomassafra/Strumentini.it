/**
 * End-to-end Worker + R2 smoke test for the isolated #349 preview.
 * Does not log capability tokens, file contents or any account identifiers.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:18142").origin;
const id = randomUUID();
const token = randomBytes(32).toString("hex");
const wrong = randomBytes(32).toString("hex");
const fixture = new TextEncoder().encode("STR349 controlled preview fixture\n");
const url = `${origin}/api/temporary-files/${id}`;
const output = { origin, preview: "temporary-files-349", checkedAt: new Date().toISOString(), results: {} };

async function call(method, bearer, body, headers = {}) {
  return await fetch(url, {
    method,
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "x-temporary-file-token": bearer,
      ...(body ? {
        "x-temporary-file-type": "text/plain",
        "x-temporary-file-name": "preview.txt",
      } : {}),
      ...headers,
    },
    ...(body ? { body } : {}),
  });
}

const noConsent = await call("POST", token, fixture);
output.results.noConsent = noConsent.status;
if (noConsent.status !== 403) throw new Error("Consent control failed");

let uploaded = false;
try {
  const created = await call("POST", token, fixture, { "x-temporary-file-consent": "yes" });
  output.results.upload = created.status;
  if (created.status !== 201) throw new Error(`Upload failed: ${created.status} ${await created.text()}`);
  uploaded = true;
  const meta = await created.json();
  output.expiresAt = meta.expiresAt;
  output.results.reportedBytes = meta.bytes;

  const duplicate = await call("POST", token, fixture, { "x-temporary-file-consent": "yes" });
  output.results.retry = duplicate.status;
  if (duplicate.status !== 200) throw new Error("Idempotent retry failed");

  const denied = await call("GET", wrong);
  output.results.wrongToken = denied.status;
  if (denied.status !== 403) throw new Error("Foreign capability could access fixture");

  const downloaded = await call("GET", token);
  output.results.download = downloaded.status;
  if (downloaded.status !== 200) throw new Error("Cannot retrieve uploaded bytes");
  const received = new Uint8Array(await downloaded.arrayBuffer());
  const expectedSha = createHash("sha256").update(fixture).digest("hex");
  const actualSha = createHash("sha256").update(received).digest("hex");
  output.results.sha256Verified = expectedSha === actualSha;
  if (!output.results.sha256Verified) throw new Error("Downloaded bytes differ");
} finally {
  if (uploaded) {
    const deleted = await call("DELETE", token);
    output.results.delete = deleted.status;
    const missing = await call("GET", token);
    output.results.afterDelete = missing.status;
  }
  console.log(JSON.stringify(output, null, 2));
}
if (output.results.delete !== 204 || output.results.afterDelete !== 404) throw new Error("Object deletion was not proven");
