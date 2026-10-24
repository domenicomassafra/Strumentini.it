import { useState } from "preact/hooks";
import { ImageLayers381Tool } from "./ImageLayers381Tool";
import { ImageTransformWorkspaceTool } from "./ImageTransformWorkspaceTool";
import { ImageMaskWorkspace382 } from "./ImageMaskWorkspace382";

export function ImageCropTool() {
  const [mode, setMode] = useState<"transform" | "layers" | "mask">("transform");
  return <>
    <div class="actions" role="group" aria-label="Modalità editor immagine">
      <button type="button" aria-pressed={mode === "transform"} onClick={() => setMode("transform")}>Trasformazioni</button>{" "}
      <button type="button" data-381-open aria-pressed={mode === "layers"} onClick={() => setMode("layers")}>Livelli</button>{" "}
      <button type="button" aria-pressed={mode === "mask"} onClick={() => setMode("mask")}>Selezioni e maschere</button>
    </div>
    {mode === "layers" ? <ImageLayers381Tool /> : mode === "mask" ? <ImageMaskWorkspace382 /> : <ImageTransformWorkspaceTool />}
  </>;
}
