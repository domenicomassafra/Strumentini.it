/**
 * One row grammar, three sections.
 *
 * Your Tools, Recent, and Suggestions previously each carried their own row
 * markup and their own rules, which is why they did not line up. They are now
 * the same component: an identity that may wrap on the left, and the value
 * column at the shared x-offset on the right. Any change to the grammar is one
 * change, and a Recent row cannot drift from a tool row.
 *
 * The value column is never blank. A section that has a value passes one; a
 * section that does not passes a runtime or activity state instead, so the
 * gutter is populated from the first row to the last on every section.
 */

import type { ComponentChildren, JSX } from "preact";
import styles from "./Workbench.module.css";

export interface LedgerValue {
  /** The produced value. Red is committed to this and nothing else. */
  readonly produced?: string | undefined;
  /** A unit or qualifier, set beneath the value in faded ink. */
  readonly unit?: string | undefined;
  /** Runtime or activity state, shown dimmed when there is no produced value. */
  readonly state?: string | undefined;
}

export interface LedgerRowProps {
  /**
   * Preact list key. Deliberately not the `data-tool-id` hook: Your Tools,
   * Recent, and Suggestions all render rows for the same tool, so a single
   * document-wide attribute would collide across sections and make
   * "which tools are installed" unanswerable from the DOM.
   */
  readonly rowId: string;
  /** Tool name, or the name Recent knows it by. */
  readonly title: string;
  /** One-line task. */
  readonly task?: string | undefined;
  /** Secondary provenance line, e.g. the Work Profile fields in use. */
  readonly detail?: ComponentChildren | undefined;
  /** The gutter cell content. */
  readonly value: LedgerValue;
  /** Row controls, placed in the identity column beneath the text. */
  readonly actions?: ComponentChildren | undefined;
  /** Extra data attributes, kept open for hooks that are not mine. */
  readonly dataset?: Readonly<Record<string, string | undefined>> | undefined;
  /**
   * Emits `data-tool-id` for this row. Set only where the section means
   * "installed tool", which is Your Tools alone.
   */
  readonly installed?: boolean | undefined;
}

function valueCell({ produced, unit, state }: LedgerValue): JSX.Element {
  if (produced !== undefined && produced !== "") {
    return (
      <>
        <span class={styles.value + " " + styles.valueProduced} data-gutter-value="produced">{produced}</span>
        {unit !== undefined && unit !== "" && <span class={styles.valueUnit}>{unit}</span>}
      </>
    );
  }
  return <span class={styles.value + " " + styles.valueState} data-gutter-value="state">{state ?? "—"}</span>;
}

export function LedgerRow({ rowId, title, task, detail, value, actions, dataset, installed }: LedgerRowProps): JSX.Element {
  return (
    <li class={styles.row} data-row-id={rowId} data-gutter {...(installed === true ? { "data-tool-id": rowId } : {})} {...dataset}>
      <div class={styles.identity}>
        <strong>{title}</strong>
        {task !== undefined && task !== "" && <span class={styles.task}>{task}</span>}
        {detail}
        {actions !== undefined && <div class={styles.rowActions}>{actions}</div>}
      </div>
      <div class={styles.valueCell}>{valueCell(value)}</div>
    </li>
  );
}
