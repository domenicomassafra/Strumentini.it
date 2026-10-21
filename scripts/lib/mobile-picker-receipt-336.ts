import { z } from "zod";

/** A simulator receipt is source-bound evidence only; never a physical-device proof. */
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const observed = z.literal("OBSERVED");
const outputProof = z.object({
  filename: z.string().min(3),
  sha256,
  bytes: z.number().int().positive(),
  reopenedWith: z.string().min(3),
  independentlyChecked: observed,
}).strict();
const flow = z.object({
  nativePickerOpened: observed,
  fileSelected: observed,
  operationCompleted: observed,
  output: outputProof,
  downloadRequested: observed,
}).strict();

export const mobilePickerReceipt336 = z.object({
  schemaVersion: z.literal(1),
  ticket: z.literal("STR-336"),
  evidence: z.literal("SIMULATED"),
  observedAt: z.iso.datetime(),
  device: z.discriminatedUnion("os", [
    z.object({ os: z.literal("iOS"), mode: z.literal("IOS_SIMULATOR"), label: z.string().min(3), physicalHardware: z.literal("NOT_OBSERVED") }).strict(),
    z.object({ os: z.literal("Android"), mode: z.literal("ANDROID_EMULATOR"), label: z.string().min(3), physicalHardware: z.literal("NOT_OBSERVED") }).strict(),
  ]),
  browser: z.object({ name: z.enum(["Safari", "Chrome"]), version: z.string().min(2), userAgent: z.string().min(10) }).strict(),
  build: z.object({ revision: z.string().regex(/^[a-f0-9]{40}$/u), compiled: z.literal(true), origin: z.string().url() }).strict(),
  photos: flow,
  files: flow,
  denial: z.object({ kind: z.literal("SIMULATED_PERMISSION_OR_READ_DENIAL"), previousValidResultRetained: observed, retrySucceeded: observed }).strict(),
  appReturn: z.object({ kind: z.literal("SIMULATED_BACKGROUND_AND_RETURN"), previousValidResultRetained: observed }).strict(),
  sharing: z.object({ method: z.enum(["NATIVE_SHARE_SHEET", "MANUAL_DOWNLOAD_FALLBACK"]), attempted: observed, outputRetainedAfterCancel: observed }).strict(),
  externalFileUploads: z.literal(0),
  pageErrors: z.array(z.string()).length(0),
}).strict().superRefine((receipt, ctx) => {
  if ((receipt.device.os === "iOS" && receipt.browser.name !== "Safari") ||
      (receipt.device.os === "Android" && receipt.browser.name !== "Chrome")) {
    ctx.addIssue({ code: "custom", path: ["browser", "name"], message: "Browser must match the simulated operating system" });
  }
  if (receipt.photos.output.sha256 === receipt.files.output.sha256 && receipt.photos.output.filename === receipt.files.output.filename) {
    ctx.addIssue({ code: "custom", path: ["files", "output"], message: "Distinct Photos and Files outputs require independent verification" });
  }
});

export function validateMobilePickerReceipt336(
  receipt: unknown,
  expected?: { revision?: string },
): string[] {
  const parsed = mobilePickerReceipt336.safeParse(receipt);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `${issue.path.join(".") || "receipt"}: ${issue.message}`);
  }
  // A receipt only proves the build it names; accept it just against that source.
  if (expected?.revision !== undefined && parsed.data.build.revision !== expected.revision) {
    return [`build.revision: receipt ${parsed.data.build.revision} is not the built source ${expected.revision}`];
  }
  return [];
}
