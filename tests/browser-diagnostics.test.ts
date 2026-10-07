import { describe, expect, it } from "vitest";
import {
  breakpointForViewport,
  formatSupportSummary,
  normalizeBrowserDeviceInfo,
  parsePublicIpResponse,
} from "../src/tools/connection-device-info/module";
import {
  KEYBOARD_HISTORY_LIMIT,
  appendKeyboardHistory,
  normalizeKeyboardDiagnosticEvent,
} from "../src/tools/keyboard-event-diagnostic/module";

const desktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

describe("connection/device information", () => {
  it("normalizes current-session browser facts without inventing identity", () => {
    const info = normalizeBrowserDeviceInfo({
      userAgent: desktopUa,
      locale: "it-IT",
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1280,
      viewportHeight: 800,
      devicePixelRatio: 2,
      orientationType: "landscape-primary",
      orientationAngle: 90,
      maxTouchPoints: 0,
      touchEventAvailable: false,
      coarsePointer: false,
    });
    expect(info).toMatchObject({
      browser: "Chrome",
      os: "macOS",
      breakpoint: "ampio",
      touchCapable: false,
    });
    expect(breakpointForViewport(390)).toBe("piccolo");
    expect(breakpointForViewport(700)).toBe("medio");
    expect(breakpointForViewport(1200)).toBe("ampio");
    const summary = formatSupportSummary(info);
    expect(summary).toContain("non sono un fingerprint");
    expect(summary).toContain("IP pubblico: escluso");
    expect(summary).toContain("Viewport CSS: 1280×800");
  });

  it("accepts bounded IPv4/IPv6 response strings and rejects arbitrary payloads", () => {
    expect(parsePublicIpResponse({ ip: "203.0.113.42" })).toBe("203.0.113.42");
    expect(parsePublicIpResponse({ ip: "2001:db8::42" })).toBe("2001:db8::42");
    expect(() => parsePublicIpResponse({ ip: "<script>" })).toThrow("INVALID_IP_RESPONSE");
    expect(() => parsePublicIpResponse({ nope: "203.0.113.42" })).toThrow("INVALID_IP_RESPONSE");
  });
});

describe("keyboard event diagnostic", () => {
  it("normalizes key facts and modifier/location labels", () => {
    expect(normalizeKeyboardDiagnosticEvent({
      type: "keydown",
      key: "K",
      code: "KeyK",
      location: 1,
      altKey: true,
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      repeat: true,
      isComposing: false,
    })).toMatchObject({
      key: "K",
      code: "KeyK",
      locationLabel: "sinistra",
      modifiers: ["Ctrl", "Alt", "Shift"],
      repeat: true,
      isComposing: false,
    });
  });

  it("keeps only a bounded in-memory event history", () => {
    let history = [] as ReturnType<typeof normalizeKeyboardDiagnosticEvent>[];
    for (let index = 0; index < KEYBOARD_HISTORY_LIMIT + 5; index += 1) {
      history = [...appendKeyboardHistory(history, normalizeKeyboardDiagnosticEvent({
        type: "keydown",
        key: String(index),
        code: `Digit${index}`,
        location: 0,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        repeat: false,
        isComposing: index === 0,
      }))];
    }
    expect(history).toHaveLength(KEYBOARD_HISTORY_LIMIT);
    expect(history[0]?.key).toBe(String(KEYBOARD_HISTORY_LIMIT + 4));
    expect(history.at(-1)?.key).toBe("5");
  });
});
