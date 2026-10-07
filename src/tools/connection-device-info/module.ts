import { parseUserAgent } from "../../engines/developer-web/web-reference";
import type { ToolModule } from "../../runtime/types";

export const PUBLIC_IP_ENDPOINT = "https://api64.ipify.org?format=json";

export interface BrowserDeviceInput {
  readonly userAgent: string;
  readonly locale: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly orientationType: string;
  readonly orientationAngle: number | null;
  readonly maxTouchPoints: number;
  readonly touchEventAvailable: boolean;
  readonly coarsePointer: boolean;
}

export interface BrowserDeviceInfo extends BrowserDeviceInput {
  readonly browser: string;
  readonly browserVersion: string | null;
  readonly os: string;
  readonly deviceHint: string;
  readonly breakpoint: "piccolo" | "medio" | "ampio";
  readonly touchCapable: boolean;
}

function finitePositive(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function breakpointForViewport(width: number): BrowserDeviceInfo["breakpoint"] {
  if (width < 640) return "piccolo";
  if (width < 900) return "medio";
  return "ampio";
}

export function normalizeBrowserDeviceInfo(input: BrowserDeviceInput): BrowserDeviceInfo {
  const parsed = parseUserAgent(input.userAgent);
  const viewportWidth = finitePositive(input.viewportWidth);
  const viewportHeight = finitePositive(input.viewportHeight);
  const maxTouchPoints = Math.max(0, Math.trunc(finitePositive(input.maxTouchPoints)));
  return {
    ...input,
    locale: input.locale.trim() || "sconosciuta",
    screenWidth: finitePositive(input.screenWidth),
    screenHeight: finitePositive(input.screenHeight),
    viewportWidth,
    viewportHeight,
    devicePixelRatio: finitePositive(input.devicePixelRatio, 1) || 1,
    orientationType: input.orientationType.trim() || "sconosciuta",
    orientationAngle: input.orientationAngle === null || !Number.isFinite(input.orientationAngle)
      ? null
      : input.orientationAngle,
    maxTouchPoints,
    browser: parsed.browser,
    browserVersion: parsed.version,
    os: parsed.os,
    deviceHint: parsed.device,
    breakpoint: breakpointForViewport(viewportWidth),
    touchCapable: maxTouchPoints > 0 || input.touchEventAvailable || input.coarsePointer,
  };
}

export function formatSupportSummary(info: BrowserDeviceInfo): string {
  const ua = info.userAgent.replace(/\s+/gu, " ").trim().slice(0, 320) || "sconosciuto";
  const browser = info.browserVersion === null ? info.browser : `${info.browser} ${info.browserVersion}`;
  const orientation = info.orientationAngle === null
    ? info.orientationType
    : `${info.orientationType} (${info.orientationAngle}°)`;
  return [
    "Informazioni di supporto — non sono un fingerprint e non identificano in modo univoco il dispositivo.",
    `Browser: ${browser}`,
    `Sistema operativo (da User-Agent): ${info.os}`,
    `User-Agent: ${ua}`,
    `Lingua: ${info.locale}`,
    `Schermo CSS: ${info.screenWidth}×${info.screenHeight}`,
    `Viewport CSS: ${info.viewportWidth}×${info.viewportHeight}`,
    `DPR: ${info.devicePixelRatio}`,
    `Orientamento: ${orientation}`,
    `Touch: ${info.touchCapable ? "disponibile" : "non rilevato"} (maxTouchPoints=${info.maxTouchPoints})`,
    `Breakpoint Strumentini: ${info.breakpoint}`,
    "IP pubblico: escluso dal riepilogo copiato; la ricerca IP è un'azione di rete separata.",
  ].join("\n");
}

export function parsePublicIpResponse(value: unknown): string {
  if (typeof value !== "object" || value === null || !("ip" in value)) throw new Error("INVALID_IP_RESPONSE");
  const ip = (value as { readonly ip?: unknown }).ip;
  if (typeof ip !== "string") throw new Error("INVALID_IP_RESPONSE");
  const normalized = ip.trim();
  if (normalized.length < 3 || normalized.length > 64 || !/^[0-9a-f:.]+$/iu.test(normalized)) {
    throw new Error("INVALID_IP_RESPONSE");
  }
  return normalized;
}

const module: ToolModule = {
  run(input) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT");
    return normalizeBrowserDeviceInfo(input as BrowserDeviceInput);
  },
};

export default module;
