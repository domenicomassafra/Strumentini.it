import { describe, expect, it } from "vitest";
import { AUTO_DOWNLOAD_KEY_339, changeAutoDownload339, planVerifiedDownload339, readAutoDownload339, writeAutoDownload339 } from "../src/runtime/download-policy-339";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

const bytes = new TextEncoder().encode('{"ok":true}');
const file = () => createOutputArtifactDescriptor({
  kind: "structured", name: "result.json", mime: "application/json", bytes,
  verification: { state: "verified", verifiedMime: "application/json", method: "read-back" },
  fidelity: "structural", fidelityNote: "Exact structured output",
});

describe("#339 explicit browser download opt-in", () => {
  it("defaults to OFF and preserves opt-in across reload using its exact key", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value); },
      removeItem: (key: string) => { items.delete(key); },
    };
    expect(readAutoDownload339(storage)).toBe(false);
    expect(writeAutoDownload339(storage, true)).toBe(true);
    expect(items.get(AUTO_DOWNLOAD_KEY_339)).toBe("enabled");
    expect(readAutoDownload339(storage)).toBe(true);
    expect(writeAutoDownload339(storage, false)).toBe(true);
    expect(readAutoDownload339(storage)).toBe(false);
  });

  it("storage denial must not imply consent or throw and cannot silently leave opt-in on", () => {
    const denied = { getItem: (): string | null => { throw new Error("denied"); }, setItem: (): void => { throw new Error("denied"); }, removeItem: (): void => { throw new Error("denied"); } };
    expect(readAutoDownload339(denied)).toBe(false);
    expect(writeAutoDownload339(denied, true)).toBe(false);
    expect(writeAutoDownload339(denied, false)).toBe(false);
    expect(writeAutoDownload339(null, true)).toBe(false);
  });

  it("reports unsuccessful revocation when removeItem throws and persisted consent survives reload", () => {
    const items = new Map([[AUTO_DOWNLOAD_KEY_339, "enabled"]]);
    const blocked = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value); },
      removeItem: () => { throw new Error("permission denied"); },
    };
    expect(changeAutoDownload339(blocked, false)).toEqual({ saved: false, persistedEnabled: true });
    expect(readAutoDownload339(blocked)).toBe(true);
    expect(items.get(AUTO_DOWNLOAD_KEY_339)).toBe("enabled");
  });

  it("cannot certify a revoked preference when readback is denied", () => {
    const storage = {
      getItem: (): string | null => { throw new Error("read denied"); },
      setItem: (): void => undefined,
      removeItem: (): void => undefined,
    };
    expect(writeAutoDownload339(storage, false)).toBe(false);
    expect(changeAutoDownload339(storage, false)).toEqual({ saved: false, persistedEnabled: null });
    expect(changeAutoDownload339(null, false)).toEqual({ saved: false, persistedEnabled: null });
  });

  it("allows exact verified artifact bytes only; refuses warning, empty, too large, forged filename", () => {
    const valid = file();
    expect(planVerifiedDownload339(valid)).toMatchObject({ allowed: true, filename: "result.json", bytes });
    expect(planVerifiedDownload339(null)).toMatchObject({ allowed: false });
    expect(planVerifiedDownload339({ ...valid, verification: { state: "warning" } })).toMatchObject({ allowed: false });
    expect(planVerifiedDownload339({ ...valid, download: { ...valid.download, ready: false } })).toMatchObject({ allowed: false });
    expect(planVerifiedDownload339({ ...valid, byteLength: valid.byteLength + 1 })).toMatchObject({ allowed: false });
    expect(planVerifiedDownload339(valid, 1)).toMatchObject({ allowed: false });
    expect(planVerifiedDownload339({ ...valid, name: "../../private.json" })).toMatchObject({ allowed: false });
  });
});
