import { useEffect, useState } from "preact/hooks";
import {
  ImageProjectError385,
  listImageProjects385,
  openImageProject385,
  saveImageProject385,
  type ImageProjectOpen385,
  type ImageProjectReference385,
} from "../../../engines/image/project-storage-385";
import type { ImageProjectHistory385 } from "../../../engines/image/project-history-385";
import type { PixelFrame } from "../../../engines/image/transform-workspace";

interface Props {
  file: File | null;
  source: PixelFrame | null;
  history: ImageProjectHistory385 | null;
  previous: ImageProjectReference385 | null;
  editable: boolean;
  onSaved: (saved: ImageProjectReference385) => void;
  onOpen: (project: ImageProjectOpen385) => Promise<void>;
}

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
  const [entries, setEntries] = useState<ImageProjectReference385[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function report(error: unknown) {
    setMessage(error instanceof ImageProjectError385 ? messages[error.code] : "Impossibile riaprire il progetto: l'originale è invariato.");
  }

  async function refresh() {
    try { setEntries(await listImageProjects385()); }
    catch (error) { report(error); }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setName(previous?.name ?? file?.name.replace(/\.[^.]+$/, "") ?? ""); }, [file, previous?.id]);

  async function save(): Promise<void> {
    if (!file || !source || !history || !editable || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveImageProject385({
        name, original: file, width: source.width, height: source.height,
        transform: history.current, ...(previous ? { previous } : {}),
      });
      onSaved(saved);
      setChosen(saved.id);
      setMessage("Progetto salvato su questo dispositivo, dopo la tua richiesta esplicita.");
      await refresh();
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function open(): Promise<void> {
    if (!chosen || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const project = await openImageProject385(chosen);
      await onOpen(project);
      setMessage("Progetto riaperto con file originale e trasformazioni salvate.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  return <fieldset class="field" data-image-project-385>
    <legend>Progetti immagine locali</legend>
    <p class="file-note">Il salvataggio è facoltativo e avviene solo premendo il pulsante. Il file originale viene conservato separato dallo stato delle modifiche, senza upload. Il PNG esportato è appiattito.</p>
    {file && <label class="field"><span>Nome progetto</span><input aria-label="Nome progetto immagine" value={name} maxLength={120} onInput={(event) => setName(event.currentTarget.value)} /></label>}
    <div class="actions">
      <button type="button" disabled={!editable || !history || !file || busy} onClick={() => void save()}>Salva progetto su questo dispositivo</button>
    </div>
    {!editable && file && <p class="file-note">Il progetto salvato conserva le modifiche di ritaglio, colore e redazione. La prospettiva resta esportabile come PNG; non è ancora nel formato progetto.</p>}
    <label class="field"><span>Riapri progetto salvato</span>
      <select aria-label="Progetto immagine salvato" value={chosen} onChange={(event) => setChosen(event.currentTarget.value)} disabled={busy}>
        <option value="">Seleziona un progetto…</option>
        {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · rev. {entry.revision}</option>)}
      </select>
    </label>
    <div class="actions"><button type="button" disabled={!chosen || busy} onClick={() => void open()}>Riapri progetto</button></div>
    {message && <p class="file-note" role="status" data-project-message>{message}</p>}
  </fieldset>;
}
