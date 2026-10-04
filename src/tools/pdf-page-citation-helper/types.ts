import type { PdfPageCitation } from "../../engines/research-knowledge";

export type PdfCitationStyle = "apa" | "mla" | "chicago";

export interface PdfPageCitationHelperInput {
  author: string;
  title: string;
  year: string | number;
  pages: string;
  style?: PdfCitationStyle;
}

export interface PdfPageCitationHelperOutput extends PdfPageCitation {
  engineVersion: string;
}
