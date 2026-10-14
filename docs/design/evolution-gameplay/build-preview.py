"""Assemble the documentation preview using existing local product assets."""

import base64
import json
from pathlib import Path

DESIGN = Path(__file__).resolve().parent
ROOT = DESIGN.parents[2]


def data_uri(kind, content):
    return f"data:{kind};base64,{base64.b64encode(content).decode()}"


assets = {}
catalog = ROOT / "packages/digital-pet-core/src/data/monster-frame-data.ts"
for line in catalog.read_text().splitlines():
    if not line.strip().startswith("["):
        continue
    try:
        name, frames = json.loads(line.strip().rstrip(","))
    except (ValueError, TypeError):
        continue
    if name not in {"garurumon", "agumon", "devimon", "orochimon", "egg"}:
        continue
    rectangles = []
    for y, row in enumerate(dict(frames)["walk_1"].splitlines()):
        for x, character in enumerate(row):
            if character in "█▀▄":
                offset = 1 if character == "▄" else 0
                height = 2 if character == "█" else 1
                rectangles.append(f'<rect x="{x}" y="{2*y+offset}" width="1" height="{height}"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
           'shape-rendering="crispEdges"><g fill="#26351e">'
           + "".join(rectangles) + "</g></svg>")
    assets[name.upper()] = data_uri("image/svg+xml", svg.encode())

assets["FOREST"] = data_uri("image/svg+xml", (ROOT / "packages/digital-pet-fields/assets/scenes/forest.svg").read_bytes())
assets["LAKE"] = data_uri("image/svg+xml", (ROOT / "packages/digital-pet-fields/assets/scenes/lake.svg").read_bytes())
assets["PIXEL_FONT"] = data_uri("font/ttf", (ROOT / "packages/digital-pet-webviews/assets/fonts/Silkscreen-Regular.ttf").read_bytes())
styles = (DESIGN / "prototype.css").read_text().replace("__PIXEL_FONT__", assets["PIXEL_FONT"])
fragment = (DESIGN / "prototype.html").read_text().replace("__PRODUCT_STYLES__", styles)
fragment = fragment.replace("__PRODUCT_SCRIPT__", (DESIGN / "prototype.browser.js").read_text())
for key, value in assets.items():
    fragment = fragment.replace(f"__{key}__", value)
assert "__EGG__" not in fragment
(DESIGN / "evolution-gameplay.html").write_text(fragment)
print(f"Assembled {len(fragment.encode())} bytes")
