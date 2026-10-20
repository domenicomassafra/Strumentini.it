"""Generate a real JPEG with independently authored ICC APP2 and IPTC APP13.

Requires Pillow's ImageCms (the pinned independent CI image consumer); the
source is the existing valid JPEG fixture. No network or sample user files.
"""

from pathlib import Path
from struct import pack

from PIL import ImageCms


def segment(marker: int, payload: bytes) -> bytes:
    assert len(payload) + 2 < 65536
    return b"\xff" + bytes([marker]) + pack(">H", len(payload) + 2) + payload


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    source = (root / "quality/fixtures/image-format-matrix/source.jpg").read_bytes()
    assert source.startswith(b"\xff\xd8")

    # Pillow/littleCMS generates a standards-compliant sRGB ICC profile with
    # a genuine `desc`/`mluc` label readable by the upstream exifr parser.
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    assert icc[36:40] == b"acsp"
    app2 = segment(0xE2, b"ICC_PROFILE\x00\x01\x01" + icc)

    # Adobe Photoshop Image Resource Block 0x0404 encapsulates IPTC IIM
    # dataset 2:5 (ObjectName). Its length is a big-endian 16-bit scalar.
    title = b"EXIFR 272 IPTC Title"
    iim = b"\x1c\x02\x05" + pack(">H", len(title)) + title
    irb = b"8BIM\x04\x04\x00\x00" + pack(">I", len(iim)) + iim
    if len(iim) % 2:
        irb += b"\x00"
    app13 = segment(0xED, b"Photoshop 3.0\x00" + irb)

    target = root / "tests/fixtures/image-exifr-272/jpeg-icc-iptc.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source[:2] + app2 + app13 + source[2:])
    print(f"Generated {target.relative_to(root)}: {target.stat().st_size} bytes")

    # Independent TIFF IFD0 + GPS oracle: 40°30' N, 16°55' E and orientation 6.
    # Offset references below are relative to the start of TIFF, not APP1.
    tiff = bytearray(240)
    tiff[0:4] = b"II\x2a\x00"
    tiff[4:8] = pack("<I", 8)
    tiff[8:10] = pack("<H", 5)

    def entry(offset: int, tag: int, kind: int, count: int, value: int) -> None:
        tiff[offset:offset + 12] = pack("<HHII", tag, kind, count, value)

    entry(10, 0x010F, 2, 7, 74)
    entry(22, 0x0110, 2, 8, 81)
    entry(34, 0x0112, 3, 1, 6)
    entry(46, 0x8769, 4, 1, 90)
    entry(58, 0x8825, 4, 1, 108)
    tiff[74:81] = b"Camera\x00"
    tiff[81:89] = b"TestCam\x00"
    tiff[90:92] = pack("<H", 1)
    entry(92, 0x9003, 2, 20, 170)
    tiff[108:110] = pack("<H", 4)
    entry(110, 1, 2, 2, 0x4E)
    entry(122, 2, 5, 3, 192)
    entry(134, 3, 2, 2, 0x45)
    entry(146, 4, 5, 3, 216)
    tiff[170:190] = b"2026:10:19 12:34:56\x00"
    for offset, numerator in ((192, 40), (200, 30), (208, 0),
                              (216, 16), (224, 55), (232, 0)):
        tiff[offset:offset + 8] = pack("<II", numerator, 1)
    gps_target = target.with_name("jpeg-gps-orientation.jpg")
    gps_target.write_bytes(source[:2] + segment(0xE1, b"Exif\x00\x00" + tiff) + source[2:])
    print(f"Generated {gps_target.relative_to(root)}: {gps_target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
