#!/usr/bin/env python3
"""Deterministic processing for reviewed character raster assets.

This utility never draws character pixels. It only extracts active runtime
frames, removes transparent padding by measurement, normalizes an existing
generated raster to an approved canvas, assembles reviewed frames, converts
formats, and validates alpha/dimensions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image

from character_alpha import protect_foreground_pixels


ACTIVE_SCENES = {
    "connect-profile": ("generated/miffy-google-connect.webp", (256, 256)),
    "home": ("generated/miffy-home.webp", (320, 494)),
    "practice-idle": ("generated/miffy-practice.webp", (327, 377)),
    "practice-correct": ("generated/miffy-practice-correct.webp", (669, 922)),
    "practice-encourage": ("generated/miffy-practice-encourage.webp", (785, 931)),
    "update-recovery": ("generated/miffy-update-recovery-v3.webp", (1005, 1210)),
}

ACTIVE_SEQUENCES = {
    "celebration": {
        "source": "generated/miffy-celebration-sprite-simple.webp",
        "cell": (418, 418),
        "layout": (4, 1),
        "frames": ("C1", "C2", "C3", "C4"),
        "runtime": "celebration-sheet.webp",
    },
    "garden-walk": {
        "source": "generated/miffy-garden-walking-sprite.webp",
        "cell": (627, 627),
        "layout": (2, 2),
        "frames": ("W1", "W2", "W3", "W4"),
        "runtime": "garden-walk-sheet.webp",
    },
    "garden-water": {
        "source": "generated/miffy-garden-watering-sprite.webp",
        "cell": (627, 627),
        "layout": (2, 2),
        "frames": ("G1", "G2", "G3", "G4"),
        "runtime": "garden-water-sheet.webp",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def alpha_stats(image: Image.Image) -> dict[str, Any]:
    alpha = image.getchannel("A")
    width, height = image.size
    return {
        "size": [width, height],
        "alphaExtrema": list(alpha.getextrema()),
        "alphaBounds": list(alpha.getbbox() or (0, 0, 0, 0)),
        "cornerAlpha": [
            alpha.getpixel((0, 0)),
            alpha.getpixel((width - 1, 0)),
            alpha.getpixel((0, height - 1)),
            alpha.getpixel((width - 1, height - 1)),
        ],
    }


def extract_references(public_dir: Path, output_dir: Path, contract_path: Path) -> None:
    contract: dict[str, Any] = {"scenes": {}, "sequences": {}, "version": 1}
    miffy_dir = output_dir / "miffy"

    for scene, (relative_source, expected_size) in ACTIVE_SCENES.items():
        source = public_dir / relative_source
        image = rgba(source)
        if image.size != expected_size:
            raise ValueError(f"{source} is {image.size}, expected {expected_size}")
        scene_dir = miffy_dir / scene
        scene_dir.mkdir(parents=True, exist_ok=True)
        reference = scene_dir / "reference-1-pose.png"
        image.save(reference, format="PNG")
        contract["scenes"][scene] = {
            "activeRuntimeSource": str(source),
            "dimensions": list(expected_size),
            "reference": str(reference),
            "sourceSha256": sha256(source),
            **alpha_stats(image),
        }

    for sequence, definition in ACTIVE_SEQUENCES.items():
        source = public_dir / definition["source"]
        sheet = rgba(source)
        cell_width, cell_height = definition["cell"]
        columns, rows = definition["layout"]
        expected_size = (cell_width * columns, cell_height * rows)
        if sheet.size != expected_size:
            raise ValueError(f"{source} is {sheet.size}, expected {expected_size}")
        frames_dir = miffy_dir / sequence / "reference-1-frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        frame_contract: dict[str, Any] = {}
        for index, frame_id in enumerate(definition["frames"]):
            column = index % columns
            row = index // columns
            box = (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
            frame = sheet.crop(box)
            reference = frames_dir / f"{frame_id}.png"
            frame.save(reference, format="PNG")
            frame_contract[frame_id] = {
                "cell": [column, row],
                "reference": str(reference),
                **alpha_stats(frame),
            }
        contract["sequences"][sequence] = {
            "activeRuntimeSource": str(source),
            "cellDimensions": list(definition["cell"]),
            "frames": frame_contract,
            "layout": list(definition["layout"]),
            "sheetDimensions": list(expected_size),
            "sourceSha256": sha256(source),
        }

    contract_path.parent.mkdir(parents=True, exist_ok=True)
    contract_path.write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")


def normalize(
    source: Path,
    output: Path,
    width: int,
    height: int,
    scale: float = 1.0,
    offset_x: int = 0,
    offset_y: int = 0,
) -> None:
    image = rgba(source)
    resized_size = (round(width * scale), round(height * scale))
    resized = image.resize(resized_size, Image.Resampling.LANCZOS)
    normalized = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    normalized.alpha_composite(resized, (offset_x, offset_y))
    output.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(output, format="PNG")


def assemble(
    frames: list[Path],
    output: Path,
    columns: int,
    rows: int,
    cell_width: int,
    cell_height: int,
) -> None:
    if len(frames) != columns * rows:
        raise ValueError(f"received {len(frames)} frames for {columns}x{rows} sheet")
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
    for index, frame_path in enumerate(frames):
        frame = rgba(frame_path)
        if frame.size != (cell_width, cell_height):
            raise ValueError(
                f"{frame_path} is {frame.size}, expected {(cell_width, cell_height)}",
            )
        sheet.alpha_composite(frame, ((index % columns) * cell_width, (index // columns) * cell_height))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="WEBP", lossless=True, method=6)


def convert(source: Path, output: Path) -> None:
    image = rgba(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="WEBP", lossless=True, method=6)


def protect_foreground_interior(
    source: Path,
    soft_matte: Path,
    edge_color_matte: Path | None,
    hard_matte: Path,
    output: Path,
    erosion_pixels: int,
    minimum_component_pixels: int,
) -> None:
    """Preserve opaque subject colors away from the reviewed soft-matte boundary."""
    source_image = rgba(source)
    soft_image = rgba(soft_matte)
    edge_image = rgba(edge_color_matte) if edge_color_matte else soft_image.copy()
    hard_image = rgba(hard_matte)
    if (
        source_image.size != soft_image.size
        or source_image.size != edge_image.size
        or source_image.size != hard_image.size
    ):
        raise ValueError(
            "source and all mattes must have identical dimensions",
        )

    width, height = source_image.size
    output_data = protect_foreground_pixels(
        source_image.tobytes(),
        soft_image.tobytes(),
        edge_image.tobytes(),
        hard_image.getchannel("A").tobytes(),
        width,
        height,
        erosion_pixels,
        minimum_component_pixels,
    )
    soft_image = Image.frombytes("RGBA", (width, height), output_data)

    output.parent.mkdir(parents=True, exist_ok=True)
    soft_image.save(output, format="PNG")


def validate(paths: list[Path], expected_width: int, expected_height: int) -> None:
    failures: list[str] = []
    for path in paths:
        image = rgba(path)
        stats = alpha_stats(image)
        if image.size != (expected_width, expected_height):
            failures.append(f"{path}: dimensions {image.size}")
        if stats["alphaExtrema"][0] != 0 or stats["alphaExtrema"][1] != 255:
            failures.append(f"{path}: alpha extrema {stats['alphaExtrema']}")
        if any(stats["cornerAlpha"]):
            failures.append(f"{path}: non-transparent corner {stats['cornerAlpha']}")
        print(json.dumps({"path": str(path), "sha256": sha256(path), **stats}))
    if failures:
        raise ValueError("; ".join(failures))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    commands = root.add_subparsers(dest="command", required=True)

    extract = commands.add_parser("extract-references")
    extract.add_argument("--public-dir", type=Path, required=True)
    extract.add_argument("--output-dir", type=Path, required=True)
    extract.add_argument("--contract", type=Path, required=True)

    normalize_command = commands.add_parser("normalize")
    normalize_command.add_argument("--source", type=Path, required=True)
    normalize_command.add_argument("--output", type=Path, required=True)
    normalize_command.add_argument("--width", type=int, required=True)
    normalize_command.add_argument("--height", type=int, required=True)
    normalize_command.add_argument("--scale", type=float, default=1.0)
    normalize_command.add_argument("--offset-x", type=int, default=0)
    normalize_command.add_argument("--offset-y", type=int, default=0)

    assemble_command = commands.add_parser("assemble")
    assemble_command.add_argument("--frames", nargs="+", type=Path, required=True)
    assemble_command.add_argument("--output", type=Path, required=True)
    assemble_command.add_argument("--columns", type=int, required=True)
    assemble_command.add_argument("--rows", type=int, required=True)
    assemble_command.add_argument("--cell-width", type=int, required=True)
    assemble_command.add_argument("--cell-height", type=int, required=True)

    convert_command = commands.add_parser("convert")
    convert_command.add_argument("--source", type=Path, required=True)
    convert_command.add_argument("--output", type=Path, required=True)

    protect_command = commands.add_parser("protect-foreground-interior")
    protect_command.add_argument("--source", type=Path, required=True)
    protect_command.add_argument("--soft-matte", type=Path, required=True)
    protect_command.add_argument("--edge-color-matte", type=Path)
    protect_command.add_argument("--hard-matte", type=Path, required=True)
    protect_command.add_argument("--output", type=Path, required=True)
    protect_command.add_argument("--erosion-pixels", type=int, default=1)
    protect_command.add_argument("--minimum-component-pixels", type=int, default=50)

    validate_command = commands.add_parser("validate")
    validate_command.add_argument("--paths", nargs="+", type=Path, required=True)
    validate_command.add_argument("--width", type=int, required=True)
    validate_command.add_argument("--height", type=int, required=True)
    return root


def main() -> None:
    args = parser().parse_args()
    if args.command == "extract-references":
        extract_references(args.public_dir, args.output_dir, args.contract)
    elif args.command == "normalize":
        normalize(
            args.source,
            args.output,
            args.width,
            args.height,
            args.scale,
            args.offset_x,
            args.offset_y,
        )
    elif args.command == "assemble":
        assemble(
            args.frames,
            args.output,
            args.columns,
            args.rows,
            args.cell_width,
            args.cell_height,
        )
    elif args.command == "convert":
        convert(args.source, args.output)
    elif args.command == "protect-foreground-interior":
        protect_foreground_interior(
            args.source,
            args.soft_matte,
            args.edge_color_matte,
            args.hard_matte,
            args.output,
            args.erosion_pixels,
            args.minimum_component_pixels,
        )
    elif args.command == "validate":
        validate(args.paths, args.width, args.height)


if __name__ == "__main__":
    main()
