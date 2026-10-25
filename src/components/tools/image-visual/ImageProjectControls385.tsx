import { useEffect, useState } from "preact/hooks";
import { createIndexedDbPersistence } from "../../../persistence/persistence";
import {
  listImageSnapshots475,
  loadImageSnapshot475,
  openLegacyImage475,
  saveImageSnapshot475,
  type ImageSnapshotOpen475,
  type ImageSnapshotReference475,
} from "../../../engines/image/editor-project-475";
import {
  ImageProjectError385,
  listImageProjects385,
  openImageProject385,
} from "../../../engines/image/project-storage-385";
import type { ImageProjectHistory385 } from "../../../engines/image/project-history-385";
import type { PixelFrame } from "../../../engines/image/transform-workspace";

interface Props {
  file: File | null;
  source: PixelFrame | null;
  history: ImageProjectHistory385 | null;
  previous: ImageSnapshotReference475 | null;
  editable: boolean;
  onSaved: (saved: ImageSnapshotReference475) => void;
  onOpen: (project: ImageSnapshotOpen475) => Promise<void>;
}

interface ProjectChoice {
  readonly key: string;
  readonly label: string;
}

const storage = createIndexedDbPersistence({ databaseName: "strumentini-editor-projects-412", storeName: "state" });
const messages: Record<ImageProjectError385["code"], string> = {
  INVALID_PROJECT: "Progetto non valido o troppo grande: nessun dato è stato salvato.",
  UNSUPPORTED_SCHEMA: "Progetto vecchio o danneggiato: i dati esistenti sono stati preservati.",
  STORAGE_UNAVAILABLE: "Archivio locale non disponibile: il progetto originale resta intatto.",
  STORAGE_FULL: "Spazio locale esaurito: il progetto originale resta intatto.",
  PROJECT_CHANGED: "Il progetto è stato modificato in un'altra scheda: riaprilo prima di salvare.",
  PROJECT_NOT_FOUND: "Progetto non trovato: nessun documento è stato sostituito.",
};

export function ImageProjectControls385({ file, source, history, previous, editable, onSaved, onOpen }: Props) {
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<ProjectChoice[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function report(error: unknown) {
    setMessage(error instanceof ImageProjectError385
      ? messages[error.code]
      : "Progetto non valido o archivio non disponibile: gli originali e i salvataggi precedenti sono invariati.");
  }

  async function refresh() {
    try {
      const current = await listImageSnapshots475(storage);
      let legacy: Awaited<ReturnType<typeof listImageProjects385>> = [];
      let unreadableLegacy = false;
      try { legacy = await listImageProjects385(); }
      catch { unreadableLegacy = true; }
      setEntries([
        ...current.items.map((item) => ({ key: `v2:${item.id}`, label: `${item.name} · v2` })),
        ...legacy.map((item) => ({ key: `v1:${item.id}`, label: `${item.name} · v1 rev. ${item.revision}` })),
      ]);
      if (current.unreadableCount > 0 || unreadableLegacy) {
        setMessage("Alcuni progetti hanno uno schema sconosciuto o file mancanti; le copie sono state conservate.");
      }
    } catch (error) { report(error); }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setName(previous?.name ?? file?.name.replace(/\.[^.]+$/, "") ?? ""); }, [file, previous?.id]);

  async function save(): Promise<void> {
    if (!file || !source || !history || !editable || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveImageSnapshot475(storage, {
        name, original: file, width: source.width, height: source.height, history,
      });
      onSaved(saved);
      setChosen(`v2:${saved.id}`);
      setMessage("Nuova copia v2 salvata con originale e cronologia undo/redo, su tua richiesta.");
      await refresh();
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function open(): Promise<void> {
    if (!chosen || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const id = chosen.slice(3);
      const project = chosen.startsWith("v2:")
        ? await loadImageSnapshot475(storage, id)
        : chosen.startsWith("v1:")
          ? openLegacyImage475(await openImageProject385(id))
          : null;
      if (!project) throw new Error("IMAGE_PROJECT_475_NOT_FOUND");
      await onOpen(project);
      setMessage("Progetto riaperto con file originale e cronologia delle modifiche.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  return <fieldset class="field" data-image-project-385 data-image-project-412>
    <legend>Progetti immagine locali</legend>
    <p class="file-note">Il salvataggio v2 è facoltativo: ogni clic crea una nuova copia con file originale e undo/redo, senza modificare i progetti v1 né caricare file in rete. Il PNG esportato resta appiattito.</p>
    {file && <label class="field"><span>Nome progetto</span><input aria-label="Nome progetto immagine" value={name} maxLength={120} onInput={(event) => setName(event.currentTarget.value)} /></label>}
    <div class="actions">
      <button type="button" disabled={!editable || !history || !file || busy} onClick={() => void save()}>Salva progetto su questo dispositivo</button>
    </div>
    {!editable && file && <p class="file-note">La prospettiva resta esportabile come PNG; non è ancora nel formato progetto.</p>}
    <label class="field"><span>Riapri progetto salvato</span>
      <select aria-label="Progetto immagine salvato" value={chosen} onChange={(event) => setChosen(event.currentTarget.value)} disabled={busy}>
        <option value="">Seleziona un progetto…</option>
        {entries.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
      </select>
    </label>
    <div class="actions"><button type="button" disabled={!chosen || busy} onClick={() => void open()}>Riapri progetto</button></div>
    {message && <p class="file-note" role="status" data-project-message>{message}</p>}
  </fieldset>;
}
