"""Cache Humulos detail cards for local catalog species without touching game saves.

Requires BeautifulSoup 4 and curl. Uses the guide snapshots consumed by
import-evolution-reference.py. Cached responses are reused; requests are limited
to four concurrent reads. Pass the cache to the importer with --details-dir.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode

from bs4 import BeautifulSoup


def download_details(html_dir, catalog, output):
    normalize = lambda name: re.sub(r"[^a-z0-9]", "", name.lower())
    names = {normalize(node[key]) for node in catalog for key in ("name_en", "name_jp")}
    jobs = {}
    for file in sorted(html_dir.glob("digital-pet-humulos-*.html")):
        guide = file.stem.removeprefix("digital-pet-humulos-")
        soup = BeautifulSoup(file.read_text(), "html.parser")
        for profile in soup.select(".profile[onclick]"):
            image = profile.find("img", title=True)
            if not image or not (normalize(image["title"]) in names or normalize(re.sub(r" \([^)]*\)$", "", image["title"])) in names):
                continue
            match = re.fullmatch(r"digimonDetailsUnified\('([^']+)','([^']+)','([^']*)'\)", profile["onclick"])
            if not match:
                continue
            species, device, version = match.groups()
            key = (guide, species, device)
            # The detail endpoint returns the species' alternatives across the
            # module's versions; one card is sufficient for repeated profiles.
            query = urlencode({"digimon": species, "device": device, "version": version})
            jobs.setdefault(key, {"guide": guide, "url": "https://humulos.com/digimon/php/details.php?" + query})

    output.mkdir(parents=True, exist_ok=True)

    def fetch(item):
        (guide, species, device), metadata = item
        file = output / f"{guide}-{device}-{species}.json"
        if file.exists():
            cached = json.loads(file.read_text())
            if cached.get("url") == metadata["url"] and cached.get("html"):
                return
        for attempt in range(3):
            try:
                response = subprocess.run(["curl", "-fsSL", "--max-time", "40", metadata["url"]], check=True, capture_output=True)
                html = response.stdout.decode("utf-8")
                soup = BeautifulSoup(html, "html.parser")
                if not soup.select_one(".diginame .sub") or not soup.select_one(".evo"):
                    raise ValueError(f"Missing evolution card: {metadata['url']}")
                file.write_text(json.dumps({**metadata, "retrievedAt": time.strftime("%Y-%m-%d", time.gmtime()), "html": html}) + "\n")
                return
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)

    with ThreadPoolExecutor(max_workers=4) as pool:
        for count, _ in enumerate(pool.map(fetch, jobs.items()), 1):
            if count % 50 == 0:
                print(f"Cached {count}/{len(jobs)} detail cards", flush=True)
    print(f"Cached all {len(jobs)} detail cards", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html-dir", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    download_details(args.html_dir, json.loads(args.catalog.read_text()), args.output)
