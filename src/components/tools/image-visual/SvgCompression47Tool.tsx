import { useEffect, useRef, useState } from "preact/hooks";
import type { SvgCompressionResult47 } from "../../../engines/image/svg-compression-47";

function useSvgUrls(result: SvgCompressionResult47 | null) {
  const [urls, setUrls] = useState<{ source: string; optimized: string; download: string } | null>(null);
  useEffect(() => {
    if (!result) { setUrls(null); return; }
    const next = {
      source: URL.createObjectURL(result.safeOriginalPreview),
      optimized: URL.createObjectURL(result.safeOptimizedPreview),
      download: URL.createObjectURL(result.blob),
    };
    setUrls(next);
    return () => { for (const url of Object.values(next)) URL.revokeObjectURL(url); };
  }, [result]);
  return urls;
}

export function SvgCompression47Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [precision, setPrecision] = useState(4);
  const [multipass, setMultipass] = useState(true);
  const [result, setResult] = useState<SvgCompressionResult47 | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const urls = useSvgUrls(result);
  useEffect(() => () => controller.current?.abort(), []);

  function invalidate() {
    controller.current?.abort(); controller.current = null;
    setResult(null); setError(""); setWorking(false);
  }
  async function submit(event: Event) {
    event.preventDefault();
    if (!file || controller.current) return;
    const active = new AbortController();
    controller.current = active; setWorking(true); setResult(null); setError("");
    try {
      const { compressSvg47 } = await import("../../../engines/image/svg-compression-47");
      const output = await compressSvg47(file, { precision, multipass, signal: active.signal });
      if (controller.current === active && !active.signal.aborted) setResult(output);
    } catch (cause) {
      if (controller.current === active && !active.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "SVG non ottimizzabile in sicurezza");
      }
    } finally {
      if (controller.current === active) { controller.current = null; setWorking(false); }
    }
  }

  return (
    <section data-svg-compression-47 class="svg-opt47" aria-label="Ottimizzazione SVG locale">
      <h2>Ottimizza SVG vettoriale</h2>
      <p>Ottimizzazione con SVGO locale. Anteprima di entrambi i file, byte reali e compressione gzip; scarica soltanto dopo la verifica che tutti i pixel siano identici.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label>File SVG statico (massimo 1 MiB)
          <input type="file" accept=".svg,image/svg+xml" onChange={(event) => { invalidate(); setFile(event.currentTarget.files?.[0] ?? null); }} disabled={working}/>
        </label>
        <label>Precisione coordinate: {precision}
          <input type="range" min="2" max="6" step="1" value={precision} onInput={(event) => { invalidate(); setPrecision(Number(event.currentTarget.value)); }} disabled={working}/>
        </label>
        <label><input type="checkbox" checked={multipass} onChange={(event) => { invalidate(); setMultipass(event.currentTarget.checked); }} disabled={working}/> Più passaggi di ottimizzazione</label>
        <p>Solo SVG statici semplici: script, link esterni, CSS, filtri, animazioni, risorse e funzionalità non certificate vengono rifiutati. Nessun cambiamento visivo o opzione aggressiva non verificata.</p>
        <div class="svg-opt47-actions">
          <button class="btn btn-primary" type="submit" disabled={working || !file}>{working ? "Verifica SVG..." : "Ottimizza e verifica SVG"}</button>
          {working && <button class="btn" type="button" onClick={invalidate}>Annulla</button>}
        </div>
      </form>
      {error && <p role="alert" class="svg-opt47-error">{error}</p>}
      {result && urls && <section data-svg-optimized="true" aria-live="polite">
        <h3>SVG verificato pixel per pixel</h3>
        <dl><div><dt>Originale</dt><dd>{result.originalBytes} byte · gzip {result.originalGzipBytes} byte</dd></div>
          <div><dt>Scaricabile</dt><dd>{result.outputBytes} byte · gzip {result.outputGzipBytes} byte</dd></div>
          <div><dt>Risparmio reale</dt><dd>{result.originalBytes - result.outputBytes} byte ({((1 - result.outputBytes / result.originalBytes) * 100).toFixed(1)}%)</dd></div></dl>
        <div class="svg-opt47-previews"><figure><img src={urls.source} alt="SVG originale nel sottoinsieme sicuro" /><figcaption>Prima</figcaption></figure>
          <figure><img src={urls.optimized} alt="SVG ottimizzato verificato" /><figcaption>Dopo</figcaption></figure></div>
        {result.keptOriginal && <p>Ottimizzare non riduce i byte: si conserva il file originale verificato.</p>}
        <a class="btn btn-primary" href={urls.download} download={result.filename}>Scarica SVG ottimizzato</a>
      </section>}
      <style>{`.svg-opt47{display:grid;gap:16px;margin:30px 0;padding:24px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.svg-opt47 form{display:grid;gap:16px}.svg-opt47 label{display:grid;gap:6px}.svg-opt47-actions{display:flex;gap:12px;flex-wrap:wrap}.svg-opt47-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.svg-opt47-previews figure{margin:0;min-width:0}.svg-opt47-previews img{max-width:100%;width:100%;height:auto;max-height:260px;object-fit:contain;border:1px solid var(--border)}.svg-opt47 dl{display:flex;flex-wrap:wrap;gap:18px}.svg-opt47 dt{color:var(--text-muted)}.svg-opt47 dd{margin:4px 0 0;font-weight:600}.svg-opt47-error{color:var(--danger)}`}</style>
    </section>
  );
}
