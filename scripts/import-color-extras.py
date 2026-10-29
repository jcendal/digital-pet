"""Regenerate offline Color eggs/projectiles from the pinned local Omnipet PNGs.

Requires Pillow. No network access. source-urls.json records download URLs;
extras-provenance.json records checksums and coverage. Run from repository root.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'packages/digital-pet-animation/assets/themes/color'
SOURCES = ASSETS / 'sources'


def decode(path):
    image = Image.open(path).convert('RGBA')
    if image.size not in [(48, 48), (24, 24)]:
        raise ValueError(f'Unexpected sprite size: {path} {image.size}')
    # Omnipet uses 3x source pixels, including transparent guide RGB.
    width, height = image.width // 3, image.height // 3
    palette, pixels = [None], []
    for y in range(height):
        for x in range(width):
            block = {image.getpixel((x * 3 + dx, y * 3 + dy)) for dy in range(3) for dx in range(3)}
            block = {p if p[3] else (0, 0, 0, 0) for p in block}
            if len(block) != 1:
                raise ValueError(f'Off-grid source pixel: {path} ({x}, {y})')
            r, g, b, alpha = block.pop()
            if alpha not in (0, 255):
                raise ValueError('Partial transparency')
            color = f'#{r:02x}{g:02x}{b:02x}' if alpha else None
            if color not in palette:
                palette.append(color)
            pixels.append(palette.index(color))
    return dict(width=width, height=height, palette=palette, pixels=pixels)


def main():
    jobs = json.loads((ASSETS / 'source-urls.json').read_text())
    frames, provenance, rejected = {}, [], []
    for job in jobs:
        path = SOURCES / job['file']
        try:
            frames[path.stem] = decode(path)
        except ValueError as error:
            rejected.append({'file': job['file'], 'reason': str(error).replace(str(ROOT), '.')})
        provenance.append({**job, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    module = json.loads((SOURCES / 'dmc.json').read_text())
    candidates = {}
    for device in module['devices']:
        for entry in device.get('digimon', []):
            values = entry['values']
            name, attack = values.get('db_id'), values.get('attack_sprite')
            if name and isinstance(attack, int) and f'attack-{attack}' in frames:
                candidates.setdefault(name, set()).add(attack)
    # Only exact upstream identities with an unambiguous device assignment are official mappings.
    assignments = {name: next(iter(ids)) for name, ids in candidates.items() if len(ids) == 1}
    families = re.findall(r'id: "([^"]+)"[\s\S]*?digitamaDesign: "Digitama (\d+)"', (ROOT / 'packages/digital-pet-core/src/data/egg-families.ts').read_text())
    result = {'frames': frames, 'attacks': assignments, 'eggs': dict(families)}
    (ASSETS / 'generated/extras.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    (ASSETS / 'extras-provenance.json').write_text(json.dumps({'source': 'https://digimon-db.omnipet.app.br/api/gathering/dmc', 'moduleSha256': hashlib.sha256((SOURCES / 'dmc.json').read_bytes()).hexdigest(), 'files': provenance, 'rejectedFrames': rejected, 'ambiguousAttacks': {k: sorted(v) for k, v in candidates.items() if len(v) > 1}, 'unassignedPolicy': 'Authored generic fireball, no invented official association.'}, indent=2) + '\n')
    subprocess.run(['npm', 'exec', '--', 'biome', 'format', '--write', str(ASSETS / 'generated/extras.json'), str(ASSETS / 'extras-provenance.json')], cwd=ROOT, check=True, capture_output=True)
    print(f'Imported {len(frames)} frames, {len(assignments)} exact attack assignments, {len(families)} egg origins')


if __name__ == '__main__':
    main()
