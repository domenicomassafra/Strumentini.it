import { useEffect, useState } from "preact/hooks";
import type { PdfProjectHistory138 } from "../../../engines/pdf/project-history-138";
import {
  listPdfSnapshots412, loadPdfSnapshot412, migrateSavedPdfProject412,
  savePdfSnapshot412, type PdfSnapshotSummary412,
} from "../../../workbench/pdf-project-412";

interface Props {
  file: File | null;
  history: PdfProjectHistory138 | null;
  legacyProjectId: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onRestore: (file: File, history: PdfProjectHistory138) => void;
}

/** Versioned PDF snapshots own their controls and state, beside the existing v1 UI. */
export function PdfVersionedProjects412({ file, history, legacyProjectId, disabled,
  onBusyChange, onRestore }: Props) {
  const [projects, setProjects] = useState<readonly PdfSnapshotSummary412[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [unreadable, setUnreadable] = useState(0);
  const [message, setMessage] = useState("");

  async function refresh() {
    const list = await listPdfSnapshots412();
    setProjects(list.items);
    setUnreadable(list.unreadableCount);
    setSelectedId((previous) => list.items.some((item) => item.id === previous)
      ? previous : (list.items[0]?.id ?? ""));
  }
  useEffect(() => {
    void refresh().catch(() => setMessage("Archivio v2 non disponibile. Puoi continuare a modificare il PDF."));
  }, []);

  async function operation(action: () => Promise<{ id: string }>, success: string, failure: string) {
    if (disabled) return;
    onBusyChange(true);
    setMessage("");
    try {
      const project = await action();
      await refresh();
      setSelectedId(project.id);
      setMessage(success);
    } catch (reason) {
      setMessage(failure + (reason instanceof Error ? reason.message : "archivio non disponibile"));
    } finally { onBusyChange(false); }
  }
  async function resume() {
    if (disabled || !selectedId) return;
    onBusyChange(true);
    setMessage("");
    try {
      const saved = await loadPdfSnapshot412(selectedId);
      if (!saved) throw new Error("Progetto v2 non disponibile");
      onRestore(saved.file, saved.history);
      setMessage("Progetto v2 verificato e riaperto con cronologia e originale integri.");
    } catch (reason) {
      setMessage("Ripristino v2 rifiutato, documento corrente invariato: " +
        (reason instanceof Error ? reason.message : "progetto non valido"));
    } finally { onBusyChange(false); }
  }

  return <section aria-label="Progetti PDF versionati" data-pdf-project-412>
    <p class="file-note">Archivio locale v2 con verifica SHA-256. La migrazione da v1 crea una copia atomica e conserva il record precedente.</p>
    {projects.length > 0 && <div class="actions">
      <label class="field"><span>Progetto PDF versione 2</span>
        <select aria-label="Progetto PDF versione 2" value={selectedId} disabled={disabled}
          onChange={(event) => setSelectedId(event.currentTarget.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>
            {project.name} · {new Date(project.createdAt).toLocaleString("it-IT")}
          </option>)}
        </select>
      </label>
      <button type="button" data-restore-pdf-project-412 onClick={() => void resume()}
        disabled={disabled || !selectedId}>Riprendi progetto v2</button>
    </div>}
    <div class="actions">
      {legacyProjectId && <button type="button" data-migrate-pdf-project-412 disabled={disabled}
        onClick={() => void operation(() => migrateSavedPdfProject412(legacyProjectId),
          "Progetto v1 migrato a v2, record e PDF v1 conservati.",
          "Migrazione v1→v2 rifiutata, originali conservati: ")}>
        Migra progetto v1 selezionato a v2
      </button>}
      {file && history && <button type="button" data-save-pdf-project-412 disabled={disabled}
        onClick={() => void operation(() => savePdfSnapshot412(file, history),
          "Progetto PDF v2 salvato e verificato. Originale e altre versioni conservati.",
          "Salvataggio v2 rifiutato, dati conservati: ")}>
        Salva progetto PDF v2
      </button>}
    </div>
    {unreadable > 0 && <p role="status" data-pdf-project-412-unreadable>
      Alcuni progetti v2 non sono leggibili: rimangono conservati senza modifiche.
    </p>}
    {message && <p role="status" data-pdf-project-412-message>{message}</p>}
  </section>;
}
