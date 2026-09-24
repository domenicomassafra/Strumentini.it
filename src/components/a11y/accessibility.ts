export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
].join(",");

export interface FocusableElement {
  focus(options?: FocusOptions): void;
  getClientRects?(): { readonly length: number };
  matches?(selectors: string): boolean;
  getAttribute?(name: string): string | null;
  isConnected?: boolean;
  disabled?: boolean;
  hidden?: boolean | string;
  tabIndex?: number;
}

export interface FieldIdSet {
  readonly control: string;
  readonly description: string;
  readonly error: string;
}

export interface FieldAccessibilityOptions {
  readonly hasDescription?: boolean;
  readonly hasError?: boolean;
  readonly required?: boolean;
}

export interface FieldControlAccessibility {
  readonly id: string;
  readonly required?: true;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly "aria-errormessage"?: string;
  readonly "aria-required"?: true;
}

export type AnnouncementPoliteness = "polite" | "assertive";

export interface StatusAnnouncement {
  readonly id: string;
  readonly message: string;
  readonly politeness: AnnouncementPoliteness;
}

export interface StatusRegionAttributes {
  readonly id: string;
  readonly role: "status" | "alert";
  readonly "aria-live": AnnouncementPoliteness;
  readonly "aria-atomic": "true" | "false";
}

export interface StatusAnnouncer {
  announce(message: string, politeness?: AnnouncementPoliteness): StatusAnnouncement | null;
  reset(): void;
}

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
}

export interface NavigationItemAttributes {
  readonly href: string;
  readonly "aria-current"?: "page";
  readonly "aria-disabled"?: "true";
  readonly tabIndex?: -1;
}

function idPart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized || "field";
}

export function createFieldIds(prefix: string, field: string): FieldIdSet {
  const base = `${idPart(prefix)}-${idPart(field)}`;
  return {
    control: `${base}-control`,
    description: `${base}-description`,
    error: `${base}-error`,
  };
}

export function joinDescribedBy(...ids: readonly (string | null | undefined | false)[]): string | undefined {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))];
  return unique.length === 0 ? undefined : unique.join(" ");
}

export function fieldControlAccessibility(
  ids: FieldIdSet,
  options: FieldAccessibilityOptions = {},
): FieldControlAccessibility {
  const describedBy = joinDescribedBy(
    options.hasDescription === true ? ids.description : undefined,
    options.hasError === true ? ids.error : undefined,
  );
  const attributes: {
    id: string;
    required?: true;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
    "aria-errormessage"?: string;
    "aria-required"?: true;
  } = { id: ids.control };
  if (describedBy !== undefined) attributes["aria-describedby"] = describedBy;
  if (options.hasError === true) {
    attributes["aria-invalid"] = true;
    attributes["aria-errormessage"] = ids.error;
  }
  if (options.required === true) {
    attributes.required = true;
    attributes["aria-required"] = true;
  }
  return attributes;
}

export function normalizeAnnouncement(message: string, maxLength = 240): string {
  return message.replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

export function statusRegionAttributes(
  id: string,
  politeness: AnnouncementPoliteness = "polite",
  atomic = true,
): StatusRegionAttributes {
  return {
    id,
    role: politeness === "assertive" ? "alert" : "status",
    "aria-live": politeness,
    "aria-atomic": atomic ? "true" : "false",
  };
}

export function createStatusAnnouncer(): StatusAnnouncer {
  let previousKey: string | null = null;
  let sequence = 0;
  return {
    announce(message, politeness = "polite") {
      const normalized = normalizeAnnouncement(message);
      if (normalized === "") return null;
      const key = `${politeness}:${normalized}`;
      if (key === previousKey) return null;
      previousKey = key;
      sequence += 1;
      return { id: `a11y-announcement-${sequence}`, message: normalized, politeness };
    },
    reset() {
      previousKey = null;
    },
  };
}

export function canReceiveFocus(element: FocusableElement | null | undefined): boolean {
  if (!element || element.disabled === true || element.hidden === true || element.hidden === "true" || element.isConnected === false) return false;
  if (typeof element.tabIndex === "number" && element.tabIndex < 0) return false;
  if (typeof element.getAttribute === "function") {
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.getAttribute("inert") !== null) return false;
    if (element.getAttribute("aria-disabled") === "true") return false;
    if (element.getAttribute("contenteditable") === "false") return false;
  }
  if (typeof element.matches === "function" && !element.matches(FOCUSABLE_SELECTOR)) return false;
  if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
  return true;
}

export function focusableElements(container: ParentNode): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(canReceiveFocus);
}

export function wrapFocus(
  container: ParentNode,
  activeElement: Element | null,
  backwards: boolean,
): HTMLElement | null {
  const elements = focusableElements(container);
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (first === undefined || last === undefined) return null;
  const currentIndex = activeElement === null ? -1 : elements.indexOf(activeElement as HTMLElement);
  if (backwards && currentIndex <= 0) return last;
  if (!backwards && (currentIndex < 0 || currentIndex === elements.length - 1)) return first;
  return null;
}

export function restoreFocus(target: FocusableElement | null | undefined): boolean {
  if (!canReceiveFocus(target)) return false;
  try {
    target?.focus({ preventScroll: true });
    return true;
  } catch {
    try {
      target?.focus();
      return true;
    } catch {
      return false;
    }
  }
}

export function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}

export function isEscapeKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

export function isTabKey(key: string): boolean {
  return key === "Tab";
}

export function navigationItemAttributes(item: NavigationItem): NavigationItemAttributes {
  const attributes: {
    href: string;
    "aria-current"?: "page";
    "aria-disabled"?: "true";
    tabIndex?: -1;
  } = { href: item.href };
  if (item.current === true) attributes["aria-current"] = "page";
  if (item.disabled === true) {
    attributes["aria-disabled"] = "true";
    attributes.tabIndex = -1;
  }
  return attributes;
}
