import { useEffect, useRef, useState } from "preact/hooks";
import fontDataUri from "../../../engines/pdf/assets/noto-sans-latin-400-regular.ttf?inline";
import type { PdfEditableForm136, PdfFormValue136 } from "../../../engines/pdf/form-edit-136";
import { recordCompletedTool } from "../../../workbench/completed-tool";

const MAX_SOURCE = 8 * 1024 * 1024;

export function PdfFormEditor136Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<PdfEditableForm136 | null>(null);
  const [values, setValues] = useState<Record<string, PdfFormValue136>>({});
  const [flatten, setFlatten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadSize, setDownloadSize] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const unicodeFont = useRef<Uint8Array | null>(null);
  function localFontBytes() {
    if (unicodeFont.current) return unicodeFont.current;
    if (!fontDataUri.startsWith("data:") || !fontDataUri.includes(";base64,")) {
      throw new Error("Font Unicode locale non incorporato nel bundle");
    }
    const encoded = fontDataUri.split(",", 2)[1] ?? "";
    if (encoded.length > 100_000) throw new Error("Font locale eccede il limite");
    unicodeFont.current = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return unicodeFont.current;
  }

  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  function discardResult() { setDownloadUrl(""); setDownloadSize(0); }
  function cancel() {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    setBusy(false);
    discardResult();
    setError("Elaborazione annullata. Il documento originale è intatto.");
  }
  async function load(next: File | null) {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    const ticket = generation.current;
    setFile(next); setInfo(null); setValues({}); setBusy(false); setFlatten(false);
    discardResult(); setError("");
    if (!next) return;
    if (next.size > MAX_SOURCE) { setError("PDF oltre 8 MiB: scegli un documento più piccolo."); return; }
    const active = new AbortController(); controller.current = active;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await next.arrayBuffer());
      if (ticket !== generation.current || active.signal.aborted) return;
      const { inspectEditablePdfForm136 } = await import("../../../engines/pdf/form-edit-136");
      const parsed = await inspectEditablePdfForm136(bytes, active.signal);
      if (ticket !== generation.current || active.signal.aborted) return;
      setInfo(parsed);
      setValues(Object.fromEntries(parsed.fields.map((field) => [field.name, field.value])));
    } catch (cause) {
      if (ticket === generation.current && !active.signal.aborted) setError(cause instanceof Error ? cause.message : "PDF non leggibile");
    } finally {
      if (ticket === generation.current) { controller.current = null; setBusy(false); }
    }
  }
  function update(name: string, value: PdfFormValue136) {
    setValues((current) => ({ ...current, [name]: value }));
    discardResult(); setError("");
  }
  async function save(event: Event) {
    event.preventDefault();
    if (!file || !info || controller.current) return;
    const active = new AbortController(); controller.current = active;
    const ticket = ++generation.current;
    setBusy(true); discardResult(); setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const font = localFontBytes();
      if (active.signal.aborted || ticket !== generation.current) return;
      const { editPdfForm136 } = await import("../../../engines/pdf/form-edit-136");
      const changed: Record<string, PdfFormValue136> = {};
      for (const field of info.fields) {
        if (field.readOnly) continue;
        const value = values[field.name];
        if (value === undefined) throw new Error(`Valore mancante per il campo ${field.name}`);
        if (value !== field.value) changed[field.name] = value;
      }
      if (Object.keys(changed).length === 0) throw new Error("Modifica almeno un campo prima di esportare.");
      const output = await editPdfForm136(bytes, changed, font, { flatten, signal: active.signal });
      if (active.signal.aborted || ticket !== generation.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(output.bytes).buffer], { type: "application/pdf" }));
      setDownloadSize(output.bytes.byteLength);
      setDownloadUrl(url);
      recordCompletedTool("pdf-form-inspector");
    } catch (cause) {
      if (ticket === generation.current && !active.signal.aborted) setError(cause instanceof Error ? cause.message : "Esportazione rifiutata");
    } finally {
      if (ticket === generation.current) { controller.current = null; setBusy(false); }
    }
  }

  return <form class="tool-operation" data-pdf-form-editor-136 onSubmit={(event) => void save(event)}>
    <section class="tool-form-card">
      <p class="file-note">Compila un modulo PDF interattivo senza caricarlo online. Salva una copia con i campi ancora modificabili oppure scegli di appiattirli.</p>
      <label class="field"><span>Modulo PDF locale</span>
        <input type="file" aria-label="Modulo PDF da compilare" accept=".pdf,application/pdf"
          onChange={(event) => void load(event.currentTarget.files?.[0] ?? null)} />
        <small>Fino a 8 MiB, 80 pagine e 120 campi. File e dati restano sul dispositivo.</small>
      </label>
      {file && <p role="status">{file.name} · {(file.size / 1024).toFixed(0)} KiB{info ? ` · ${info.fields.length} campi, ${info.pageCount} pagine` : ""}</p>}
      {info && <div data-form-fields-136>
        <h3>Campi da compilare</h3>
        {info.fields.map((field) => <label class="field" key={field.name}>
          <span>{field.name}{field.readOnly ? " · sola lettura" : ""}</span>
          {field.kind === "checkbox" ?
            <input type="checkbox" checked={values[field.name] === true} disabled={busy || field.readOnly}
              onChange={(event) => update(field.name, event.currentTarget.checked)} /> :
            field.kind === "text" ?
              <input type="text" value={String(values[field.name] ?? "")} maxLength={1000} disabled={busy || field.readOnly}
                onInput={(event) => update(field.name, event.currentTarget.value)} /> :
              <select value={String(values[field.name] ?? "")} disabled={busy || field.readOnly}
                onChange={(event) => update(field.name, event.currentTarget.value)}>
                <option value="" disabled>Seleziona un valore</option>
                {field.options.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>}
        </label>)}
        <label class="field"><span><input type="checkbox" checked={flatten} disabled={busy}
          onChange={(event) => { setFlatten(event.currentTarget.checked); discardResult(); }} /> Appiattisci i campi nel PDF esportato</span>
          <small>Disattivato per impostazione predefinita. Se attivo, i campi diventano contenuto fisso e non saranno più modificabili.</small>
        </label>
        <div class="actions"><button type="submit" class="primary" disabled={busy}>Compila e verifica PDF</button>
          <button type="button" disabled={busy} onClick={() => void load(null)}>Ricomincia</button>
        </div>
      </div>}
      {busy && <div class="actions"><p role="status">Verifica locale del documento…</p><button type="button" onClick={cancel}>Annulla elaborazione</button></div>}
      {error && <p role="alert">{error} Il file originale non è stato modificato.</p>}
      {downloadUrl && <section class="result-panel" data-form-result-136 role="status">
        <p>PDF compilato e riaperto con due parser locali; {flatten ? "campi appiattiti" : "campi modificabili preservati"}.</p>
        <p>{(downloadSize / 1024).toFixed(0)} KiB · {info?.pageCount} pagine</p>
        <a href={downloadUrl} download={flatten ? "modulo-compilato-appiattito.pdf" : "modulo-compilato.pdf"}>Scarica PDF verificato</a>
      </section>}
    </section>
  </form>;
}
