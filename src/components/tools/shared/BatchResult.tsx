import type { BatchResultItem } from "../../../runtime/batch-result";
import { summarizeBatchResult } from "../../../runtime/batch-result";

const STATUS_LABEL: Readonly<Record<BatchResultItem["status"], string>> = {
  queued: "In coda",
  running: "In elaborazione",
  success: "Completato",
  error: "Errore",
  cancelled: "Annullato",
  unsupported: "Non supportato",
};

export function BatchResult({ items }: { readonly items: readonly BatchResultItem[] }) {
  const summary = summarizeBatchResult(items);
  return (
    <section aria-label="Risultati batch">
      <p class="gutter-note" role="status">
        {summary.successful} completati con successo · {summary.failed} falliti · {summary.cancelled} annullati · {summary.pending} in attesa
      </p>
      <ul class="status-list">
        {items.map((item) => (
          <li key={item.id} data-state={item.status}>
            <strong>{item.label}</strong>
            <span class="file-note"> — {STATUS_LABEL[item.status]}</span>
            {item.message === undefined ? null : <p class="file-note">{item.message}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
