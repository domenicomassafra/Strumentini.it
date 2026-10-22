#!/usr/bin/env node
// STR-363: raw, sampled emulator/simulator process observations ONLY.
// This does not perform a browser scenario or certify a receipt.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = resolve(root, "quality/receipts/mobile-memory-363/observed/raw");
const routes = { pdf: "/tools/pdf-rotate/", image: "/tools/image-resize/", csv: "/tools/csv-cleaner/" };
const allowed = new Set(["platform", "device", "format", "size", "phase", "samples", "interval-ms", "exclusive-lease-ack"]);
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, "");
  if (!key || !allowed.has(key) || !process.argv[i]?.startsWith("--") || !process.argv[i + 1] || args[key]) {
    throw Error("Invalid arguments. Specify --platform IOS_SIMULATOR|ANDROID_EMULATOR --device ID --format pdf|image|csv --size S|M|L --phase cold|warm --samples N --interval-ms N --exclusive-lease-ack STR-363");
  }
  args[key] = process.argv[i + 1];
}
if (!["IOS_SIMULATOR", "ANDROID_EMULATOR"].includes(args.platform) ||
    !/^[a-zA-Z0-9-]{5,64}$/.test(args.device ?? "") ||
    !Object.hasOwn(routes, args.format ?? "") ||
    !["S", "M", "L"].includes(args.size) ||
    !["cold", "warm"].includes(args.phase) ||
    args["exclusive-lease-ack"] !== "STR-363") {
  throw Error("Invalid case/device or exclusive lease acknowledgement missing; confirm the real lease externally before running");
}
const count = Number(args.samples ?? "10");
const intervalMs = Number(args["interval-ms"] ?? "1000");
if (!Number.isInteger(count) || count < 2 || count > 120 ||
    !Number.isInteger(intervalMs) || intervalMs < 300 || intervalMs > 10000) {
  throw Error("Samples must be 2..120 and interval 300..10000 milliseconds");
}
function command(bin, argv, timeout = 15000) {
  const stdout = execFileSync(bin, argv, { encoding: "utf8", timeout, maxBuffer: 2_000_000 });
  return { bin, argv, stdout };
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const revision = command("git", ["-C", root, "rev-parse", "HEAD"]).stdout.trim();
const trackedChanges = command("git", ["-C", root, "status", "--porcelain", "--untracked-files=no"]).stdout.trim();
if (trackedChanges) throw Error("Tracked checkout differs from HEAD; compile and capture on an isolated clean revision");
const collectorSha256 = hash(await readFile(import.meta.filename));
const route = routes[args.format];
const html = resolve(root, "dist", route.slice(1), "index.html");
const routeSha256 = hash(await readFile(html)); // Fail closed if consumer was not compiled.
let deviceIdentity;
let sampleCommand;
if (args.platform === "ANDROID_EMULATOR") {
  const adb = process.env.ANDROID_HOME
    ? resolve(process.env.ANDROID_HOME, "platform-tools/adb") : "adb";
  const state = command(adb, ["-s", args.device, "get-state"]);
  if (state.stdout.trim() !== "device") throw Error("Android emulator is not online");
  deviceIdentity = {
    state: state.stdout.trim(),
    fingerprint: command(adb, ["-s", args.device, "shell", "getprop", "ro.build.fingerprint"]).stdout.trim(),
    release: command(adb, ["-s", args.device, "shell", "getprop", "ro.build.version.release"]).stdout.trim(),
    chromePackage: command(adb, ["-s", args.device, "shell", "dumpsys", "package", "com.android.chrome"]).stdout
      .match(/\bversionName=([^\s]+)/)?.[1] ?? "UNKNOWN",
  };
  sampleCommand = [adb, ["-s", args.device, "shell", "dumpsys", "meminfo", "com.android.chrome"]];
} else {
  const devices = JSON.parse(command("xcrun", ["simctl", "list", "-j", "devices"]).stdout);
  const matching = Object.values(devices.devices).flat().find((device) => device.udid === args.device);
  if (!matching || matching.state !== "Booted") throw Error("The exact iOS Simulator is not booted");
  deviceIdentity = { state: matching.state, name: matching.name, udid: matching.udid };
  // simctl/ps RSS is a host-side process sample, not Safari's total memory.
  sampleCommand = ["xcrun", ["simctl", "spawn", args.device, "ps", "-A", "-o", "pid=,rss=,comm="]];
}
const slug = [args.platform.toLowerCase(), args.format, args.size.toLowerCase(), args.phase].join("-");
const session = new Date().toISOString().replace(/[:.]/g, "-");
const directory = resolve(evidenceRoot, slug + "-" + session);
if (!directory.startsWith(evidenceRoot + sep)) throw Error("Unsafe evidence directory");
await mkdir(directory, { recursive: true });
const samples = [];
for (let index = 0; index < count; index++) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const result = command(...sampleCommand);
  const samplerElapsedMs = Number((performance.now() - start).toFixed(3));
  const rawFile = "sample-" + String(index).padStart(3, "0") + ".txt";
  await writeFile(resolve(directory, rawFile), result.stdout, { flag: "wx" });
  samples.push({
    rawFile, sha256: hash(result.stdout), bytes: Buffer.byteLength(result.stdout),
    startedAt, samplerElapsedMs, command: [result.bin, ...result.argv],
  });
  if (index + 1 < count) await delay(intervalMs);
}
const manifest = {
  schemaVersion: 1, ticket: "STR-363", status: "RAW_ONLY_INCOMPLETE",
  evidenceKind: "SIMULATED_DEVICE_ONLY", physicalDeviceObserved: false,
  capture: { declaration: "exclusive lease confirmed externally, not attested by this script",
    method: args.platform === "ANDROID_EMULATOR" ? "ADB_DUMPSYS_MEMINFO" : "SIMCTL_PS",
    limitations: "Samples alone do not prove S/M/L workloads, input latency, frame pacing, cancel, background, retry, OOM or independent output reopen" },
  sourceRevision: revision, collectorSha256, compiledConsumer: true, route, routeSha256,
  platform: args.platform, format: args.format, size: args.size, phase: args.phase,
  deviceId: args.device, deviceIdentity, samples,
};
await writeFile(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: manifest.status, directory, samples: samples.length,
  routeSha256, sourceRevision: revision, physicalDeviceObserved: false }));
