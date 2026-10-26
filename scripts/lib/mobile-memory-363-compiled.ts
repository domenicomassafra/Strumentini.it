import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  MOBILE_363_EVIDENCE_DIR,
  MOBILE_363_ROUTES,
  assessMobileMemory363,
} from "./mobile-memory-363";

type Dict = Record<string, unknown>;
const obj = (value: unknown): Dict => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as Dict : {};
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Independent provenance check against this checkout and its compiled routes.
 * It can only mark a record READY FOR INDEPENDENT DEVICE-TRACE REVIEW. A saved JSON
 * trace, even when hashed, cannot authenticate real simulator observations.
 */
export async function assessMobileMemory363Compiled(
  receipt: unknown,
  checkoutRoot: string,
): Promise<{ status: "PROVENANCE_CHECKED_REVIEW_REQUIRED" | "BLOCKED"; reasons: string[] }> {
  const base = assessMobileMemory363(receipt);
  const reasons = base.reasons.filter((reason) =>
    reason !== "schema-only receipt has no verified compiled build or device logs");
  const root = obj(receipt);
  const checkout = resolve(checkoutRoot);
  let actualRevision = "";
  try {
    actualRevision = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (root.sourceRevision !== actualRevision) reasons.push("source revision does not match checked-out git HEAD");
  } catch {
    reasons.push("checked-out git HEAD unavailable");
  }
  const cases = Array.isArray(root.cases) ? root.cases : [];
  const trustedEvidenceRoot = resolve(checkout, MOBILE_363_EVIDENCE_DIR);
  const routeDigests = new Map<string, string>();
  for (const route of Object.values(MOBILE_363_ROUTES)) {
    const html = resolve(checkout, "dist", route.slice(1), "index.html");
    try {
      const bytes = await readFile(html);
      routeDigests.set(route, digest(bytes));
    } catch {
      reasons.push("compiled consumer route is unavailable: " + route);
    }
  }
  for (const [index, item] of cases.entries()) {
    const row = obj(item);
    if (row.status !== "PASS") continue;
    const prefix = `cases[${index}]`;
    const expectedRouteHash = routeDigests.get(String(row.route));
    if (expectedRouteHash === undefined || row.routeSha256 !== expectedRouteHash) {
      reasons.push(prefix + " route SHA differs from compiled consumer");
    }
    const proposed = resolve(checkout, String(row.evidenceSource ?? ""));
    if (!(proposed.startsWith(trustedEvidenceRoot + sep))) {
      reasons.push(prefix + " device trace outside restricted receipt folder");
      continue;
    }
    try {
      const canonical = await realpath(proposed);
      if (!canonical.startsWith((await realpath(trustedEvidenceRoot)) + sep))
        throw new Error("device trace resolves outside restricted folder");
      const info = await stat(canonical);
      if (!info.isFile() || info.size < 2 || info.size > 20_000) throw new Error("device trace size/type is invalid");
      const bytes = await readFile(canonical);
      if (row.evidenceSha256 !== digest(bytes)) throw new Error("device trace SHA mismatch");
      const trace = obj(JSON.parse(bytes.toString("utf8")));
      const observation = obj(trace.observation);
      const capture = obj(trace.capture);
      for (const field of ["platform", "format", "size", "phase", "route", "routeSha256",
        "device", "input", "memory", "frame", "inputLatencyMs", "operationElapsedMs", "recovery", "output"]) {
        if (JSON.stringify(observation[field]) !== JSON.stringify(row[field])) {
          throw new Error("device trace and submitted receipt diverge at " + field);
        }
      }
      if (trace.sourceRevision !== actualRevision ||
          capture.method !== (row.platform === "IOS_SIMULATOR" ? "SIMCTL_DEVICE_TRACE" : "ADB_DEVICE_TRACE") ||
          typeof capture.command !== "string" ||
          !(row.platform === "IOS_SIMULATOR"
            ? capture.command.startsWith("xcrun simctl ")
            : capture.command.startsWith("adb -s emulator-"))) {
        throw new Error("trace capture metadata is incomplete");
      }
    } catch (error) {
      reasons.push(prefix + " independent device trace unavailable/invalid: " +
        (error instanceof Error ? error.message : "read error"));
    }
  }
  return {
    status: reasons.length === 0 ? "PROVENANCE_CHECKED_REVIEW_REQUIRED" : "BLOCKED",
    reasons: reasons.length === 0
      ? ["Compiled SHA and local trace hash match; independent agent device-capture review remains mandatory"]
      : reasons,
  };
}
