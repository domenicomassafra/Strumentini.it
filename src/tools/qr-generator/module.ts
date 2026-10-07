import { generateQr, QR_MAX_BYTES, QR_MAX_VERSION } from "../../engines/qr";
import type { ToolModule } from "../../runtime/types";

export type WifiQrSecurity = "WPA" | "WEP" | "nopass";

function escapeWifiField(value: string): string {
  return value.replace(/[\\;,:"]/gu, (character) => `\\${character}`);
}

export function buildWifiQrPayload(input: {
  readonly ssid: string;
  readonly password?: string;
  readonly security?: WifiQrSecurity;
  readonly hidden?: boolean;
}): string {
  const ssid = input.ssid.trim();
  if (ssid === "") throw new Error("QR_WIFI_SSID_REQUIRED");
  const security = input.security ?? "WPA";
  if (security !== "WPA" && security !== "WEP" && security !== "nopass") throw new Error("QR_WIFI_SECURITY_INVALID");
  const password = input.password ?? "";
  if (security !== "nopass" && password === "") throw new Error("QR_WIFI_PASSWORD_REQUIRED");
  const fields = [
    `T:${security}`,
    `S:${escapeWifiField(ssid)}`,
    ...(security === "nopass" ? [] : [`P:${escapeWifiField(password)}`]),
    ...(input.hidden === true ? ["H:true"] : []),
  ];
  return `WIFI:${fields.join(";")};;`;
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("QR_INPUT_REQUIRED");
    const record = value as { payload?: unknown; mask?: unknown; preset?: unknown; ssid?: unknown; password?: unknown; security?: unknown; hidden?: unknown };
    if (record.mask !== undefined && (typeof record.mask !== "number" || !Number.isInteger(record.mask) || record.mask < 0 || record.mask > 7)) throw new Error("QR_INVALID_MASK");
    const preset = record.preset === undefined ? "text" : record.preset;
    if (preset !== "text" && preset !== "wifi") throw new Error("QR_PRESET_INVALID");
    const payload = preset === "wifi"
      ? buildWifiQrPayload({
          ssid: typeof record.ssid === "string" ? record.ssid : "",
          ...(typeof record.password === "string" ? { password: record.password } : {}),
          ...(typeof record.security === "string" ? { security: record.security as WifiQrSecurity } : {}),
          hidden: record.hidden === true || record.hidden === "true",
        })
      : typeof record.payload === "string"
        ? record.payload
        : (() => { throw new Error("QR_INPUT_REQUIRED"); })();
    const result = generateQr(payload, record.mask === undefined ? {} : { mask: record.mask });
    return {
      ...result,
      preset,
      byteLimit: QR_MAX_BYTES,
      maxVersion: QR_MAX_VERSION,
      bytesRemaining: QR_MAX_BYTES - result.byteLength,
      dataUrl: `data:image/svg+xml,${encodeURIComponent(result.svg)}`,
    };
  },
};

export default module;
