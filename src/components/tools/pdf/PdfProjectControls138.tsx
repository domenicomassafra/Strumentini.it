import type { PdfProjectSummary138 } from "../../../workbench/pdf-project-138";

interface Props {
  projects: readonly PdfProjectSummary138[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  unreadableProjects: number;
  message: string;
  onResume: () => void;
  onDelete: () => void;
}

/** Presentation only. The workspace owns persistence, history and file lifetime. */
export function PdfProjectControls138({ projects, selectedId, onSelect, disabled,
  unreadableProjects, message, onResume, onDelete }: Props) {
  return <section aria-label="Progetti PDF locali" data-pdf-project-138>
    <p class="file-note">Progetti PDF salvati solo su questo dispositivo, su richiesta. Ogni salvataggio crea una copia, senza sovrascrivere progetti precedenti.</p>
    {projects.length > 0 && <div class="actions">
      <label class="field"><span>Progetto da riprendere</span>
        <select aria-label="Progetto da riprendere" value={selectedId} disabled={disabled}
          onChange={(event) => onSelect(event.currentTarget.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {new Date(project.createdAt).toLocaleString("it-IT")}</option>)}
        </select>
      </label>
      <button type="button" onClick={onResume} disabled={!selectedId || disabled}>Riprendi progetto</button>
      <button type="button" data-delete-pdf-project onClick={onDelete}
        disabled={!selectedId || disabled}>Elimina progetto selezionato</button>
    </div>}
    {unreadableProjects > 0 && <p role="status">Alcuni progetti non sono leggibili o superano i limiti: restano conservati senza modifiche.</p>}
    {message && <p role="status" data-pdf-project-message>{message}</p>}
  </section>;
}
