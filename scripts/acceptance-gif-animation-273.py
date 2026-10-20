"""External Pillow consumer oracle for #273. Modes: make DIR | compare SOURCE OUTPUT."""
import json
import runpy
import sys
from pathlib import Path
from PIL import Image, ImageDraw

PALETTE = [component for color in (
    (255, 255, 255), (255, 0, 0), (0, 255, 0), (0, 0, 255),
    (255, 255, 0), (255, 0, 255), (0, 255, 255), (0, 0, 0))
    for component in color] + [0] * (256 * 3 - 8 * 3)


def make(directory: Path) -> None:
    directory.mkdir(exist_ok=True, parents=True)
    frames = []
    for index, rectangle in enumerate([
        (0, 0, 2, 2), (6, 0, 9, 2), (0, 6, 2, 9),
        (6, 6, 9, 9), (3, 3, 6, 6), (5, 4, 7, 6),
    ]):
        image = Image.new("P", (10, 10), 0)
        image.putpalette(PALETTE)
        ImageDraw.Draw(image).rectangle(rectangle, fill=index + 1)
        frames.append(image)
    target = directory / "disposal-offset-loop.gif"
    frames[0].save(target, format="GIF", save_all=True, append_images=frames[1:],
                   duration=[100, 200, 300, 400, 500, 200], loop=2,
                   disposal=[0, 1, 2, 3, 1, 1], optimize=True, transparency=0)
    with Image.open(target) as gif:
        disposals = []
        boxes = []
        for n in range(gif.n_frames):
            gif.seek(n)
            disposals.append(gif.disposal_method)
            boxes.append(gif.dispose_extent)
        assert disposals == [0, 1, 2, 3, 1, 1], disposals
        assert any(box != (0, 0, 10, 10) for box in boxes), boxes
        assert gif.info["loop"] == 2
        print("PILLOW_SOURCE", json.dumps({"disposals": disposals, "frameBoxes": boxes}))

    # Independent interlaced 8×8 indexed GIF fixture generator already in #212.
    interlace = runpy.run_path(str(Path(__file__).with_name("generate-gif-interlaced-212.py")))["make_interlaced_gif"]()
    # Include second valid interlaced image with its own actual LZW stream.
    descriptor_at = 13 + 256 * 3 + 8
    two = (interlace[:-1] + bytes((0x21, 0xF9, 4, 4, 12, 0, 0, 0))
           + interlace[descriptor_at:-1] + bytes((0x3B,)))
    interlaced = directory / "interlaced-animated.gif"
    interlaced.write_bytes(two)
    with Image.open(interlaced) as gif:
        assert gif.n_frames == 2, gif.n_frames
        for n in range(2):
            gif.seek(n)
            assert gif.size == (8, 8)
            assert gif.info.get("duration") == 120
            assert gif.convert("RGBA").getpixel((1, 7))[:3] == (171, 29, 143)
    print("PILLOW_INTERLACED_SOURCE_PASS")

    # Real, externally decoded 31-frame GIF to exercise frame-count refusal.
    many = []
    for n in range(31):
        frame = Image.new("P", (10, 10), 1 + (n % 7))
        frame.putpalette(PALETTE)
        many.append(frame)
    many[0].save(directory / "too-many-frames.gif", format="GIF", save_all=True,
                 append_images=many[1:], duration=[50] * len(many),
                 disposal=1, loop=0, optimize=False)
    with Image.open(directory / "too-many-frames.gif") as verified:
        assert verified.n_frames == 31, verified.n_frames


def compare(source: Path, result: Path) -> None:
    with Image.open(source) as original, Image.open(result) as converted:
        assert original.n_frames == converted.n_frames, "frame count"
        assert original.size == converted.size, "logical geometry"
        assert original.info.get("loop") == converted.info.get("loop"), (
            "loop", original.info.get("loop"), converted.info.get("loop"))
        for n in range(original.n_frames):
            original.seek(n)
            converted.seek(n)
            assert original.info.get("duration") == converted.info.get("duration"), ("delay", n)
            expected = Image.new("RGBA", original.size, (255, 255, 255, 255))
            expected.alpha_composite(original.convert("RGBA"))
            actual = converted.convert("RGB")
            exp_rgb = expected.convert("RGB")
            assert actual.tobytes() == exp_rgb.tobytes(), (
                "independent decoded canvas mismatch", n,
                sum(a != b for a, b in zip(actual.tobytes(), exp_rgb.tobytes())))
        print("PILLOW_EXTERNAL_DECODE_PASS", source.name, converted.n_frames,
              converted.size, converted.info.get("loop"))


if __name__ == "__main__":
    if sys.argv[1] == "make":
        make(Path(sys.argv[2]))
    elif sys.argv[1] == "compare":
        compare(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        raise SystemExit("expected: make DIR | compare SOURCE OUTPUT")
