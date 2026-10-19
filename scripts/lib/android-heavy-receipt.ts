import { z } from "zod";

/** STR-280: a simulated Android browser run must never satisfy a physical Gold gate. */
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const routeClass = z.enum(["image", "pdf", "office", "ocr", "media"]);
const observed = z.enum(["OBSERVED", "NOT_OBSERVED"]);

export const androidHeavyRouteReceipt = z.object({
  schemaVersion: z.literal(1),
  ticket: z.literal("STR-280"),
  status: z.enum(["SIMULATED_PASS", "LIMIT"]),
  observedAt: z.iso.datetime(),
  device: z.object({
    label: z.string().min(2),
    os: z.literal("Android"),
    mode: z.literal("PLAYWRIGHT_BROWSER_EMULATION"),
    physicalHardware: z.literal("NOT_OBSERVED"),
  }).strict(),
  browser: z.object({ engine: z.literal("chromium"), version: z.string().min(2), userAgent: z.string().regex(/Android.*Chrome/iu) }).strict(),
  build: z.object({ revision: z.string().regex(/^[a-f0-9]{40}$/u), compiled: z.literal(true) }).strict(),
  route: z.string().regex(/^\/(?:tools\/[a-z0-9-]+|documenti-markdown)\/$/u),
  input: z.object({ class: routeClass, filename: z.string().min(2), mime: z.string().min(3), bytes: z.number().int().positive(), sha256: sha }).strict(),
  memory: z.object({
    scope: z.literal("CHROMIUM_JS_HEAP_ONLY"),
    usedBeforeBytes: z.number().finite().nonnegative(),
    usedAfterBytes: z.number().finite().nonnegative(),
    jobElapsedMs: z.number().finite().nonnegative(),
    actualOomObserved: z.literal(false),
    nativeWasmGpuPeakObserved: z.literal(false),
  }).strict(),
  checks: z.object({ fileSelected: observed, progress: observed, cancelRecoverable: observed, retrySucceeded: observed, downloadTriggered: observed, independentlyReopened: observed }).strict(),
  output: z.object({ filename: z.string().min(3), bytes: z.number().int().positive(), sha256: sha, reopenedWith: z.string().min(3), verifiedContent: z.string().min(3) }).strict().nullable(),
  limits: z.array(z.object({ kind: z.enum(["OOM", "UNSUPPORTED", "CANCELLED", "OUTPUT_UNAVAILABLE"]), source: z.enum(["BROWSER", "CONTROLLED_PREFLIGHT"]), recoverable: z.boolean(), detail: z.string().min(3) }).strict()),
  externalRequests: z.number().int().nonnegative(),
  pageErrors: z.array(z.string()),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.externalRequests !== 0 || value.pageErrors.length !== 0) fail("browser task must remain local and error-free");
  if (value.checks.fileSelected !== "OBSERVED") fail("real file selection must be observed");
  if (value.status === "SIMULATED_PASS") {
    if (value.output === null) fail("passing route requires independently reopened output");
    if (value.checks.downloadTriggered !== "OBSERVED" || value.checks.independentlyReopened !== "OBSERVED") fail("download and independent reopen required");
    if (value.limits.some((limit) => !limit.recoverable)) fail("unrecovered limit cannot pass");
  } else if (value.limits.length === 0) fail("LIMIT requires a specific observed or unmeasured boundary");
  if (value.output === null && (value.checks.downloadTriggered === "OBSERVED" || value.checks.independentlyReopened === "OBSERVED")) fail("output evidence missing");
});

export type AndroidHeavyRouteReceipt = z.infer<typeof androidHeavyRouteReceipt>;

export function validateAndroidHeavyRouteReceipt(value: unknown): string[] {
  const result = androidHeavyRouteReceipt.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".") || "receipt"}: ${issue.message}`);
}

/** The historical STR-206 physical promotion gate cannot mistake browser emulation for hardware. */
export function androidHeavyPromotionDecision(value: unknown): {
  simulatedAcceptance: "PASS" | "NO_GO";
  physicalPromotion: "NO_GO";
  reasons: string[];
} {
  const reasons = validateAndroidHeavyRouteReceipt(value);
  const receipt = reasons.length === 0 ? (value as AndroidHeavyRouteReceipt) : null;
  if (receipt?.status !== "SIMULATED_PASS") reasons.push("compiled route output not independently accepted");
  return {
    simulatedAcceptance: reasons.length === 0 ? "PASS" : "NO_GO",
    physicalPromotion: "NO_GO",
    reasons: [...reasons, "STR-206 physical gate: no Android hardware measurement/receipt"],
  };
}
