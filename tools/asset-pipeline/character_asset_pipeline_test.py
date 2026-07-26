#!/usr/bin/env python3
"""Focused tests for deterministic character alpha processing."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image

from character_asset_pipeline import protect_foreground_interior


class ProtectForegroundInteriorTest(unittest.TestCase):
    def test_filters_noise_and_preserves_reviewed_foreground_contracts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = Image.new("RGBA", (11, 11), (255, 0, 255, 255))
            soft = Image.new("RGBA", (11, 11), (0, 0, 0, 0))
            edge = Image.new("RGBA", (11, 11), (0, 0, 0, 0))
            hard = Image.new("RGBA", (11, 11), (0, 0, 0, 0))

            for y in range(3, 8):
                for x in range(3, 8):
                    source.putpixel((x, y), (180, 110, 220, 255))
                    soft.putpixel((x, y), (90, 90, 90, 128))
                    edge.putpixel((x, y), (70, 70, 70, 200))
                    hard.putpixel((x, y), (0, 0, 0, 255))

            for y in range(8, 10):
                for x in range(8, 10):
                    source.putpixel((x, y), (0, 120, 255, 255))
                    soft.putpixel((x, y), (0, 100, 200, 160))
                    edge.putpixel((x, y), (0, 90, 180, 220))
                    hard.putpixel((x, y), (0, 0, 0, 255))

            hard.putpixel((1, 1), (0, 0, 0, 255))
            soft.putpixel((1, 1), (255, 0, 255, 180))
            hard.putpixel((0, 5), (0, 0, 0, 255))
            hard.putpixel((1, 5), (0, 0, 0, 255))
            soft.putpixel((0, 5), (255, 0, 255, 180))
            soft.putpixel((1, 5), (255, 0, 255, 180))

            paths = {
                "source": root / "source.png",
                "soft": root / "soft.png",
                "edge": root / "edge.png",
                "hard": root / "hard.png",
                "output": root / "output.png",
            }
            source.save(paths["source"])
            soft.save(paths["soft"])
            edge.save(paths["edge"])
            hard.save(paths["hard"])

            protect_foreground_interior(
                paths["source"],
                paths["soft"],
                paths["edge"],
                paths["hard"],
                paths["output"],
                erosion_pixels=1,
                minimum_component_pixels=4,
            )

            with Image.open(paths["output"]) as result:
                result = result.convert("RGBA")
                self.assertEqual(result.getpixel((5, 5)), (180, 110, 220, 255))
                self.assertEqual(result.getpixel((3, 3)), (70, 70, 70, 128))
                self.assertEqual(result.getpixel((8, 8)), (0, 90, 180, 160))
                self.assertEqual(result.getpixel((1, 1)), (0, 0, 0, 0))
                self.assertEqual(result.getpixel((0, 5)), (0, 0, 0, 0))
                self.assertEqual(result.getpixel((1, 5)), (0, 0, 0, 0))

    def test_rejects_mismatched_matte_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            matte = root / "matte.png"
            mismatched = root / "mismatched.png"
            Image.new("RGBA", (3, 3)).save(source)
            Image.new("RGBA", (3, 3)).save(matte)
            Image.new("RGBA", (2, 3)).save(mismatched)

            with self.assertRaisesRegex(ValueError, "identical dimensions"):
                protect_foreground_interior(
                    source,
                    matte,
                    None,
                    mismatched,
                    root / "output.png",
                    erosion_pixels=1,
                    minimum_component_pixels=1,
                )


if __name__ == "__main__":
    unittest.main()
