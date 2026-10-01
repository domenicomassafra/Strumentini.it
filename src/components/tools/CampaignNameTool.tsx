import { useEffect, useState } from "preact/hooks";
import { createIndexedDbPersistence } from "../../persistence/persistence";
import { CAMPAIGN_FIELDS, parseCampaignFieldOrder, type CampaignNamingPreset } from "../../engines/campaign-url";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { CampaignNameOutput } from "../../tools/campaign-name/types";

const PRESET_KEY = "campaign-name/preset:v1";
const DEFAULT_PRESET: CampaignNamingPreset = { fields: ["client", "channel", "campaign"], separator: "-", lowercase: true };

export function CampaignNameTool() {
  const [preset, setPreset] = useState<CampaignNamingPreset>(DEFAULT_PRESET); const [loaded, setLoaded] = useState(false);
  const [order, setOrder] = useState(DEFAULT_PRESET.fields.join(",")); const [separator, setSeparator] = useState<CampaignNamingPreset["separator"]>("-"); const [lowercase, setLowercase] = useState(true);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(CAMPAIGN_FIELDS.map((field) => [field, ""]))); const [result, setResult] = useState<CampaignNameOutput | null>(null); const [message, setMessage] = useState("");
  useEffect(() => { const persistence = createIndexedDbPersistence(); void persistence.get<CampaignNamingPreset>(PRESET_KEY).then((stored) => { if (stored) { setPreset(stored); setOrder(stored.fields.join(",")); setSeparator(stored.separator); setLowercase(stored.lowercase); } setLoaded(true); }).catch(() => setLoaded(true)); }, []);
  function currentPreset(): CampaignNamingPreset { return { fields: parseCampaignFieldOrder(order), separator, lowercase }; }
  async function preview(event: Event) { event.preventDefault(); setMessage(""); try { const run = await toolRuntime.run("campaign-name", { preset: currentPreset(), values }); if (!run.ok) throw new Error(run.message); setResult(run.value as CampaignNameOutput); } catch { setResult(null); setMessage("Usa nomi di campo validi e inserisci un valore per ogni campo selezionato."); } }
  async function savePreset() { try { const next = currentPreset(); await createIndexedDbPersistence().put(PRESET_KEY, next); setPreset(next); setMessage("Impostazione salvata. I valori di questa attività non sono stati memorizzati."); } catch { setMessage("Non è stato possibile salvare l'impostazione in questo browser."); } }
  const overridden = loaded && (order !== preset.fields.join(",") || separator !== preset.separator || lowercase !== preset.lowercase);
  return <form class="tool-operation single-column" onSubmit={preview}>
    <div class="tool-form-card">
      <p class="preset-provenance">{loaded ? (overridden ? "Valore specifico per questa attività — impostazione salvata invariata" : "Dall'impostazione salvata") : "Caricamento dell'impostazione salvata…"}</p>
      <label class="field"><span>Ordine dei campi</span><input aria-label="Ordine dei campi" value={order} onInput={(e) => setOrder(e.currentTarget.value)} /><small>Valori ammessi: client, channel, campaign, market, date. Sono identificatori tecnici del modello.</small></label>
      <div class="field-grid"><label class="field"><span>Separatore</span><select aria-label="Separatore" value={separator} onChange={(e) => setSeparator(e.currentTarget.value as CampaignNamingPreset["separator"])}><option value="-">-</option><option value="_">_</option><option value=".">.</option></select></label><label class="field checkbox-field"><span>Maiuscole e minuscole</span><span><input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.currentTarget.checked)} /> tutto minuscolo</span></label></div>
      {CAMPAIGN_FIELDS.map((field) => <label class="field" key={field}><span>{{ client: "Cliente", channel: "Canale", campaign: "Campagna", market: "Mercato", date: "Data" }[field] ?? field}</span><input aria-label={field} value={values[field]} onInput={(e) => setValues({ ...values, [field]: e.currentTarget.value })} /></label>)}
      {message && <p role="status">{message}</p>}
      <div class="actions"><button class="primary" type="submit">Mostra anteprima</button><button type="button" onClick={savePreset}>Salva impostazione</button></div>
    </div>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Anteprima</p>{result ? <strong class="gutter-value">{result.name}</strong> : <p class="result-placeholder">Il nome della campagna apparirà qui.</p>}</section>
  </form>;
}
