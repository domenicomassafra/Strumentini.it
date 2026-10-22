import {
  createHeavyLocalJobRunner,
  type HeavyLocalJobRuntimePolicy,
  type HeavyWorkerLease,
} from "../../runtime/heavy-local-job";
import { OOXML_PACKAGE_LIMITS, analyzeOoxmlPackage } from "../ooxml/package";
import { SPREADSHEET_INTERCHANGE_LIMITS, SpreadsheetInterchangeError } from "../table/spreadsheet-interchange";
import type { OfficeLocalRequest, OfficeLocalResult } from "./worker-protocol";

export const OFFICE_LOCAL_JOB_POLICY: HeavyLocalJobRuntimePolicy = {
  capabilities: { worker: "required" },
  limits: {
    softInputBytes: 5 * 1024 * 1024,
    hardInputBytes: OOXML_PACKAGE_LIMITS.maxInputBytes,
    softWorkingSetBytes: 64 * 1024 * 1024,
    hardWorkingSetBytes: 128 * 1024 * 1024,
  },
};

function createWorkerLease(): HeavyWorkerLease<OfficeLocalRequest, OfficeLocalResult> {
  return { worker: new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }) };
}

function requestInputBytes(request: OfficeLocalRequest): number {
  if (request.kind === "csv-to-xlsx") return new TextEncoder().encode(request.text).byteLength;
  if (request.kind === "markdown-to-xlsx") return new TextEncoder().encode(request.markdown).byteLength;
  if (request.kind === "docx-generate") return new TextEncoder().encode(request.text).byteLength;
  return request.bytes.byteLength;
}

function assertRequestBounds(request: OfficeLocalRequest, inputBytes: number): void {
  if (request.kind === "csv-to-xlsx" || request.kind === "markdown-to-xlsx" || request.kind === "xlsx-to-csv" ||
      request.kind === "xlsx-workbook-open" || request.kind === "xlsx-workbook-export") {
    if (inputBytes > SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes) {
      throw new SpreadsheetInterchangeError("FILE_TOO_LARGE", `Spreadsheet input exceeds the ${SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes}-byte local limit.`);
    }
    return;
  }
  if (request.kind === "docx-generate") {
    if (inputBytes > 2 * 1024 * 1024) throw new SpreadsheetInterchangeError("FILE_TOO_LARGE", "DOCX semantic source exceeds the 2 MiB local limit.");
    return;
  }
  if (inputBytes > OOXML_PACKAGE_LIMITS.maxInputBytes) analyzeOoxmlPackage(request.bytes);
}

function estimatedWorkingSet(request: OfficeLocalRequest): number {
  const inputBytes = requestInputBytes(request);
  if (request.kind === "ooxml-rebuild") {
    const analysis = analyzeOoxmlPackage(request.bytes);
    return inputBytes + analysis.totalUncompressedBytes * 2 + OOXML_PACKAGE_LIMITS.maxInputBytes;
  }
  if (request.kind === "office-clean-metadata") {
    const analysis = analyzeOoxmlPackage(request.bytes);
    return inputBytes + analysis.totalUncompressedBytes * 2 + OOXML_PACKAGE_LIMITS.maxInputBytes;
  }
  if (request.kind === "ooxml-analyze" || request.kind === "office-structure" || request.kind === "docx-extract" || request.kind === "pptx-outline") return inputBytes * 4 + 4 * 1024 * 1024;
  if (request.kind === "xlsx-to-csv" || request.kind === "xlsx-workbook-open" || request.kind === "xlsx-workbook-export") {
    return inputBytes * 8 + 8 * 1024 * 1024;
  }
  if (request.kind === "docx-generate") return inputBytes * 6 + 8 * 1024 * 1024;
  return inputBytes * 6 + SPREADSHEET_INTERCHANGE_LIMITS.maxOutputBytes + 8 * 1024 * 1024;
}

function transferableRequest(request: OfficeLocalRequest): { readonly request: OfficeLocalRequest; readonly transfer: readonly Transferable[] } {
  if (!("bytes" in request)) return { request, transfer: [] };
  const copied = request.bytes.slice(0);
  return { request: { ...request, bytes: copied }, transfer: [copied] };
}

export async function runOfficeLocalJob(
  request: OfficeLocalRequest,
  options: { readonly signal?: AbortSignal; readonly onProgress?: (fraction: number, phase?: string) => void } = {},
): Promise<OfficeLocalResult> {
  const runner = createHeavyLocalJobRunner<OfficeLocalRequest, OfficeLocalResult>({ policy: OFFICE_LOCAL_JOB_POLICY, createWorker: createWorkerLease });
  try {
    const inputBytes = requestInputBytes(request);
    assertRequestBounds(request, inputBytes);
    const workingSetBytes = estimatedWorkingSet(request);
    const transfer = transferableRequest(request);
    const execution = runner.start({
      request: transfer.request,
      input: { inputBytes, estimatedWorkingSetBytes: workingSetBytes },
      transfer: transfer.transfer,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.onProgress === undefined ? {} : { onProgress: (progress) => {
        if (progress.kind === "determinate") options.onProgress?.(progress.fraction, progress.phase);
      } }),
    });
    return (await execution.promise).value;
  } finally {
    runner.dispose();
  }
}
