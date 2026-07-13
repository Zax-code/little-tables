#!/usr/bin/env python3
"""Split a transparent 2x2 character sheet into tightly padded web assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


SCENES = (
    ("home", 0, 0),
    ("practice", 1, 0),
    ("celebration", 0, 1),
    ("garden", 1, 1),
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--padding", type=int, default=28)
    args = parser.parse_args()

    sheet = Image.open(args.source).convert("RGBA")
    cell_width = sheet.width // 2
    cell_height = sheet.height // 2
    args.destination.mkdir(parents=True, exist_ok=True)

    for scene, column, row in SCENES:
        cell = sheet.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        alpha_bounds = cell.getchannel("A").getbbox()
        if alpha_bounds is None:
            raise ValueError(f"The {scene} cell does not contain visible pixels")

        left, top, right, bottom = alpha_bounds
        left = max(0, left - args.padding)
        top = max(0, top - args.padding)
        right = min(cell.width, right + args.padding)
        bottom = min(cell.height, bottom + args.padding)

        output = cell.crop((left, top, right, bottom))
        output.save(args.destination / f"miffy-{scene}.png", optimize=True)


if __name__ == "__main__":
    main()
