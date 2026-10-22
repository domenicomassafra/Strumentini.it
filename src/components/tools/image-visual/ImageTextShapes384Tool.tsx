import { useEffect, useRef, useState } from "preact/hooks";
import type { TextShapeLayer384, TextShapesOutput384 } from "../../../engines/image/text-shapes-384";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolOperation, ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation } from "../shared";
import { DownloadLink } from "../marketing-media/DownloadLink";

type Kind = TextShapeLayer384["type"];

function freshLayer(type: Kind, index: number): TextShapeLayer384 {
  const common = { id: `layer-${index}`, x: 10, y: 10, fill: type === "ellipse" ? "#00ff00" : "#ff0000", opacity: 1, visible: true };
  if (type === "text") return { ...common, type, text: "Testo", fontSize: 28, fontFamily: "sans-serif", direction: "ltr" };
  return type === "rectangle"
    ? { ...common, type: "rectangle", width: 60, height: 40 }
    : { ...common, type: "ellipse", width: 60, height: 40 };
}

export function ImageTextShapes384Tool() {
  const [file, setFile] = useState<File | null>(null);
  const sequence = useRef(2);
  const [layers, setLayers] = useState<TextShapeLayer384[]>([freshLayer("text", 1)]);
  const [url, setUrl] = useState("");
  const operation = useToolOperation<TextShapesOutput384>((signal) => toolRuntime.run("screenshot-border-background-helper", {
    mode: "text-shapes-384", file, layers,
  }, {}, signal));

  useEffect(() => {
    if (!operation.result) { setUrl(""); return; }
    const next = URL.createObjectURL(operation.result.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [operation.result]);

  function update(index: number, patch: Partial<TextShapeLayer384>) {
    setLayers((previous) => previous.map((item, i) => i === index ? { ...item, ...patch } as TextShapeLayer384 : item));
    operation.reset();
  }

  function swap(index: number, next: number) {
    setLayers((previous) => {
      const copy = [...previous];
      const current = copy[index];
      const target = copy[next];
      if (!current || !target) return previous;
      copy[index] = target;
      copy[next] = current;
      return copy;
    });
    operation.reset();
  }

  return <section data-str-384="true" aria-label="Testo e forme su immagine">
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}>
        <label class="field"><span>Immagine originale</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} /></label>
        <p class="file-note">Livelli dal basso verso l'alto. Il file originale rimane invariato; il PNG composito è un nuovo file.</p>
        {layers.map((layer, index) => <fieldset key={layer.id} data-shape-layer={layer.id}>
          <legend>Livello {index + 1}: {layer.type}</legend>
          <div class="field-grid">
            <label class="field"><span>Tipo</span><select aria-label={`Tipo ${index + 1}`} value={layer.type} onChange={(event) => update(index, freshLayer(event.currentTarget.value as Kind, sequence.current++))}><option value="text">Testo</option><option value="rectangle">Rettangolo</option><option value="ellipse">Ellisse</option></select></label>
            <label class="field"><span>Visibile</span><input aria-label={`Visibile ${index + 1}`} type="checkbox" checked={layer.visible} onChange={(event) => update(index, { visible: event.currentTarget.checked })} /></label>
            <label class="field"><span>X px</span><input aria-label={`X ${index + 1}`} type="number" min="0" value={layer.x} onInput={(event) => update(index, { x: Number(event.currentTarget.value) })} /></label>
            <label class="field"><span>Y px</span><input aria-label={`Y ${index + 1}`} type="number" min="0" value={layer.y} onInput={(event) => update(index, { y: Number(event.currentTarget.value) })} /></label>
            <label class="field"><span>Colore</span><input aria-label={`Colore ${index + 1}`} type="color" value={layer.fill} onInput={(event) => update(index, { fill: event.currentTarget.value })} /></label>
            <label class="field"><span>Opacità</span><input aria-label={`Opacità ${index + 1}`} type="number" step="0.1" min="0" max="1" value={layer.opacity} onInput={(event) => update(index, { opacity: Number(event.currentTarget.value) })} /></label>
            {layer.type === "text" ? <>
              <label class="field"><span>Testo</span><input aria-label={`Testo ${index + 1}`} value={layer.text} maxLength={240} onInput={(event) => update(index, { text: event.currentTarget.value })} /></label>
              <label class="field"><span>Dimensione font px</span><input aria-label={`Font size ${index + 1}`} type="number" min="8" max="512" value={layer.fontSize} onInput={(event) => update(index, { fontSize: Number(event.currentTarget.value) })} /></label>
              <label class="field"><span>Font browser</span><select aria-label={`Font ${index + 1}`} value={layer.fontFamily} onChange={(event) => update(index, { fontFamily: event.currentTarget.value as "serif" })}><option value="sans-serif">Sans serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select></label>
            </> : <>
              <label class="field"><span>Larghezza px</span><input aria-label={`Larghezza ${index + 1}`} type="number" min="1" value={layer.width} onInput={(event) => update(index, { width: Number(event.currentTarget.value) })} /></label>
              <label class="field"><span>Altezza px</span><input aria-label={`Altezza ${index + 1}`} type="number" min="1" value={layer.height} onInput={(event) => update(index, { height: Number(event.currentTarget.value) })} /></label>
            </>}
          </div>
          <ToolActions>
            <button type="button" disabled={index === 0} onClick={() => swap(index, index - 1)}>Sposta sotto</button>
            <button type="button" disabled={index === layers.length - 1} onClick={() => swap(index, index + 1)}>Sposta sopra</button>
            <button type="button" disabled={layers.length === 1} onClick={() => { setLayers((previous) => previous.filter((_, i) => i !== index)); operation.reset(); }}>Rimuovi</button>
          </ToolActions>
        </fieldset>)}
        <ToolActions>
          <button type="button" disabled={layers.length >= 16} onClick={() => { setLayers((previous) => [...previous, freshLayer("rectangle", sequence.current++)]); operation.reset(); }}>Aggiungi livello</button>
          <ToolSubmitButton busy={operation.isRunning}>Componi PNG</ToolSubmitButton>
        </ToolActions>
        <p class="file-note">Esporta solo pixel PNG. Font generici locali; font personalizzati, emoji e testi RTL vengono rifiutati perché la resa non è verificabile. Non è un export SVG/vettoriale.</p>
        <InlineError message={operation.error} />
      </form>
      <ToolResultPanel eyebrow="Testo e forme" placeholder="Anteprima dopo la composizione" busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {operation.result && <section data-shapes-output="true">
          <p>PNG {operation.result.width}×{operation.result.height} px · {operation.result.layers.length} livelli</p>
          {url && <img data-shapes-preview="true" src={url} alt="Anteprima esatta del PNG esportato" />}
          <p>{operation.result.fontPolicy} {operation.result.vectorPolicy}.</p>
          <ToolActions><DownloadLink blob={operation.result.blob} filename={operation.result.filename}>Scarica lo stesso PNG</DownloadLink></ToolActions>
        </section>}
      </ToolResultPanel>
    </ToolOperation>
  </section>;
}
