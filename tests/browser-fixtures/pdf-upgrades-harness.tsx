import { h, render } from "preact";
import textModule from "../../src/tools/pdf-text-extraction/module";
import imageModule from "../../src/tools/pdf-image-extractor/module";
import metadataModule from "../../src/tools/pdf-metadata-inspector/module";
import removeModule from "../../src/tools/pdf-metadata-remover/module";
import { PdfResultV2, preparePdfResult } from "../../src/components/tools/pdf/PdfResultV2";
import type { PdfResultToolId } from "../../src/tools/pdf-result-declarations";
import type { ToolModule } from "../../src/runtime/types";
import "../../src/components/tools/tool-surface.css";

const fixtureUrl = new URL("../../quality/fixtures/pdf-gold/page-scoped-images-metadata.pdf", import.meta.url);

async function sourceFile(): Promise<File> {
  const response = await fetch(fixtureUrl);
  if (!response.ok) throw new Error(`fixture HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new File([bytes.buffer as ArrayBuffer], "page-scoped-images-metadata.pdf", { type: "application/pdf" });
}

async function show(toolId: PdfResultToolId, module: ToolModule, input: Record<string, unknown>) {
  const file = await sourceFile();
  const value = await module.run({ file, ...input }, { defaults: {} });
  const prepared = await preparePdfResult(toolId, value);
  const root = document.querySelector<HTMLElement>("#result");
  if (root === null) throw new Error("result root missing");
  render(h(PdfResultV2, {
    toolId,
    result: prepared,
    sourceFiles: [file],
    onReset: () => undefined,
    onRetry: () => undefined,
  }), root);
}

document.querySelector("#text")?.addEventListener("click", () => show("pdf-text-extraction", textModule, { pages: [2, 1], mode: "operator-lines" }));
document.querySelector("#images")?.addEventListener("click", () => show("pdf-image-extractor", imageModule, { pages: [1, 2], dedupe: true }));
document.querySelector("#metadata")?.addEventListener("click", () => show("pdf-metadata-inspector", metadataModule, {}));
document.querySelector("#remove")?.addEventListener("click", () => show("pdf-metadata-remover", removeModule, {}));
