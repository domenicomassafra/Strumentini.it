import { HEAVY_LOCAL_NETWORK_POLICY, type HeavyWorkerResponse, type HeavyWorkerStartMessage } from "../../runtime/heavy-local-job";
import { analyzeOoxmlPackage } from "../ooxml/package";
import { rebuildOoxmlPackage } from "../ooxml/package-codec";
import { cleanOfficeMetadata, extractDocxSemantics, extractPptxOutline, generateDocxFromSemanticText, inspectOfficeStructure } from "../ooxml/office-semantics";
import { csvToXlsx, markdownTableToXlsx, xlsxToCsv } from "../table/spreadsheet-interchange";
import type { OfficeLocalRequest, OfficeLocalResult } from "./worker-protocol";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HeavyWorkerStartMessage<OfficeLocalRequest>>) => void) | null;
  postMessage(message: HeavyWorkerResponse<OfficeLocalResult>, transfer?: Transferable[]): void;
};

function post(jobId: number, message: Record<string, unknown>, transfer?: Transferable[]): void {
  scope.postMessage({ ...message, jobId } as HeavyWorkerResponse<OfficeLocalResult>, transfer);
}

function transferableWriteResult(result: Awaited<ReturnType<typeof csvToXlsx>>): OfficeLocalResult {
  return { kind: "spreadsheet-write", result };
}

scope.onmessage = async (event) => {
  const message = event.data;
  const { jobId, payload } = message;
  if (message.networkPolicy !== HEAVY_LOCAL_NETWORK_POLICY) {
    post(jobId, { type: "failure", code: "NETWORK_POLICY", message: "Office local worker requires networkPolicy=forbidden." });
    return;
  }
  try {
    post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 0.05, phase: "preflight" } });
    if (payload.kind === "csv-to-xlsx") {
      const result = await csvToXlsx(payload.text, { ...(payload.sheetName === undefined ? {} : { sheetName: payload.sheetName }), ...(payload.columnPolicies === undefined ? {} : { columnPolicies: payload.columnPolicies }) });
      post(jobId, { type: "resource", action: "reserve", resourceId: "xlsx-output", bytes: result.byteLength });
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      const value = transferableWriteResult(result);
      post(jobId, { type: "success", result: value }, [result.bytes]);
      return;
    }
    if (payload.kind === "markdown-to-xlsx") {
      const result = await markdownTableToXlsx(payload.markdown, { ...(payload.sheetName === undefined ? {} : { sheetName: payload.sheetName }), ...(payload.columnPolicies === undefined ? {} : { columnPolicies: payload.columnPolicies }) });
      post(jobId, { type: "resource", action: "reserve", resourceId: "xlsx-output", bytes: result.byteLength });
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "spreadsheet-write", result } }, [result.bytes]);
      return;
    }
    if (payload.kind === "xlsx-to-csv") {
      const result = await xlsxToCsv(payload.bytes, { ...(payload.sheet === undefined ? {} : { sheet: payload.sheet }), ...(payload.delimiter === undefined ? {} : { delimiter: payload.delimiter }), ...(payload.refuseFormulaLikeText === undefined ? {} : { refuseFormulaLikeText: payload.refuseFormulaLikeText }), ...(payload.strictEditing === undefined ? {} : { strictEditing: payload.strictEditing }) });
      post(jobId, { type: "resource", action: "reserve", resourceId: "csv-output", bytes: new TextEncoder().encode(result.csv).byteLength });
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "spreadsheet-read", result } });
      return;
    }
    if (payload.kind === "ooxml-analyze") {
      const result = analyzeOoxmlPackage(payload.bytes);
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "ooxml-analysis", result } });
      return;
    }
    if (payload.kind === "office-structure") {
      const result = await inspectOfficeStructure(payload.bytes);
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "office-structure", result } });
      return;
    }
    if (payload.kind === "docx-extract") {
      const result = await extractDocxSemantics(payload.bytes);
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "docx-extract", result } });
      return;
    }
    if (payload.kind === "pptx-outline") {
      const result = await extractPptxOutline(payload.bytes);
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "complete" } });
      post(jobId, { type: "success", result: { kind: "pptx-outline", result } });
      return;
    }
    if (payload.kind === "docx-generate") {
      const result = await generateDocxFromSemanticText(payload.text, payload.sourceFormat);
      post(jobId, { type: "resource", action: "reserve", resourceId: "docx-output", bytes: result.byteLength });
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "verified" } });
      post(jobId, { type: "success", result: { kind: "docx-generate", result } }, [result.bytes]);
      return;
    }
    if (payload.kind === "office-clean-metadata") {
      const analysis = analyzeOoxmlPackage(payload.bytes);
      post(jobId, { type: "resource", action: "reserve", resourceId: "expanded-members", bytes: analysis.totalUncompressedBytes * 2 });
      const result = await cleanOfficeMetadata(payload.bytes);
      post(jobId, { type: "resource", action: "reserve", resourceId: "office-clean-output", bytes: result.byteLength });
      post(jobId, { type: "resource", action: "release", resourceId: "expanded-members" });
      post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "verified" } });
      post(jobId, { type: "success", result: { kind: "office-clean-metadata", result } }, [result.bytes]);
      return;
    }
    const analysis = analyzeOoxmlPackage(payload.bytes);
    post(jobId, { type: "resource", action: "reserve", resourceId: "expanded-members", bytes: analysis.totalUncompressedBytes * 2 });
    post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 0.25, phase: "decode-rebuild" } });
    const result = await rebuildOoxmlPackage(payload.bytes);
    post(jobId, { type: "resource", action: "reserve", resourceId: "ooxml-output", bytes: result.byteLength });
    post(jobId, { type: "resource", action: "release", resourceId: "expanded-members" });
    post(jobId, { type: "progress", progress: { kind: "determinate", fraction: 1, phase: "verified" } });
    post(jobId, { type: "success", result: { kind: "ooxml-rebuild", result } }, [result.bytes]);
  } catch (error) {
    post(jobId, {
      type: "failure",
      code: error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string" ? String((error as { code: string }).code) : "OFFICE_LOCAL_FAILURE",
      message: error instanceof Error ? error.message : "Office local worker failed.",
    });
  }
};
