import { useMemo, useState } from "preact/hooks";
import type { CssDesignMode, CssDesignResult } from "../../engines/design-css";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ResultProvenance, ToolActions, ToolResetButton, ToolSubmitButton, useToolOperation } from "./shared";

function numeric(value: string): number {
  return Number(value.replace(",", "."));
}

export function CssDesignHelperTool() {
  const [mode, setMode] = useState<CssDesignMode>("gradient");
  const [angle, setAngle] = useState("135");
  const [startColor, setStartColor] = useState("#336699");
  const [endColor, setEndColor] = useState("#66cc99");
  const [offsetX, setOffsetX] = useState("0");
  const [offsetY, setOffsetY] = useState("16");
  const [blur, setBlur] = useState("32");
  const [spread, setSpread] = useState("-8");
  const [shadowColor, setShadowColor] = useState("#222222");
  const [topLeft, setTopLeft] = useState("24");
  const [topRight, setTopRight] = useState("24");
  const [bottomRight, setBottomRight] = useState("24");
  const [bottomLeft, setBottomLeft] = useState("24");
  const [copyStatus, setCopyStatus] = useState("");

  const input = useMemo(() => mode === "gradient"
    ? { mode, angle: numeric(angle), startColor, endColor }
    : mode === "shadow"
      ? { mode, offsetX: numeric(offsetX), offsetY: numeric(offsetY), blur: numeric(blur), spread: numeric(spread), color: shadowColor }
      : { mode, topLeft: numeric(topLeft), topRight: numeric(topRight), bottomRight: numeric(bottomRight), bottomLeft: numeric(bottomLeft) },
  [angle, blur, bottomLeft, bottomRight, endColor, mode, offsetX, offsetY, shadowColor, spread, startColor, topLeft, topRight]);

  const operation = useToolOperation<CssDesignResult>(
    (signal) => toolRuntime.run("css-design-helper", input, {}, signal),
    { formatThrownError: (error) => error instanceof Error ? `Valore non valido: ${error.message}` : "Valore CSS non valido." },
  );

  function reset() {
    operation.reset();
    setCopyStatus("");
  }

  async function copyCss() {
    if (operation.result === null || navigator.clipboard === undefined) return;
    await navigator.clipboard.writeText(operation.result.css);
    setCopyStatus("CSS copiato.");
  }

  const previewStyle = operation.result === null ? {} : operation.result.property === "background"
    ? { background: operation.result.value }
    : operation.result.property === "box-shadow"
      ? { boxShadow: operation.result.value }
      : { borderRadius: operation.result.value };

  return (
    <div class="tool-surface">
      <form onSubmit={(event) => { event.preventDefault(); setCopyStatus(""); void operation.run(); }} noValidate>
        <div class="field-grid">
          <label class="field"><span>Helper</span><select value={mode} onChange={(event) => { setMode(event.currentTarget.value as CssDesignMode); reset(); }}><option value="gradient">Gradiente lineare</option><option value="shadow">Box shadow</option><option value="radius">Border radius</option></select></label>
          {mode === "gradient" && <>
            <label class="field"><span>Angolo (0–360°)</span><input type="number" min="0" max="360" step="1" value={angle} onInput={(event) => setAngle(event.currentTarget.value)} /></label>
            <label class="field"><span>Colore iniziale</span><input type="color" value={startColor} onInput={(event) => setStartColor(event.currentTarget.value)} /></label>
            <label class="field"><span>Colore finale</span><input type="color" value={endColor} onInput={(event) => setEndColor(event.currentTarget.value)} /></label>
          </>}
          {mode === "shadow" && <>
            <label class="field"><span>Offset X (px)</span><input type="number" min="-200" max="200" value={offsetX} onInput={(event) => setOffsetX(event.currentTarget.value)} /></label>
            <label class="field"><span>Offset Y (px)</span><input type="number" min="-200" max="200" value={offsetY} onInput={(event) => setOffsetY(event.currentTarget.value)} /></label>
            <label class="field"><span>Sfocatura (px)</span><input type="number" min="0" max="300" value={blur} onInput={(event) => setBlur(event.currentTarget.value)} /></label>
            <label class="field"><span>Espansione (px)</span><input type="number" min="-200" max="200" value={spread} onInput={(event) => setSpread(event.currentTarget.value)} /></label>
            <label class="field"><span>Colore ombra</span><input type="color" value={shadowColor} onInput={(event) => setShadowColor(event.currentTarget.value)} /></label>
          </>}
          {mode === "radius" && <>
            <label class="field"><span>Alto sinistra (px)</span><input type="number" min="0" max="1000" value={topLeft} onInput={(event) => setTopLeft(event.currentTarget.value)} /></label>
            <label class="field"><span>Alto destra (px)</span><input type="number" min="0" max="1000" value={topRight} onInput={(event) => setTopRight(event.currentTarget.value)} /></label>
            <label class="field"><span>Basso destra (px)</span><input type="number" min="0" max="1000" value={bottomRight} onInput={(event) => setBottomRight(event.currentTarget.value)} /></label>
            <label class="field"><span>Basso sinistra (px)</span><input type="number" min="0" max="1000" value={bottomLeft} onInput={(event) => setBottomLeft(event.currentTarget.value)} /></label>
          </>}
        </div>
        <InlineError message={operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning}>Genera CSS</ToolSubmitButton><ToolResetButton onClick={reset} /></ToolActions>
      </form>
      {operation.result !== null && <section class="result-panel" data-css-design-result>
        <div aria-label="Anteprima CSS" style={{ minHeight: "9rem", border: "1px solid currentColor", ...previewStyle }} />
        <label class="field"><span>CSS canonico</span><textarea rows={3} readOnly value={operation.result.css} /></label>
        <ToolActions><button type="button" onClick={() => void copyCss()}>Copia CSS</button></ToolActions>
        <ResultProvenance>Anteprima e testo copiato derivano dallo stesso modello validato, interamente locale e senza rete.</ResultProvenance>
        {copyStatus !== "" && <p role="status">{copyStatus}</p>}
      </section>}
    </div>
  );
}
