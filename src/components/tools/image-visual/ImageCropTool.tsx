import { useState } from "preact/hooks";
import { ImageLayers381Tool } from "./ImageLayers381Tool";
import { ImageTransformWorkspaceTool } from "./ImageTransformWorkspaceTool";

export function ImageCropTool() {
  const [mode, setMode] = useState<"transform" | "layers">("transform");
  return <>
    <div role="group" aria-label="Modalità editor immagine">
      <button type="button" aria-pressed={mode === "transform"} onClick={() => setMode("transform")}>Trasformazioni</button>{" "}
      <button type="button" data-381-open aria-pressed={mode === "layers"} onClick={() => setMode("layers")}>Livelli</button>
    </div>
    {mode === "layers" ? <ImageLayers381Tool /> : <ImageTransformWorkspaceTool />}
  </>;
}
