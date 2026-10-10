import type { ResultDeclaration } from "../catalog/manifest";

/** Result v2 contracts for the twenty PDF/document routes owned by ticket 98. */
export const PDF_RESULT_DECLARATIONS = {
  "document-handoff-manifest": { class: "text-code", capabilities: ["copy", "download", "reset"] },
  "images-to-pdf": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-compare-lite": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-compression-lite": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-flatten": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-form-inspector": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-image-extractor": { class: "file", capabilities: ["download", "retry", "reset"] },
  "pdf-link-extractor": { class: "text-code", capabilities: ["copy", "reset"] },
  "pdf-merge": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-metadata-inspector": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-metadata-remover": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-page-count-verifier": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-page-delete-extract": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-page-reorder": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-page-size-inspector": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-password-check-remove": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "pdf-rotate": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-split": { class: "pdf", capabilities: ["download", "retry", "reset"] },
  "pdf-text-extraction": { class: "text-code", capabilities: ["copy", "download", "reset"] },
  "pdf-to-images": { class: "file", capabilities: ["download", "retry", "reset"] },
} as const satisfies Readonly<Record<string, ResultDeclaration>>;

export const PDF_EXPANSION_RESULT_DECLARATIONS = {
  "pdf-multi-text-search": { class: "text-code", capabilities: ["copy", "reset"] },
  "pdf-to-markdown": { class: "text-code", capabilities: ["copy", "download", "reset"] },
} as const satisfies Readonly<Record<string, ResultDeclaration>>;

export const PDF_ALL_RESULT_DECLARATIONS = {
  ...PDF_RESULT_DECLARATIONS,
  ...PDF_EXPANSION_RESULT_DECLARATIONS,
} as const satisfies Readonly<Record<string, ResultDeclaration>>;

export type PdfResultToolId = keyof typeof PDF_ALL_RESULT_DECLARATIONS;

export function pdfResultDeclaration(toolId: PdfResultToolId): ResultDeclaration {
  return PDF_ALL_RESULT_DECLARATIONS[toolId];
}
