import { useState } from "preact/hooks";
import { adjacentPdfPageId, movePdfPageId } from "../../../engines/pdf/page-order-controls";

export function PdfVisualOrder({ order, onChange, undo, canUndo }: {
  readonly order: readonly number[];
  readonly onChange: (next: readonly number[]) => void;
  readonly undo: () => void;
  readonly canUndo: boolean;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  if (order.length === 0) return null;
  return (
    <section aria-label="Organizzatore visuale delle pagine" data-pdf-visual-order>
      <p class="file-note">Sposta una pagina con i pulsanti (anche da tastiera) oppure trascinala su un'altra posizione. Ogni numero mantiene l'identità della pagina PDF originale. La modifica del documento avviene solo premendo il pulsante principale.</p>
      <button type="button" disabled={!canUndo} onClick={undo}>Annulla ultimo spostamento</button>
      <ol class="status-list">
        {order.map((page, index) => (
          <li key={page} draggable
            onDragStart={(event) => { setDragged(page); event.dataTransfer?.setData("text/plain", String(page)); }}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const source = dragged;
              setDragged(null);
              if (source === null || !order.includes(source)) return;
              onChange(movePdfPageId(order, source, page));
            }}
          >
            <strong>Posizione {index + 1}: pagina originale {page}</strong>
            <div class="actions">
              <button type="button" aria-label={`Sposta pagina ${page} in alto`} disabled={index === 0} onClick={() => onChange(adjacentPdfPageId(order, page, -1))}>Su</button>
              <button type="button" aria-label={`Sposta pagina ${page} in basso`} disabled={index === order.length - 1} onClick={() => onChange(adjacentPdfPageId(order, page, 1))}>Giù</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
