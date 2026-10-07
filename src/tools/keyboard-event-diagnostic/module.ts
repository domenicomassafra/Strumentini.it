import type { ToolModule } from "../../runtime/types";

export const KEYBOARD_HISTORY_LIMIT = 12;

export interface KeyboardDiagnosticInput {
  readonly type: "keydown" | "keyup";
  readonly key: string;
  readonly code: string;
  readonly location: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly repeat: boolean;
  readonly isComposing: boolean;
}

export interface KeyboardDiagnosticEvent extends KeyboardDiagnosticInput {
  readonly modifiers: readonly string[];
  readonly locationLabel: string;
}

function boundedEventText(value: string): string {
  const compact = value.replace(/[\r\n\t]/gu, " ");
  return compact.length <= 32 ? compact : `${compact.slice(0, 31)}…`;
}

export function keyboardLocationLabel(location: number): string {
  if (location === 1) return "sinistra";
  if (location === 2) return "destra";
  if (location === 3) return "tastierino";
  return "standard";
}

export function normalizeKeyboardDiagnosticEvent(input: KeyboardDiagnosticInput): KeyboardDiagnosticEvent {
  const modifiers = [
    input.ctrlKey ? "Ctrl" : null,
    input.altKey ? "Alt" : null,
    input.shiftKey ? "Shift" : null,
    input.metaKey ? "Meta" : null,
  ].filter((value): value is string => value !== null);
  return {
    ...input,
    key: boundedEventText(input.key),
    code: boundedEventText(input.code),
    modifiers,
    locationLabel: keyboardLocationLabel(input.location),
  };
}

export function appendKeyboardHistory(
  history: readonly KeyboardDiagnosticEvent[],
  event: KeyboardDiagnosticEvent,
  limit = KEYBOARD_HISTORY_LIMIT,
): readonly KeyboardDiagnosticEvent[] {
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : KEYBOARD_HISTORY_LIMIT;
  return [event, ...history].slice(0, boundedLimit);
}

const module: ToolModule = {
  run(input) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT");
    return normalizeKeyboardDiagnosticEvent(input as KeyboardDiagnosticInput);
  },
};

export default module;
