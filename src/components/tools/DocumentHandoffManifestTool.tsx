import { PdfTool } from "./pdf/PdfTool";
export function DocumentHandoffManifestTool() { return <PdfTool toolId="document-handoff-manifest" title="Handoff files" description="Create a deterministic JSON manifest with safe names, structure flags, sizes, and local SHA-256 digests." actionLabel="Create manifest" inputMode="multi" accept="application/pdf,.pdf,application/octet-stream" />; }
