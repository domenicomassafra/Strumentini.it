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
  async function preview(event: Event) { event.preventDefault(); setMessage(""); try { const run = await toolRuntime.run("campaign-name", { preset: currentPreset(), values }); if (!run.ok) throw new Error(run.message); setResult(run.value as CampaignNameOutput); } catch { setResult(null); setMessage("Use valid field names and provide a value for every selected field."); } }
  async function savePreset() { try { const next = currentPreset(); await createIndexedDbPersistence().put(PRESET_KEY, next); setPreset(next); setMessage("Preset saved. Current task values were not saved."); } catch { setMessage("Preset could not be saved in this browser."); } }
  const overridden = loaded && (order !== preset.fields.join(",") || separator !== preset.separator || lowercase !== preset.lowercase);
  return <form class="tool-operation single-column" onSubmit={preview}>
    <div class="tool-form-card">
      <p class="preset-provenance">{loaded ? (overridden ? "Current task override — saved preset unchanged" : "From saved preset") : "Loading saved preset…"}</p>
      <label class="field"><span>Field order</span><input aria-label="Field order" value={order} onInput={(e) => setOrder(e.currentTarget.value)} /><small>Allowed: client, channel, campaign, market, date</small></label>
      <div class="field-grid"><label class="field"><span>Separator</span><select aria-label="Separator" value={separator} onChange={(e) => setSeparator(e.currentTarget.value as CampaignNamingPreset["separator"])}><option value="-">-</option><option value="_">_</option><option value=".">.</option></select></label><label class="field checkbox-field"><span>Letter case</span><span><input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.currentTarget.checked)} /> lowercase</span></label></div>
      {CAMPAIGN_FIELDS.map((field) => <label class="field" key={field}><span>{field}</span><input aria-label={field} value={values[field]} onInput={(e) => setValues({ ...values, [field]: e.currentTarget.value })} /></label>)}
      {message && <p role="status">{message}</p>}
      <div class="actions"><button class="primary" type="submit">Preview name</button><button type="button" onClick={savePreset}>Save preset</button></div>
    </div>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Preview</p>{result ? <strong class="gutter-value">{result.name}</strong> : <p class="result-placeholder">Your campaign name appears here.</p>}</section>
  </form>;
}
