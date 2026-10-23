import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { z } from "zod";

/** A simulator receipt is source-bound evidence only; never a physical-device proof. */
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const observed = z.literal("OBSERVED");
const screenshot = z.object({
  file: z.string().regex(/^[a-zA-Z0-9_-]+\.png$/u),
  sha256,
  bytes: z.number().int().min(68),
  capture: z.enum(["ADB_SCREENCAP", "SIMCTL_IO"]),
}).strict();
const outputProof = z.object({
  filename: z.string().min(3),
  artifactFile: z.string().regex(/^[a-zA-Z0-9_.-]+$/u),
  sha256,
  bytes: z.number().int().positive(),
  savedOnDevice: observed,
  retrievedFromDevice: observed,
  reopenedWith: z.string().min(3),
  independentlyChecked: observed,
}).strict();
const flow = z.object({
  nativePickerOpened: observed,
  fileSelected: observed,
  operationCompleted: observed,
  output: outputProof,
  downloadRequested: observed,
  screenshot,
}).strict();

export const mobilePickerReceipt336 = z.object({
  schemaVersion: z.literal(1),
  ticket: z.literal("STR-336"),
  evidence: z.literal("SIMULATED"),
  observedAt: z.iso.datetime(),
  device: z.discriminatedUnion("os", [
    z.object({ os: z.literal("iOS"), mode: z.literal("IOS_SIMULATOR"), label: z.string().min(3), identifier: z.string().uuid(), runtimeVersion: z.string().min(3), runtimeBuild: z.string().min(5), physicalHardware: z.literal("NOT_OBSERVED") }).strict(),
    z.object({ os: z.literal("Android"), mode: z.literal("ANDROID_EMULATOR"), label: z.string().min(3), identifier: z.string().regex(/^emulator-\d+$/u), runtimeVersion: z.string().min(3), runtimeBuild: z.string().min(5), physicalHardware: z.literal("NOT_OBSERVED") }).strict(),
  ]),
  browser: z.object({ name: z.enum(["Safari", "Chrome"]), version: z.string().min(2), userAgent: z.string().min(10) }).strict(),
  build: z.object({ revision: z.string().regex(/^[a-f0-9]{40}$/u), indexSha256: sha256, compiled: z.literal(true), origin: z.string().url() }).strict(),
  photos: flow,
  files: flow,
  denial: z.object({ kind: z.literal("SIMULATED_PERMISSION_OR_READ_DENIAL"), previousValidResultRetained: observed, retrySucceeded: observed, screenshot }).strict(),
  appReturn: z.object({ kind: z.literal("SIMULATED_BACKGROUND_AND_RETURN"), previousValidResultRetained: observed, screenshot }).strict(),
  sharing: z.object({ method: z.enum(["NATIVE_SHARE_SHEET", "MANUAL_DOWNLOAD_FALLBACK"]), attempted: observed, outputRetainedAfterCancel: observed, screenshot }).strict(),
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
  for (const [name, proof] of Object.entries({ photos: receipt.photos.screenshot,
    files: receipt.files.screenshot, denial: receipt.denial.screenshot,
    appReturn: receipt.appReturn.screenshot, sharing: receipt.sharing.screenshot })) {
    if ((receipt.device.os === "Android" && proof.capture !== "ADB_SCREENCAP") ||
        (receipt.device.os === "iOS" && proof.capture !== "SIMCTL_IO")) {
      ctx.addIssue({ code: "custom", path: [name, "screenshot", "capture"], message: "Screenshot capture must match the native simulator" });
    }
  }
});

export function validateMobilePickerReceipt336(
  receipt: unknown,
  expected?: { revision?: string; indexSha256?: string },
): string[] {
  const parsed = mobilePickerReceipt336.safeParse(receipt);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `${issue.path.join(".") || "receipt"}: ${issue.message}`);
  }
  // Format validation alone never authenticates a screenshot or downloaded file.
  // The caller compares these to the real checkout and compiled index bytes.
  if (expected?.revision !== undefined && parsed.data.build.revision !== expected.revision) {
    return [`build.revision: receipt ${parsed.data.build.revision} is not the built source ${expected.revision}`];
  }
  if (expected?.indexSha256 !== undefined && parsed.data.build.indexSha256 !== expected.indexSha256) {
    return [`build.indexSha256: receipt does not match the compiled index artifact`];
  }
  return [];
}

/** Verify the actual compiled index, captured PNG screenshots and retrieved outputs. */
export async function verifyMobilePickerArtifacts336(
  receipt: unknown,
  expected: { revision: string; indexFile: string; evidenceDir: string },
): Promise<string[]> {
  const errors: string[] = [];
  let indexSha256: string;
  try {
    indexSha256 = createHash("sha256").update(await readFile(expected.indexFile)).digest("hex");
  } catch {
    return ["build.indexSha256: compiled index file could not be read"];
  }
  errors.push(...validateMobilePickerReceipt336(receipt, {
    revision: expected.revision, indexSha256,
  }));
  if (errors.length) return errors;
  const data = mobilePickerReceipt336.parse(receipt);
  const files = [
    { label: "photos.output", file: data.photos.output.artifactFile,
      sha256: data.photos.output.sha256, bytes: data.photos.output.bytes, png: false },
    { label: "files.output", file: data.files.output.artifactFile,
      sha256: data.files.output.sha256, bytes: data.files.output.bytes, png: false },
    ...(["photos", "files", "denial", "appReturn", "sharing"] as const)
      .map((key) => ({ label: `${key}.screenshot`, file: data[key].screenshot.file,
        sha256: data[key].screenshot.sha256, bytes: data[key].screenshot.bytes, png: true })),
  ];
  const root = resolve(expected.evidenceDir) + sep;
  for (const proof of files) {
    const path = resolve(root, proof.file);
    if (!path.startsWith(root)) {
      errors.push(`${proof.label}: file is outside the evidence directory`);
      continue;
    }
    try {
      const bytes = await readFile(path);
      if (bytes.length !== proof.bytes ||
          createHash("sha256").update(bytes).digest("hex") !== proof.sha256) {
        errors.push(`${proof.label}: actual bytes/hash differ from receipt`);
      }
      if (proof.png && !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        errors.push(`${proof.label}: captured evidence is not PNG`);
      }
    } catch {
      errors.push(`${proof.label}: file cannot be read`);
    }
  }
  return errors;
}
