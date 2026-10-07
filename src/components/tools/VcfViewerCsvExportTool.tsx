import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { VCF_MAX_BYTES } from "../../tools/vcf-viewer-csv-export/limits";
import type { VCardParseResult } from "../../tools/vcf-viewer-csv-export/module";
import { InlineError, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isVCardParseResult(value: unknown): value is VCardParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<VCardParseResult>;
  return Array.isArray(candidate.contacts)
    && typeof candidate.csv === "string"
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every((warning) => typeof warning === "string");
}

export function VcfViewerCsvExportTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VCardParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function inspect() {
    if (file === null) { setError("Scegli un file .vcf prima di continuare."); return; }
    if (file.size > VCF_MAX_BYTES) { setError(`Il file supera il limite locale di ${Math.round(VCF_MAX_BYTES / 1024)} KiB.`); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const run = await toolRuntime.run("vcf-viewer-csv-export", { text: await file.text() }, {});
      if (!run.ok) throw new Error(run.message);
      if (!isVCardParseResult(run.value)) throw new Error("VCF_RUNTIME_RESULT_INVALID");
      setResult(run.value);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const message = code.startsWith("VCF_") ? `VCF non valido o non supportato (${code}).` : "Non riesco a leggere questo VCF.";
      setError(message);
    } finally { setBusy(false); }
  }

  function reset() { setFile(null); setResult(null); setError(null); }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Contatti letti"
          state={result === null ? "idle" : "success"}
          {...(result === null ? {} : { value: String(result.contacts.length) })}
          placeholder="Apri un VCF locale per vedere i contatti senza caricarlo online."
          entries={result === null ? [] : [
            { label: "CSV", value: `${new TextEncoder().encode(result.csv).length} byte` },
            { label: "Avvisi", value: String(result.warnings.length) },
            { label: "Rete", value: "vietata" },
          ]}
        />
      }
    >
      <p>Le righe piegate vengono ricomposte per il valore logico, mentre il sorgente originale resta visibile. Telefoni ed email ripetuti restano valori distinti.</p>
      <form onSubmit={(event) => { event.preventDefault(); void inspect(); }}>
        <label class="field">
          <span>File VCF / vCard</span>
          <input
            aria-label="File VCF"
            type="file"
            accept=".vcf,text/vcard,text/x-vcard"
            onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setResult(null); setError(null); }}
          />
          <small>Limite locale: {Math.round(VCF_MAX_BYTES / 1024)} KiB.</small>
        </label>
        <InlineError message={error} />
        <ToolActions>
          <button class="button primary" type="submit" disabled={busy}>{busy ? "Lettura…" : "Apri VCF"}</button>
          <button type="button" onClick={reset}>Azzera</button>
        </ToolActions>
      </form>
      {result !== null && (
        <section aria-live="polite">
          {result.warnings.map((warning) => <p class="file-note" key={warning}>{warning}</p>)}
          <div class="table-scroll">
            <table>
              <thead><tr><th scope="col">#</th><th scope="col">Nome</th><th scope="col">Telefoni</th><th scope="col">Email</th><th scope="col">Organizzazione</th></tr></thead>
              <tbody>
                {result.contacts.map((contact) => (
                  <tr key={contact.index}>
                    <td>{contact.index}</td>
                    <td>{contact.fullName || [contact.givenName, contact.familyName].filter(Boolean).join(" ") || "—"}</td>
                    <td>{contact.phones.length === 0 ? "—" : <ul>{contact.phones.map((item, index) => <li key={`${contact.index}-tel-${index}`}>{item.value}{item.types.length > 0 ? ` · ${item.types.join(", ")}` : ""}</li>)}</ul>}</td>
                    <td>{contact.emails.length === 0 ? "—" : <ul>{contact.emails.map((item, index) => <li key={`${contact.index}-mail-${index}`}>{item.value}{item.types.length > 0 ? ` · ${item.types.join(", ")}` : ""}</li>)}</ul>}</td>
                    <td>{contact.organizations.join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.contacts.map((contact) => (
            <details key={`raw-${contact.index}`}>
              <summary>Contatto {contact.index}: raw e proprietà non supportate ({contact.unsupported.length})</summary>
              {contact.unsupported.length > 0 && <ul>{contact.unsupported.map((property, index) => <li key={`${contact.index}-unsupported-${index}`}><code>{property.name}</code>: <code>{property.raw}</code></li>)}</ul>}
              <pre class="schema-preview">{contact.rawSource}</pre>
            </details>
          ))}
          <ToolActions><button type="button" onClick={() => downloadText(result.csv, "contatti-vcard.csv", "text/csv;charset=utf-8")}>Scarica CSV protetto</button></ToolActions>
          <ResultProvenance>Il CSV usa intestazioni fisse e antepone un apostrofo alle celle che potrebbero essere interpretate come formule da un foglio di calcolo.</ResultProvenance>
        </section>
      )}
    </ToolSurface>
  );
}
