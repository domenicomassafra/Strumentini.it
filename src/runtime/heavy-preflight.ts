export const HEAVY_JOB_CAPABILITIES = ["worker", "wasm", "image-decode"] as const;

export type HeavyJobCapability = (typeof HEAVY_JOB_CAPABILITIES)[number];
export type HeavyJobCapabilityNeed = "required" | "preferred" | "unused";
export type HeavyJobSupportState = "supported" | "degraded" | "unsupported";
export type HeavyJobResourceState = "within-limits" | "warning" | "blocked";

export interface HeavyJobCapabilityPolicy {
  readonly worker?: HeavyJobCapabilityNeed;
  readonly wasm?: HeavyJobCapabilityNeed;
  readonly "image-decode"?: HeavyJobCapabilityNeed;
}

export interface HeavyJobResourceLimits {
  readonly softInputBytes?: number;
  readonly hardInputBytes?: number;
  readonly softWorkingSetBytes?: number;
  readonly hardWorkingSetBytes?: number;
}

export interface HeavyJobPreflightPolicy {
  readonly capabilities?: HeavyJobCapabilityPolicy;
  readonly limits?: HeavyJobResourceLimits;
}

export interface HeavyJobInputMetadata {
  readonly inputBytes?: number;
  readonly estimatedWorkingSetBytes?: number;
}

export type HeavyJobCapabilitySnapshot = Readonly<Record<HeavyJobCapability, boolean>>;

export interface HeavyJobPreflightResult {
  readonly state: HeavyJobSupportState;
  readonly resourceState: HeavyJobResourceState;
  readonly capabilities: HeavyJobCapabilitySnapshot;
  readonly requiredCapabilities: readonly HeavyJobCapability[];
  readonly preferredCapabilities: readonly HeavyJobCapability[];
  readonly missingRequired: readonly HeavyJobCapability[];
  readonly missingPreferred: readonly HeavyJobCapability[];
  readonly limits: HeavyJobResourceLimits;
  readonly input: HeavyJobInputMetadata;
  readonly reasons: readonly string[];
}

function finiteNonNegative(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a finite non-negative number`);
  return value;
}

function normalizedLimits(limits: HeavyJobResourceLimits = {}): HeavyJobResourceLimits {
  const softInputBytes = finiteNonNegative(limits.softInputBytes, "softInputBytes");
  const hardInputBytes = finiteNonNegative(limits.hardInputBytes, "hardInputBytes");
  const softWorkingSetBytes = finiteNonNegative(limits.softWorkingSetBytes, "softWorkingSetBytes");
  const hardWorkingSetBytes = finiteNonNegative(limits.hardWorkingSetBytes, "hardWorkingSetBytes");

  if (softInputBytes !== undefined && hardInputBytes !== undefined && softInputBytes > hardInputBytes) {
    throw new RangeError("softInputBytes cannot exceed hardInputBytes");
  }
  if (softWorkingSetBytes !== undefined && hardWorkingSetBytes !== undefined && softWorkingSetBytes > hardWorkingSetBytes) {
    throw new RangeError("softWorkingSetBytes cannot exceed hardWorkingSetBytes");
  }

  return {
    ...(softInputBytes === undefined ? {} : { softInputBytes }),
    ...(hardInputBytes === undefined ? {} : { hardInputBytes }),
    ...(softWorkingSetBytes === undefined ? {} : { softWorkingSetBytes }),
    ...(hardWorkingSetBytes === undefined ? {} : { hardWorkingSetBytes }),
  };
}

export function detectHeavyJobCapabilities(scope: typeof globalThis = globalThis): HeavyJobCapabilitySnapshot {
  const candidate = scope as typeof globalThis & {
    Worker?: unknown;
    WebAssembly?: unknown;
    createImageBitmap?: unknown;
    ImageDecoder?: unknown;
  };
  return {
    worker: typeof candidate.Worker === "function",
    wasm: typeof candidate.WebAssembly === "object" && candidate.WebAssembly !== null,
    "image-decode": typeof candidate.createImageBitmap === "function" || typeof candidate.ImageDecoder === "function",
  };
}

function capabilityLists(policy: HeavyJobCapabilityPolicy = {}): {
  readonly required: HeavyJobCapability[];
  readonly preferred: HeavyJobCapability[];
} {
  const required: HeavyJobCapability[] = [];
  const preferred: HeavyJobCapability[] = [];
  for (const capability of HEAVY_JOB_CAPABILITIES) {
    const need = policy[capability] ?? "unused";
    if (need === "required") required.push(capability);
    if (need === "preferred") preferred.push(capability);
  }
  return { required, preferred };
}

function resourceAssessment(
  input: HeavyJobInputMetadata,
  limits: HeavyJobResourceLimits,
): { readonly state: HeavyJobResourceState; readonly reasons: string[] } {
  const inputBytes = finiteNonNegative(input.inputBytes, "inputBytes");
  const estimatedWorkingSetBytes = finiteNonNegative(input.estimatedWorkingSetBytes, "estimatedWorkingSetBytes");
  const blocked: string[] = [];
  const warnings: string[] = [];

  if (inputBytes !== undefined && limits.hardInputBytes !== undefined && inputBytes > limits.hardInputBytes) {
    blocked.push(`Input is ${inputBytes} bytes, above the hard limit of ${limits.hardInputBytes} bytes.`);
  } else if (inputBytes !== undefined && limits.softInputBytes !== undefined && inputBytes > limits.softInputBytes) {
    warnings.push(`Input is ${inputBytes} bytes, above the soft limit of ${limits.softInputBytes} bytes.`);
  }

  if (
    estimatedWorkingSetBytes !== undefined &&
    limits.hardWorkingSetBytes !== undefined &&
    estimatedWorkingSetBytes > limits.hardWorkingSetBytes
  ) {
    blocked.push(
      `Estimated working set is ${estimatedWorkingSetBytes} bytes, above the hard limit of ${limits.hardWorkingSetBytes} bytes.`,
    );
  } else if (
    estimatedWorkingSetBytes !== undefined &&
    limits.softWorkingSetBytes !== undefined &&
    estimatedWorkingSetBytes > limits.softWorkingSetBytes
  ) {
    warnings.push(
      `Estimated working set is ${estimatedWorkingSetBytes} bytes, above the soft limit of ${limits.softWorkingSetBytes} bytes.`,
    );
  }

  if (blocked.length > 0) return { state: "blocked", reasons: blocked };
  if (warnings.length > 0) return { state: "warning", reasons: warnings };
  return { state: "within-limits", reasons: [] };
}

export function preflightHeavyLocalJob(
  policy: HeavyJobPreflightPolicy,
  input: HeavyJobInputMetadata = {},
  capabilities: HeavyJobCapabilitySnapshot = detectHeavyJobCapabilities(),
): HeavyJobPreflightResult {
  const limits = normalizedLimits(policy.limits);
  const needs = capabilityLists(policy.capabilities);
  const missingRequired = needs.required.filter((capability) => !capabilities[capability]);
  const missingPreferred = needs.preferred.filter((capability) => !capabilities[capability]);
  const resource = resourceAssessment(input, limits);
  const reasons = [...resource.reasons];

  for (const capability of missingRequired) reasons.push(`Required browser capability is unavailable: ${capability}.`);
  for (const capability of missingPreferred) reasons.push(`Preferred browser capability is unavailable: ${capability}.`);

  const state: HeavyJobSupportState = missingRequired.length > 0 || resource.state === "blocked"
    ? "unsupported"
    : missingPreferred.length > 0 || resource.state === "warning"
      ? "degraded"
      : "supported";

  return {
    state,
    resourceState: resource.state,
    capabilities,
    requiredCapabilities: needs.required,
    preferredCapabilities: needs.preferred,
    missingRequired,
    missingPreferred,
    limits,
    input,
    reasons,
  };
}
