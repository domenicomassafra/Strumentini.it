/** STR-363: simulated device measurements never certify physical mobile hardware. */
export const MOBILE_363_PLATFORMS = ["IOS_SIMULATOR", "ANDROID_EMULATOR"] as const;
export const MOBILE_363_FORMATS = ["pdf", "image", "csv"] as const;
export const MOBILE_363_SIZES = ["S", "M", "L"] as const;
export const MOBILE_363_PHASES = ["cold", "warm"] as const;

type Dict = Record<string, unknown>;
const obj = (value: unknown): Dict => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as Dict : {};
const nonnegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const positive = (value: unknown) => nonnegative(value) && Number(value) > 0;
const sha = (value: unknown) => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const identity = (value: unknown) => typeof value === "string" && value.trim().length >= 2;

export function validateMobileMemory363(value: unknown): string[] {
  const root = obj(value);
  const errors: string[] = [];
  if (root.schemaVersion !== 1 || root.ticket !== "STR-363") errors.push("schema/ticket mismatch");
  if (root.evidenceKind !== "SIMULATED_DEVICE_ONLY" || root.physicalDeviceObserved !== false)
    errors.push("physical device evidence must never be claimed by this receipt");
  if (!/^[a-f\d]{40}$/u.test(String(root.sourceRevision ?? ""))) errors.push("source revision missing");
  if (typeof root.observedAt !== "string" || !Number.isFinite(Date.parse(root.observedAt))) errors.push("observation time missing");
  if (!Array.isArray(root.cases)) return [...errors, "cases missing"];
  const seen = new Set<string>();
  for (const [index, candidate] of root.cases.entries()) {
    const row = obj(candidate);
    const prefix = `cases[${index}]`;
    const key = [row.platform, row.format, row.size, row.phase].join("/");
    if (!MOBILE_363_PLATFORMS.includes(row.platform as typeof MOBILE_363_PLATFORMS[number]) ||
        !MOBILE_363_FORMATS.includes(row.format as typeof MOBILE_363_FORMATS[number]) ||
        !MOBILE_363_SIZES.includes(row.size as typeof MOBILE_363_SIZES[number]) ||
        !MOBILE_363_PHASES.includes(row.phase as typeof MOBILE_363_PHASES[number])) {
      errors.push(prefix + " invalid matrix identity"); continue;
    }
    if (seen.has(key)) errors.push(prefix + " duplicate matrix identity");
    seen.add(key);
    if (row.status === "NOT_RUN") {
      if (!identity(row.limitation) || String(row.limitation).length < 20) errors.push(prefix + " NOT_RUN needs concrete limitation");
      continue;
    }
    if (row.status !== "PASS") { errors.push(prefix + " unsupported status"); continue; }
    const device = obj(row.device);
    if (![device.model, device.osVersion, device.browser, device.browserVersion].every(identity))
      errors.push(prefix + " simulator/browser identity missing");
    if (row.compiledConsumer !== true || !sha(row.routeSha256) || !String(row.route).startsWith("/tools/"))
      errors.push(prefix + " compiled route fingerprint missing");
    const input = obj(row.input);
    if (!positive(input.bytes) || !sha(input.sha256)) errors.push(prefix + " input fixture fingerprint missing");
    const memory = obj(row.memory);
    // Process RSS/PSS and JS heap cannot be compared as if they measured the same allocator.
    if (!["PROCESS_PSS_KB", "PROCESS_RSS_KB", "JS_HEAP_BYTES"].includes(String(memory.metric)) ||
        ![memory.before, memory.after, memory.peak].every(nonnegative) ||
        Number(memory.peak) < Math.max(Number(memory.before), Number(memory.after)))
      errors.push(prefix + " observed memory measurement missing or inconsistent");
    const frame = obj(row.frame);
    if (!positive(frame.samples) || !nonnegative(frame.maxIntervalMs) || !nonnegative(row.inputLatencyMs) ||
        !positive(row.operationElapsedMs)) errors.push(prefix + " frame/input timing missing");
    const recovery = obj(row.recovery);
    if (recovery.cancel !== "PASS" || recovery.background !== "PASS" ||
        recovery.retry !== "PASS" || recovery.reopen !== "PASS" ||
        recovery.oom !== "PREFLIGHT_RECOVERED" || recovery.actualOomObserved !== false)
      errors.push(prefix + " cancel/background/retry/reopen/controlled limit incomplete");
    const output = obj(row.output);
    if (!positive(output.bytes) || !sha(output.sha256) || !identity(output.reopenedWith) ||
        output.reopenedIndependently !== true || !identity(output.verifiedContent))
      errors.push(prefix + " independently reopened output missing");
    if (!identity(row.evidenceSource)) errors.push(prefix + " measurement provenance missing");
  }
  return errors;
}

export function assessMobileMemory363(value: unknown): { status: "SIMULATED_PASS" | "BLOCKED"; reasons: string[] } {
  const reasons = validateMobileMemory363(value);
  const cases = Array.isArray(obj(value).cases) ? obj(value).cases as unknown[] : [];
  for (const platform of MOBILE_363_PLATFORMS) {
    for (const format of MOBILE_363_FORMATS) {
      for (const size of MOBILE_363_SIZES) {
        for (const phase of MOBILE_363_PHASES) {
          const match = cases.find((candidate) => {
            const row = obj(candidate);
            return row.platform === platform && row.format === format && row.size === size && row.phase === phase;
          });
          if (obj(match).status !== "PASS") reasons.push(`${platform}/${format}/${size}/${phase} not measured on compiled consumer`);
        }
      }
    }
  }
  return { status: reasons.length === 0 ? "SIMULATED_PASS" : "BLOCKED", reasons };
}
