import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import {
  OFFICE_PRINT_CAPABILITIES_56, exportOfficePrintable56, preflightOfficePrint56,
  type PrintableOfficeFile56,
} from "../src/engines/pdf/office-print-pack-56";

/** Genuine editable packages produced with python-docx, xlsxwriter and python-pptx.
 * These are source-side fidelity challenges, NOT successful PDF render fixtures.
 */
const CASES = [
  {
    format: "docx", fixture: "complex.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    requiredParts: ["word/document.xml", "word/styles.xml", "word/fontTable.xml", "word/media/image1.png", "word/media/image2.jpg"],
    requiredMarkup: ["<w:tbl", "<w:hyperlink"],
    sourcePart: "word/document.xml",
    unsupported: ["font", "tabelle", "immagini", "paginazione", "collegamenti"],
  },
  {
    format: "xlsx", fixture: "complex.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    requiredParts: ["xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/drawings/drawing1.xml", "xl/charts/chart1.xml", "xl/media/image1.png"],
    requiredMarkup: ["<row", "<c "],
    sourcePart: "xl/worksheets/sheet1.xml",
    unsupported: ["font", "formule", "grafici", "immagini", "stampa"],
  },
  {
    format: "pptx", fixture: "complex.pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    requiredParts: ["ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slideMasters/slideMaster1.xml", "ppt/charts/chart1.xml", "ppt/embeddings/Microsoft_Excel_Sheet1.xlsx", "ppt/media/image1.png"],
    requiredMarkup: ["<p:sp", "<p:graphicFrame"],
    sourcePart: "ppt/slides/slide1.xml",
    unsupported: ["font", "grafici", "media", "geometria", "master"],
  },
] as const;

describe("#056 real editable Office fidelity corpus: no unapproved page rendering", () => {
  for (const item of CASES) {
    it(`${item.format.toUpperCase()} has actual fidelity challenges and refuses conversion before reading bytes`, async () => {
      const bytes = readFileSync(new URL(`./ooxml-68-corpus/${item.fixture}`, import.meta.url));
      expect(bytes.length).toBeGreaterThan(4_000);
      const zip = unzipSync(bytes);
      for (const part of item.requiredParts) expect(zip[part], `Missing ${part}`).toBeDefined();
      const xml = new TextDecoder().decode(zip[item.sourcePart]);
      for (const tag of item.requiredMarkup) expect(xml).toContain(tag);

      const capability = OFFICE_PRINT_CAPABILITIES_56.find((entry) => entry.format === item.format);
      expect(capability?.decision).toBe("REFUSE_FIDELITY");
      expect(capability?.fidelity).toBe("UNPROVEN_OFFICE_LAYOUT");
      for (const feature of item.unsupported) expect(capability?.reason.toLowerCase()).toContain(feature);

      let reads = 0;
      const office: PrintableOfficeFile56 = {
        name: item.fixture, size: bytes.length, type: item.mime,
        arrayBuffer: async () => { reads++; return Uint8Array.from(bytes).buffer; },
      };
      expect(() => preflightOfficePrint56(office)).toThrow(/PDF56_OFFICE_FIDELITY_REFUSED/u);
      await expect(exportOfficePrintable56(office)).rejects.toThrow(/PDF56_OFFICE_FIDELITY_REFUSED/u);
      expect(reads).toBe(0);

      const disguised = new File([bytes], "rename.txt", { type: "text/plain" });
      await expect(exportOfficePrintable56(disguised)).rejects.toThrow(/PDF56_BINARY_REFUSED/u);
    });
  }
});
