import type { JSX } from "preact";

export type StatusMarkKind = "ok" | "missing" | "warn" | "error" | "info";

export interface StatusMarkProps {
  kind: StatusMarkKind;
  /** Rendered to assistive tech; omit when adjacent text already carries the meaning. */
  label?: string;
  className?: string;
}

/**
 * Authored SVG status marks, drawn in the ledger's ink.
 *
 * These replace the Unicode status glyphs (✓, !, −, →) the renderers used
 * inline. A glyph's shape, weight and colour are whatever the reader's system
 * font decides — which is why a ✓ rendered next to ink text never matched it.
 * A stroked path at 1.75 in `currentColor` inherits the row's colour and stays
 * identical on every platform, in light and in dark.
 */
const PATHS: Readonly<Record<StatusMarkKind, JSX.Element>> = {
  // A pen tick: two strokes, the short arm first.
  ok: <path d="M2.5 6.4 4.9 8.8 9.5 3.4" />,
  // An em rule: the row is absent, not wrong.
  missing: <path d="M2.5 6h7" />,
  // An exclamation cut to the same 1.75 stroke as the tick.
  warn: <path d="M6 2.4v4.2M6 9.2v.1" />,
  // A cross: ink, not a red filled circle.
  error: <path d="M3.4 3.4 8.6 8.6M8.6 3.4 3.4 8.6" />,
  // A barred circle: reference, not status.
  info: <><circle cx="6" cy="6" r="3.9" /><path d="M6 5.1v3.1" /></>,
};

const LABELS: Readonly<Record<StatusMarkKind, string>> = {
  ok: "Disponibile",
  missing: "Non disponibile",
  warn: "Attenzione",
  error: "Errore",
  info: "Informazione",
};

export function StatusMark({ kind, label, className = "status-mark" }: StatusMarkProps) {
  const hidden = label === undefined;
  return (
    <svg
      class={className}
      data-mark={kind}
      viewBox="0 0 12 12"
      width="12"
      height="12"
      role={hidden ? "presentation" : "img"}
      aria-hidden={hidden ? "true" : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[kind]}
    </svg>
  );
}

export function statusMarkLabel(kind: StatusMarkKind): string {
  return LABELS[kind];
}

export interface RangeMarkProps {
  start: string;
  end: string;
}

/**
 * An interval, drawn. The renderers used the Unicode arrow "→" between a
 * start and an end instant; that glyph is whatever the reader's system font
 * ships, so the same interval rendered at a different weight on a different
 * machine. This is the same arrow at the same 1.75 stroke as the status marks.
 */
export function RangeMark({ start, end }: RangeMarkProps) {
  return (
    <span class="range-mark">
      <span class="range-mark-bound">{start}</span>
      <svg class="status-mark" data-mark="info" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M2.4 6h7.2M7.2 3.4 9.6 6 7.2 8.6" />
      </svg>
      <span class="range-mark-bound">{end}</span>
    </span>
  );
}

export type CaretDirection = "up" | "down";

const CARET_PATHS: Readonly<Record<CaretDirection, JSX.Element>> = {
  up: <path d="M3.4 7.6 6 4.4 8.6 7.6" />,
  down: <path d="M3.4 4.4 6 7.6 8.6 4.4" />,
};

export interface CaretMarkProps {
  direction: CaretDirection;
  /** Always required: the control is icon-only and this label is its name. */
  label: string;
}

/**
 * A chevron for an icon-only control. The column mapper used the Unicode
 * arrows "↑" and "↓" as the entire contents of a button, so the control had
 * no shape of its own — its meaning was whatever arrow the reader's system
 * font drew. This is a chevron at the same 1.75 stroke as the status marks.
 */
export function CaretMark({ direction, label }: CaretMarkProps) {
  return (
    <svg
      class="status-mark caret-mark"
      data-mark="info"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      role="img"
      aria-label={label}
      focusable="false"
    >
      {CARET_PATHS[direction]}
    </svg>
  );
}
