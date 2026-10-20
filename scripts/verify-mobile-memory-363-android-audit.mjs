/** Independent reviewer of partial AVD raw files: authenticates bytes, not device origin. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import sharp from "sharp";
const root = resolve(import.meta.dirname, "..");
const scratch = resolve(root, ".tmp-str363-android");
const file = process.argv[2];
assert(file && basename(file).endsWith("-raw.json"));
const canonical = await realpath(resolve(file));
assert(canonical.startsWith((await realpath(scratch)) + sep), "raw file outside private audit root");
assert((await stat(canonical)).size < 100000, "raw input too big");
const source = JSON.parse(await readFile(canonical, "utf8"));
const hash = data => createHash("sha256").update(data).digest("hex");
assert.equal(source.evidenceKind, "ANDROID_EMULATOR_PARTIAL_RAW_UNATTESTED");
assert.equal(source.physicalDeviceObserved, false);
const actualHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.match(source.sourceRevision, /^[a-f0-9]{40}$/u);
// The optional audit-only child commit must not change code or dependencies
// from the source revision whose compiled dist was exercised.
if (source.sourceRevision !== actualHead) {
  execFileSync("git", ["merge-base", "--is-ancestor", source.sourceRevision, actualHead], { cwd: root });
  const changes = execFileSync("git", ["diff", "--name-only", source.sourceRevision, actualHead], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert(changes.every(name => name === "scripts/acceptance-mobile-memory-363-android-audit.mjs" ||
    name === "scripts/verify-mobile-memory-363-android-audit.mjs" ||
    name.startsWith("quality/receipts/mobile-memory-363/partial-android/")),
    "runtime/dependency code differs from recorded source revision");
}
assert.equal(source.route, "/tools/image-resize/");
assert.equal(source.routeSha256, hash(await readFile(resolve(root, "dist/tools/image-resize/index.html"))));
assert.match(source.simulator.fingerprint, /sdk_gphone64_x86_64/u);
assert.equal(source.browser.package, "com.android.chrome");
assert.match(source.browser.userAgent, /Android.*Chrome\//u);
assert(source.observations.length >= 1 && source.observations.length <= 6);
const seen = new Set();
for (const row of source.observations) {
  assert.equal(row.platform, "ANDROID_EMULATOR");
  assert.equal(row.format, "image");
  assert.equal(row.status, "OBSERVED_PARTIAL_REVIEW_REQUIRED");
  assert(["S", "M", "L"].includes(row.size));
  assert(["cold", "warm"].includes(row.phase));
  const key = row.size + "-" + row.phase;
  assert(!seen.has(key), "duplicate matrix cell");
  seen.add(key);
  const sourceFile = resolve(scratch, `${source.runId}-image-${row.size}.png`);
  const sourceBytes = await readFile(sourceFile);
  assert.equal(sourceBytes.length, row.input.bytes);
  assert.equal(hash(sourceBytes), row.input.sha256);
  const original = await sharp(sourceBytes, { failOn: "error" }).metadata();
  assert.deepEqual([original.format, original.width, original.height], ["png", ...row.input.dimensions]);
  const outputFile = resolve(scratch, `${source.runId}-${row.size}-${row.phase}-download.jpg`);
  assert.equal(await realpath(outputFile), await realpath(row.output.path));
  const saved = await readFile(outputFile);
  assert.equal(saved.length, row.output.bytes);
  assert.equal(hash(saved), row.output.sha256);
  assert.equal(saved.subarray(0, 3).toString("hex"), "ffd8ff");
  const decoded = await sharp(saved, { failOn: "error" }).metadata();
  const pixels = await sharp(saved, { failOn: "error" }).ensureAlpha().raw().toBuffer();
  assert.deepEqual([decoded.format, decoded.width, decoded.height], ["jpeg", ...row.output.dimensions]);
  assert.equal(pixels.length, row.output.decodedPixelBytes);
  assert.equal(row.memory.metric, "JS_HEAP_BYTES");
  assert([row.memory.before, row.memory.after, row.memory.observedPeak].every(v => Number.isFinite(v) && v >= 0));
  assert(row.memory.samples >= 2);
  assert(row.memory.observedPeak >= Math.max(row.memory.before, row.memory.after));
  assert(row.chromeMainProcessPssKB.before > 0 && row.chromeMainProcessPssKB.after > 0);
  assert(Number.isFinite(row.timing.operationElapsedMs) && row.timing.operationElapsedMs > 0);
  assert.deepEqual(row.pageErrors, []);
  assert.deepEqual(row.offsiteRequests, []);
  for (const name of ["cancel", "background", "retry", "controlledOom"]) assert.equal(row.recovery[name], "NOT_RUN");
}
console.log(JSON.stringify({ status: "PARTIAL_RAW_CROSSCHECKED_REVIEW_REQUIRED", cases: seen.size,
  rawSha256: hash(await readFile(canonical)), sourceRevision: source.sourceRevision, auditHead: actualHead,
  independentDecoder: "sharp/libvips",
  limitations: "Cannot attest native capture, input picker or unrun recovery; PR #380 receipt remains 36 NOT_RUN" }));
