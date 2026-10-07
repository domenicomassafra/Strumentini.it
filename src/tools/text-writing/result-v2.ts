import type { ResultDeclaration } from "../../catalog/manifest";

export const TEXT_RESULT_V2_DECLARATIONS = {
  "case-converter": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "csv-column-to-list": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "find-replace-preview": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "invisible-character-detector": { class: "validator", capabilities: ["copy", "download", "reuse", "retry", "reset", "provenance"] },
  "language-aware-text-statistics": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "line-deduplicator": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "line-sorter": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "list-compare": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "list-difference": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "list-intersection": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "lorem-sample-data-generator": { class: "text-code", capabilities: ["copy", "download", "reset"] },
  "markdown-preview": { class: "text-code", capabilities: ["copy", "download", "reset"] },
  "markdown-table-formatter": { class: "table", capabilities: ["copy", "download", "reuse", "reset"] },
  "reading-time-estimator": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "slug-generator": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "smart-quote-normalizer": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "text-diff": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "text-to-csv-rows": { class: "table", capabilities: ["copy", "download", "reuse", "reset"] },
  "unicode-normalizer": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "whitespace-normalizer": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  "word-character-line-counter": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "semantic-text-chunker": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "fact-sensitive-text-diff": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "stable-placeholder-anonymizer": { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  "italian-gulpease-readability": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "mojibake-repair": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset", "before-after", "provenance"] },
  "pdf-copy-text-reflow": { class: "text-code", capabilities: ["copy", "download", "reuse", "reset", "before-after", "provenance"] },
  "phone-link-hashtag-mention-extractor": { class: "table", capabilities: ["copy", "download", "reset", "provenance"] },
  "subtitle-srt-vtt-transform": { class: "text-code", capabilities: ["copy", "download", "retry", "reset", "provenance"] },
} as const satisfies Readonly<Record<string, ResultDeclaration>>;

export type TextResultV2ToolId = keyof typeof TEXT_RESULT_V2_DECLARATIONS;

export function textResultV2Declaration(toolId: TextResultV2ToolId): ResultDeclaration {
  return TEXT_RESULT_V2_DECLARATIONS[toolId];
}
