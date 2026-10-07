import type { ComponentChildren } from "preact";
import type { FileResultItem, FileResultWorkspaceModel } from "../../../runtime/file-result";

const STATUS_LABEL: Readonly<Record<FileResultItem["status"], string>> = {
  queued: "In coda",
  running: "In elaborazione",
  success: "Completato",
  warning: "Completato con avviso",
  partial: "Parziale",
  error: "Errore",
  cancelled: "Annullato",
};

export interface FileResultRowProps {
  readonly item: FileResultItem;
  readonly actions?: ComponentChildren;
}

export function FileResultRow({ item, actions }: FileResultRowProps) {
  const outputBytes = item.artifact?.byteLength ?? item.afterBytes;
  const verifiedType = item.artifact?.verification.verifiedMime ?? item.source.detectedMime ?? "Tipo non verificato";
  return (
    <li data-state={item.status}>
      <strong class="long-result">{item.source.name}</strong>
      <p class="file-note">{STATUS_LABEL[item.status]}</p>
      {item.progress === undefined ? null : (
        <progress value={item.progress} max={1} aria-label={`Avanzamento ${item.source.name}`} />
      )}
      <dl class="gutter-rows">
        <div><dt>Tipo</dt><dd>{verifiedType}</dd></div>
        <div><dt>Dimensione iniziale</dt><dd>{item.beforeBytes ?? item.source.byteLength} byte</dd></div>
        {outputBytes === undefined ? null : <div><dt>Dimensione risultato</dt><dd>{outputBytes} byte</dd></div>}
      </dl>
      {item.message === undefined ? null : <p class="gutter-note" data-state={item.status === "error" ? "error" : "info"}>{item.message}</p>}
      {actions === undefined ? null : <div class="actions">{actions}</div>}
    </li>
  );
}

export interface FileResultWorkspaceProps {
  readonly workspace: FileResultWorkspaceModel;
  readonly actionsFor?: (item: FileResultItem) => ComponentChildren;
}

export function FileResultWorkspace({ workspace, actionsFor }: FileResultWorkspaceProps) {
  return (
    <section aria-label="File elaborati">
      <p class="file-note">{workspace.privacyCopy}</p>
      <ul class="status-list">
        {workspace.items.map((item) => (
          <FileResultRow key={item.id} item={item} actions={actionsFor?.(item)} />
        ))}
      </ul>
    </section>
  );
}
