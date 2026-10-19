import { useRef, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { recordCompletedTool } from "../../workbench/completed-tool";
import { EMAIL_MAX_BYTES, type MailAttachment, type MailPreview } from "../../tools/eml-msg-viewer/module";
import { InlineError, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

function save(data: Uint8Array | string, filename: string): void {
  const blob = new Blob([data instanceof Uint8Array ? new Uint8Array(data).buffer : data],
    { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function EmlMsgViewerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MailPreview | null>(null);
  const [raw, setRaw] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  async function openEmail() {
    if (!file) { setError("Seleziona un file EML o MSG."); return; }
    if (file.size === 0 || file.size > EMAIL_MAX_BYTES) { setError("File vuoto o oltre 12 MiB."); return; }
    const current = ++request.current;
    setBusy(true); setPreview(null); setRaw(null); setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await toolRuntime.run("eml-msg-viewer", { filename: file.name, bytes }, {});
      if (request.current !== current) return;
      if (!result.ok) throw new Error(result.message);
      const value = result.value as MailPreview;
      if (!value || !Array.isArray(value.attachments) || !["EML", "MSG"].includes(value.format)) throw new Error("EMAIL_RESULT_INVALID");
      setPreview(value); setRaw(bytes);
      recordCompletedTool("eml-msg-viewer");
    } catch (cause) {
      if (request.current === current) setError("File non valido o non supportato: " + (cause instanceof Error ? cause.message : "errore"));
    } finally {
      if (request.current === current) setBusy(false);
    }
  }
  function reset() { ++request.current; setFile(null); setRaw(null); setPreview(null); setError(""); setBusy(false); }
  function attachmentRow(item: MailAttachment, index: number) {
    return <li key={index}><strong>{item.name}</strong> ({item.size} byte)
      {item.blocked || item.bytes === null
        ? <span> — Non esportabile: {item.reason}</span>
        : <button type="button" onClick={() => { if (item.bytes) save(item.bytes, item.name + ".download"); }}>Scarica come file inattivo</button>}
    </li>;
  }
  return <ToolSurface gutter={<ToolGutter label="Email locale" state={preview ? "success" : "idle"}
    placeholder="Seleziona un file EML o MSG; i dati restano nel browser."
    {...(preview ? { value: preview.format, entries: [{ label: "Allegati", value: String(preview.attachments.length) }, { label: "Rete", value: "vietata" }] } : { entries: [] })} />}>
    <p>I messaggi HTML sono presentati come testo letterale, senza caricare script, immagini remote o pixel di tracciamento. Gli allegati esportabili hanno estensione .download.</p>
    <form onSubmit={(event) => { event.preventDefault(); void openEmail(); }}>
      <label class="field"><span>File email (.eml / .msg)</span>
        <input type="file" accept=".eml,.msg,message/rfc822,application/vnd.ms-outlook" aria-label="File EML o MSG"
          onChange={(event) => { ++request.current; setFile(event.currentTarget.files?.[0] ?? null); setPreview(null); setRaw(null); setError(""); setBusy(false); }} />
      </label>
      <InlineError message={error || null} />
      <ToolActions>
        <button type="submit" class="button primary" disabled={busy}>{busy ? "Lettura…" : "Apri email"}</button>
        <button type="button" onClick={reset}>Azzera</button>
      </ToolActions>
    </form>
    {preview && <section aria-live="polite" data-email-preview>
      <dl><dt>Oggetto</dt><dd>{preview.subject || "—"}</dd>
        <dt>Da</dt><dd>{preview.from || "—"}</dd>
        <dt>A</dt><dd>{preview.to || "—"}</dd>
        <dt>Data</dt><dd>{preview.date || "—"}</dd></dl>
      <h3>Contenuto (solo testo)</h3>
      <pre class="schema-preview" data-email-body>{preview.body || "(nessun testo)"}</pre>
      <h3>Allegati ({preview.attachments.length})</h3>
      <ul>{preview.attachments.map(attachmentRow)}</ul>
      <ToolActions>
        <button type="button" onClick={() => save(preview.body, "email-testo.txt")}>Scarica testo</button>
        {raw && <button type="button" onClick={() => save(raw, "email-originale." + preview.format.toLowerCase() + ".download")}>Scarica sorgente inattivo</button>}
      </ToolActions>
      {preview.notices.map((notice) => <ResultProvenance key={notice}>{notice}</ResultProvenance>)}
    </section>}
  </ToolSurface>;
}
