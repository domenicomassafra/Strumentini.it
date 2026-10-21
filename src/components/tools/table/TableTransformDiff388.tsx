import Papa from "papaparse";

const PREVIEW_ROWS = 7;
const PREVIEW_CHARS = 64 * 1024;
const CELL_CHARS = 100;

/** Keep preview allocations bounded; the complete CSV stays untouched in the operation result. */
function shorten(value: string): string {
  let text = "";
  let count = 0;
  for (const char of value) {
    if (count === CELL_CHARS) return text + "…";
    text += char;
    count += 1;
  }
  return text;
}

interface PreviewRow {
  readonly cells: readonly string[];
  readonly display: string;
}

function previewRows(text: string, delimiter: string): PreviewRow[] {
  const excerpt = text.slice(0, PREVIEW_CHARS);
  const parsed = Papa.parse<string[]>(excerpt, {
    delimiter, preview: PREVIEW_ROWS, dynamicTyping: false, skipEmptyLines: false,
  });
  return parsed.data.slice(0, PREVIEW_ROWS).map(cells => ({
    cells,
    // Quote each cell so embedded separators, quotes and newlines remain distinct.
    display: cells.map(cell => JSON.stringify(shorten(cell))).join(" · "),
  }));
}

export interface TableDiff388 {
  readonly rows: readonly { readonly before: string; readonly after: string; readonly changed: boolean }[];
  readonly truncated: boolean;
  readonly changedPositions: number;
}

export function tableDiff388(source: string, output: string, delimiter: string): TableDiff388 {
  const before = previewRows(source, delimiter);
  const after = previewRows(output, delimiter);
  const rows = Array.from({ length: Math.max(before.length, after.length) }, (_, index) => {
    const left = before[index];
    const right = after[index];
    return {
      before: left?.display ?? "—",
      after: right?.display ?? "—",
      // Compare original cell values, before any preview-only shortening/joining.
      changed: left === undefined || right === undefined
        || left.cells.length !== right.cells.length
        || left.cells.some((cell, position) => cell !== right.cells[position]),
    };
  });
  return {
    rows,
    truncated: source.length > PREVIEW_CHARS || output.length > PREVIEW_CHARS
      || before.length === PREVIEW_ROWS || after.length === PREVIEW_ROWS,
    changedPositions: rows.filter(row => row.changed).length,
  };
}

/** Positional diff shows changed/reordered records; counts come from the engine, never this sample. */
export function TableTransformDiff388({
  source, output, delimiter, summary,
}: {
  readonly source: string;
  readonly output: string;
  readonly delimiter: string;
  readonly summary: string;
}) {
  const diff = tableDiff388(source, output, delimiter);
  return <section data-str388-diff aria-label="Confronto prima e dopo">
    <h3>Confronto prima / dopo</h3>
    <p class="file-note">{summary}. Le righe sono confrontate per posizione; quelle spostate dall'ordinamento non perdono il contenuto originale.</p>
    <div class="table-preview-scroll"><table class="table-preview">
      <caption>Anteprima delle prime {diff.rows.length} posizioni, sola lettura</caption>
      <thead><tr><th scope="col">Posizione</th><th scope="col">Prima</th><th scope="col">Dopo</th></tr></thead>
      <tbody>{diff.rows.map((row, index) => <tr key={index} data-str388-changed={row.changed ? "true" : "false"}>
        <th scope="row">{index === 0 ? "Intestazione" : String(index)}</th>
        <td><code>{row.before}</code></td><td><code>{row.after}</code></td>
      </tr>)}</tbody>
    </table></div>
    <p class="file-note">{diff.changedPositions} posizioni diverse nell'anteprima. {diff.truncated ? "Anteprima limitata: i dati completi restano disponibili per il download." : "Tutte le righe visualizzate."}</p>
  </section>;
}
