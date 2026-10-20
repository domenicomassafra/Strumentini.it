const button = document.querySelector<HTMLButtonElement>("#run");
const output = document.querySelector<HTMLElement>("#result");

if (button === null || output === null) throw new Error("Acceptance fixture controls missing.");

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const { runOfficeLocalJob } = await import("../../../src/engines/office-local/client");
    const written = await runOfficeLocalJob({
      kind: "csv-to-xlsx",
      text: "id,date-like,amount\n00123,03/04/2026,12.5\n",
      sheetName: "IDs",
      columnPolicies: [{ column: 2, type: "number" }],
    });
    if (written.kind !== "spreadsheet-write") throw new Error("Unexpected write result.");
    const reopened = await runOfficeLocalJob({ kind: "xlsx-to-csv", bytes: written.result.bytes, sheet: "IDs" });
    if (reopened.kind !== "spreadsheet-read") throw new Error("Unexpected read result.");
    const response = await fetch("/spikes/heavy-local-feasibility/public/corpus/sample.docx");
    if (!response.ok) throw new Error(`DOCX fixture fetch failed: ${response.status}`);
    const docx = await response.arrayBuffer();
    const rebuilt = await runOfficeLocalJob({ kind: "ooxml-rebuild", bytes: docx });
    if (rebuilt.kind !== "ooxml-rebuild") throw new Error("Unexpected OOXML rebuild result.");
    const structure = await runOfficeLocalJob({ kind: "office-structure", bytes: docx });
    if (structure.kind !== "office-structure") throw new Error("Unexpected Office structure result.");
    const extracted = await runOfficeLocalJob({ kind: "docx-extract", bytes: docx });
    if (extracted.kind !== "docx-extract") throw new Error("Unexpected DOCX extraction result.");
    const cleaned = await runOfficeLocalJob({ kind: "office-clean-metadata", bytes: docx });
    if (cleaned.kind !== "office-clean-metadata") throw new Error("Unexpected Office metadata cleanup result.");
    const generated = await runOfficeLocalJob({ kind: "docx-generate", sourceFormat: "markdown", text: "# Browser DOCX\n\n- voce\n\n| id | valore |\n| --- | --- |\n| 007 | Bond |" });
    if (generated.kind !== "docx-generate") throw new Error("Unexpected DOCX generation result.");
    const download = document.createElement("a");
    download.id = "download-docx";
    download.textContent = "Download DOCX";
    download.download = "browser-office.docx";
    download.href = URL.createObjectURL(new Blob([new Uint8Array(generated.result.bytes)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    document.body.append(download);
    const pptxResponse = await fetch("/spikes/heavy-local-feasibility/public/corpus/sample.pptx");
    if (!pptxResponse.ok) throw new Error(`PPTX fixture fetch failed: ${pptxResponse.status}`);
    const pptx = await pptxResponse.arrayBuffer();
    const outline = await runOfficeLocalJob({ kind: "pptx-outline", bytes: pptx });
    if (outline.kind !== "pptx-outline") throw new Error("Unexpected PPTX outline result.");
    output.textContent = JSON.stringify({
      csv: reopened.result.csv,
      generatedXlsxBytes: written.result.byteLength,
      docx: {
        kind: rebuilt.result.output.kind,
        outputBytes: rebuilt.result.byteLength,
        sizeOutcome: rebuilt.result.sizeOutcome,
        verification: rebuilt.result.verification,
        structure: { kind: structure.result.kind, previewPolicy: structure.result.previewPolicy, activeContentPolicy: structure.result.activeContentPolicy },
        semanticText: extracted.result.text,
        metadata: { removed: cleaned.result.removed.length, after: cleaned.result.after.length, verification: cleaned.result.verification },
        generated: { kind: generated.result.output.kind, text: generated.result.reopened.text, verification: generated.result.verification },
      },
      pptx: { slides: outline.result.slides, rasterExport: outline.result.rasterExport },
    });
  } catch (error) {
    output.textContent = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    button.disabled = false;
  }
});
