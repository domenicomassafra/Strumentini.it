import type { ResultAction, ResultActionId } from "../../../runtime/result-actions";
import { useEffect, useState } from "preact/hooks";

export interface ShareableResultFile {
  readonly blob: Blob;
  readonly filename: string;
}

export interface ResultActionsProps {
  readonly actions: readonly ResultAction[];
  readonly onAction: Readonly<Partial<Record<ResultActionId, () => void | Promise<void>>>>;
  /** Only verified, ready-to-download files may be offered for native sharing. */
  readonly shareFile?: ShareableResultFile | undefined;
}

function NativeShareAction({ shareFile }: { readonly shareFile: ShareableResultFile }) {
  const [canShareFile, setCanShareFile] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    if (typeof navigator.share !== "function") {
      setCanShareFile(false);
      return;
    }
    try {
      const file = new File([shareFile.blob], shareFile.filename, { type: shareFile.blob.type });
      setCanShareFile(typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
    } catch {
      setCanShareFile(false);
    }
  }, [shareFile.blob, shareFile.filename]);

  async function share(): Promise<void> {
    if (!canShareFile) return;
    try {
      const file = new File([shareFile.blob], shareFile.filename, { type: shareFile.blob.type });
      await navigator.share({ files: [file], title: shareFile.filename });
      setShareStatus("Condivisione completata nel sistema del dispositivo.");
    } catch (error) {
      setShareStatus(error instanceof Error && error.name === "AbortError"
        ? "Condivisione annullata. Il file è ancora disponibile."
        : "Condivisione non riuscita. Scarica il risultato e allegalo manualmente.");
    }
  }

  return <>
    {canShareFile && <button type="button" data-result-action="share" onClick={() => void share()}>Condividi file</button>}
    {shareStatus !== "" && <p class="file-note" role="status">{shareStatus}</p>}
  </>;
}

export function ResultActions({ actions, onAction, shareFile }: ResultActionsProps) {
  if (actions.length === 0 && shareFile === undefined) return null;
  const actionButtons = actions.map((action) => {
    const handler = onAction[action.id];
    if (handler === undefined) return null;
    return (
      <button
        key={action.id}
        type="button"
        class={action.primary ? "primary" : undefined}
        aria-label={action.primary ? action.label + " — azione principale" : action.label}
        data-result-action={action.id}
        data-primary-action={action.primary ? "true" : "false"}
        onClick={() => void handler()}
      >
        {action.label}
      </button>
    );
  });
  return (
    <div class="actions" aria-label="Azioni sul risultato">
      {shareFile === undefined ? actionButtons : [...actionButtons, <NativeShareAction key="native-share" shareFile={shareFile} />]}
    </div>
  );
}
