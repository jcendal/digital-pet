"""Generate LCD paths from the locally downloaded Omnipet dot frames.

Download frames 0 and 1 for every name returned by /api/digitamas into the animation
package's assets/digitamas directory before running this script. No runtime
network requests or hatch rules are generated.
"""

import hashlib
import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "packages/digital-pet-animation/assets/digitamas"


def pixels_from_png(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Expected PNG")
    offset, compressed = 8, bytearray()
    while offset < len(data):
        size = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        checksum = struct.unpack(">I", data[offset + 8 + size:offset + 12 + size])[0]
        if zlib.crc32(kind + payload) != checksum:
            raise ValueError("Invalid PNG checksum")
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            if (width, height, depth, color, compression, filtering, interlace) != (48, 48, 8, 6, 0, 0, 0):
                raise ValueError("Expected a non-interlaced 48×48 RGBA frame")
        elif kind == b"IDAT":
            compressed.extend(payload)
        offset += size + 12
    raw = zlib.decompress(compressed)
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise ValueError("Invalid frame length")
    rows = []
    for y in range(height):
        method = raw[y * (stride + 1)]
        row = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        previous = rows[-1] if rows else bytearray(stride)
        for x in range(stride):
            left = row[x - 4] if x >= 4 else 0
            above = previous[x]
            corner = previous[x - 4] if x >= 4 else 0
            if method == 1:
                prediction = left
            elif method == 2:
                prediction = above
            elif method == 3:
                prediction = (left + above) // 2
            elif method == 4:
                p = left + above - corner
                distances = [abs(p - left), abs(p - above), abs(p - corner)]
                prediction = [left, above, corner][distances.index(min(distances))]
            elif method == 0:
                prediction = 0
            else:
                raise ValueError("Unknown PNG filter")
            row[x] = (row[x] + prediction) % 256
        rows.append(row)
    # Source pixels are 3×3 blocks. Respect alpha: transparent green guide
    # pixels must never become LCD pixels, and opaque white is LCD background.
    pixels = []
    for y in range(16):
        for x in range(16):
            block = {tuple(rows[y * 3 + dy][(x * 3 + dx) * 4:(x * 3 + dx + 1) * 4])
                     for dy in range(3) for dx in range(3)}
            block = {pixel if pixel[3] else (0, 0, 0, 0) for pixel in block}
            if len(block) != 1:
                raise ValueError("Source frame is not aligned to its 16×16 pixel grid")
            r, g, b, alpha = block.pop()
            if alpha and (r, g, b) == (0, 0, 0):
                pixels.append((x, y))
    if not pixels:
        raise ValueError("Empty Digitama")
    return pixels


def frame_entry(number, frame):
    file = ASSETS / (f"digitama-{number}.png" if frame == 0 else f"digitama-{number}-frame-{frame}.png")
    data = file.read_bytes()
    pixels = pixels_from_png(data)
    occupied = set(pixels)
    content = "\n".join("".join(
        "█" if (x, y) in occupied and (x, y + 1) in occupied else
        "▀" if (x, y) in occupied else "▄" if (x, y + 1) in occupied else " "
        for x in range(16)) for y in range(0, 16, 2))
    return {
        "source": f"https://digimon-db.omnipet.app.br/api/digitamas/Digitama%20{number}/sheet/dot/frame/{frame}",
        "file": file.name,
        "sha256": hashlib.sha256(data).hexdigest(),
        "format": "dot",
        "frame": frame,
        "sourceWidth": 48,
        "sourceHeight": 48,
        "viewBox": "0 0 16 16",
        "content": content,
        "path": "".join(f"M{x} {y}h1v1h-1z" for x, y in pixels),
    }


entries = []
for number in range(1, 45):
    alternate, review = None, None
    try:
        alternate = frame_entry(number, 1)
    except ValueError as error:
        file = ASSETS / f"digitama-{number}-frame-1.png"
        review = {"file": file.name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(), "reason": str(error)}
        print(f"Digitama {number}: alternate frame retained for review; using frame 0 as fallback")
    entries.append({"name": f"Digitama {number}", **frame_entry(number, 0), "alternate": alternate, "alternateReview": review})
(ASSETS / "catalog.json").write_text(json.dumps(entries, indent=2) + "\n")
print(f"Imported {len(entries)} Digitama designs, {sum(entry['alternate'] is not None for entry in entries)} animated alternates")
