"""Generate evolution-reference.json from locally downloaded Humulos HTML.

Requires BeautifulSoup 4. Run from the repository root with --html-dir and
--catalog pointing to a JSON export of DIGIMON_DATA. No network or save access.
"""
import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--html-dir", type=Path, required=True)
parser.add_argument("--catalog", type=Path, required=True)
parser.add_argument("--output", type=Path, default=Path("packages/digital-pet-core/src/data/evolution-reference.json"))
args = parser.parse_args()
catalog = json.loads(args.catalog.read_text())
by_id = {node["id"]: node for node in catalog}
normalize = lambda text: re.sub(r"[^a-z0-9]", "", text.lower())
aliases = {}
for node in catalog:
    for name in [node["name_en"], node["name_jp"]]:
        aliases.setdefault(normalize(name), set()).add(node["id"])

aliases["agumonyukinokizuna"] = {"7-041"}
aliases["gabumonyujonokizuna"] = {"7-042"}

def match(name, stage=None):
    suffix = re.search(r"\((Baby I|Baby II|Child|Adult|Perfect|Ultimate)\)", name)
    if suffix:
        stage = {"Baby I": 1, "Baby II": 2, "Child": 3, "Adult": 4, "Perfect": 5, "Ultimate": 6}[suffix[1]]
        name = name[:suffix.start()].strip()
    name = re.sub(r"\s+\((?:VBu|NSp|DSa|NSo|WGu|MEm)\)$", "", name)
    ids = aliases.get(normalize(name), set())
    if len(ids) > 1 and stage is not None:
        ids = {node_id for node_id in ids if by_id[node_id]["stage"] == stage}
    return next(iter(ids)) if len(ids) == 1 else None


def care_mask(condition):
    result = re.search(r"(\d+)(?:\s*-\s*(\d+)|(\+))?\s+Care Mistakes", condition)
    if not result:
        return 15, False
    low = min(3, int(result[1]))
    high = 3 if result[3] else min(3, int(result[2] or result[1]))
    return sum(1 << count for count in range(low, high + 1)), True


def victory_range(condition):
    result = re.search(r"(\d+)(?:\s*-\s*(\d+)|(\+))?\s+Victories", condition, re.I)
    if result:
        # The game has one cumulative form counter, not a device's fixed battle
        # window or win ratio. Keep the required minimum; retain an explicit
        # zero-based upper bracket only when it separates a later unlock.
        low = int(result[1])
        return low, int(result[2]) if low == 0 and result[2] else None
    result = re.search(r"Win\s+(\d+)\s+(?:Cumulative\s+)?Battles", condition, re.I)
    return (int(result[1]), None) if result else (0, None)


facts = {}
sources = {}


def add(source, target, kind, mask, explicit_care, guide, stage=None, victories=(0, None)):
    source = match(source, stage)
    target = match(target, by_id[source]["stage"] + 1 if source else None)
    if not source or not target or source == target:
        return
    if kind == "normal" and by_id[target]["stage"] <= by_id[source]["stage"]:
        kind = "special"
    facts.setdefault((source, target), []).append((kind, mask, explicit_care, guide, *victories))


for file in sorted(args.html_dir.glob("digital-pet-humulos-*.html")):
    guide = file.stem.removeprefix("digital-pet-humulos-")
    if guide == "pen20":
        continue  # Its colour-only connectors do not identify source species.
    path = {"dmx2": "dmx/2", "dmx3": "dmx/3", "vbdm": "vbdm/all", "vbbe": "vbbe/all", "garuru": "vbdm/php/details_ajax.php?digimon=garuru"}.get(guide, guide)
    sources[guide] = "https://humulos.com/digimon/" + path + ("/" if "?" not in path else "")
    soup = BeautifulSoup(file.read_text(), "html.parser")
    cards = [soup] if guide == "garuru" else soup.select(".details, .detailsNew")
    for card in cards:
        name = card.select_one(".diginame .sub")
        if not name:
            continue
        base = card.select_one(".baseinfo")
        roman = re.search(r"Stage\s+(VII|VI|IV|V|III|II|I)\b", base.get_text(" ", strip=True) if base else "")
        stage = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}.get(roman[1]) if roman else None
        for evo in card.select(".evo .evolutions"):
            target = evo.select_one("h3")
            condition = evo.find_next_sibling("p", class_="deets")
            if not target or not condition:
                continue
            alternatives = re.split(r"\s*•\s*", condition.get_text(" ", strip=True))
            for alternative in filter(None, alternatives):
                alternative = re.sub(r"Library slots?\s+[\d/]+\s+not unlocked,?\s*", "", alternative, flags=re.I)
                kind = "jogress" if "Jogress" in alternative else "special" if re.search(r"Slot\s*\d|unlocked|cleared|Defeat", alternative, re.I) else "normal"
                mask, explicit = care_mask(alternative)
                add(name.get_text(strip=True), target.get_text(strip=True), kind, mask, explicit, guide, stage, victory_range(alternative))
    names, edges = {}, []
    for profile in soup.select(".profile"):
        image = profile.find("img", title=True)
        row = profile.find_parent("div", class_="row")
        if not image or not row:
            continue
        requirements = row.find("div", id=lambda value: value and value.endswith("_Req_column"), recursive=False)
        outgoing = next((cls for element in row.find_all("div", recursive=False) for cls in element.get("class", []) if cls.endswith("_lineOut")), None)
        key = requirements["id"][:-11] if requirements else outgoing[:-8] if outgoing else None
        if key:
            names[key] = image["title"]
        if not requirements:
            continue
        # Detail cards contain more precise conditions when available.
        for element in requirements.find_all("div"):
            for cls in element.get("class", []):
                if cls.endswith("_line") and not cls.endswith("_Req_line"):
                    kind = "jogress" if "Jogress" in requirements.get_text() else "special" if re.search(r"cleared|unlocked", requirements.get_text(), re.I) else "normal"
                    edges.append((cls[:-5], key, kind))
    for source, target, kind in edges:
        if source in names and target in names:
            add(names[source], names[target], kind, 15, False, guide)

routes = []
requirements = {}
for (source, target), evidence in sorted(facts.items()):
    normal = [row for row in evidence if row[0] == "normal"]
    if normal:
        precise = {row[3] for row in normal if row[2] or row[4] > 0 or row[5] is not None}
        normal = [row for row in normal if row[3] not in precise or row[2] or row[4] > 0 or row[5] is not None]
        care = [row for row in normal if row[2]] or normal
        mask = 0
        for row in care:
            mask |= row[1]
        kind = "normal"
        groups = sorted({(row[1], row[4], row[5]) for row in care}, key=lambda row: (row[0], row[1], row[2] if row[2] is not None else 1000001))
        unrestricted = 0
        for group_mask, low, high in groups:
            if low == 0 and high is None:
                unrestricted |= group_mask
        groups = ([ (unrestricted, 0, None) ] if unrestricted else []) + [
            (group_mask & ~unrestricted, low, high) for group_mask, low, high in groups
            if (low > 0 or high is not None) and group_mask & ~unrestricted
        ]
        if any(low > 0 or high is not None for _, low, high in groups) and (15, 0, None) not in groups:
            requirements[f"{source}:{target}"] = groups
    else:
        mask = 0
        kind = "jogress" if any(row[0] == "jogress" for row in evidence) else "special"
    routes.append([source, target, kind, mask, sorted({row[3] for row in evidence})])
args.output.write_text(json.dumps({"reviewedAt": "2026-10-14", "sources": sources, "routes": routes, "requirements": requirements}, indent=2) + "\n")
print(f"Generated {len(routes)} referenced routes ({sum(row[2] == 'normal' for row in routes)} normal)")
