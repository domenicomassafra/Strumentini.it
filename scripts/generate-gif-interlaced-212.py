"""Deterministic real GIF89a interlaced image fixture; no image libraries used.

Each of the 8 rows has unique indexed pixels, so bit-flipping a non-interlaced
GIF cannot pass independent decoded-pixel parity. 9-bit LZW literal codes stay
at 9 bits for this 64-pixel image; transparent index 0 and a 120ms GCE delay.
"""
from pathlib import Path


def make_interlaced_gif() -> bytes:
    width = height = 8
    header = b"GIF89a" + bytes((width, 0, height, 0, 0xF7, 0, 0))
    palette = bytes(component for index in range(256)
                    for component in ((index * 3) & 255, (index * 5) & 255, (index * 7) & 255))
    control = b"\x21\xF9\x04\x01\x0C\x00\x00\x00"  # transparent index 0, 12cs
    descriptor = b"\x2C\x00\x00\x00\x00\x08\x00\x08\x00\x40"  # interlaced
    order = list(range(0, height, 8)) + list(range(4, height, 8)) + list(range(2, height, 4)) + list(range(1, height, 2))
    pixels = [row * width + column for row in order for column in range(width)]
    assert len(order) == height and order != list(range(height)) and len(pixels) == 64
    codes = [256, *pixels, 257]
    # The GIF's LZW min code size 8 => clear 256, end 257, 9 bits initially.
    packed = 0
    count = 0
    encoded = bytearray()
    for code in codes:
        packed |= code << count
        count += 9
        while count >= 8:
            encoded.append(packed & 255)
            packed >>= 8
            count -= 8
    if count:
        encoded.append(packed & 255)
    assert len(encoded) < 255
    blocks = bytes((8, len(encoded))) + bytes(encoded) + b"\x00\x3B"
    return header + palette + control + descriptor + blocks


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "quality/fixtures/image-format-matrix/interlaced-8x8.gif"
    target.write_bytes(make_interlaced_gif())
    from PIL import Image
    with Image.open(target) as image:
        assert image.format == "GIF" and image.size == (8, 8) and image.n_frames == 1
        assert image.info.get("duration") == 120
        rgba = image.convert("RGBA")
        for row in range(8):
            for col in range(8):
                index = row * 8 + col
                expected = ((index * 3) & 255, (index * 5) & 255, (index * 7) & 255, 255) if index else (0, 0, 0, 0)
                assert rgba.getpixel((col, row)) == expected, (row, col)
    print(f"IMAGE_212_INTERLACED_SOURCE_INDEPENDENT_PILLOW_PASS bytes={target.stat().st_size} frames=1 8x8=64 rgba_pixels")
