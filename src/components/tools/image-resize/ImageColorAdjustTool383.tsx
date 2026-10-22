import { useEffect, useRef, useState } from "preact/hooks";
import { inspectImageHeader } from "../../../engines/image/format";
import { adjustImageFile383 } from "../../../engines/image/editor-pipeline-383";

/** Temporary standalone color surface. #140 will integrate it into the layer editor. */
export function ImageColorAdjustTool383() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState("256");
  const [height, setHeight] = useState("256");
  const [black, setBlack] = useState("0");
  const [white, setWhite] = useState("255");
  const [gamma, setGamma] = useState("1");
  const [midpoint, setMidpoint] = useState("128");
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [result, setResult] = useState<Blob | null>(null);
  const [download, setDownload] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileRequest = useRef(0);

  useEffect(() => {
    if (!result) { setDownload(""); return; }
    const url = URL.createObjectURL(result);
    setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(() => () => controller.current?.abort(), []);

  async function chooseFile(event: Event) {
    const picked = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    const request = ++fileRequest.current;
    setFile(picked);
    setResult(null);
    setError("");
    if (!picked) return;
    try {
      const header = inspectImageHeader(new Uint8Array(await picked.slice(0, 2 * 1024 * 1024).arrayBuffer()));
      if (request !== fileRequest.current) return;
      setWidth(String(header.width));
      setHeight(String(header.height));
    } catch {
      if (request === fileRequest.current) setError("Immagine non valida o intestazione incompleta.");
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!file || busy) return;
    setError("");
    setResult(null);
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const output = await adjustImageFile383({
        file, width: Number(width), height: Number(height), fit,
        adjustments: {
          levels: { black: Number(black), white: Number(white), gamma: Number(gamma) },
          curve: [{ input: 0, output: 0 }, { input: 128, output: Number(midpoint) }, { input: 255, output: 255 }],
        },
      }, abort.signal);
      setResult(output.blob);
    } catch (cause) {
      if (abort.signal.aborted) {
        setError("Operazione annullata. L'originale è invariato.");
      } else if (String(cause).includes("UNVERIFIED_COLOR_PROFILE")) {
        setError("Profilo colore o orientamento non verificabile: il file è stato rifiutato senza ricodifica. Usa un'immagine priva di ICC/EXIF e di metadati sconosciuti.");
      } else {
        setError(cause instanceof Error ? cause.message : "Elaborazione non riuscita.");
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  return (
    <section class="tool-operation" data-str-383 aria-label="Regolazioni colore locali">
      <h2>Regolazioni colore e curve · sRGB</h2>
      <p>Livelli, curva tonale a tre punti e ridimensionamento in PNG. I file senza profilo incorporato vengono interpretati come sRGB; ICC, EXIF e metadati sconosciuti richiedono una gestione colore verificata e vengono rifiutati. Il file originale rimane intatto.</p>
      <form onSubmit={submit}>
        <label class="field">
          <span>Immagine da regolare</span>
          <input data-str-383-file type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} disabled={busy} />
        </label>
        <div class="field-grid">
          <label class="field"><span>Larghezza (px)</span><input type="number" min="1" max="8192" step="1" value={width} onInput={(e) => { setWidth(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
          <label class="field"><span>Altezza (px)</span><input type="number" min="1" max="8192" step="1" value={height} onInput={(e) => { setHeight(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
          <label class="field"><span>Livello nero (0–254)</span><input type="number" min="0" max="254" value={black} onInput={(e) => { setBlack(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
          <label class="field"><span>Livello bianco (1–255)</span><input type="number" min="1" max="255" value={white} onInput={(e) => { setWhite(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
          <label class="field"><span>Gamma (0,1–5)</span><input type="number" min="0.1" max="5" step="0.1" value={gamma} onInput={(e) => { setGamma(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
          <label class="field"><span>Curva: uscita al punto 128</span><input type="number" min="0" max="255" step="1" value={midpoint} onInput={(e) => { setMidpoint(e.currentTarget.value); setResult(null); }} disabled={busy}/></label>
        </div>
        <fieldset class="segmented">
          <legend>Ridimensionamento</legend>
          <label><input type="radio" name="str383-fit" checked={fit === "contain"} onChange={() => { setFit("contain"); setResult(null); }} disabled={busy}/> Contieni</label>
          <label><input type="radio" name="str383-fit" checked={fit === "cover"} onChange={() => { setFit("cover"); setResult(null); }} disabled={busy}/> Riempi e ritaglia</label>
        </fieldset>
        <div class="actions">
          <button class="primary" type="submit" disabled={busy || file === null}>{busy ? "Elaborazione locale…" : "Applica regolazioni"}</button>
          {busy && <button type="button" onClick={() => controller.current?.abort()}>Annulla</button>}
        </div>
      </form>
      {error && <p role="alert" class="error">{error}</p>}
      {busy && <p role="status">Elaborazione in corso sul dispositivo</p>}
      {download && (
        <div class="result-panel" data-str-383-result>
          <p>PNG prodotto in sRGB, senza dichiarare la conservazione del profilo o dei metadati originali.</p>
          <img src={download} alt="Anteprima dell'immagine regolata" style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain" }} />
          <p><a href={download} download={file ? file.name.replace(/\.[^.]+$/u, "") + "-regolata.png" : "regolata.png"}>Scarica il PNG regolato</a></p>
        </div>
      )}
    </section>
  );
}
