import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { UtmBuilderOutput } from "../../tools/utm-builder/types";

export function UtmBuilderTool() {
  const [baseUrl, setBaseUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [result, setResult] = useState<UtmBuilderOutput | null>(null);
  const [error, setError] = useState("");
  async function submit(event: Event) {
    event.preventDefault(); setError(""); setResult(null);
    const run = await toolRuntime.run("utm-builder", { baseUrl, source, medium, campaign });
    if (!run.ok) { setError("Enter a valid http(s) URL and source, medium, and campaign values."); return; }
    setResult(run.value as UtmBuilderOutput);
  }
  return <form class="tool-operation single-column" onSubmit={submit}>
    <div class="tool-form-card">
      <label class="field"><span>Destination URL</span><input aria-label="Destination URL" value={baseUrl} onInput={(e) => setBaseUrl(e.currentTarget.value)} placeholder="https://example.com/landing?ref=site#details" /></label>
      <div class="field-grid">
        <label class="field"><span>Source</span><input aria-label="Source" value={source} onInput={(e) => setSource(e.currentTarget.value)} /></label>
        <label class="field"><span>Medium</span><input aria-label="Medium" value={medium} onInput={(e) => setMedium(e.currentTarget.value)} /></label>
      </div>
      <label class="field"><span>Campaign</span><input aria-label="Campaign" value={campaign} onInput={(e) => setCampaign(e.currentTarget.value)} /></label>
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary tool-submit" type="submit">Build URL</button>
    </div>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Result</p>{result ? <code class="long-result">{result.url}</code> : <p class="result-placeholder">Your campaign URL appears here.</p>}</section>
  </form>;
}
