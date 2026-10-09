"""Independent pypdf, pdfminer.six and Pillow proof for bounded #218 outputs.

Usage: python3 pdf-mixed-forensics-218.py original.pdf output.pdf scan|jpeg|unchanged
No shared production PDF engine/parser/writer modules are imported.
"""
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image
from pdfminer.high_level import extract_text
from pypdf import PdfReader


def compressed(image):
    image = image.get_object()
    # Raw stream bytes are preserved through pypdf's independent parser.
    return image._data


def inspect(before_path: Path, after_path: Path, profile: str):
    original = PdfReader(before_path, strict=True)
    result = PdfReader(after_path, strict=True)
    assert len(original.pages) == len(result.pages) == 1
    before = original.pages[0]
    after = result.pages[0]
    assert list(before.mediabox) == list(after.mediabox), "Page MediaBox drift"
    assert before.get("/Rotate", 0) == after.get("/Rotate", 0), "Page rotation drift"
    assert before.get_contents().get_data() == after.get_contents().get_data(), "Page content stream changed"
    orig_text = extract_text(str(before_path))
    new_text = extract_text(str(after_path))
    assert orig_text == new_text and "SEARCHABLE_MIXED_VECTOR_TEXT_218" in new_text, "Searchable text changed"
    source_xo = before["/Resources"]["/XObject"]
    output_xo = after["/Resources"]["/XObject"]
    assert set(source_xo.keys()) == set(output_xo.keys()), "Image references dropped"
    # JPEG source genuinely decodes with independent Pillow.
    with Image.open(io.BytesIO(compressed(source_xo["/ImJpeg"]))) as image:
        assert image.format == "JPEG" and image.size == (360, 280)
        image.load()
    original_jpeg = compressed(source_xo["/ImJpeg"])
    rewritten_jpeg = compressed(output_xo["/ImJpeg"])
    original_scan = compressed(source_xo["/ImFlate"])
    rewritten_scan = compressed(output_xo["/ImFlate"])
    if profile in ("scan", "scan-gray"):
        assert rewritten_jpeg == original_jpeg, "JPEG layer changed during Flate scan mode"
        assert output_xo["/ImFlate"].get_object()["/Filter"] == "/DCTDecode"
        converted = compressed(output_xo["/ImFlate"])
        with Image.open(io.BytesIO(converted)) as image:
            assert image.format == "JPEG" and image.size == (256, 199)
            image.load()
            if profile == "scan-gray":
                rgb = image.convert("RGB")
                samples = [rgb.getpixel((x, y)) for y in range(0, 199, 17) for x in range(0, 256, 23)]
                err = sum(abs(r-g) + abs(g-b) for r, g, b in samples) / len(samples)
                assert err < 3, ("Grayscale pixels not grayscale", err)
        assert len(converted) < len(original_scan), "No true embedded scan saving"
    elif profile == "jpeg":
        assert rewritten_scan == original_scan, "PNG-predictor Flate layer changed during JPEG-only mode"
        assert output_xo["/ImJpeg"].get_object()["/Filter"] == "/DCTDecode"
        with Image.open(io.BytesIO(rewritten_jpeg)) as image:
            assert image.format == "JPEG" and image.size == (360, 280)
            image.load()
        assert len(rewritten_jpeg) < len(original_jpeg), "JPEG actually not recompressed"
    elif profile == "unchanged":
        assert after_path.read_bytes() == before_path.read_bytes(), "Refused profile changed source bytes"
    else:
        raise ValueError(profile)
    if "indexed" in before_path.name:
        original_indexed = source_xo["/ImIndexed"].get_object()
        result_indexed = output_xo["/ImIndexed"].get_object()
        assert original_indexed["/ColorSpace"][0] == result_indexed["/ColorSpace"][0] == "/Indexed"
        assert compressed(source_xo["/ImIndexed"]) == compressed(output_xo["/ImIndexed"]), "Indexed layer rewritten"
    if "bomb" in before_path.name:
        old_bomb = source_xo["/ImBomb"].get_object()
        new_bomb = output_xo["/ImBomb"].get_object()
        assert (old_bomb["/Width"], old_bomb["/Height"]) == (new_bomb["/Width"], new_bomb["/Height"]) == (100_000, 100_000)
        assert compressed(source_xo["/ImBomb"]) == compressed(output_xo["/ImBomb"]), "High-risk unrendered image rewritten"
    return {"mode": profile, "source": len(before_path.read_bytes()), "output": len(after_path.read_bytes()),
            "same_contents": True, "same_text": True, "jpeg_source_sha": hashlib.sha256(original_jpeg).hexdigest()[:12]}


if __name__ == "__main__":
    print(json.dumps(inspect(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]), sort_keys=True))
