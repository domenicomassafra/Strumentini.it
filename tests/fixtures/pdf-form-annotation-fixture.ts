export function formAnnotationFixture(flag: number, subtype: "Widget" | "Link" = "Widget"): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [7 0 R] >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R /Annots [5 0 R] >>
endobj
4 0 obj
<< /Length 42 >>
stream
BT /F1 18 Tf 30 310 Td (Visible base) Tj ET
endstream
endobj
5 0 obj
<< /Type /Annot /Subtype /${subtype} /Rect [30 40 180 80] /F ${flag} /T (widget) /Parent 7 0 R /AP << /N 9 0 R >> >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
7 0 obj
<< /FT /Tx /T (client) /V (Alice) /Kids [5 0 R] >>
endobj
9 0 obj
<< /Type /XObject /Subtype /Form /BBox [0 0 150 40] /Resources << /Font << /F1 6 0 R >> >> /Length 39 >>
stream
BT /F1 16 Tf 10 10 Td (Alice) Tj ET
endstream
endobj
trailer
<< /Size 10 /Root 1 0 R >>
startxref
0
%%EOF`);
}
