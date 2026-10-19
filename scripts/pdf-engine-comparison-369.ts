/** STR-369: independently executed editing scope and feature/license/bundle/mobile matrix. */
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { watermarkPdf } from "../src/engines/pdf/watermark";
import {
  hash, readBounded, refuse, inspectPdfEngineProvenance369, type PdfInspection369,
} from "./audit-pdf-engine-provenance-369";

export interface PdfComparison369 {
  readonly engine: "in-house PDF parser/writer" | "Mozilla PDF.js" | "pdfstudio / qpdf WASM" | "@cantoo/pdf-lib (feasibility)" | "pdf-lib" | "MuPDF" | "macOS PDFKit";
  readonly installed: boolean;
  readonly licenseGate: string;
  readonly source: string;
  readonly checkedAt: string;
  readonly licenseSource: string;
  readonly capabilities: readonly string[];
  readonly unsupported: readonly string[];
  readonly browserBundle: string;
  readonly mobileEvidence: string;
  readonly decision: "KEEP_SCOPED" | "RENDER_ONLY" | "NO_ADOPT" | "NOT_APPLICABLE";
}
export interface PdfAudit369 {
  readonly inspection: PdfInspection369;
  readonly probe: {
    readonly fixturePageCount: number; readonly extractedText: string; readonly fixtureSha256: string;
    readonly roundTrip: {
      readonly operation: "ADD_VISIBLE_TEXT_OVERLAY_PAGE_1";
      readonly originalSha256: string; readonly outputSha256: string;
      readonly pageCount: number; readonly firstPageText: string; readonly untouchedPageText: string;
      readonly independentReader: "pdfjs-dist/legacy"; readonly verdict: "PASS";
    };
  };
  readonly comparison: readonly PdfComparison369[];
  readonly adoption: "NO_ADOPT_NO_GOLD";
}
export async function auditInstalledPdfEngine369(projectRoot: string): Promise<PdfAudit369> {
  const root = realpathSync(projectRoot);
  const inspection = inspectPdfEngineProvenance369(root);
  const fixture = readBounded(root, "quality/fixtures/pdf-gold/simple-2page.pdf", 100);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const independentReadback = async (bytes: Uint8Array): Promise<{ pages: number; text: string[] }> => {
    const loader = pdfjs.getDocument({
      data: Uint8Array.from(bytes), useSystemFonts: false, disableAutoFetch: true, disableStream: true,
      standardFontDataUrl: join(root, "node_modules/pdfjs-dist/standard_fonts") + "/",
    });
    try {
      const doc = await loader.promise;
      const text: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const words = await page.getTextContent();
        text.push(words.items.map((item) => "str" in item ? item.str : "").join(" ").trim());
        page.cleanup();
      }
      return { pages: doc.numPages, text };
    } catch (error) {
      refuse("PDF.js independent readback refused: " + String(error).slice(0, 150));
    } finally {
      await loader.destroy().catch(() => undefined);
    }
  };
  const original = await independentReadback(fixture);
  const pages = original.pages;
  const text = original.text;
  if (pages !== 2) refuse("PDF.js independent fixture page count mismatch");
  const extractedText = text.join(" ").slice(0, 1000);
  if (!/alpha/iu.test(extractedText) || !/beta/iu.test(extractedText)) {
    refuse("PDF.js text extraction fixture semantics not independently proved");
  }
  // Existing first-party editor, not PDF.js, writes an actual PDF content stream.
  // Reopening with an independent implementation proves the admitted subset.
  const result = watermarkPdf(Uint8Array.from(fixture), {
    pages: "1", text: "STR369_OVERLAY", opacity: 1, rotation: 0, position: "center",
  });
  if (hash(result.artifact.bytes) === hash(fixture)) refuse("PDF editor did not change PDF bytes");
  const edited = await independentReadback(result.artifact.bytes);
  if (edited.pages !== 2
    || !/alpha/iu.test(edited.text[0] ?? "")
    || !/STR369_OVERLAY/u.test(edited.text[0] ?? "")
    || edited.text[1] !== original.text[1]
    || /STR369_OVERLAY/u.test(edited.text[1] ?? "")) {
    refuse("independent PDF.js overlay round-trip text/page preservation mismatch");
  }
  const vendorRoot = "src/engines/pdf/vendor/pdfstudio/";
  const provenance = readBounded(root, vendorRoot + "PROVENANCE.md", 100).toString("utf8");
  const studioLicense = readBounded(root, vendorRoot + "LICENSE", 200).toString("utf8");
  const qpdfWasm = readBounded(root, vendorRoot + "wasm/qpdf.wasm", 4096);
  const studioEntry = readBounded(root, vendorRoot + "index.js", 100);
  if (!/pdfstudio@0\.4\.0/u.test(provenance) || !/github\.com\/fayazara\/pdfstudio/u.test(provenance)
    || !/Apache License\s+Version 2\.0/u.test(studioLicense)
    || !provenance.includes(hash(qpdfWasm))) {
    refuse("pdfstudio vendor provenance/license/WASM mismatch");
  }
  const mainBytes = inspection.assets.find((item) => item.path === "build/pdf.mjs")?.bytes ?? 0;
  const workerBytes = inspection.assets.find((item) => item.path === "build/pdf.worker.mjs")?.bytes ?? 0;
  const mainGzip = gzipSync(readBounded(root, "node_modules/pdfjs-dist/build/pdf.mjs")).length;
  const workerGzip = gzipSync(readBounded(root, "node_modules/pdfjs-dist/build/pdf.worker.mjs")).length;
  const checkedAt = "2026-10-19";
  return {
    inspection,
    probe: { fixturePageCount: pages, extractedText, fixtureSha256: hash(fixture),
      roundTrip: { operation: "ADD_VISIBLE_TEXT_OVERLAY_PAGE_1", originalSha256: hash(fixture),
        outputSha256: hash(result.artifact.bytes), pageCount: edited.pages,
        firstPageText: edited.text[0] ?? "", untouchedPageText: edited.text[1] ?? "",
        independentReader: "pdfjs-dist/legacy", verdict: "PASS" } },
    comparison: [
      { engine: "in-house PDF parser/writer", installed: true, licenseGate: "FIRST_PARTY_SOURCE_REVIEW_REQUIRED",
        source: "src/engines/pdf/parser.ts + writer.ts + watermark.ts",
        checkedAt, licenseSource: "first-party source in this repository; third-party rights in input PDFs are separate",
        capabilities: ["local PDF object parse/write", "visible text overlay page 1 round-trip PASS (PDF.js independent)"],
        unsupported: ["arbitrary replacement of existing glyphs, font reflow and redaction NOT_PROVEN"],
        browserBundle: "source in application chunks; production transferred bytes NOT_MEASURED",
        mobileEvidence: "NOT_RUN: mobile physical memory and large/corrupt PDF load", decision: "KEEP_SCOPED" },
      { engine: "Mozilla PDF.js", installed: true, licenseGate: "APACHE_2_0_DECLARED_RIGHTS_UNREVIEWED",
        source: "node_modules/pdfjs-dist@" + inspection.identity.version,
        checkedAt, licenseSource: "https://github.com/mozilla/pdf.js/blob/master/LICENSE + installed LICENSE and 10 component notices",
        capabilities: ["real 2-page PDF fixture parsing", "extract alpha/beta and added overlay text", "browser rendering"],
        unsupported: ["semantic editing of arbitrary existing text NOT_PROVEN", "transitive WASM/QuickJS rights NOT_CLEARED"],
        browserBundle: "local main " + mainBytes + "B raw/" + mainGzip + "B gzip + worker " + workerBytes
          + "B raw/" + workerGzip + "B gzip; codec assets separate; deployed transfer NOT_MEASURED",
        mobileEvidence: "NOT_RUN: physical peak RAM and decode profile", decision: "RENDER_ONLY" },
      { engine: "pdfstudio / qpdf WASM", installed: true, licenseGate: "APACHE_2_0_DECLARED_TRANSITIVES_UNREVIEWED",
        source: vendorRoot + "PROVENANCE.md (pdfstudio@0.4.0, published npm tarball provenance claim)",
        checkedAt, licenseSource: "src/engines/pdf/vendor/pdfstudio/LICENSE; https://github.com/qpdf/qpdf (Apache-2.0)",
        capabilities: ["existing local password/protection operations through qpdf wrapper"],
        unsupported: ["arbitrary existing page text editing NOT_PROVEN", "vendored qpdf/zlib/libjpeg chain independently reattested NOT_RUN"],
        browserBundle: "local qpdf WASM " + qpdfWasm.length + "B raw/" + gzipSync(qpdfWasm).length
          + "B gzip + index.js " + studioEntry.length + "B raw; lazy-loaded; production transfer NOT_MEASURED",
        mobileEvidence: "NOT_RUN: physical WASM peak RAM and decode profile", decision: "KEEP_SCOPED" },
      { engine: "pdf-lib", installed: false, licenseGate: "MIT_DECLARED_NOT_ADOPTED",
        source: "https://github.com/Hopding/pdf-lib (upstream README/docs, checked 2026-10-19)",
        checkedAt, licenseSource: "https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md (MIT)",
        capabilities: ["document/page creation, overlays, form-field edit per upstream documentation"],
        unsupported: ["existing non-form page text replacement unsupported per upstream documentation"],
        browserBundle: "NOT_MEASURED: package not installed", mobileEvidence: "NOT_RUN", decision: "NO_ADOPT" },
      { engine: "@cantoo/pdf-lib (feasibility)", installed: false, licenseGate: "MIT_DECLARED_NOT_PRODUCT_RUNTIME",
        source: "spikes/heavy-local-feasibility/package.json (pinned 2.11.1, experimental donor only)",
        checkedAt, licenseSource: "https://github.com/cantoo-scribe/pdf-lib (MIT package manifest in feasibility spike)",
        capabilities: ["experimental PDF manipulation donor in isolated feasibility spike"],
        unsupported: ["production editor integration NOT_RUN", "arbitrary existing text replacement NOT_PROVEN"],
        browserBundle: "NOT_MEASURED: not shipped as application dependency",
        mobileEvidence: "NOT_RUN", decision: "NO_ADOPT" },
      { engine: "MuPDF", installed: false, licenseGate: "AGPL_OR_COMMERCIAL_UNAPPROVED",
        source: "https://github.com/ArtifexSoftware/mupdf.js (official JS/WASM; NOT installed)",
        checkedAt, licenseSource: "https://artifex.com/licensing (AGPLv3 or commercial agreement; no approval)",
        capabilities: ["PDF manipulation advertised upstream; not exercised locally"],
        unsupported: ["proprietary deployment under current rights NO_GO"],
        browserBundle: "NOT_MEASURED: NOT_ADOPTED", mobileEvidence: "NOT_RUN", decision: "NO_ADOPT" },
      { engine: "macOS PDFKit", installed: process.platform === "darwin", licenseGate: "NATIVE_OS_NOT_BROWSER_VENDOR",
        source: "Apple native PDFKit; OS binding, not browser engine", checkedAt,
        licenseSource: "https://developer.apple.com/documentation/pdfkit; Apple platform-only",
        capabilities: ["native platform PDF viewing APIs"],
        unsupported: ["browser client runtime not available"],
        browserBundle: "NOT_APPLICABLE", mobileEvidence: "NOT_APPLICABLE to cross-platform browser", decision: "NOT_APPLICABLE" },
    ],
    adoption: "NO_ADOPT_NO_GOLD",
  };
}
