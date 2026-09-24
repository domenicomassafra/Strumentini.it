import type { PdfFileInput } from "../pdf/contracts";
import type { PdfLink } from "../../engines/pdf";
export type PdfLinkExtractorInput = PdfFileInput;
export interface PdfLinkExtractorOutput { readonly links: readonly PdfLink[]; readonly pageCount: number }
