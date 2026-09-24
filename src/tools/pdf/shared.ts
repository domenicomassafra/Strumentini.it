import type { PdfArtifact, PdfMutationOptions } from "../../engines/pdf";
import { PDF_LIMITS } from "../../engines/pdf";

export interface PdfToolFile {
  readonly blob: Blob;
  readonly filename: string;
}

export function requireFile(value: unknown, label = "PDF file"): PdfToolFile {
  if (typeof Blob === "undefined" || !(value instanceof Blob)) throw new Error(`INVALID_INPUT: Choose a local ${label}.`);
  const filename = "name" in value && typeof (value as { name?: unknown }).name === "string" ? (value as { name: string }).name : "document.pdf";
  return { blob: value, filename };
}

export function requireFiles(value: unknown, label = "files"): PdfToolFile[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`INVALID_INPUT: Choose at least one ${label}.`);
  if (value.length > PDF_LIMITS.maxFiles) throw new Error("PDF_LIMIT: Too many files were selected.");
  return value.map((item) => requireFile(item, label));
}

export function requireBlobArray(value: unknown, label = "files"): Blob[] {
  return requireFiles(value, label).map(({ blob }) => blob);
}

export function parsePageList(value: unknown): number[] {
  if (Array.isArray(value)) {
    if (value.some((item) => !Number.isInteger(item) || Number(item) < 1)) throw new Error("INVALID_INPUT: Page numbers must be positive whole numbers.");
    return [...new Set(value as number[])];
  }
  if (typeof value !== "string") throw new Error("INVALID_INPUT: Enter page numbers such as 1, 3, 5.");
  const pages = value.split(/[\s,;]+/u).filter(Boolean).map(Number);
  if (pages.length === 0 || pages.some((page) => !Number.isInteger(page) || page < 1)) throw new Error("INVALID_INPUT: Enter page numbers such as 1, 3, 5.");
  return [...new Set(pages)];
}

export function parsePageGroups(value: unknown): number[][] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("INVALID_INPUT: Enter at least one page group.");
  return value.map((group) => parsePageList(group));
}

export function mutationInput(value: unknown): { file: PdfToolFile; options: PdfMutationOptions & { readonly filename: string } } {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
  const candidate = value as Record<string, unknown>;
  const file = requireFile(candidate.file, "PDF file");
  const pages = candidate.pages === undefined ? undefined : parsePageList(candidate.pages);
  const order = candidate.order === undefined ? undefined : parsePageList(candidate.order);
  const groups = candidate.groups === undefined ? undefined : parsePageGroups(candidate.groups);
  const rotations = candidate.rotations === undefined ? undefined : parseRotations(candidate.rotations);
  return {
    file,
    options: {
      filename: file.filename,
      ...(pages === undefined ? {} : { pages }),
      ...(order === undefined ? {} : { order }),
      ...(groups === undefined ? {} : { groups }),
      ...(rotations === undefined ? {} : { rotations }),
    } as PdfMutationOptions & { readonly filename: string },
  };
}

function parseRotations(value: unknown): Record<number, 90 | 180 | 270> {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a rotation.");
  const result: Record<number, 90 | 180 | 270> = {};
  for (const [page, rotation] of Object.entries(value)) {
    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || (rotation !== 90 && rotation !== 180 && rotation !== 270)) {
      throw new Error("INVALID_INPUT: Rotations must be 90, 180, or 270 degrees.");
    }
    result[pageNumber] = rotation;
  }
  return result;
}

export function resultArtifacts(artifacts: readonly PdfArtifact[]): { artifacts: readonly PdfArtifact[]; artifactCount: number; totalBytes: number } {
  return { artifacts, artifactCount: artifacts.length, totalBytes: artifacts.reduce((total, artifact) => total + artifact.bytes.byteLength, 0) };
}

export function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}
