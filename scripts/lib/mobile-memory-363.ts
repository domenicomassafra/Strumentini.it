/** STR-363: simulated device measurements never certify physical mobile hardware. */
export const MOBILE_363_PLATFORMS = ["IOS_SIMULATOR", "ANDROID_EMULATOR"] as const;
export const MOBILE_363_FORMATS = ["pdf", "image", "csv"] as const;
export const MOBILE_363_SIZES = ["S", "M", "L"] as const;
export const MOBILE_363_PHASES = ["cold", "warm"] as const;
export const MOBILE_363_ROUTES = {
  pdf: "/tools/pdf-rotate/",
  image: "/tools/image-resize/",
  csv: "/tools/csv-cleaner/",
} as const;

type Dict = Record<string, unknown>;
const obj = (value: unknown): Dict => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as Dict : {};
const nonnegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const positive = (value: unknown) => nonnegative(value) && Number(value) > 0;
const sha = (value: unknown) => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const identity = (value: unknown) => typeof value === "string" && value.trim().length >= 2;
const fabricated = (value: unknown) => /(?:^|[^a-z])(?:unit|test|fixture|synthetic|mock|fake|dummy|placeholder|example)(?:[^a-z]|$)/iu
  .test(String(value ?? ""));
const caseSlug = (row: Dict) => `${String(row.platform).toLowerCase()}-${row.format}-${String(row.size).toLowerCase()}-${row.phase}`;
export const MOBILE_363_EVIDENCE_DIR = "quality/receipts/mobile-memory-363/observed" as const;

/** Claims for a simulated *device* must have plausible, coherent identities.
 * This is an anti-misclassification guard, never an authenticity guarantee.
 */
export function validateMobile363PromotionIdentity(value: unknown): string[] {
  const errors: string[] = [];
  const root = obj(value);
  if (!Array.isArray(root.cases)) return ["promotion cases missing"];
  if (fabricated(root.sourceRevision) || !/^[a-f\d]{40}$/u.test(String(root.sourceRevision ?? "")))
    errors.push("promotion source revision is not a SHA");
  for (const [index, candidate] of root.cases.entries()) {
    const row = obj(candidate);
    if (row.status !== "PASS") continue;
    const prefix = `cases[${index}]`;
    const device = obj(row.device);
    const input = obj(row.input);
    const output = obj(row.output);
    const claimedNames = [device.model, device.osVersion, device.browser, device.browserVersion,
      row.evidenceSource, output.reopenedWith, output.verifiedContent];
    if (claimedNames.some(fabricated)) errors.push(prefix + " synthetic/unit/test marker cannot be device proof");
    if (row.platform === "IOS_SIMULATOR") {
      if (!/^(?:iPhone|iPad)\s+[\w .-]+$/u.test(String(device.model ?? "")) ||
          !/^(?:iOS|iPadOS)\s+\d+(?:\.\d+){0,2}$/u.test(String(device.osVersion ?? "")) ||
          !/^Safari$/u.test(String(device.browser ?? "")) ||
          !/^\d+(?:\.\d+){1,3}$/u.test(String(device.browserVersion ?? ""))) {
        errors.push(prefix + " iOS simulator/browser identity inconsistent");
      }
    } else if (row.platform === "ANDROID_EMULATOR") {
      if (!/(?:Pixel|sdk_gphone|Android Emulator)/iu.test(String(device.model ?? "")) ||
          !/^Android\s+\d+(?:\.\d+){0,2}$/u.test(String(device.osVersion ?? "")) ||
          !/^Chrome$/u.test(String(device.browser ?? "")) ||
          !/^\d+(?:\.\d+){1,3}$/u.test(String(device.browserVersion ?? ""))) {
        errors.push(prefix + " Android emulator/browser identity inconsistent");
      }
    }
    if (row.route !== MOBILE_363_ROUTES[row.format as keyof typeof MOBILE_363_ROUTES] ||
        !sha(row.routeSha256)) errors.push(prefix + " representative compiled route mismatch");
    if (!positive(input.bytes) || !sha(input.sha256) || !positive(output.bytes) || !sha(output.sha256))
      errors.push(prefix + " input/output fingerprint missing");
    const requiredEvidencePath = `${MOBILE_363_EVIDENCE_DIR}/${caseSlug(row)}.json`;
    if (row.evidenceSource !== requiredEvidencePath || !sha(row.evidenceSha256))
      errors.push(prefix + " independently hashed local device trace missing");
  }
  return errors;
}

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

export function assessMobileMemory363(value: unknown): { status: "BLOCKED"; reasons: string[] } {
  const reasons = [...validateMobileMemory363(value), ...validateMobile363PromotionIdentity(value)];
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
  // A self-declared JSON object cannot attest a running simulator, actual
  // memory metrics, or the bytes of the compiled route. Even 36 syntactically
  // complete rows are only candidate evidence.
  reasons.push("schema-only receipt has no verified compiled build or device logs");
  return { status: "BLOCKED", reasons };
}
