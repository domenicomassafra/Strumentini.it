"""Reproducible *real Office library* fixtures for ticket 264.

Run: python3 tests/ooxml-media-generate-fixtures.py
Dependencies: Pillow, python-docx, python-pptx, xlsxwriter.
Includes two actual embedded rasters and Office-authored relationships/drawings.
"""
from io import BytesIO
from pathlib import Path
import random

from PIL import Image, ImageDraw
from docx import Document
from docx.shared import Inches
from pptx import Presentation
from pptx.util import Inches as SlideInches
import xlsxwriter

OUT = Path(__file__).with_name("ooxml-media-fixtures")
OUT.mkdir(parents=True, exist_ok=True)


def source_images():
    random_generator = random.Random(264)
    image = Image.new("RGB", (420, 280), "#f3f4ff")
    draw = ImageDraw.Draw(image)
    for index in range(450):
        x, y = random_generator.randrange(420), random_generator.randrange(280)
        color = tuple(random_generator.randrange(256) for _ in range(3))
        draw.rectangle((x, y, x + 9, y + 8), fill=color)
    png = BytesIO()
    image.save(png, "PNG", compress_level=0)  # valid but intentionally unoptimized
    jpeg = BytesIO()
    image.save(jpeg, "JPEG", quality=99, subsampling=0)
    return png.getvalue(), jpeg.getvalue()


png, jpeg = source_images()
(OUT / "media-original.png").write_bytes(png)
(OUT / "media-original.jpg").write_bytes(jpeg)

doc = Document()
doc.add_heading("Ticket 264 - editable DOCX with raster media", 1)
doc.add_paragraph("Original text and image relationships must remain editable.")
for kind, bytes_ in (("PNG", png), ("JPEG", jpeg)):
    doc.add_paragraph(kind + " picture below")
    doc.add_picture(BytesIO(bytes_), width=Inches(2.1))
doc.save(OUT / "embedded.docx")

deck = Presentation()
slide = deck.slides.add_slide(deck.slide_layouts[6])
for index, bytes_ in enumerate((png, jpeg)):
    slide.shapes.add_picture(BytesIO(bytes_), SlideInches(0.6 + index * 4), SlideInches(1), width=SlideInches(3))
deck.save(OUT / "embedded.pptx")

book = xlsxwriter.Workbook(OUT / "embedded.xlsx")
sheet = book.add_worksheet("Media")
sheet.write("A1", "Editable spreadsheet with two linked embedded rasters")
sheet.write("A2", 264)
for index, bytes_ in enumerate((png, jpeg)):
    sheet.insert_image(3, 1 + index * 9, f"image{index}.{'png' if index == 0 else 'jpg'}",
                       {"image_data": BytesIO(bytes_), "x_scale": 0.55, "y_scale": 0.55})
book.close()

for kind in ("docx", "pptx", "xlsx"):
    file = OUT / f"embedded.{kind}"
    print(kind, file.stat().st_size, "bytes")
