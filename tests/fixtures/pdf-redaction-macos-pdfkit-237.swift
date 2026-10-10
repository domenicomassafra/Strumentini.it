// macOS independent post-export consumer: PDFKit extract/copy/reopen plus
// CoreGraphics print-to-PDF page transfer and PDFKit rendered preview.
// Usage: swift tests/fixtures/pdf-redaction-macos-pdfkit-237.swift exported-*.pdf
import Foundation
import PDFKit
import CoreGraphics
import AppKit

func demand(_ result: @autoclosure () -> Bool, _ description: String) {
    guard result() else {
        fputs("PDFKit 237 REFUSED: \(description)\n", stderr)
        exit(2)
    }
}

var checked = 0
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let original = PDFDocument(url: url),
          let cgOriginal = CGPDFDocument(url as CFURL) else {
        fputs("Cannot open PDF in independent macOS PDFKit/CoreGraphics: \(path)\n", stderr)
        exit(2)
    }
    demand(original.pageCount == cgOriginal.numberOfPages && original.pageCount >= 1, "page count")
    demand(original.string?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true,
           "PDFKit copy/search extraction found hidden text")

    for number in 0..<original.pageCount {
        guard let page = original.page(at: number), let cgPage = cgOriginal.page(at: number + 1) else {
            fatalError("Missing independently reopened PDF page")
        }
        demand(page.annotations.isEmpty, "PDFKit recovered annotations")
        let box = page.bounds(for: .mediaBox)
        let w = Int(ceil(box.width)), h = Int(ceil(box.height))
        demand(w >= 30 && h >= 30 && w <= 1200 && h <= 1200, "invalid PDFKit print page bounds")

        if number == 0 {
            let thumbnail = page.thumbnail(of: NSSize(width: w, height: h), for: .mediaBox)
            guard let tiff = thumbnail.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) else {
                fatalError("PDFKit print-preview raster unavailable")
            }
            let x = bitmap.pixelsWide / 2
            let upper = bitmap.colorAt(x: x, y: bitmap.pixelsHigh / 4)?.usingColorSpace(.deviceRGB)
            let lower = bitmap.colorAt(x: x, y: bitmap.pixelsHigh * 3 / 4)?.usingColorSpace(.deviceRGB)
            demand(upper != nil && lower != nil, "PDFKit render samples")
            demand(max(upper!.redComponent, upper!.greenComponent, upper!.blueComponent) <= 0.02,
                   "redacted upper half not black in PDFKit independent print preview")
            demand(max(lower!.redComponent, lower!.greenComponent, lower!.blueComponent) > 0.02,
                   "non-redacted lower half lost in PDFKit independent print preview")
        }

        // Print every page to a fresh PDF context, independently of the TS
        // exporter, then confirm that re-opening the printed PDF cannot copy
        // any text that was covered by the original redaction.
        let printed = NSMutableData()
        guard let sink = CGDataConsumer(data: printed) else { fatalError("PDF print sink") }
        var media = cgPage.getBoxRect(.mediaBox)
        guard let printer = CGContext(consumer: sink, mediaBox: &media, nil) else {
            fatalError("CoreGraphics PDF print context")
        }
        printer.beginPDFPage(nil)
        printer.drawPDFPage(cgPage)
        printer.endPDFPage()
        printer.closePDF()
        guard let reopened = PDFDocument(data: printed as Data) else {
            fatalError("PDFKit cannot reopen print-to-PDF output")
        }
        demand(reopened.pageCount == 1, "printed page missing")
        demand(reopened.string?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true,
               "copy/extract from printed PDF recovered hidden text")
        checked += 1
    }
}
print("PASS #237 PDFKit/CoreGraphics independent reopen/copy/print: \(checked) pages")
