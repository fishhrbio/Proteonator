"""Create a small original ProView icon with Python standard library only."""
from __future__ import annotations
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets"
OUT.mkdir(exist_ok=True)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def png(size: int) -> bytes:
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            xx = (x + 0.5) / size * 2 - 1
            yy = (y + 0.5) / size * 2 - 1
            radius = math.hypot(xx, yy)
            teal_ring = abs(radius - 0.61) < 0.065
            stem = abs(xx + 0.28) < 0.055 and -0.34 < yy < 0.31
            top = -0.34 < yy < -0.23 and -0.30 < xx < -0.04
            arc = abs(math.hypot(xx + 0.14, yy + 0.14) - 0.16) < 0.055 and xx > -0.18
            vee = -0.02 < yy < 0.34 and abs(abs(xx - 0.22) - (0.34 - yy) * 0.48) < 0.045
            atom = math.hypot(xx - 0.42, yy + 0.31) < 0.065
            if teal_ring or stem or top or arc:
                color = (100, 221, 202, 255)
            elif atom or vee:
                color = (255, 210, 139, 255)
            else:
                color = (11, 17, 27, 255)
            rows.extend(color)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + png_chunk(b"IEND", b"")


sizes = (16, 32, 48, 64, 128, 256)
images = [png(n) for n in sizes]
(OUT / "icon.png").write_bytes(png(512))
header = struct.pack("<HHH", 0, 1, len(images))
offset = 6 + 16 * len(images)
entries = bytearray()
for n, image in zip(sizes, images):
    entries.extend(struct.pack("<BBBBHHII", n if n < 256 else 0, n if n < 256 else 0, 0, 0, 1, 32, len(image), offset))
    offset += len(image)
(OUT / "icon.ico").write_bytes(header + entries + b"".join(images))
print("Created assets/icon.png and assets/icon.ico")
