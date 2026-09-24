import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canReceiveFocus,
  createFieldIds,
  createStatusAnnouncer,
  fieldControlAccessibility,
  focusableElements,
  isActivationKey,
  isEscapeKey,
  isTabKey,
  navigationItemAttributes,
  restoreFocus,
  statusRegionAttributes,
  wrapFocus,
  type FocusableElement,
} from "../src/components/a11y/accessibility";

function element(overrides: Partial<FocusableElement> = {}): FocusableElement {
  return {
    tabIndex: 0,
    isConnected: true,
    focus: () => undefined,
    getClientRects: () => ({ length: 1 }),
    ...overrides,
  };
}

function container(elements: readonly HTMLElement[]): ParentNode {
  return { querySelectorAll: () => elements } as unknown as ParentNode;
}

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string): number => {
    const channels = hex.slice(1).match(/.{2}/gu)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
    const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("shared accessibility primitives", () => {
  it("associates only rendered descriptions and errors with form controls", () => {
    const ids = createFieldIds("field", "Email address");
    expect(fieldControlAccessibility(ids, { hasDescription: true, hasError: true, required: true })).toEqual({
      id: ids.control,
      "aria-describedby": `${ids.description} ${ids.error}`,
      "aria-invalid": true,
      "aria-errormessage": ids.error,
      required: true,
      "aria-required": true,
    });
    expect(fieldControlAccessibility(ids, { hasDescription: false, hasError: false, required: false })).toEqual({
      id: ids.control,
    });
  });

  it("filters hidden and disabled targets before focus or restoration", () => {
    expect(canReceiveFocus(element({ tabIndex: -1 }))).toBe(false);
    expect(canReceiveFocus(element({ getAttribute: (name) => name === "aria-hidden" ? "true" : null }))).toBe(false);
    expect(canReceiveFocus(element({ getAttribute: (name) => name === "aria-disabled" ? "true" : null }))).toBe(false);
    expect(canReceiveFocus(element({ isConnected: false }))).toBe(false);

    let focusOptions: FocusOptions | undefined;
    const target = element({ focus: (options) => { focusOptions = options; } });
    expect(restoreFocus(target)).toBe(true);
    expect(focusOptions).toEqual({ preventScroll: true });
    expect(restoreFocus(element({ tabIndex: -1 }))).toBe(false);
  });

  it("keeps dialog focus inside the dialog at both tab boundaries", () => {
    const first = element() as HTMLElement;
    const middle = element() as HTMLElement;
    const last = element() as HTMLElement;
    const scope = container([first, middle, last]);
    expect(focusableElements(scope)).toEqual([first, middle, last]);
    expect(wrapFocus(scope, first, true)).toBe(last);
    expect(wrapFocus(scope, last, false)).toBe(first);
    expect(wrapFocus(scope, middle, false)).toBeNull();
    expect(wrapFocus(scope, null, true)).toBe(last);
  });

  it("deduplicates status announcements and exposes keyboard helpers", () => {
    const announcer = createStatusAnnouncer();
    expect(announcer.announce("  Ready\nnow  ")).toMatchObject({ message: "Ready now", politeness: "polite" });
    expect(announcer.announce("Ready now")).toBeNull();
    announcer.reset();
    expect(announcer.announce("Ready now")).not.toBeNull();
    expect(statusRegionAttributes("status", "assertive")).toEqual({
      id: "status",
      role: "alert",
      "aria-live": "assertive",
      "aria-atomic": "true",
    });
    expect(isActivationKey("Enter")).toBe(true);
    expect(isActivationKey("Spacebar")).toBe(true);
    expect(isEscapeKey("Escape")).toBe(true);
    expect(isTabKey("Tab")).toBe(true);
  });

  it("keeps current and disabled navigation states explicit", () => {
    expect(navigationItemAttributes({ href: "/library", label: "Library", current: true })).toEqual({
      href: "/library",
      "aria-current": "page",
    });
    expect(navigationItemAttributes({ href: "/future", label: "Future", disabled: true })).toEqual({
      href: "/future",
      "aria-disabled": "true",
      tabIndex: -1,
    });
  });
});

describe("accessibility primitive markup and styles", () => {
  const dialogSource = readFileSync(new URL("../src/components/a11y/A11yDialog.tsx", import.meta.url), "utf8");
  const formSource = readFileSync(new URL("../src/components/a11y/FormField.tsx", import.meta.url), "utf8");
  const navSource = readFileSync(new URL("../src/components/a11y/AccessibleNav.tsx", import.meta.url), "utf8");
  const statusSource = readFileSync(new URL("../src/components/a11y/StatusAnnouncement.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/components/a11y/primitives.module.css", import.meta.url), "utf8");

  it("provides labelled landmarks, focus restoration, and keyboard close paths", () => {
    expect(dialogSource).toMatch(/<dialog[\s\S]*aria-labelledby=\{titleId\}/u);
    expect(dialogSource).toMatch(/onKeyDown=\{handleKeyDown\}/u);
    expect(dialogSource).toMatch(/isEscapeKey\(event\.key\)/u);
    expect(dialogSource).toMatch(/restoreInvoker/u);
    expect(formSource).toMatch(/hasError = error !== undefined && error\.trim\(\) !== ""/u);
    expect(navSource).toMatch(/<nav[\s\S]*aria-label=\{label\}/u);
    expect(navSource).toMatch(/Current/u);
    expect(navSource).toMatch(/aria-disabled/u);
    expect(statusSource).toMatch(/aria-live/u);
    expect(statusSource).toMatch(/aria-atomic/u);
  });

  it("keeps shared controls 44px, reflowable, and reduced-motion safe", () => {
    expect(styles).toMatch(/min-inline-size: 44px/u);
    expect(styles).toMatch(/min-block-size: 44px/u);
    expect(styles).toMatch(/max-inline-size: 100%/u);
    expect(styles).toMatch(/overflow-wrap: anywhere/u);
    expect(styles).toMatch(/grid-template-columns: repeat\(auto-fit, minmax\(min\(44px, 100%\), 1fr\)\)/u);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/u);
    expect(styles).toMatch(/animation-duration: 0\.01ms !important/u);
    expect(styles).toMatch(/transition-duration: 0\.01ms !important/u);
  });

  it("provides dark-mode contrast fallbacks for required and current states", () => {
    expect(contrast("#ffb4ab", "#1d1e1a")).toBeGreaterThan(4.5);
    expect(contrast("#9bc8b8", "#1d1e1a")).toBeGreaterThan(3);
    expect(styles).toMatch(/@media \(prefers-color-scheme: dark\)/u);
    expect(styles).toMatch(/\.required\s*\{[\s\S]*color: #ffb4ab/u);
    expect(styles).toMatch(/\.navLink\[aria-current="page"\][\s\S]*border-color: #9bc8b8/u);
  });
});
