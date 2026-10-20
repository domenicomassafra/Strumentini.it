#!/usr/bin/env node
// Independent parser for raw captures. Never promotes a receipt or reports PASS.
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep, basename } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const allowedRoot = resolve(root, "quality/receipts/mobile-memory-363/observed/raw");
const routes = { pdf: "/tools/pdf-rotate/", image: "/tools/image-resize/", csv: "/tools/csv-cleaner/" };
const location = process.argv[2];
if (!location || process.argv.length !== 3) throw Error("Usage: node scripts/parse-mobile-memory-363-raw.mjs path/to/capture-directory");
const folder = await realpath(resolve(location));
const allowed = await realpath(allowedRoot);
if (!folder.startsWith(allowed + sep)) throw Error("Capture must live under the canonical raw evidence directory");
const manifest = JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8"));
const errors = [];
if (manifest.ticket !== "STR-363" || manifest.schemaVersion !== 1 ||
    manifest.status !== "RAW_ONLY_INCOMPLETE" ||
    manifest.evidenceKind !== "SIMULATED_DEVICE_ONLY" ||
    manifest.physicalDeviceObserved !== false ||
    !["ADB_DUMPSYS_MEMINFO", "SIMCTL_PS"].includes(manifest.capture?.method)) {
  errors.push("invalid or falsely promoted capture manifest");
}
const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (manifest.sourceRevision !== head) errors.push("capture source revision differs from checked-out HEAD");
const collectorHash = createHash("sha256").update(await readFile(resolve(root, "scripts/capture-mobile-memory-363.mjs"))).digest("hex");
if (collectorHash !== manifest.collectorSha256) errors.push("collector script differs from recorded bytes");
if (manifest.route !== routes[manifest.format] ||
    !["S", "M", "L"].includes(manifest.size) || !["cold", "warm"].includes(manifest.phase) ||
    !["IOS_SIMULATOR", "ANDROID_EMULATOR"].includes(manifest.platform) ||
    (manifest.platform === "ANDROID_EMULATOR") !== (manifest.capture?.method === "ADB_DUMPSYS_MEMINFO")) {
  errors.push("inconsistent platform, method or case/route");
}
const routePath = resolve(root, "dist", String(manifest.route ?? "").replace(/^\/+/, ""), "index.html");
if (!routePath.startsWith(resolve(root, "dist") + sep)) errors.push("compiled route outside dist");
else {
  try {
    const sha = createHash("sha256").update(await readFile(routePath)).digest("hex");
    if (sha !== manifest.routeSha256) errors.push("compiled route hash differs from actual HTML");
  } catch { errors.push("compiled route missing"); }
}
const memorySamples = [];
if (!Array.isArray(manifest.samples) || manifest.samples.length < 2 || manifest.samples.length > 120)
  errors.push("missing bounded raw samples");
else for (const [index, entry] of manifest.samples.entries()) {
  if (entry.rawFile !== "sample-" + String(index).padStart(3, "0") + ".txt" ||
      basename(entry.rawFile) !== entry.rawFile) {
    errors.push("unsafe/unexpected sample path " + index); continue;
  }
  try {
    const path = resolve(folder, entry.rawFile);
    if (await realpath(path) !== path) throw Error("symlinked raw file");
    const bytes = await readFile(path);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== entry.sha256 || bytes.length !== entry.bytes) {
      errors.push("raw sample " + index + " hash/length mismatch"); continue;
    }
    if (!Array.isArray(entry.command) || entry.command.length < 4 ||
        !entry.command.includes(manifest.deviceId) ||
        !Number.isFinite(entry.samplerElapsedMs) ||
        !Number.isFinite(Date.parse(entry.startedAt))) {
      errors.push("raw sample " + index + " lacks command/device/timing provenance"); continue;
    }
    const source = bytes.toString("utf8");
    if (manifest.capture?.method === "ADB_DUMPSYS_MEMINFO") {
      // Android 'TOTAL' row: process PSS (column 1) and RSS (column 5), both KB.
      // This is a sample of the named process, NOT aggregate browser/renderers.
      const total = source.match(/^\s*TOTAL\s+(\d+)\s+\d+\s+\d+\s+\d+\s+(\d+)\s+/m);
      if (!total) { errors.push("missing Android process PSS/RSS in sample " + index); continue; }
      memorySamples.push({ timestamp: entry.startedAt, pssKb: Number(total[1]), rssKb: Number(total[2]) });
    }
  } catch (error) { errors.push("cannot read sample " + index + ": " + String(error)); }
}
const values = memorySamples.map((entry) => entry.pssKb);
const result = {
  status: "INCOMPLETE_REVIEW_REQUIRED", // Always; no authoritative device pass.
  captureValid: errors.length === 0, errors, sourceRevision: manifest.sourceRevision,
  case: { platform: manifest.platform, format: manifest.format, size: manifest.size, phase: manifest.phase },
  deviceId: manifest.deviceId,
  processMemory: values.length ? {
    metric: "SAMPLED_ANDROID_CHROME_MAIN_PROCESS_PSS_KB",
    first: values[0], last: values.at(-1), sampledPeak: Math.max(...values),
    samples: memorySamples,
  } : null,
  missing: ["actual workload/cold-warm proof", "browser frame/input timing",
    "background/cancel/retry/controlled limit", "independent download reopen",
    "human review of device ownership, raw logs and session authenticity"],
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 2;
