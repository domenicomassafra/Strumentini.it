import type { OutputArtifactDescriptor } from "./output-artifact";

/** #339 — A user choice, not inferred consent from a completed operation. */
export const AUTO_DOWNLOAD_KEY_339 = "strumentini:auto-download:v1";
const ENABLED = "enabled";

export function readAutoDownload339(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try { return storage?.getItem(AUTO_DOWNLOAD_KEY_339) === ENABLED; } catch { return false; }
}

/** Fail closed: enabling is not allowed unless the browser persists the choice. */
export function writeAutoDownload339(storage: Pick<Storage, "setItem" | "removeItem" | "getItem"> | null | undefined, enabled: boolean): boolean {
  try {
    if (!storage) return false;
    if (enabled) storage.setItem(AUTO_DOWNLOAD_KEY_339, ENABLED);
    else storage.removeItem(AUTO_DOWNLOAD_KEY_339);
    return readAutoDownload339(storage) === enabled;
  } catch { return false; }
}

export type DownloadPlan339 =
  | { readonly allowed: true; readonly filename: string; readonly mime: string; readonly bytes: Uint8Array }
  | { readonly allowed: false; readonly reason: string };

/** No download for an unverified, empty or over-budget output. */
export function planVerifiedDownload339(artifact: OutputArtifactDescriptor | null, maxBytes = 64 * 1024 * 1024): DownloadPlan339 {
  if (artifact === null || !artifact.download.ready || artifact.verification.state !== "verified") {
    return { allowed: false, reason: "Risultato non verificato: download non disponibile." };
  }
  if (artifact.bytes.byteLength === 0 || artifact.bytes.byteLength !== artifact.byteLength || artifact.byteLength > maxBytes) {
    return { allowed: false, reason: "Dimensioni del file non valide o oltre il limite." };
  }
  if (artifact.download.filename !== artifact.name || artifact.download.mime !== artifact.mime || /[\\/\u0000-\u001f\u007f]/u.test(artifact.name)) {
    return { allowed: false, reason: "Nome o tipo del file non sicuro." };
  }
  return { allowed: true, filename: artifact.name, mime: artifact.mime, bytes: artifact.bytes };
}

export function browserStorage339(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
