import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "parse5";

const root = resolve(import.meta.dirname, "..");
const receiptDir = resolve(root, "quality/functional-audit/result-v2-original-200");
const original = JSON.parse(await readFile(resolve(root, "quality/functional-audit/original-200.inventory.json"), "utf8"));
const ids = original.entries.map(({ toolId }) => toolId);
assert.equal(ids.length, 200);
assert.equal(new Set(ids).size, 200);

function findElement(tree, name, attrName, expected) {
  if (tree.tagName === name && (attrName === undefined || tree.attrs?.some((attr) => attr.name === attrName && attr.value === expected))) return tree;
  for (const child of tree.childNodes ?? []) {
    const found = findElement(child, name, attrName, expected);
    if (found) return found;
  }
  return null;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET") { res.writeHead(405).end(); return; }
  const match = /^\/tools\/([a-z0-9-]+)\/$/u.exec(new URL(req.url ?? "/", "http://localhost").pathname);
  if (!match || !ids.includes(match[1])) { res.writeHead(404).end(); return; }
  try {
    const bytes = await readFile(resolve(root, "dist/tools", match[1], "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const failures = [];
const hash = createHash("sha256");
let checked = 0;
try {
  for (const id of ids) {
    const url = `${origin}/tools/${id}/`;
    const response = await fetch(url, { method: "GET", redirect: "error" });
    if (response.status !== 200) { failures.push({ toolId: id, error: `http-${response.status}` }); continue; }
    const body = await response.text();
    const parsed = parse(body);
    if (!findElement(parsed, "article", "data-tool-page", id)) {
      failures.push({ toolId: id, error: "built-html-tool-identity-missing" });
      continue;
    }
    if (!findElement(parsed, "h1")) {
      failures.push({ toolId: id, error: "built-html-h1-missing" });
      continue;
    }
    hash.update(id).update(String(body.length)).update(body);
    checked += 1;
  }
  const receipt = {
    schemaVersion: 1,
    sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    scope: "original-200 built static HTML HTTP GET and independent parse5 DOM tree",
    checked, denominator: 200, failures,
    httpLocalOnly: true, requestMethod: "GET", uploadRequests: 0,
    builtRouteBodiesSha256: hash.digest("hex"),
    limitation: "Does not claim hydrated Result v2 interaction, positive/refusal, lazy execution, or independent output-file parsing.",
  };
  await writeFile(resolve(receiptDir, "consumer-html.json"), JSON.stringify(receipt, null, 2) + "\n", "utf8");
  console.log("original 200 static consumer HTTP/HTML:", JSON.stringify(receipt));
  assert.equal(checked, 200, `${failures.length} built HTML routes failed`);
} finally {
  await new Promise((ready, reject) => server.close((error) => error ? reject(error) : ready()));
}
