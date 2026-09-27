import { useEffect, useRef, useState } from "preact/hooks";

/** How long a superseded value stays legible in the gutter. WORLD.md: ~4s. */
export const GUTTER_PREVIOUS_MS = 4000;

export interface PreviousValueProps {
  /** The current value. Empty means nothing new to show right now. */
  value: string | null | undefined;
  className?: string;
  /**
   * True while the tool is recomputing.
   *
   * A tool operation clears its result while it runs, so the headline subtree
   * would unmount and remount on every run — taking the delta with it. While
   * `retain` is set the last value stays on the board, which is also what the
   * ledger wants: the total does not blink out while you are still typing.
   */
  retain?: boolean;
}

/**
 * A gutter headline with its predecessor still dimmed directly above it.
 *
 * This is "il total corrente": change an input, the new value settles into the
 * column, and the one it replaced stays readable for four seconds so you can
 * see what moved and by how much.
 *
 * The superseded value is captured as it leaves, not as it lingers. Holding it
 * on a timer alone would lose it: a value that had been up for longer than 4s
 * would be gone before its successor ever arrived, and the delta would never
 * be seen.
 */
export function PreviousValue({
  value,
  className = "gutter-value",
  retain = false,
}: PreviousValueProps) {
  const incoming = value ?? "";
  // The last value that was actually on the board, whether or not it is still
  // the one being drawn. Survives the empty result a recompute passes through.
  const shownRef = useRef("");
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    if (incoming === "") {
      // A recompute in flight keeps the board as it was; a reset clears it.
      if (!retain) {
        shownRef.current = "";
        setPrevious(null);
      }
      return;
    }
    const outgoing = shownRef.current;
    shownRef.current = incoming;
    if (outgoing !== "" && outgoing !== incoming) setPrevious(outgoing);
  }, [incoming, retain]);

  useEffect(() => {
    if (previous === null) return;
    const timer = setTimeout(() => setPrevious(null), GUTTER_PREVIOUS_MS);
    return () => clearTimeout(timer);
  }, [previous]);

  const current = incoming !== "" ? incoming : shownRef.current;
  if (current === "") return null;

  return (
    <span class="gutter-headline">
      {previous !== null && (
        <span class="gutter-previous" aria-hidden="true">{previous}</span>
      )}
      <strong class={className}>{current}</strong>
    </span>
  );
}
