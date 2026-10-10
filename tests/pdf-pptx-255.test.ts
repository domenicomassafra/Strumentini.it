import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import sharp from "sharp";
import {
  buildPdfPptx255, PDF_PPTX_255_SLIDE_HEIGHT_EMU, PDF_PPTX_255_SLIDE_WIDTH_EMU,
} from "../src/engines/pdf/pdf-to-pptx-255";

const template = new Uint8Array(readFileSync(new URL("../src/engines/pdf/pptx-255-blank.pptx", import.meta.url)));

async function fixture(width: number, height: number, rgb: [number, number, number]) {
  return new Uint8Array(await sharp({
    create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  }).png().toBuffer());
}

describe("#255 independent PowerPoint page-as-slide output", () => {
  it("reopens slide order, relationship references, PNG pixels, and exact image placement with independent python-pptx/Pillow", async () => {
    const red = await fixture(80, 40, [220, 15, 15]);
    const blue = await fixture(32, 80, [10, 10, 200]);
    const green = await fixture(50, 50, [10, 180, 15]);
    const frames = [
      { page: 3, bytes: red, width: 80, height: 40 },
      { page: 1, bytes: blue, width: 32, height: 80 },
      { page: 2, bytes: green, width: 50, height: 50 },
    ];
    const result = buildPdfPptx255(frames, template);
    expect(result.slideCount).toBe(3);
    expect(result.selectedPages).toEqual([3, 1, 2]);
    expect(result.fidelity).toBe("page-as-slide-raster");
    expect(result.slideDimensionsEmu).toEqual({ width: PDF_PPTX_255_SLIDE_WIDTH_EMU, height: PDF_PPTX_255_SLIDE_HEIGHT_EMU });
    expect(result.slides[0]).toMatchObject({ page: 3, imageWidth: 80, imageHeight: 40 });
    expect(result.slides[1]).toMatchObject({ page: 1, imageWidth: 32, imageHeight: 80 });
    const files = unzipSync(result.bytes);
    expect(Object.keys(files).filter(k => /^ppt\/slides\/slide\d+\.xml$/u.test(k))).toHaveLength(3);
    expect(files["ppt/media/pdf-page-2.png"]).toEqual(blue);
    // This is a *second* OOXML reader, not fflate and not our XML parser.
    const python = String.raw`
import base64, hashlib, io, json, sys, zipfile
from pptx import Presentation
from PIL import Image
data = json.loads(sys.stdin.read())
raw = base64.b64decode(data["pptx"])
prs = Presentation(io.BytesIO(raw))
assert len(prs.slides) == 3, len(prs.slides)
assert (prs.slide_width,prs.slide_height) == (9144000,6858000)
expected = data["expected"]
with zipfile.ZipFile(io.BytesIO(raw)) as z:
    assert z.testzip() is None, "ZIP CRC"
    for i,slide in enumerate(prs.slides):
        assert len(slide.shapes) == 1, "Each slide must contain only the one raster page"
        shape = slide.shapes[0]
        assert shape.shape_type == 13, "Expected native PPTX picture shape"
        assert shape.name == f"Pagina PDF {expected[i]['page']} (immagine)"
        image = shape.image
        with Image.open(io.BytesIO(image.blob)) as raster:
            raster.load()
            assert raster.size == tuple(expected[i]['pixels'])
            assert raster.convert("RGB").getpixel((0,0)) == tuple(expected[i]['color'])
            assert image.content_type == "image/png"
            # Independently reconstruct the rendered slide matte+picture:
            # white canvas with centered, aspect-correct raster.
            canvas = Image.new("RGB", (1000,750), "white")
            width = round(shape.width * 1000 / 9144000)
            height = round(shape.height * 750 / 6858000)
            x = round(shape.left * 1000 / 9144000)
            y = round(shape.top * 750 / 6858000)
            assert x >= 0 and y >= 0 and x + width <= 1001 and y + height <= 751
            assert abs(width/height - raster.width/raster.height) < .02
            canvas.paste(raster.resize((width,height)),(x,y))
            midpoint = canvas.getpixel((x + width//2,y + height//2))
            assert midpoint == tuple(expected[i]['color']),midpoint
        assert (shape.left,shape.top,shape.width,shape.height) == tuple(expected[i]['emu'])
print("PDF_PPTX_255_INDEPENDENT_REOPEN_PASS slides=3 image-bytes=3 geometry=3 visual=3 zip_crc=PASS")
`;
    const recheck = execFileSync("python3", ["-c", python], {
      input: JSON.stringify({
        pptx: Buffer.from(result.bytes).toString("base64"),
        expected: [
          { page: 3, pixels: [80, 40], color: [220, 15, 15], emu: [result.slides[0]!.x, result.slides[0]!.y, result.slides[0]!.cx, result.slides[0]!.cy] },
          { page: 1, pixels: [32, 80], color: [10, 10, 200], emu: [result.slides[1]!.x, result.slides[1]!.y, result.slides[1]!.cx, result.slides[1]!.cy] },
          { page: 2, pixels: [50, 50], color: [10, 180, 15], emu: [result.slides[2]!.x, result.slides[2]!.y, result.slides[2]!.cx, result.slides[2]!.cy] },
        ],
      }),
      encoding: "utf8",
    });
    expect(recheck).toContain("PDF_PPTX_255_INDEPENDENT_REOPEN_PASS");
  });

  it("rejects missing pages, oversized count, forged PNG dimensions and cancellation before publishing", async () => {
    expect(() => buildPdfPptx255([], template)).toThrow("PAGE_LIMIT");
    const one = await fixture(8, 8, [20, 30, 40]);
    expect(() => buildPdfPptx255(Array.from({ length: 9 }, (_, n) => ({ page: n + 1, bytes: one, width: 8, height: 8 })), template)).toThrow("PAGE_LIMIT");
    expect(() => buildPdfPptx255([{ page: 1, bytes: one, width: 9, height: 8 }], template)).toThrow("BAD_PNG");
    const abort = new AbortController();
    abort.abort();
    expect(() => buildPdfPptx255([{ page: 1, bytes: one, width: 8, height: 8 }], template, abort.signal)).toThrow("annullata");
  });
});
