"""Offline regression tests for the evolution importer; requires BeautifulSoup 4."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


IMPORTER = Path(__file__).resolve().parents[1] / "import-evolution-reference.py"


def node(node_id, name, stage, url=None):
    return {"id": node_id, "name_en": name, "name_jp": name, "stage": stage, "url": url or name}


def record(slug, name, level, **fields):
    return {"url": slug, "name": name, "dub": name, "level": level, **fields}


def card(name, stage, evolutions):
    return f'<div class="detailsInt"><div class="diginame"><p class="sub">{name}</p></div><div class="baseinfo">Stage {stage}</div><div class="evo">{evolutions}</div></div>'


def evolution(target, condition, slug="target"):
    return f'<div class="evolutions" onclick="digimonShinkaUnified(\'{slug}\',\'source\',16,\'\',\'\')"><h3>{target}</h3></div><p class="deets">{condition}</p>'


class EvolutionReferenceTests(unittest.TestCase):
    def generate(self, catalog, records=None, guide_html=None, details=None, previous=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            catalog_file = root / "catalog.json"
            catalog_file.write_text(json.dumps(catalog))
            if records is not None:
                (root / "digital-pet-humulos-pen20.html").write_text("<script>result = " + json.dumps(records) + ";</script>")
            for guide, html in (guide_html or {}).items():
                (root / f"digital-pet-humulos-{guide}.html").write_text(html)
            cache = root / "details"
            cache.mkdir()
            for index, (guide, slug, html) in enumerate(details or []):
                (cache / f"{index}.json").write_text(json.dumps({"guide": guide, "url": f"https://humulos.com/digimon/php/details.php?digimon={slug}", "html": html}))
            output = root / "output.json"
            if previous:
                output.write_text(json.dumps(previous))
            subprocess.run([sys.executable, str(IMPORTER), "--html-dir", str(root), "--catalog", str(catalog_file), "--details-dir", str(cache), "--output", str(output)], check=True, capture_output=True)
            return json.loads(output.read_text())

    def test_pen20_reads_species_ids_and_restores_lopmon_line(self):
        result = self.generate(
            [node("lop", "Lopmon", 3), node("turu", "Turuiemon", 4), node("anty", "Antylamon", 5)],
            [record("lop", "Lopmon", "III", evo1="turu", evo1_name="Wrong display label", evo1_req="No requirements"), record("turu", "Turuiemon", "IV", evo1="anty", evo1_req="0-2 Care Mistakes, 15 Battles, 12-15 Victories*"), record("anty", "Antylamon", "V")],
        )
        self.assertIn(["lop", "turu", "normal", 15, ["pen20"]], result["routes"])
        self.assertEqual(result["requirements"]["turu:anty"], [[7, 12, None]])

    def test_singular_care_and_normal_or_jogress_keep_complete_alternatives(self):
        result = self.generate(
            [node("a", "First", 4), node("b", "Second", 5), node("c", "Third", 5)],
            [record("a", "First", "IV", evo1="b", evo1_req="1 Care Mistake, 2 Victories OR Jogress with Vaccine or Data Adult", evo2="c", evo2_req="Jogress with Vaccine or Data Adult"), record("b", "Second", "V"), record("c", "Third", "V")],
        )
        self.assertIn(["a", "b", "normal", 2, ["pen20"]], result["routes"])
        self.assertEqual(result["requirements"]["a:b"], [[2, 2, None]])
        self.assertIn(["a", "c", "jogress", 0, ["pen20"]], result["routes"])

    def test_duplicate_species_ids_are_preserved_without_merging_stages(self):
        result = self.generate(
            [node("a", "DORUguremon", 5, "official/doruguremon"), node("b", "DORUguremon", 5, "official/doruguremon"), node("c", "Next", 6), node("whale4", "Whamon", 4), node("whale5", "Whamon", 5), node("sea", "Plesiomon", 6)],
            [record("doru", "DORUguremon", "V", evo1="next", evo1_req="No requirements"), record("next", "Next", "VI"), record("whale", "Whamon", "V", evo1="sea", evo1_req="Jogress with Vaccine Perfect"), record("sea", "Plesiomon", "VI")],
        )
        for source in ["a", "b"]:
            self.assertIn([source, "c", "normal", 15, ["pen20"]], result["routes"])
        self.assertIn(["whale5", "sea", "jogress", 0, ["pen20"]], result["routes"])
        self.assertFalse(any(route[0] == "whale4" for route in result["routes"]))

    def test_precise_jogress_card_cannot_be_overridden_by_chart_lines(self):
        chart = '<div class="row"><div class="profile"><img title="First"></div><div class="p_first_lineOut"></div></div><div class="row"><div id="p_second_Req_column"><div class="p_first_line"></div></div><div class="profile"><img title="Second"></div></div>'
        result = self.generate(
            [node("a", "First", 4), node("b", "Second", 5)],
            guide_html={"penc": chart},
            details=[("penc", "first", card("First", "IV", evolution("Second", "Jogress with Vaccine Stage V")))],
        )
        self.assertEqual(result["routes"], [["a", "b", "jogress", 0, ["penc"]]])

    def test_choice_lists_and_exact_target_stage_do_not_turn_fusion_into_exp(self):
        choices = evolution("Second", "Choose one:") + '<ul class="deetsList"><li>0 Care Mistakes, 2 Victories</li><li>Jogress with Vaccine or Data Stage V</li></ul>'
        result = self.generate(
            [node("a", "First", 5), node("b", "Second", 6), node("c", "Second", 7)],
            guide_html={"penc": ""},
            details=[("penc", "first", card("First", "V", choices)), ("penc", "target", card("Second", "VI", ""))],
        )
        self.assertEqual(result["routes"], [["a", "b", "normal", 1, ["penc"]]])
        self.assertEqual(result["requirements"]["a:b"], [[1, 2, None]])

    def test_unidentifiable_pen20_data_fails_instead_of_silently_dropping_routes(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.generate([], guide_html={"pen20": "<p>No dataset</p>"})

    def test_choice_list_belongs_only_to_the_immediately_preceding_route(self):
        routes = evolution("Second", "Jogress with Vaccine Stage V", "second") + '<hr/>' + evolution("Third", "Choose one:", "third") + '<ul class="deetsList"><li>0 Care Mistakes</li><li>Jogress with Vaccine Stage V</li></ul>'
        result = self.generate(
            [node("a", "First", 5), node("b", "Second", 6), node("c", "Third", 6)],
            guide_html={"penc": ""},
            details=[("penc", "first", card("First", "V", routes))],
        )
        self.assertIn(["a", "b", "jogress", 0, ["penc"]], result["routes"])
        self.assertIn(["a", "c", "normal", 1, ["penc"]], result["routes"])

    def test_unimplemented_unlocks_are_special_but_default_slot_alternative_is_available(self):
        routes = evolution("Second", "Slot 6 not unlocked, 0 Care Mistakes", "second") + evolution("Third", "Clear Area F of Quest Mode as First", "third") + evolution("Fourth", "Mode Change", "fourth")
        result = self.generate(
            [node("a", "First", 4), node("b", "Second", 5), node("c", "Third", 5), node("d", "Fourth", 5)],
            guide_html={"penc": ""},
            details=[("penc", "first", card("First", "IV", routes))],
        )
        self.assertIn(["a", "b", "normal", 1, ["penc"]], result["routes"])
        for target in ["c", "d"]:
            self.assertIn(["a", target, "special", 0, ["penc"]], result["routes"])

    def test_modern_chart_requires_cached_conditions_instead_of_assuming_normal(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.generate([node("a", "First", 4)], guide_html={"penc": '<div class="profile" onclick="digimonDetailsUnified(\'first\',\'16\',\'\')"><img title="First"></div>'})

    def test_withdrawn_routes_are_retained_only_as_unverified_for_pending_saves(self):
        result = self.generate(
            [node("a", "First", 4), node("b", "Second", 5)],
            guide_html={"penc": ""},
            previous={"sources": {"penc": "https://humulos.com/digimon/penc/"}, "routes": [["a", "b", "normal", 15, ["penc"]]]},
        )
        self.assertEqual(result["routes"], [["a", "b", "unverified", 0, ["penc"]]])

    def test_xros_default_album_branch_is_normal_but_collection_and_digixros_are_special(self):
        routes = evolution("Second", "Choose one:", "second") + '<ul class="deetsList"><li>Shoutmon X7 missing from Album</li><li>Have Shoutmon X7 in your Album, Train 0-10 times</li></ul>' + evolution("Third", "DigiXros: Obtain First in your Album or Friend list", "third")
        result = self.generate(
            [node("a", "First", 2), node("b", "Second", 3), node("c", "Third", 4)],
            guide_html={"dmxw": ""},
            details=[("dmxw", "first", card("First", "II", routes))],
        )
        self.assertIn(["a", "b", "normal", 15, ["dmxw"]], result["routes"])
        self.assertIn(["a", "c", "special", 0, ["dmxw"]], result["routes"])


if __name__ == "__main__":
    unittest.main()
