import type { SpreadsheetColumnPolicy, SpreadsheetReadResult, SpreadsheetWriteResult } from "../table/spreadsheet-interchange";
import type { Workbook389 } from "../table/workbook-formulas-389";
import type { OoxmlPackageAnalysis } from "../ooxml/package";
import type { OoxmlRebuildResult } from "../ooxml/package-codec";
import type {
  DocxGenerationResult,
  DocxSemanticExtraction,
  OfficeMetadataCleanupResult,
  OfficeStructureInspection,
  PptxOutlineResult,
} from "../ooxml/office-semantics";

export type OfficeLocalRequest =
  | { readonly kind: "csv-to-xlsx"; readonly text: string; readonly sheetName?: string; readonly columnPolicies?: readonly SpreadsheetColumnPolicy[] }
  | { readonly kind: "markdown-to-xlsx"; readonly markdown: string; readonly sheetName?: string; readonly columnPolicies?: readonly SpreadsheetColumnPolicy[] }
  | { readonly kind: "xlsx-to-csv"; readonly bytes: ArrayBuffer; readonly sheet?: string | number; readonly delimiter?: string; readonly refuseFormulaLikeText?: boolean; readonly strictEditing?: boolean }
  | { readonly kind: "xlsx-workbook-open"; readonly bytes: ArrayBuffer }
  | { readonly kind: "xlsx-workbook-export"; readonly bytes: ArrayBuffer; readonly workbook: Workbook389 }
  | { readonly kind: "ooxml-analyze"; readonly bytes: ArrayBuffer }
  | { readonly kind: "ooxml-rebuild"; readonly bytes: ArrayBuffer }
  | { readonly kind: "office-structure"; readonly bytes: ArrayBuffer }
  | { readonly kind: "office-clean-metadata"; readonly bytes: ArrayBuffer }
  | { readonly kind: "docx-extract"; readonly bytes: ArrayBuffer }
  | { readonly kind: "docx-generate"; readonly text: string; readonly sourceFormat: "text" | "markdown" | "html" }
  | { readonly kind: "pptx-outline"; readonly bytes: ArrayBuffer };

export type OfficeLocalResult =
  | { readonly kind: "spreadsheet-write"; readonly result: SpreadsheetWriteResult }
  | { readonly kind: "spreadsheet-read"; readonly result: SpreadsheetReadResult }
  | { readonly kind: "xlsx-workbook-open"; readonly result: Workbook389 }
  | { readonly kind: "xlsx-workbook-export"; readonly bytes: ArrayBuffer }
  | { readonly kind: "ooxml-analysis"; readonly result: OoxmlPackageAnalysis }
  | { readonly kind: "ooxml-rebuild"; readonly result: OoxmlRebuildResult }
  | { readonly kind: "office-structure"; readonly result: OfficeStructureInspection }
  | { readonly kind: "office-clean-metadata"; readonly result: OfficeMetadataCleanupResult }
  | { readonly kind: "docx-extract"; readonly result: DocxSemanticExtraction }
  | { readonly kind: "docx-generate"; readonly result: DocxGenerationResult }
  | { readonly kind: "pptx-outline"; readonly result: PptxOutlineResult };
