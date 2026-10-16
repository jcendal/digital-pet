"""Offline tests for attack imports; requires Pillow."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location("attack_import", Path(__file__).resolve().parents[1] / "import-attack-artwork.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class AttackArtworkTests(unittest.TestCase):
    def test_alpha_and_white_stay_empty_but_coloured_attacks_have_lcd_pixels(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary) / "frame.png"
            image = Image.new("RGBA", (24, 24), (0, 255, 0, 0))
            for y in range(3):
                for x in range(3):
                    image.putpixel((x, y), (255, 255, 255, 255))
                    image.putpixel((x + 3, y), (255, 0, 0, 255))
            image.save(file)
            frame = importer.artwork(file)
            self.assertEqual(frame["content"].split("\n")[0], " ▀      ")
            self.assertEqual(frame["path"], "M1 0h1v1h-1z")

    def test_empty_resources_are_rejected_instead_of_silent_blank_attacks(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary) / "empty.png"
            Image.new("RGBA", (24, 24)).save(file)
            with self.assertRaises(ValueError):
                importer.artwork(file)

    def test_official_identity_disambiguates_same_name_stages_without_guessing(self):
        url = "https://digimon.net/reference_en/detail.php?directory_name=whamon"
        source = [
            {"id": "whamon-adult", "url_en": url, "extra_data": {"DM20": {"stage": 4}}, "name_english": "Whamon"},
            {"id": "whamon-perfect", "url_en": url, "extra_data": {"PENOG": {"stage": 5}}, "name_english": "Whamon"},
        ]
        node = {"url": url, "stage": 5, "name_en": "Whamon", "name_jp": "Whamon"}
        self.assertEqual(importer.match_species(node, source)["id"], "whamon-perfect")
        node["url"] = "https://digimon.net/reference_en/"
        self.assertIsNone(importer.match_species(node, source))

    def test_x_antibody_alias_does_not_confuse_the_base_species(self):
        source = [{"id": "agumon_x", "name_english": "Agumon (X Antibody)"}, {"id": "agumon", "name_english": "Agumon"}]
        node = {"url": "https://digimon.net/reference_en/", "stage": 3, "name_en": "Agumon X", "name_jp": "Agumon X"}
        self.assertEqual(importer.match_species(node, source)["id"], "agumon_x")


if __name__ == "__main__":
    unittest.main()
