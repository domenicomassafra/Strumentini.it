/**
 * Validation telemetry is strictly opt-in even when a site build exposes a
 * configured endpoint. Never interpret absent, corrupt or inaccessible local
 * storage as consent to send events.
 */
export const TELEMETRY_CONSENT_STORAGE_KEY = "strumentini:validation-telemetry-consent:v1";

export interface TelemetryConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function hasValidationTelemetryConsent(storage: Pick<TelemetryConsentStorage, "getItem"> | null | undefined): boolean {
  if (storage === null || storage === undefined) return false;
  try {
    return storage.getItem(TELEMETRY_CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

export function saveValidationTelemetryConsent(
  storage: TelemetryConsentStorage | null | undefined,
  granted: boolean,
): boolean {
  if (storage === null || storage === undefined) return false;
  try {
    storage.setItem(TELEMETRY_CONSENT_STORAGE_KEY, granted ? "granted" : "denied");
    return true;
  } catch {
    // A denied or private storage context can never activate collection.
    return false;
  }
}
