import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../workbench/completed-tool";
import { CAMPAIGN_FIELDS, parseCampaignFieldOrder, type CampaignNamingPreset } from "../../engines/campaign-url";
import { createIndexedDbPersistence } from "../../persistence/persistence";
import { createBoundedTextPreview } from "../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { campaignNameManifest } from "../../tools/campaign-name/manifest";
import type { CampaignNameOutput } from "../../tools/campaign-name/types";
import {
  BoundedTextResultPreview,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ToolResultPanel,
} from "./shared";

const PRESET_KEY = "campaign-name/preset:v1";
const DEFAULT_PRESET: CampaignNamingPreset = { fields: ["client", "channel", "campaign"], separator: "-", lowercase: true };

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CampaignNameTool() {
  const [preset, setPreset] = useState<CampaignNamingPreset>(DEFAULT_PRESET);
  const [loaded, setLoaded] = useState(false);
  const [order, setOrder] = useState(DEFAULT_PRESET.fields.join(","));
  const [separator, setSeparator] = useState<CampaignNamingPreset["separator"]>("-");
  const [lowercase, setLowercase] = useState(true);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(CAMPAIGN_FIELDS.map((field) => [field, ""])));
  const [result, setResult] = useState<CampaignNameOutput | null>(null);
  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const persistence = createIndexedDbPersistence();
    void persistence.get<CampaignNamingPreset>(PRESET_KEY).then((stored) => {
      if (stored) {
        setPreset(stored);
        setOrder(stored.fields.join(","));
        setSeparator(stored.separator);
        setLowercase(stored.lowercase);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  function currentPreset(): CampaignNamingPreset {
    return { fields: parseCampaignFieldOrder(order), separator, lowercase };
  }

  async function preview(event: Event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const current = revision.current;
    setMessage("");
    setActionStatus("");
    setResult(null);
    try {
      const run = await toolRuntime.run("campaign-name", { preset: currentPreset(), values });
      if (current !== revision.current) return;
      if (!run.ok) throw new Error(run.message);
      setResult(run.value as CampaignNameOutput);
      recordCompletedTool(campaignNameManifest.id);
    } catch {
      if (current === revision.current) setMessage("Usa nomi di campo validi e inserisci un valore per ogni campo selezionato.");
    } finally { pending.current = false; }
  }

  async function savePreset() {
    try {
      const next = currentPreset();
      await createIndexedDbPersistence().put(PRESET_KEY, next);
      setPreset(next);
      setMessage("Impostazione salvata. I valori di questa attività non sono stati memorizzati.");
    } catch {
      setMessage("Non è stato possibile salvare l'impostazione in questo browser.");
    }
  }

  function resetTask() {
    revision.current += 1;
    setValues(Object.fromEntries(CAMPAIGN_FIELDS.map((field) => [field, ""])));
    setResult(null);
    setMessage("");
    setActionStatus("");
  }

  const overridden = loaded && (order !== preset.fields.join(",") || separator !== preset.separator || lowercase !== preset.lowercase);
  const text = result?.name ?? "";
  const artifact = result === null ? null : createOutputArtifactDescriptor({
    kind: "text",
    name: "campaign-name.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode(text),
    verification: { state: "verified", verifiedMime: "text/plain", method: "local campaign-name serializer" },
    fidelity: "lossless",
    fidelityNote: "Il file contiene esattamente il nome campagna mostrato nel risultato.",
  });
  const previewResult = artifact === null ? null : createBoundedTextPreview(artifact, 8, "code");
  const actions = artifact === null ? [] : resolveResultActions({
    declaration: campaignNameManifest.result,
    primary: "copy",
    hasCopyPayload: text !== "",
    artifact,
    reuseReady: true,
    resetReady: true,
  });

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(text);
    setActionStatus("Nome campagna copiato.");
  }

  function reuseResult() {
    if (result === null) return;
    revision.current += 1;
    setValues((current) => ({ ...current, campaign: result.name }));
    setResult(null);
    setActionStatus("Il nome generato è stato riusato nel campo Campagna.");
  }

  return (
    <form class="tool-operation single-column" onSubmit={preview}>
      <div class="tool-form-card">
        <p class="preset-provenance">{loaded ? (overridden ? "Valore specifico per questa attività — impostazione salvata invariata" : "Dall'impostazione salvata") : "Caricamento dell'impostazione salvata…"}</p>
        <label class="field"><span>Ordine dei campi</span><input aria-label="Ordine dei campi" value={order} onInput={(e) => { revision.current += 1; setOrder(e.currentTarget.value); setResult(null); }} /><small>Valori ammessi: client, channel, campaign, market, date. Sono identificatori tecnici del modello.</small></label>
        <div class="field-grid"><label class="field"><span>Separatore</span><select aria-label="Separatore" value={separator} onChange={(e) => { revision.current += 1; setSeparator(e.currentTarget.value as CampaignNamingPreset["separator"]); setResult(null); }}><option value="-">-</option><option value="_">_</option><option value=".">.</option></select></label><label class="field checkbox-field"><span>Maiuscole e minuscole</span><span><input type="checkbox" checked={lowercase} onChange={(e) => { revision.current += 1; setLowercase(e.currentTarget.checked); setResult(null); }} /> tutto minuscolo</span></label></div>
        {CAMPAIGN_FIELDS.map((field) => <label class="field" key={field}><span>{{ client: "Cliente", channel: "Canale", campaign: "Campagna", market: "Mercato", date: "Data" }[field] ?? field}</span><input aria-label={field} value={values[field]} onInput={(e) => { revision.current += 1; setValues({ ...values, [field]: e.currentTarget.value }); setResult(null); }} /></label>)}
        {message && <p role="status">{message}</p>}
        <div class="actions"><button class="primary" type="submit">Mostra anteprima</button><button type="button" onClick={savePreset}>Salva impostazione</button></div>
      </div>
      <ToolResultPanel eyebrow="Anteprima" placeholder="Il nome della campagna apparirà qui." state={result === null ? "idle" : "success"}>
        {result !== null && previewResult !== null && artifact !== null && (
          <div data-result-class="text-code">
            <ResultInterpretation state="success">Nome generato applicando ordine, separatore e regola maiuscole/minuscole correnti.</ResultInterpretation>
            <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={previewResult} /></div>
            <div data-result-slot="counts"><ResultBreakdown label="Conteggi" rows={[{ label: "Caratteri", value: String([...text].length) }, { label: "Byte", value: String(artifact.byteLength) }]} /></div>
            <ResultActions actions={actions} onAction={{ copy: copyResult, download: () => downloadText(artifact.download.filename, text), reuse: reuseResult, reset: resetTask }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </form>
  );
}
