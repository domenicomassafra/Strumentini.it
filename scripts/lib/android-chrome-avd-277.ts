/** Evidence contract for STR-277. An AVD receipt never asserts physical hardware. */
export interface AndroidChromeAvd277Receipt {
  schemaVersion: 1;
  ticket: "STR-277";
  evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED";
  physicalDeviceObserved: false;
  observedAt: string;
  emulator: { serial: string; avd: string; api: number; fingerprint: string };
  browser: { package: "com.android.chrome"; version: string; userAgent: string };
  build: { revision: string; compiled: true; route: "/tools/image-resize/"; htmlSha256: string };
  input: { filename: string; mime: "image/png"; bytes: number; sha256: string; width: number; height: number };
  operation: { androidPickerOpened: true; fileSelected: true; resizedInChrome: true; androidDownloadSaved: true };
  output: { filename: string; mime: "image/jpeg"; bytes: number; sha256: string; width: number; height: number; decoder: "sharp/libvips"; reopened: true };
}

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const sha = (value: unknown): boolean => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const nonEmpty = (value: unknown): boolean => typeof value === "string" && value.trim().length >= 2;
const positive = (value: unknown): boolean => Number.isInteger(value) && (value as number) > 0;

export function validateAndroidChromeAvd277(value: unknown): string[] {
  if (!isObject(value)) return ["receipt object missing"];
  const errors: string[] = [];
  if (value.schemaVersion !== 1 || value.ticket !== "STR-277" || value.evidenceKind !== "ANDROID_EMULATOR_CHROME_SIMULATED" || value.physicalDeviceObserved !== false) {
    errors.push("evidence must declare simulated Android Chrome, never physical hardware");
  }
  if (!nonEmpty(value.observedAt) || !Number.isFinite(Date.parse(String(value.observedAt)))) errors.push("observation timestamp missing");
  const device = isObject(value.emulator) ? value.emulator : {};
  if (!nonEmpty(device.serial) || !nonEmpty(device.avd) || !positive(device.api) || !nonEmpty(device.fingerprint)) errors.push("emulator AVD/API/fingerprint missing");
  const browser = isObject(value.browser) ? value.browser : {};
  if (browser.package !== "com.android.chrome" || !nonEmpty(browser.version) || !/Android.*Chrome\//u.test(String(browser.userAgent))) errors.push("Android Chrome package/version/UA missing");
  const build = isObject(value.build) ? value.build : {};
  if (!/^[a-f0-9]{40}$/u.test(String(build.revision)) || build.compiled !== true || build.route !== "/tools/image-resize/" || !sha(build.htmlSha256)) errors.push("compiled route fingerprint missing");
  const input = isObject(value.input) ? value.input : {};
  if (input.mime !== "image/png" || !nonEmpty(input.filename) || !positive(input.bytes) || !sha(input.sha256) || !positive(input.width) || !positive(input.height)) errors.push("input image byte/MIME/dimension identity missing");
  const operation = isObject(value.operation) ? value.operation : {};
  if (operation.androidPickerOpened !== true || operation.fileSelected !== true || operation.resizedInChrome !== true || operation.androidDownloadSaved !== true) errors.push("Android picker/resize/download interaction incomplete");
  const output = isObject(value.output) ? value.output : {};
  if (output.mime !== "image/jpeg" || !nonEmpty(output.filename) || !positive(output.bytes) || !sha(output.sha256) || !positive(output.width) || !positive(output.height) || output.decoder !== "sharp/libvips" || output.reopened !== true) errors.push("independent download readback incomplete");
  if (positive(input.width) && positive(input.height) && positive(output.width) && positive(output.height) && ((output.width as number) >= (input.width as number) || (output.height as number) >= (input.height as number))) errors.push("output was not resized smaller");
  return errors;
}
