import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TrackingCleanerOutput } from "../../tools/tracking-cleaner/types";

export function TrackingCleanerTool() {
  const [url, setUrl] = useState(""); const [result, setResult] = useState<TrackingCleanerOutput | null>(null); const [error, setError] = useState("");
  async function submit(event: Event) { event.preventDefault(); setError(""); setResult(null); const run = await toolRuntime.run("tracking-cleaner", { url }); if (!run.ok) { setError("Enter a valid http(s) URL."); return; } setResult(run.value as TrackingCleanerOutput); }
  return <form class="tool-operation single-column" onSubmit={submit}>
    <div class="tool-form-card"><label class="field"><span>URL to clean</span><textarea aria-label="URL to clean" rows={4} value={url} onInput={(e) => setUrl(e.currentTarget.value)} /></label>{error && <p role="alert" class="error">{error}</p>}<button class="primary tool-submit" type="submit">Remove tracking parameters</button></div>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Result</p>{result ? <><code class="long-result">{result.url}</code><p><strong>Removed:</strong> {result.dropped.length ? result.dropped.join(", ") : "Nothing — URL already clean"}</p></> : <p class="result-placeholder">The cleaned URL and exact removed keys appear here.</p>}</section>
  </form>;
}
