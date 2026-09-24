export type PdfCitationStyle = "apa" | "mla" | "chicago";

export interface PdfPageCitationHelperInput {
  author: string;
  title: string;
  year: string | number;
  pages: string;
  style?: PdfCitationStyle;
}

export interface PdfPageCitationHelperOutput {
  citation: string;
  pages: string;
  pageCount: number;
  style: PdfCitationStyle;
  engineVersion: string;
}
