"""Import Omnipet's resolved attack banks and species assignments offline.

Requires Pillow. Export /api/digimon pages to species.json (a combined array),
DIGIMON_DATA to catalog.json, and /api/gathering/{module} to {module}.json in
--input. Modules are prioritized explicitly below; the chosen device/version
retains its provenance. --download caches selected PNGs using curl (four reads at once).
Without that flag, only local cached files are read. Game saves are never read.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urlparse

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODULES = ("penog", "penc", "pen20", "dm20", "dmx", "penz", "penprog", "twin", "dmm", "dmog", "dmxw", "dmc", "pengz", "dmgz", "dmrv", "vbe", "vb")
BASE = "https://digimon-db.omnipet.app.br"


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\(x antibody\)", "x", value.lower()))


def official_key(url):
    return parse_qs(urlparse(url or "").query).get("directory_name", [None])[0]


def match_species(node, species):
    key = official_key(node["url"])
    matches = [row for row in species if key and official_key(row.get("url_en")) == key]
    if len(matches) > 1:
        matches = [row for row in matches if node["stage"] in [module.get("stage") for module in row["extra_data"].values()]]
    if len(matches) == 1:
        return matches[0]
    names = {normalize(node["name_en"]), normalize(node["name_jp"])}
    matches = [row for row in species if names & {normalize(row.get(key) or "") for key in ("name_english", "name_dub", "name_romanization")}]
    return matches[0] if len(matches) == 1 else None


def artwork(file):
    with Image.open(file) as original:
        original.load()
        if original.format != "PNG" or max(original.size) > 128:
            raise ValueError(f"Unexpected attack image: {file}")
        source_size = original.size
        image = original.convert("RGBA")
        # Classic banks use 3x source pixels. Colour-device attacks are adapted
        # to the same 8x8 LCD canvas, with alpha and white highlights preserved.
        image.thumbnail((8, 8), Image.Resampling.NEAREST)
        pixels = {(x, y) for y in range(image.height) for x in range(image.width)
                  if image.getpixel((x, y))[3] >= 128 and min(image.getpixel((x, y))[:3]) < 240}
        if not pixels:
            raise ValueError(f"Empty attack image: {file}")
        offset = ((8 - image.width) // 2, (8 - image.height) // 2)
        pixels = {(x + offset[0], y + offset[1]) for x, y in pixels}
        content = "\n".join("".join("█" if (x, y) in pixels and (x, y + 1) in pixels else
                                   "▀" if (x, y) in pixels else "▄" if (x, y + 1) in pixels else " "
                                   for x in range(8)) for y in range(0, 8, 2))
        return {"sourceWidth": source_size[0], "sourceHeight": source_size[1], "content": content,
                "path": "".join(f"M{x} {y}h1v1h-1z" for x, y in sorted(pixels)), "viewBox": "0 0 8 8"}


def generate(input_dir, cache, download=False):
    species = json.loads((input_dir / "species.json").read_text())
    catalog = json.loads((input_dir / "catalog.json").read_text())
    corrections = json.loads((ROOT / "packages/digital-pet-core/src/data/catalog-corrections.json").read_text())
    catalog = [{**node, **corrections["records"].get(node["id"], {})} for node in catalog]
    banks, candidates = {}, {}
    for module in MODULES:
        data = json.loads((input_dir / f"{module}.json").read_text())
        for bank in data["attack_sets"]:
            for attack in bank["attacks"]:
                if not attack.get("url"):
                    continue
                banks.setdefault((bank["key"], attack["id"]), {"set": bank["key"], "index": attack["id"], "source": BASE + attack["url"]})
        for device in data["devices"]:
            for row in device.get("digimon", []):
                values = row["values"]
                index = values.get("attack_sprite", values.get("small_attack"))
                bank = device.get("attack_set") or ("vb-small" if module in ("vb", "vbe") else None)
                if not values.get("db_id") or type(index) is not int or (bank, index) not in banks:
                    continue
                evidence = row.get("sources", {}).get("attack_sprite" if "attack_sprite" in values else "small_attack", {})
                candidates.setdefault(values["db_id"], []).append({"module": module, "set": bank, "index": index,
                    "device": device["slug"], "target": row["target"], "evidence": evidence.get("source", "unknown"),
                    "source": f"{BASE}/api/gathering/{module}/entries/{row['target']}"})
    assignments, unavailable = {}, []
    selected = {key for key in banks if key[0] == "penog"}
    if {index for bank, index in selected} != set(range(109)):
        raise ValueError("Expected all 109 PENOG sprites, indexed 0–108")
    for node in catalog:
        match = match_species(node, species)
        options = candidates.get(match["id"], []) if match else []
        if not options:
            unavailable.append({"nodeId": node["id"], "speciesId": match["id"] if match else None})
            continue
        chosen = min(options, key=lambda row: (row["evidence"] in ("assumed", "unknown"), MODULES.index(row["module"])))
        selected.add((chosen["set"], chosen["index"]))
        assignments[node["id"]] = {"speciesId": match["id"], **chosen}
    cache.mkdir(parents=True, exist_ok=True)

    def fetch(key):
        entry = banks[key]
        file = cache / f"{key[0]}-{key[1]}.png"
        if not file.exists() and download:
            if not entry["source"].startswith(BASE + "/api/gathering/"):
                raise ValueError("Unexpected asset source")
            subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "30", entry["source"], "-o", str(file)], check=True, capture_output=True)
        return {**entry, "file": file.name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(), **artwork(file)}

    with ThreadPoolExecutor(max_workers=4) as pool:
        frames = list(pool.map(fetch, sorted(selected)))
    output = ROOT / "packages/digital-pet-animation/assets/attacks"
    output.mkdir(parents=True, exist_ok=True)
    for frame in frames:
        (output / frame["file"]).write_bytes((cache / frame["file"]).read_bytes())
    expected = {frame["file"] for frame in frames}
    for file in output.glob("*.png"):
        if re.fullmatch(r"[a-z0-9-]+-\d+\.png", file.name) and file.name not in expected:
            file.unlink()  # This directory is owned entirely by this generated export.
    (output / "catalog.json").write_text(json.dumps({"reviewedAt": date.today().isoformat(), "frames": frames}, indent=2) + "\n")
    (ROOT / "packages/digital-pet-core/src/data/attack-assignments.json").write_text(json.dumps({
        "reviewedAt": date.today().isoformat(), "modulePriority": MODULES, "assignments": assignments,
        "unavailable": unavailable}, indent=2) + "\n")
    print(f"Imported {len(frames)} projectiles, {len(assignments)}/{len(catalog)} species assignments; {len(unavailable)} use the existing fallback")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    generate(args.input, args.cache, args.download)
