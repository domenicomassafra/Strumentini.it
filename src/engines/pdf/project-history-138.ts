import type { PdfWorkspaceMode372 } from "./workspace-372";
import { PDF_LIMITS } from "./types";

export interface PdfProjectEdit138 {
  readonly order: readonly number[];
  readonly selected: readonly number[];
  readonly mode: PdfWorkspaceMode372;
}
export interface PdfProjectHistory138 {
  readonly version: 1;
  readonly index: number;
  readonly states: readonly PdfProjectEdit138[];
}
export const PDF_PROJECT_HISTORY_LIMIT_138 = 40;

function validEdit(value: unknown, count: number): value is PdfProjectEdit138 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as Partial<PdfProjectEdit138>;
  if (e.mode !== "reorder" && e.mode !== "selected") return false;
  if (!Array.isArray(e.order) || e.order.length !== count ||
    !Array.isArray(e.selected) || e.selected.length > count) return false;
  const expected = new Set(Array.from({ length: count }, (_, i) => i + 1));
  for (const n of e.order) {
    if (!Number.isInteger(n) || !expected.delete(n)) return false;
  }
  const selection = new Set<number>();
  for (const n of e.selected) {
    if (!Number.isInteger(n) || n < 1 || n > count || selection.has(n)) return false;
    selection.add(n);
  }
  return true;
}
function copyEdit(e: PdfProjectEdit138): PdfProjectEdit138 {
  return { order: [...e.order], selected: [...e.selected], mode: e.mode };
}
export function validatePdfProjectHistory138(value: unknown, count: number): value is PdfProjectHistory138 {
  if (!Number.isInteger(count) || count < 1 || count > PDF_LIMITS.maxPages ||
    !value || typeof value !== "object" || Array.isArray(value)) return false;
  const h = value as Partial<PdfProjectHistory138>;
  return h.version === 1 && Array.isArray(h.states) &&
    h.states.length >= 1 && h.states.length <= PDF_PROJECT_HISTORY_LIMIT_138 &&
    Number.isInteger(h.index) && (h.index ?? -1) >= 0 && (h.index ?? Infinity) < h.states.length &&
    h.states.every((state) => validEdit(state, count)) &&
    h.states[0]?.mode === "reorder" && h.states[0].selected.length === 0 &&
    h.states[0].order.every((page, index) => page === index + 1);
}
export function createPdfProjectHistory138(count: number): PdfProjectHistory138 {
  if (!Number.isInteger(count) || count < 1 || count > PDF_LIMITS.maxPages) throw new Error("PDF_PROJECT_138_PAGE_LIMIT");
  return { version: 1, index: 0, states: [{ order: Array.from({ length: count }, (_, i) => i + 1), selected: [], mode: "reorder" }] };
}
export function recordPdfProjectEdit138(history: PdfProjectHistory138, edit: PdfProjectEdit138, count: number): PdfProjectHistory138 {
  if (!validatePdfProjectHistory138(history, count) || !validEdit(edit, count)) throw new Error("PDF_PROJECT_138_INVALID_EDIT");
  const current = history.states[history.index]!;
  if (current.mode === edit.mode &&
      current.order.join(",") === edit.order.join(",") &&
      current.selected.join(",") === edit.selected.join(",")) return history;
  const next = [...history.states.slice(0, history.index + 1), copyEdit(edit)];
  const states = next.length <= PDF_PROJECT_HISTORY_LIMIT_138
    ? next : [next[0]!, ...next.slice(-(PDF_PROJECT_HISTORY_LIMIT_138 - 1))];
  return { version: 1, states, index: states.length - 1 };
}
export function stepPdfProjectHistory138(history: PdfProjectHistory138, delta: -1 | 1): PdfProjectHistory138 {
  const index = history.index + delta;
  if (index < 0 || index >= history.states.length) return history;
  return { ...history, index };
}
