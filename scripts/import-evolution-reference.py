"""Generate evolution-reference.json from locally downloaded Humulos HTML.

Requires BeautifulSoup 4. Run from the repository root with --html-dir and
--catalog pointing to a JSON export of DIGIMON_DATA. No network or save access.
"""
import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--html-dir", type=Path, required=True)
parser.add_argument("--catalog", type=Path, required=True)
parser.add_argument("--details-dir", type=Path, help="Cached JSON detail cards from download-evolution-details.py")
parser.add_argument("--previous", type=Path, help="Previous snapshot to retain withdrawn targets for pending saves (defaults to the output file)")
parser.add_argument("--output", type=Path, default=Path("packages/digital-pet-core/src/data/evolution-reference.json"))
args = parser.parse_args()
previous_file = args.previous or args.output
previous = json.loads(previous_file.read_text()) if previous_file.exists() else None
catalog = json.loads(args.catalog.read_text())
corrections = json.loads((Path(__file__).resolve().parents[1] / "packages/digital-pet-core/src/data/catalog-corrections.json").read_text())
catalog = [{**node, **corrections["records"].get(node["id"], {})} for node in catalog]
by_id = {node["id"]: node for node in catalog}
normalize = lambda text: re.sub(r"[^a-z0-9]", "", text.lower())
aliases = {}
for node in catalog:
    for name in [node["name_en"], node["name_jp"]]:
        aliases.setdefault(normalize(name), set()).add(node["id"])

for node_id, names in corrections["aliases"].items():
    if node_id in by_id:
        for name in names:
            aliases.setdefault(normalize(name), set()).add(node_id)

def matches(name, stage=None):
    suffix = re.search(r"\((Baby I|Baby II|Child|Adult|Perfect|Ultimate)\)", name)
    if suffix:
        stage = {"Baby I": 1, "Baby II": 2, "Child": 3, "Adult": 4, "Perfect": 5, "Ultimate": 6}[suffix[1]]
        name = name[:suffix.start()].strip()
    name = re.sub(r"\s+\((?:VBu|NSp|DSa|NSo|WGu|MEm)\)$", "", name)
    ids = aliases.get(normalize(name), set())
    if len(ids) > 1 and stage is not None:
        ids = {node_id for node_id in ids if by_id[node_id]["stage"] == stage}
    # Some historical IDs are duplicate spellings of the same species. Preserve
    # both saves only when the stage and official reference URL agree exactly.
    identities = {(by_id[node_id]["stage"], by_id[node_id]["url"]) for node_id in ids}
    return sorted(ids) if len(identities) == 1 else []


def care_mask(condition):
    result = re.search(r"(\d+)(?:\s*-\s*(\d+)|(\+))?\s+Care Mistakes?\b", condition, re.I)
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


def add(source, target, kind, mask, explicit_care, guide, stage=None, victories=(0, None), target_stage=None):
    for source_id in matches(source, stage):
        for target_id in matches(target, target_stage if target_stage is not None else by_id[source_id]["stage"] + 1):
            if source_id == target_id:
                continue
            route_kind = "special" if kind == "normal" and by_id[target_id]["stage"] <= by_id[source_id]["stage"] else kind
            facts.setdefault((source_id, target_id), []).append((route_kind, mask, explicit_care, guide, *victories))


def alternatives(condition):
    # Only uppercase OR separates complete alternatives. Lowercase "or" can
    # describe an attribute predicate within one Jogress alternative.
    return filter(None, re.split(r"\s*•\s*|\s+OR\s+", condition))


def route_kind(condition):
    if re.search(r"Jogress|Tag\s+Battles?\s+\d+\s+times?\s+with\b", condition, re.I):
        return "jogress"
    if re.search(r"Slot\s*\d|unlocked|\bclear(?:ed)?\b|Defeat|Battle against|Mode Change|DigiXros|Album|Event Battle", condition, re.I):
        return "special"
    return "normal"


def pen20_records(soup):
    for script in soup.find_all("script"):
        text = script.get_text()
        start = re.search(r"\bresult\s*=\s*(\[)", text)
        if start:
            records, _ = json.JSONDecoder().raw_decode(text[start.start(1):])
            if isinstance(records, list) and all(isinstance(row, dict) for row in records):
                return records
    raise ValueError("Pendulum 20th species dataset is missing; refusing to discard its routes")


def card_stage(card):
    base = card.select_one(".baseinfo")
    roman = re.search(r"Stage\s+(VII|VI|IV|V|III|II|I)\b", base.get_text(" ", strip=True) if base else "")
    return {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}.get(roman[1]) if roman else None


details = {}
detail_sources = {}
if args.details_dir:
    for file in sorted(args.details_dir.glob("*.json")):
        cached = json.loads(file.read_text())
        species = parse_qs(urlparse(cached["url"]).query)["digimon"][0]
        details[(cached["guide"], species)] = BeautifulSoup(cached["html"], "html.parser")
        detail_sources.setdefault(cached["guide"], {})[species] = cached["url"]


def import_card(card, guide):
    name = card.select_one(".diginame .sub")
    if not name:
        return []
    stage = card_stage(card)
    source_name = name.get_text(strip=True)
    if not matches(source_name, stage):
        dub = card.select_one(".diginame .dub")
        if dub:
            source_name = dub.get_text(strip=True)
    for evo in card.select(".evo .evolutions"):
        target = evo.select_one("h3")
        condition = evo.find_next_sibling("p", class_="deets")
        if not target or not condition:
            continue
        target_name = target.get_text(strip=True)
        target_stage = None
        target_id = re.search(r"digimonShinkaUnified\('([^']+)'", evo.get("onclick", ""))
        target_card = details.get((guide, target_id[1])) if target_id else None
        if target_card:
            target_stage = card_stage(target_card)
            if not matches(target_name, target_stage):
                dub = target_card.select_one(".diginame .dub")
                if dub:
                    target_name = dub.get_text(strip=True)
        choice_list = condition.find_next_sibling()
        if choice_list and (choice_list.name != "ul" or "deetsList" not in choice_list.get("class", [])):
            choice_list = None
        conditions = [item.get_text(" ", strip=True) for item in choice_list.find_all("li", recursive=False)] if choice_list else [condition.get_text(" ", strip=True)]
        for text in conditions:
            for alternative in alternatives(text):
                alternative = re.sub(r"(?:Library\s+)?slots?\s+[\d/]+\s+not unlocked,?\s*", "", alternative, flags=re.I)
                if re.fullmatch(r".+ missing from (?:your )?Album", alternative, re.I):
                    alternative = "No requirements"  # The default, uncollected-album branch.
                mask, explicit = care_mask(alternative)
                add(source_name, target_name, route_kind(alternative), mask, explicit, guide, stage, victory_range(alternative), target_stage)
    return matches(source_name, stage)


detailed_species = {}
for (guide, _), card in details.items():
    detailed_species.setdefault(guide, set()).update(import_card(card, guide))


for file in sorted(args.html_dir.glob("digital-pet-humulos-*.html")):
    guide = file.stem.removeprefix("digital-pet-humulos-")
    path = {"dmx2": "dmx/2", "dmx3": "dmx/3", "vbdm": "vbdm/all", "vbbe": "vbbe/all", "garuru": "vbdm/php/details_ajax.php?digimon=garuru"}.get(guide, guide)
    sources[guide] = "https://humulos.com/digimon/" + path + ("/" if "?" not in path else "")
    soup = BeautifulSoup(file.read_text(), "html.parser")
    if guide == "pen20":
        # The page embeds the actual species/target IDs and complete requirements.
        # Its coloured connectors alone cannot identify a source reliably.
        records = pen20_records(soup)
        records_by_id = {row["url"]: row for row in records if row.get("url")}
        stages = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}
        for row in records:
            source = row.get("name", "")
            stage = stages.get(row.get("level"))
            if not matches(source, stage):
                source = row.get("dub", "")
            for key, value in row.items():
                if not re.fullmatch(r"evo\d+", key) or not value:
                    continue
                target = records_by_id.get(value)
                if not target:
                    raise ValueError(f"Unknown Pendulum 20th evolution target {value!r}")
                target_stage = stages.get(target.get("level"))
                name = target["name"] if matches(target["name"], target_stage) else target.get("dub", "")
                condition = row.get(key + "_req", "")
                if not condition:
                    raise ValueError(f"Missing Pendulum 20th condition for {source} -> {name}")
                for alternative in alternatives(condition):
                    mask, explicit = care_mask(alternative)
                    add(source, name, route_kind(alternative), mask, explicit, guide, stage, victory_range(alternative), target_stage)
        continue
    cards = [soup] if guide == "garuru" else soup.select(".details, .detailsNew")
    for card in cards:
        detailed_species.setdefault(guide, set()).update(import_card(card, guide))
    unified = soup.select('.profile[onclick^="digimonDetailsUnified"]')
    if unified:
        for profile in unified:
            image = profile.find("img", title=True)
            if not image or not (aliases.get(normalize(image["title"])) or aliases.get(normalize(re.sub(r" \([^)]*\)$", "", image["title"])))):
                continue
            call = re.match(r"digimonDetailsUnified\('([^']+)'", profile["onclick"])
            if call and (guide, call[1]) not in details:
                raise ValueError(f"Missing cached {guide}/{call[1]} card; run download-evolution-details.py first")
        continue  # Icon-only chart requirements must never invent ordinary EXP routes.
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
            if any(source_id in detailed_species.get(guide, set()) for source_id in matches(names[source])):
                continue  # Never override a precise card with chart-line inference.
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
if previous:
    missing_sources = set(previous["sources"]) - set(sources)
    if missing_sources:
        raise ValueError(f"Missing previous guide snapshots: {sorted(missing_sources)}")
    confirmed = {(row[0], row[1]) for row in routes}
    for source, target, _, _, evidence in previous["routes"]:
        if (source, target) not in confirmed:
            # A previously published target can already be pending in a save.
            # Keep it addressable, without advertising or selecting it again.
            routes.append([source, target, "unverified", 0, evidence])
    routes.sort(key=lambda row: (row[0], row[1]))
args.output.write_text(json.dumps({"reviewedAt": date.today().isoformat(), "sources": sources, "detailSources": detail_sources, "routes": routes, "requirements": requirements}, indent=2) + "\n")
print(f"Generated {len(routes)} referenced routes ({sum(row[2] == 'normal' for row in routes)} normal)")
