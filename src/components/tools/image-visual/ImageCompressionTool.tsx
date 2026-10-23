import { useEffect, useState } from "preact/hooks";
import { ImageVisualTool } from "./ImageVisualTool";
import { SvgCompression47Tool } from "./SvgCompression47Tool";
import { ImageFamilyCapabilities028 } from "./ImageFamilyCapabilities028";

export function ImageCompressionTool() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Astro serves this form as live SSR HTML while the Preact island's JS is
  // still loading. Before hydration, a changed select has no event handler:
  // it can visibly say "lossy" while compression silently uses the default.
  // Disable every control until the first client effect has run. The server
  // and the initial hydration render both keep this exact disabled state.
  return (
    <fieldset
      data-image-compression-hydration-gate
      disabled={!hydrated}
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
    >
      <p class="file-note" data-webp-capability-47>
        WebP: compressione con perdita (lossy), trasparenza conservata se il browser la codifica correttamente.
        WebP senza perdita (lossless) e controllo dello sforzo di codifica non disponibili con il codec Canvas corrente.
      </p>
      <ImageVisualTool toolId="image-compression" />
      <SvgCompression47Tool />
      <ImageFamilyCapabilities028 />
    </fieldset>
  );
}
