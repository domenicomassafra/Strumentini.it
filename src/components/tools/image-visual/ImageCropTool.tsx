import { useState } from "preact/hooks";
import { ImageTransformWorkspaceTool } from "./ImageTransformWorkspaceTool";
import { ImageMaskWorkspace382 } from "./ImageMaskWorkspace382";

export function ImageCropTool() {
  const [editor, setEditor] = useState<"transform" | "mask">("transform");
  return <>
    <div class="actions" role="group" aria-label="Editor immagine">
      <button type="button" aria-pressed={editor === "transform"} onClick={() => setEditor("transform")}>Trasforma immagine</button>
      <button type="button" aria-pressed={editor === "mask"} onClick={() => setEditor("mask")}>Selezioni e maschere</button>
    </div>
    {editor === "mask" ? <ImageMaskWorkspace382 /> : <ImageTransformWorkspaceTool />}
  </>;
}
