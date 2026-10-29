"""Generate portable theme frames from the pinned upstream color snapshot.

Download digimon-data.ts and monster-color-frames.ts at the revision declared in
color-sprite-source.json into --input. This importer reads only local files. It
never executes upstream code, modifies gameplay catalogs, or accesses saves.
Output uses base64 count/index byte pairs; zlib is used only during import.
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse
import zlib

ROOT = Path(__file__).resolve().parents[1]
POSES = {
    "angry", "attack_1", "attack_2", "eat_1", "eat_2", "happy", "refuse",
    "sick", "sleep_1", "sleep_2", "walk_1", "walk_2",
}


def read_records(text):
    rows = []
    for block in re.findall(r'\{\s*name_en:.*?\n  \}', text, re.S):
        fields = re.findall(r'(name_en|name_jp|id|sprite|url): ("(?:\\.|[^"\\])*")', block)
        row = {name: json.loads(value) for name, value in fields}
        if set(row) != {"name_en", "name_jp", "id", "sprite", "url"}:
            raise ValueError("Incomplete catalog identity")
        rows.append(row)
    if not rows or len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Invalid catalog identities")
    return rows


def read_color_data(text):
    marker = "export const MONSTER_COLOR_FRAME_DATA: MonsterColorSpriteData = "
    payload = text.split(marker, 1)[1].strip().rstrip(";")
    # The pinned source contains only arrays, string literals and trailing commas.
    return json.loads(re.sub(r",\s*]", "]", payload))


def decode_sprite(poses, blob):
    if len(set(poses)) != len(poses) or not set(poses) <= POSES or not {"walk_1", "walk_2"} <= set(poses):
        raise ValueError("Invalid sprite poses")
    maximum = 2 + 255 * 3 + len(POSES) * 256
    decoder = zlib.decompressobj()
    raw = decoder.decompress(base64.b64decode(blob, validate=True), maximum + 1)
    if not decoder.eof or decoder.unused_data or len(raw) > maximum or len(raw) < 2:
        raise ValueError("Invalid compressed sprite")
    count = int.from_bytes(raw[:2], "big")
    offset = 2 + count * 3
    if count < 1 or count > 255 or len(raw) != offset + len(poses) * 256:
        raise ValueError("Invalid palette or frame length")
    palette = [None] + ["#" + raw[i:i + 3].hex() for i in range(2, offset, 3)]
    pixels = raw[offset:]
    if max(pixels) > count:
        raise ValueError("Pixel outside palette")
    frames = {pose: pixels[index * 256:(index + 1) * 256] for index, pose in enumerate(poses)}
    if any(not any(frame) for frame in frames.values()):
        raise ValueError("Empty source pose")
    return palette, frames


def encode_runs(pixels):
    runs = bytearray()
    index = 0
    while index < len(pixels):
        count = 1
        while index + count < len(pixels) and pixels[index + count] == pixels[index] and count < 255:
            count += 1
        runs.extend((count, pixels[index]))
        index += count
    return base64.b64encode(runs).decode("ascii")


def reference(row):
    return parse_qs(urlparse(row["url"]).query).get("directory_name", [""])[0].lower()


def match_identities(local, upstream, overrides):
    by_reference = {}
    by_sprite = {}
    for row in upstream:
        by_reference.setdefault(reference(row), []).append(row)
        by_sprite.setdefault(row["sprite"], []).append(row)
    mappings = {}
    for node in local:
        override = overrides.get(node["id"])
        if override:
            if override["legacySprite"] != node["sprite"] or not override["reason"]:
                raise ValueError(f"Stale identity override: {node['id']}")
            candidates = by_sprite.get(override["sprite"], [])
        else:
            candidates = by_reference.get(reference(node), []) if reference(node) else []
        if len(candidates) != 1:
            raise ValueError(f"Identity needs an explicit mapping: {node['id']}")
        candidate = candidates[0]
        mappings[node["id"]] = {
            "sprite": candidate["sprite"],
            "upstreamId": candidate["id"],
            "method": "explicit" if override else "official-reference",
            **({"reason": override["reason"]} if override else {}),
        }
    if set(overrides) - set(mappings):
        raise ValueError("Overrides contain absent local IDs")
    return mappings


def generate(input_dir, output_root=ROOT):
    lock = json.loads((ROOT / "scripts/color-sprite-source.json").read_text())
    sources = {}
    for name, expected in lock["files"].items():
        data = (input_dir / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"Pinned source checksum mismatch: {name}")
        sources[name] = data.decode("utf8")
    raw_catalog = (ROOT / "packages/digital-pet-core/src/data/digimon-data.ts").read_text()
    corrections = json.loads((ROOT / "packages/digital-pet-core/src/data/catalog-corrections.json").read_text())
    local = [{**node, **corrections["records"].get(node["id"], {})} for node in read_records(raw_catalog)]
    mappings = match_identities(local, read_records(sources["digimon-data.ts"]), lock["overrides"])
    selected = {row["sprite"] for row in mappings.values()}
    sprites = []
    seen = set()
    for sprite, poses, blob in read_color_data(sources["monster-color-frames.ts"]):
        if sprite in seen:
            raise ValueError(f"Duplicate sprite: {sprite}")
        seen.add(sprite)
        palette, frames = decode_sprite(poses, blob)
        if sprite in selected:
            sprites.append({"sprite": sprite, "palette": palette,
                            "frames": {pose: encode_runs(frame) for pose, frame in frames.items()}})
    if selected - seen:
        raise ValueError(f"Missing color sprites: {sorted(selected - seen)}")
    sprites.sort(key=lambda row: row["sprite"])
    provenance = {"repository": lock["repository"], "revision": lock["revision"],
                  "sourceChecksums": lock["files"]}
    identity_output = output_root / "packages/digital-pet-core/src/data/color-sprite-identities.json"
    frame_output = output_root / "packages/digital-pet-animation/assets/themes/color/generated/monsters.json"
    report_output = output_root / "packages/digital-pet-animation/assets/themes/color/catalog.json"
    frame_text = json.dumps(sprites, separators=(",", ":")) + "\n"
    outputs = {
        identity_output: {"generatedBy": "scripts/import-color-sprites.py", **provenance, "nodes": mappings},
        report_output: {"generatedBy": "scripts/import-color-sprites.py", **provenance,
                        "format": "base64-rle-count-index-v1", "width": 16, "height": 16,
                        "identities": len(mappings), "sprites": len(sprites),
                        "poses": sum(len(row["frames"]) for row in sprites),
                        "dataSha256": hashlib.sha256(frame_text.encode()).hexdigest(),
                        "dataBytes": len(frame_text.encode()),
                        "remainingIntegration": ["regional-origin-eggs", "color-attack-assignments",
                                                 "effects-and-scenery", "host-theme-selection"],
                        "poseSubstitutions": {"injured_1": "sick", "injured_2": "refuse"}},
    }
    # All inputs and mappings are validated before any output is changed.
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    frame_output.parent.mkdir(parents=True, exist_ok=True)
    frame_output.write_text(frame_text)
    print(f"Generated {len(mappings)} identities and {len(sprites)} color sprites ({len(frame_text.encode())} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    generate(args.input, args.output_root)
