import base64
import importlib.util
from pathlib import Path
import unittest
import zlib

SPEC = importlib.util.spec_from_file_location("color_sprites", Path(__file__).resolve().parents[1] / "import-color-sprites.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def blob(raw):
    return base64.b64encode(zlib.compress(raw)).decode()


class ColorSpriteTests(unittest.TestCase):
    def test_decode_retains_transparency_white_and_pose_order(self):
        first = bytes([0, 1, 2, 1] * 64)
        second = bytes(reversed(first))
        raw = bytes([0, 2, 255, 255, 255, 0, 0, 0]) + first + second
        palette, frames = MODULE.decode_sprite(["walk_1", "walk_2"], blob(raw))
        self.assertEqual(palette, [None, "#ffffff", "#000000"])
        self.assertEqual(frames["walk_1"], first)
        self.assertEqual(frames["walk_2"], second)

    def test_bad_blobs_cannot_silently_produce_partial_frames(self):
        valid = bytes([0, 1, 255, 0, 0]) + bytes([1] * 512)
        for raw in [valid[:-1], valid + b"extra", bytes([0, 0]) + bytes(512),
                    bytes([0, 1, 255, 0, 0]) + bytes([2] * 512), bytes(100_000)]:
            with self.assertRaises(ValueError):
                MODULE.decode_sprite(["walk_1", "walk_2"], blob(raw))
        with self.assertRaises(ValueError):
            MODULE.decode_sprite(["walk_1", "walk_1"], blob(valid))
        with self.assertRaises(ValueError):
            MODULE.decode_sprite(["walk_1", "javascript"], blob(valid))

    def test_run_encoding_splits_runs_at_byte_limit_and_round_trips(self):
        for pixels in [bytes(256), bytes([3] * 512), bytes(range(256)), bytes([0, 1, 2] * 86)]:
            packed = base64.b64decode(MODULE.encode_runs(pixels))
            result = bytearray()
            for index in range(0, len(packed), 2):
                self.assertGreater(packed[index], 0)
                result.extend([packed[index + 1]] * packed[index])
            self.assertEqual(result, pixels)
        self.assertEqual(base64.b64decode(MODULE.encode_runs(bytes(256))), bytes([255, 0, 1, 0]))

    def test_identity_matching_preserves_local_ids_and_requires_explicit_conflicts(self):
        local = [{"id": "4-054", "sprite": "greymon", "url": "https://example.test/?directory_name=greymon"}]
        upstream = [
            {"id": "A-085", "sprite": "greymon-2010", "url": local[0]["url"]},
            {"id": "A-086", "sprite": "greymon-vaccine", "url": "https://example.test/?directory_name=greymon-first"},
        ]
        overrides = {"4-054": {"legacySprite": "greymon", "sprite": "greymon-vaccine", "reason": "Preserve classic art"}}
        result = MODULE.match_identities(local, upstream, overrides)
        self.assertEqual(list(result), ["4-054"])
        self.assertEqual(result["4-054"]["upstreamId"], "A-086")
        self.assertEqual(local[0]["sprite"], "greymon")
        with self.assertRaises(ValueError):
            MODULE.match_identities(local, upstream + [upstream[0]], {})
        with self.assertRaises(ValueError):
            MODULE.match_identities([{**local[0], "sprite": "changed"}], upstream, overrides)


if __name__ == "__main__":
    unittest.main()
