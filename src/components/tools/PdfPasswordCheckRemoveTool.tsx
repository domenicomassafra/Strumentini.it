import { PdfTool } from "./pdf/PdfTool";
export function PdfPasswordCheckRemoveTool() { return <PdfTool toolId="pdf-password-check-remove" title="PDF file" description="Check encryption markers locally; encrypted files are never brute-forced or bypassed." actionLabel="Check PDF" optionMode="password" />; }
