import { IMAGE_LIMITS, estimateDecodedBytes } from "../../src/engines/image/policy";

export type PhysicalImageTarget = "ios-safari" | "android-chrome";

export interface PhysicalImageReceiptInput {
  target: PhysicalImageTarget;
  device: string;
  browser: string;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  checks: {
    filesOrPhotosPicker: "PASS";
    resizeCompleted: "PASS";
    verifiedDownloadOpened: "PASS";
    noCrashOrReload: "PASS";
    mobileLayoutUsable: "PASS";
    boundaryPolicyCase: "PASS";
  };
  observedAt?: string;
  notes?: string;
}

export interface PhysicalImageReceipt {
  schemaVersion: 1;
  status: "PASS";
  target: PhysicalImageTarget;
  device: string;
  browser: string;
  observedAt: string;
  route: "/tools/image-resize/";
  source: { width: number; height: number; pixels: number };
  output: { width: number; height: number; pixels: number };
  maxSourcePixelsTested: number;
  maxEstimatedDecodedBytesTested: number;
  thresholdCoverage: {
    sourcePixelLimitFraction: number;
    decodedWorkingSetLimitFraction: number;
  };
  checks: PhysicalImageReceiptInput["checks"];
  policyLimits: typeof IMAGE_LIMITS;
  notes?: string;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function cleanLabel(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 2) throw new Error(`${label} is required`);
  return normalized;
}

function assertTargetBrowser(target: PhysicalImageTarget, browser: string) {
  if (target === "ios-safari" && !/safari/iu.test(browser)) {
    throw new Error("iOS physical receipt browser must identify Safari");
  }
  if (target === "android-chrome" && !/chrome/iu.test(browser)) {
    throw new Error("Android physical receipt browser must identify Chrome");
  }
}

export function buildPhysicalImageReceipt(input: PhysicalImageReceiptInput): PhysicalImageReceipt {
  const device = cleanLabel(input.device, "device");
  const browser = cleanLabel(input.browser, "browser");
  assertTargetBrowser(input.target, browser);
  const sourceWidth = positiveInteger(input.sourceWidth, "source width");
  const sourceHeight = positiveInteger(input.sourceHeight, "source height");
  const outputWidth = positiveInteger(input.outputWidth, "output width");
  const outputHeight = positiveInteger(input.outputHeight, "output height");
  if (sourceWidth > IMAGE_LIMITS.maxDimension || sourceHeight > IMAGE_LIMITS.maxDimension) {
    throw new Error(`source dimensions exceed current ${IMAGE_LIMITS.maxDimension}px per-side policy`);
  }
  if (outputWidth > IMAGE_LIMITS.maxDimension || outputHeight > IMAGE_LIMITS.maxDimension) {
    throw new Error(`output dimensions exceed current ${IMAGE_LIMITS.maxDimension}px per-side policy`);
  }
  const sourcePixels = sourceWidth * sourceHeight;
  const outputPixels = outputWidth * outputHeight;
  if (sourcePixels > IMAGE_LIMITS.maxSourcePixels) throw new Error("source pixels exceed current policy");
  if (outputPixels > IMAGE_LIMITS.maxOutputPixels) throw new Error("output pixels exceed current policy");
  const estimatedDecodedBytes = estimateDecodedBytes(sourcePixels, outputPixels);
  if (estimatedDecodedBytes > IMAGE_LIMITS.maxEstimatedDecodedBytes) {
    throw new Error("source/output pair exceeds current decoded-working-set policy");
  }
  if (Object.values(input.checks).some((value) => value !== "PASS")) {
    throw new Error("every physical acceptance check must be an explicit PASS");
  }
  const sourceCoverage = sourcePixels / IMAGE_LIMITS.maxSourcePixels;
  const memoryCoverage = estimatedDecodedBytes / IMAGE_LIMITS.maxEstimatedDecodedBytes;
  if (sourceCoverage < 0.95) {
    throw new Error(`physical threshold case covers only ${(sourceCoverage * 100).toFixed(1)}% of the current source-pixel limit; at least 95% is required`);
  }
  if (memoryCoverage < 0.85) {
    throw new Error(`physical threshold case covers only ${(memoryCoverage * 100).toFixed(1)}% of the current decoded-working-set limit; at least 85% is required`);
  }
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("observedAt must be an ISO-compatible timestamp");
  const notes = input.notes?.trim();
  return {
    schemaVersion: 1,
    status: "PASS",
    target: input.target,
    device,
    browser,
    observedAt: new Date(observedAt).toISOString(),
    route: "/tools/image-resize/",
    source: { width: sourceWidth, height: sourceHeight, pixels: sourcePixels },
    output: { width: outputWidth, height: outputHeight, pixels: outputPixels },
    maxSourcePixelsTested: sourcePixels,
    maxEstimatedDecodedBytesTested: estimatedDecodedBytes,
    thresholdCoverage: {
      sourcePixelLimitFraction: sourceCoverage,
      decodedWorkingSetLimitFraction: memoryCoverage,
    },
    checks: input.checks,
    policyLimits: IMAGE_LIMITS,
    ...(notes === undefined || notes === "" ? {} : { notes }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validatePhysicalImageReceipt(value: unknown, target: PhysicalImageTarget): string[] {
  if (!isRecord(value)) return ["receipt must be an object"];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (value.status !== "PASS") issues.push("status must be PASS");
  if (value.target !== target) issues.push(`target must be ${target}`);
  if (typeof value.device !== "string" || value.device.trim().length < 2) issues.push("device is required");
  if (typeof value.browser !== "string" || value.browser.trim().length < 2) issues.push("browser is required");
  if (typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt))) issues.push("observedAt is invalid");
  if (value.route !== "/tools/image-resize/") issues.push("route must be /tools/image-resize/");
  if (!isRecord(value.source) || !isRecord(value.output)) issues.push("source/output measurements are required");
  if (!isRecord(value.checks)) issues.push("physical checks are required");
  if (!isRecord(value.policyLimits) || JSON.stringify(value.policyLimits) !== JSON.stringify(IMAGE_LIMITS)) {
    issues.push("receipt policyLimits do not match the current image policy");
  }

  if (issues.length === 0) {
    try {
      const source = value.source as Record<string, unknown>;
      const output = value.output as Record<string, unknown>;
      const checks = value.checks as Record<string, unknown>;
      const rebuilt = buildPhysicalImageReceipt({
        target,
        device: value.device as string,
        browser: value.browser as string,
        sourceWidth: source.width as number,
        sourceHeight: source.height as number,
        outputWidth: output.width as number,
        outputHeight: output.height as number,
        checks: {
          filesOrPhotosPicker: checks.filesOrPhotosPicker as "PASS",
          resizeCompleted: checks.resizeCompleted as "PASS",
          verifiedDownloadOpened: checks.verifiedDownloadOpened as "PASS",
          noCrashOrReload: checks.noCrashOrReload as "PASS",
          mobileLayoutUsable: checks.mobileLayoutUsable as "PASS",
          boundaryPolicyCase: checks.boundaryPolicyCase as "PASS",
        },
        observedAt: value.observedAt as string,
      });
      if (value.maxSourcePixelsTested !== rebuilt.maxSourcePixelsTested) issues.push("maxSourcePixelsTested does not match source dimensions");
      if (value.maxEstimatedDecodedBytesTested !== rebuilt.maxEstimatedDecodedBytesTested) issues.push("maxEstimatedDecodedBytesTested does not match current policy estimate");
      if (source.pixels !== rebuilt.source.pixels || output.pixels !== rebuilt.output.pixels) issues.push("source/output pixel counts are inconsistent");
      if (!isRecord(value.thresholdCoverage) ||
          value.thresholdCoverage.sourcePixelLimitFraction !== rebuilt.thresholdCoverage.sourcePixelLimitFraction ||
          value.thresholdCoverage.decodedWorkingSetLimitFraction !== rebuilt.thresholdCoverage.decodedWorkingSetLimitFraction) {
        issues.push("thresholdCoverage does not match current policy");
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "receipt measurements are invalid");
    }
  }
  return issues;
}
