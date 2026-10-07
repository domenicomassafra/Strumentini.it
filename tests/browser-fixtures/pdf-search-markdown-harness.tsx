import { h, render } from "preact";
import { createSimplePdf } from "../../src/engines/pdf";
import searchModule from "../../src/tools/pdf-multi-text-search/module";
import markdownModule from "../../src/tools/pdf-to-markdown/module";
import { PdfResultV2, preparePdfResult } from "../../src/components/tools/pdf/PdfResultV2";
import type { PdfResultToolId } from "../../src/tools/pdf-result-declarations";
import type { ToolModule } from "../../src/runtime/types";
import "../../src/components/tools/tool-surface.css";

function asFile(bytes: Uint8Array, name: string): File {
  const copy = Uint8Array.from(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: "application/pdf" });
}

async function show(toolId: PdfResultToolId, module: ToolModule, input: Record<string, unknown>, files: File[]) {
  const value = await module.run(input, { defaults: {} });
  const prepared = await preparePdfResult(toolId, value);
  const root = document.querySelector<HTMLElement>("#result");
  if (root === null) throw new Error("result root missing");
  render(h(PdfResultV2, {
    toolId,
    result: prepared,
    sourceFiles: files,
    onReset: () => undefined,
    onRetry: () => undefined,
  }), root);
}

document.querySelector("#search")?.addEventListener("click", async () => {
  const files = [
    asFile(createSimplePdf(["alpha first", "second ALPHA"]), "searchable.pdf"),
    asFile(createSimplePdf([""]), "scan.pdf"),
    asFile(new TextEncoder().encode("not a pdf"), "broken.pdf"),
  ];
  await show("pdf-multi-text-search", searchModule, {
    files,
    query: "alpha",
    contextCharacters: 8,
    maxResults: 10,
  }, files);
});

document.querySelector("#markdown")?.addEventListener("click", async () => {
  const file = asFile(createSimplePdf(["# heading *literal*", "second page"]), "report.pdf");
  await show("pdf-to-markdown", markdownModule, { file }, [file]);
});
