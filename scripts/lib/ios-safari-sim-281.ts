import { createHash } from "node:crypto";

export const IOS281_ROUTES = ["/tools/image-resize/", "/tools/audio-generator/"] as const;

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as RecordValue : {};
const hash = (value: unknown): boolean => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);

/** This contract deliberately cannot validate a physical-device receipt. */
export function validateIosSafariSim281(receipt: unknown): string[] {
  const errors: string[] = [];
  const root = object(receipt);
  const browser = object(root.browser);
  const build = object(root.build);
  if (root.schemaVersion !== 1 || root.ticket !== 109) errors.push("schema/ticket mismatch");
  if (root.evidenceKind !== "SIMULATED_DESKTOP_WEBKIT_MOBILE" || root.physicalDeviceObserved !== false)
    errors.push("receipt must be explicitly simulated and non-physical");
  if (browser.engine !== "webkit" || typeof browser.version !== "string" || !browser.version ||
    browser.deviceProfile !== "iPhone 17" || browser.platform !== "macOS Playwright")
    errors.push("browser identity missing or not a desktop WebKit simulation");
  if (!/^[a-f\d]{40}$/u.test(String(build.revision ?? "")) || !hash(build.fingerprintSha256))
    errors.push("build revision/fingerprint missing");
  const pages = object(build.pages);
  if (IOS281_ROUTES.some((route) => !hash(pages[route]))) errors.push("built route HTML fingerprints missing");
  if (hash(build.fingerprintSha256) &&
    createHash("sha256").update(JSON.stringify(pages)).digest("hex") !== build.fingerprintSha256)
    errors.push("aggregate fingerprint does not match the route hashes");
  const routes = root.routes;
  if (!Array.isArray(routes) || routes.length !== IOS281_ROUTES.length ||
    new Set(routes.map((entry) => object(entry).route)).size !== IOS281_ROUTES.length)
    return [...errors, "expected exactly the two distinct representative heavy routes"];

  for (const route of IOS281_ROUTES) {
    const match = routes.find((entry) => object(entry).route === route);
    if (!match) { errors.push("missing route " + route); continue; }
    const row = object(match);
    const memory = object(row.memory);
    const picker = object(row.picker);
    const recovery = object(row.recovery);
    const download = object(row.download);
    const share = object(row.share);
    const network = object(row.network);
    if (row.status !== "PASS") errors.push(route + " did not pass");
    if (picker.mechanism !== "playwright-setInputFiles" || picker.nativeIosPickerObserved !== false ||
      picker.selection !== "PASS") errors.push(route + " picker identity/selection missing");
    if (memory.measurement !== "POLICY_ESTIMATE_ONLY" || memory.observedPeakBytes !== null ||
      !Number.isSafeInteger(memory.estimatedBytes) || Number(memory.estimatedBytes) <= 0 ||
      !Number.isSafeInteger(memory.hardLimitBytes) || Number(memory.hardLimitBytes) <= 0 ||
      Number(memory.estimatedBytes) > Number(memory.hardLimitBytes) ||
      typeof memory.limitation !== "string" || memory.limitation.length < 20)
      errors.push(route + " memory bounds/unsupported measurement invalid");
    if (recovery.invalidInput !== "PASS" || recovery.retry !== "PASS" ||
      !(recovery.cancel === "PASS" || (recovery.cancel === "NOT_OBSERVED" &&
        typeof recovery.cancelLimitation === "string" && recovery.cancelLimitation.length > 20)))
      errors.push(route + " refusal/cancel/retry evidence incomplete");
    if (route.includes("audio-generator") && recovery.cancel !== "PASS") errors.push("audio cancellation must be observed");
    if (!hash(download.sha256) || !Number.isSafeInteger(download.bytes) || Number(download.bytes) <= 0 ||
      download.reopenedIndependently !== "PASS" || download.blobHref !== true ||
      typeof download.filename !== "string" || !download.filename)
      errors.push(route + " Blob/download/reopen proof incomplete");
    if (share.status !== "NOT_RUN" || typeof share.limitation !== "string" || share.limitation.length < 20)
      errors.push(route + " simulated native share limitation missing");
    if (!Array.isArray(network.offsite) || network.offsite.length !== 0 ||
      !Array.isArray(network.uploads) || network.uploads.length !== 0)
      errors.push(route + " unexpected offsite/upload traffic");
  }
  return errors;
}
