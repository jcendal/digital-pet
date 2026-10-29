"""Generate authored Color palettes over existing original vector geometry, offline."""
import json
import re
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'packages/digital-pet-fields/assets'
# Each palette orders sky, highlight, distant terrain, terrain, water/ground, foreground.
PALETTES = {
 'lake': ['#bde5f4','#eff7ed','#84af91','#5b8c6e','#70b8d1','#637b83'],
 'beach': ['#b9e5f4','#fff5d9','#7fae84','#578971','#76c3cf','#b5925d'],
 'village': ['#badfec','#faf1d0','#91b37b','#5d926a','#d0bd86','#6c7954'],
 'savannah': ['#c9e6ed','#fff2c3','#c9b67d','#a38e59','#dcd09b','#7a8052'],
 'swamp': ['#b9d9cc','#e1e7b7','#8fba98','#628f7c','#a0c2a5','#547963'],
 'forest': ['#bcdfde','#eff1d1','#86b68d','#4b8d68','#b0ca92','#3c7057'],
 'jungle': ['#b3dcda','#e7edc7','#78ae82','#408a64','#9fc587','#336954'],
 'mangrove': ['#b6dbd4','#edf1cd','#81b39a','#508e75','#85bdba','#4e7263'],
 'ice': ['#c2e2f1','#fcffff','#a0c7dd','#709cb9','#d3e9ed','#617eaa'],
 'panorama': ['#bfdef0','#fbf4dd','#a4b5ad','#788e91','#c6c6a2','#697e7b'],
 'city': ['#c4e0ed','#f7f1d9','#a0b8c4','#718b9e','#b9c9c9','#586d83'],
 'factory': ['#c6d8dc','#f1e7c8','#a8b4b9','#788d99','#b7b1a0','#667383'],
 'dino': ['#d6e3ca','#fff1c3','#b1b67a','#8d945c','#d3c48e','#787b4d'],
 'canyon': ['#c9dfec','#fff0cc','#c6a382','#a67b62','#e2c69b','#835d52'],
 'wasteland': ['#d4d8dd','#eee4cc','#b7a597','#928375','#c7b8a0','#746d67'],
 'cemetery': ['#bdc6d4','#dce0d7','#9babb1','#788592','#b2b7ac','#626e80'],
 'castle': ['#b9bfd6','#e5dfe5','#aaa3bf','#817f9e','#bfb4c0','#676680'],
 'terminal': ['#b9cddd','#e3eef2','#8faabb','#668b9f','#abc5c9','#506879'],
 'pyramid': ['#d2d3e1','#f1e9d2','#b0a3c1','#8c7e9d','#c9b5b7','#6b617f'],
 'toys': ['#c7e1ed','#fff0d6','#c1a8cc','#888ebb','#dcd2ad','#8d7499'],
}
source_colors = ['#b8c79a','#c5cfaa','#a3b384','#94a477','#afbe91','#899a6b']
(ASSETS/'themes/color/scenes').mkdir(parents=True,exist_ok=True)
coverage={}
for name,palette in PALETTES.items():
    source=(ASSETS/'scenes'/f'{name}.svg').read_text()
    replacements=dict(zip(source_colors,palette))
    # Remaining shades retain their relative lightness within the authored palette.
    for color in sorted(set(re.findall(r'#[0-9a-fA-F]{6}',source))):
        if color.lower() not in replacements:
            luminance=sum(int(color[i:i+2],16) for i in [1,3,5])
            nearest=min(source_colors,key=lambda c:abs(sum(int(c[i:i+2],16) for i in [1,3,5])-luminance))
            replacements[color.lower()]=replacements[nearest]
    colored=re.sub(r'#[0-9a-fA-F]{6}',lambda m:replacements[m[0].lower()],source)
    (ASSETS/'themes/color/scenes'/f'{name}.svg').write_text(colored)
    coverage[name]=replacements
source=(ASSETS/'maps/file-island.svg').read_text()
# Every LCD shade has an explicit default; never silently paint unknown details green.
map_colors = {
    '#afbe93': '#83bfd3', '#a3b487': '#cee9ed', '#8fa276': '#d6cb96',
    '#7d9060': '#61956a', '#a4b586': '#a5ca86', '#65784e': '#5e6e64',
    '#89986e': '#899fa6', '#c5cfa9': '#eef0d5', '#899b6e': '#88ac72',
    '#bac79c': '#b1c995', '#73875a': '#657c66', '#d0d8b7': '#e4d9b0',
    '#aab98e': '#b7c89b',
}
# Shared LCD shades describe different materials. Apply local palettes to the
# original semantic groups without changing their geometry or the LCD artwork.
map_regions = {
    'infinityMountain': {
        'marker': 'Infinity Mountain anchors the island.',
        'colors': {'#8fa276': '#9aabac', '#73875a': '#6e858c',
                   '#d0d8b7': '#f5fbff', '#aab98e': '#c2d0cf'},
    },
    'industrialCoast': {
        'marker': 'Industrial coast.',
        'colors': {'#65784e': '#667b89', '#a4b586': '#d4e9de'},
    },
    'easternCastle': {
        'marker': 'Northern barrens and eastern castle.',
        'colors': {'#65784e': '#77728e', '#c5cfa9': '#efe3c7'},
    },
    'gearSavannah': {
        'marker': 'Gear Savannah.',
        'colors': {'#899b6e': '#a18b59', '#bac79c': '#ddd09b'},
    },
    'fossilPlateau': {
        'marker': 'Sandy pyramid outcrop and fossil plateau.',
        'colors': {'#a4b586': '#d2b885', '#65784e': '#9b795d', '#73875a': '#f5e9c9'},
    },
    'coelaBeach': {
        'marker': "Coela Beach's sandy cape, telephone booths and an offshore shoal.",
        'colors': {'#c5cfa9': '#f0dfb2', '#73875a': '#557f95', '#d0d8b7': '#c8eef0'},
    },
}
colored_map = re.sub(r'#[0-9a-fA-F]{6}', lambda m: map_colors[m[0]], source)
for name, region in map_regions.items():
    pattern = r'<!-- ' + re.escape(region['marker']) + r' -->(.*?)(?=<!--|</svg>)'
    original = re.search(pattern, source, re.DOTALL)
    if original is None:
        raise ValueError(f'Map region {name} is missing from the source')
    palette = map_colors | region['colors']
    colored = re.sub(r'#[0-9a-fA-F]{6}', lambda m: palette[m[0]], original[0])
    colored_map = re.sub(pattern, lambda _: colored, colored_map, flags=re.DOTALL)
# House symbols are reused through <use>; color the definition once.
house_colors = {'#65784e': '#76899a', '#c5cfa9': '#f2e5c6', '#89986e': '#8d7965'}
house_pattern = r'<g id="house">.*?</g>'
house = re.search(house_pattern, source, re.DOTALL)
if house is None:
    raise ValueError('House symbol is missing from the source map')
colored_house = re.sub(r'#[0-9a-fA-F]{6}', lambda m: house_colors[m[0]], house[0])
colored_map = re.sub(house_pattern, lambda _: colored_house, colored_map, flags=re.DOTALL)
(ASSETS/'themes/color/file-island.svg').write_text(colored_map.replace('LCD atlas','Color atlas'))
(ASSETS/'themes/color/palettes.json').write_text(json.dumps({
    'scenes': coverage, 'map': map_colors, 'mapRegions': map_regions,
    'mapSymbols': {'house': house_colors},
}, indent=2)+'\n')
subprocess.run(['npm', 'exec', '--', 'biome', 'format', '--write', str(ASSETS/'themes/color/palettes.json')], cwd=ROOT, check=True)
print('Generated 20 Color scenes and one map; original geometry preserved.')
