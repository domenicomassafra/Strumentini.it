import type { BoundedTablePreview, BoundedTextPreview } from "../../../runtime/bounded-preview";

function summary(shown: number, total: number, unit: "lines" | "rows", truncated: boolean): string {
  const noun = unit === "lines" ? "righe" : "righe tabella";
  return truncated
    ? `Anteprima: ${shown} di ${total} ${noun}. Il file completo resta disponibile nelle azioni del risultato.`
    : `Anteprima completa: ${shown} ${noun}.`;
}

export function BoundedTextResultPreview({ preview }: { readonly preview: BoundedTextPreview }) {
  return (
    <section class="bounded-result-preview" aria-label="Anteprima del risultato">
      <p class="file-note" role="status">{summary(preview.shown, preview.total, preview.unit, preview.truncated)}</p>
      <pre class={preview.kind === "code" ? "result-code" : "result-json"} tabIndex={0}>{preview.text}</pre>
    </section>
  );
}

export function BoundedTableResultPreview({ preview }: { readonly preview: BoundedTablePreview }) {
  return (
    <section class="bounded-result-preview" aria-label="Anteprima tabella">
      <p class="file-note" role="status">{summary(preview.shown, preview.total, preview.unit, preview.truncated)}</p>
      <div class="table-output" role="region" aria-label="Righe mostrate" tabIndex={0}>
        <table>
          <thead><tr>{preview.headers.map((header, index) => <th key={index} scope="col">{header}</th>)}</tr></thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {preview.headers.map((_header, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
