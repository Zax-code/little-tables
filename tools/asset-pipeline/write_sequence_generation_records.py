#!/usr/bin/env python3
"""Write provenance records for reviewed character animation frames."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "assets/generated/characters"
PUBLIC_ROOT = ROOT / "apps/web/public/characters"

CHARACTERS = {
    "malo-bear": (
        "Malo",
        "bear",
        "cream short-sleeve T-shirt and brick-red neckerchief",
    ),
    "fenna-fox": (
        "Fenna",
        "fox",
        "open warm-ochre vest, blue neckerchief, visible tail, and toe-line marks",
    ),
    "mina-cat": ("Mina", "cat", "lilac cardigan and yellow collar"),
    "paco-dog": (
        "Paco",
        "floppy-eared dog",
        "pale blue-and-cream striped sailor shirt and mint neckerchief",
    ),
    "colin-mallard": (
        "Colin",
        "mallard",
        "leafy-green vest and lavender neckerchief",
    ),
}

SEQUENCES = {
    "celebration": {
        "cellDimensions": [418, 418],
        "layout": [4, 1],
        "sheetDimensions": [1672, 418],
        "runtime": "celebration-sheet.webp",
        "frames": {
            "C1": "anticipation crouch before the reward hop",
            "C2": "rising transition with the feet lifting",
            "C3": "airborne reward-hop apex",
            "C4": "landing and reset",
        },
    },
    "garden-walk": {
        "cellDimensions": [627, 627],
        "layout": [2, 2],
        "sheetDimensions": [1254, 1254],
        "runtime": "garden-walk-sheet.webp",
        "frames": {
            "W1": "right-facing stride with the front foot forward",
            "W2": "right-facing passing pose with the feet close",
            "W3": "right-facing opposite stride",
            "W4": "right-facing second passing pose",
        },
    },
    "garden-water": {
        "cellDimensions": [627, 627],
        "layout": [2, 2],
        "sheetDimensions": [1254, 1254],
        "runtime": "garden-water-sheet.webp",
        "frames": {
            "G1": "front-facing ready pose with upright can and zero droplets",
            "G2": "initial can tilt with exactly two separated droplets",
            "G3": "short pour with exactly four separated droplets",
            "G4": "full pour with exactly eight separated droplets",
        },
    },
}

NORMALIZATION: dict[tuple[str, str, str], tuple[float, int, int]] = {
    ("malo-bear", "celebration", "C1"): (1, 0, 9),
    ("fenna-fox", "celebration", "C1"): (1, -1, 4),
    ("mina-cat", "celebration", "C1"): (1, 0, -1),
    ("paco-dog", "celebration", "C1"): (1, 0, 28),
    ("colin-mallard", "celebration", "C1"): (1, 4, 5),
    ("malo-bear", "celebration", "C2"): (0.95, 10, 23),
    ("fenna-fox", "celebration", "C2"): (0.895, 27, 24),
    ("mina-cat", "celebration", "C2"): (1, 2, -4),
    ("paco-dog", "celebration", "C2"): (0.99, 2, 21),
    ("colin-mallard", "celebration", "C2"): (0.98, 3, 5),
    ("malo-bear", "celebration", "C3"): (1.1, -19, 7),
    ("fenna-fox", "celebration", "C3"): (1, 4, 19),
    ("mina-cat", "celebration", "C3"): (1.05, -12, 2),
    ("paco-dog", "celebration", "C3"): (1.03, -5, 27),
    ("colin-mallard", "celebration", "C3"): (1, 3, 17),
    ("malo-bear", "celebration", "C4"): (0.99, 4, 4),
    ("fenna-fox", "celebration", "C4"): (1.045, -7, -2),
    ("mina-cat", "celebration", "C4"): (0.96, 10, 2),
    ("paco-dog", "celebration", "C4"): (0.99, 2, 15),
    ("colin-mallard", "celebration", "C4"): (0.975, 7, 4),
    ("malo-bear", "garden-walk", "W1"): (1, 14, 15),
    ("malo-bear", "garden-walk", "W2"): (1.08, -80, 0),
    ("malo-bear", "garden-walk", "W3"): (1, -16, 5),
    ("malo-bear", "garden-walk", "W4"): (1.15, -89, -28),
    ("fenna-fox", "garden-walk", "W1"): (0.968, 8, 38),
    ("fenna-fox", "garden-walk", "W2"): (1.029, -43, 32),
    ("fenna-fox", "garden-walk", "W3"): (1.026, -8, 23),
    ("fenna-fox", "garden-walk", "W4"): (1.002, -39, 24),
    ("mina-cat", "garden-walk", "W1"): (0.923, 28, 56),
    ("mina-cat", "garden-walk", "W2"): (0.998, -6, 48),
    ("mina-cat", "garden-walk", "W3"): (1.015, -12, 21),
    ("mina-cat", "garden-walk", "W4"): (1, -10, 13),
    ("paco-dog", "garden-walk", "W1"): (1.05, -2, 45),
    ("paco-dog", "garden-walk", "W2"): (0.924, 10, 71),
    ("paco-dog", "garden-walk", "W3"): (1, -1, 28),
    ("paco-dog", "garden-walk", "W4"): (1.062, -38, 0),
    ("colin-mallard", "garden-walk", "W1"): (1.023, -2, 7),
    ("colin-mallard", "garden-walk", "W2"): (0.902, -11, 47),
    ("colin-mallard", "garden-walk", "W3"): (1, 2, -10),
    ("colin-mallard", "garden-walk", "W4"): (0.877, -7, 42),
    ("malo-bear", "garden-water", "G1"): (0.948, 22, 22),
    ("malo-bear", "garden-water", "G2"): (0.966, -32, 11),
    ("malo-bear", "garden-water", "G3"): (1.071, -43, -17),
    ("malo-bear", "garden-water", "G4"): (1.074, -59, -6),
    ("fenna-fox", "garden-water", "G1"): (0.98, 3, 18),
    ("fenna-fox", "garden-water", "G2"): (1.014, -32, 24),
    ("fenna-fox", "garden-water", "G3"): (0.984, -2, 18),
    ("fenna-fox", "garden-water", "G4"): (1.075, -57, 6),
    ("mina-cat", "garden-water", "G1"): (0.931, 29, 50),
    ("mina-cat", "garden-water", "G2"): (1, -24, 45),
    ("mina-cat", "garden-water", "G3"): (1.015, -4, 25),
    ("mina-cat", "garden-water", "G4"): (1.011, -26, 27),
    ("paco-dog", "garden-water", "G1"): (0.829, 68, 98),
    ("paco-dog", "garden-water", "G2"): (0.998, -34, 38),
    ("paco-dog", "garden-water", "G3"): (1.009, -3, 32),
    ("paco-dog", "garden-water", "G4"): (1.043, -40, 34),
    ("colin-mallard", "garden-water", "G1"): (0.966, -4, 27),
    ("colin-mallard", "garden-water", "G2"): (1.002, -8, 29),
    ("colin-mallard", "garden-water", "G3"): (1.045, -17, 7),
    ("colin-mallard", "garden-water", "G4"): (0.97, -12, 33),
}


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cleanup(character_id: str) -> dict[str, object]:
    settings: dict[str, object] = {
        "helper": "~/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py",
        "autoKey": "border",
        "softMatte": True,
        "transparentThreshold": 12,
        "opaqueThreshold": 220,
        "despill": True,
        "edgeContract": 1,
    }
    if character_id == "colin-mallard":
        settings.pop("autoKey")
        settings["keyColor"] = "#ff00ff"
        settings["foregroundInteriorProtection"] = {
            "hardKeyColor": "#ff00ff",
            "hardTolerance": 64,
            "erosionPixels": 3,
            "minimumComponentPixels": 50,
            "removeBorderComponents": True,
            "method": "restore generated RGB only inside eroded opaque matte",
        }
    return settings


def prompt(
    name: str,
    species: str,
    wardrobe: str,
    sequence: str,
    frame_id: str,
    state: str,
    dimensions: list[int],
) -> str:
    key = "magenta" if name == "Colin" else "green"
    direction = "Face right. " if sequence == "garden-walk" else ""
    prop_invariant = {
        "celebration": (
            "Keep the reward-hop silhouette free of unrelated action props."
        ),
        "garden-walk": (
            "Keep the complete upright blue watering can unchanged and do not add water."
        ),
        "garden-water": (
            "Keep the complete blue watering can and exactly the frame-specific water "
            "droplets shown by Reference 1."
        ),
    }[sequence]
    return f"""USE CASE / OUTPUT
Create one production raster frame for {sequence} / {frame_id}.
Output exact {dimensions[0]}:{dimensions[1]} aspect, one character, flat chroma-key {key} background, no text.

REFERENCE ROLES
Reference 1 is the active Miffy {frame_id} pose-and-composition contract. Preserve its exact action phase, camera, framing, optical center, negative space, prop location/angle/endpoints, baseline, and padding.
Reference 2 is the identity contract. Replace Miffy with {name}, the approved {species}; preserve the canonical silhouette, face, fixed colors, and wardrobe. Do not blend species or retain rabbit features.

SEMANTIC STATE
{state}. {direction}This is one reviewed frame only, not a generic pose or animation sheet.

STYLE / FRAMING
Use simple flat children's-book color and restrained black linework. Keep the complete character and every required prop uncropped. Match the neighboring frame's apparent scale, line weight, colors, baseline, and composition. Use only flat chroma behind the subject.

INVARIANTS
Keep {wardrobe} unchanged. {prop_invariant}

AVOID
No Miffy or rabbit identity, pink dress, extra limbs, extra props, flowers, plants, scenery, shadows, text, logo, watermark, border, or droplets beyond the semantic frame."""


def main() -> None:
    for character_id, (name, species, wardrobe) in CHARACTERS.items():
        identity = ASSET_ROOT / character_id / "home-reference/canonical-full-body-home.png"
        for sequence, definition in SEQUENCES.items():
            sequence_dir = ASSET_ROOT / character_id / sequence
            runtime = PUBLIC_ROOT / character_id / definition["runtime"]
            frame_records: list[dict[str, Any]] = []
            for frame_id, state in definition["frames"].items():
                frame_dir = sequence_dir / frame_id
                source = frame_dir / "generated-source.png"
                alpha = frame_dir / "alpha-source.png"
                final = frame_dir / "final-frame.png"
                missing = [
                    path
                    for path in (identity, source, alpha, final, runtime)
                    if not path.exists()
                ]
                if missing:
                    raise FileNotFoundError(", ".join(str(path) for path in missing))
                with Image.open(final) as image:
                    if list(image.size) != definition["cellDimensions"]:
                        raise ValueError(
                            f"{final}: {list(image.size)} != "
                            f"{definition['cellDimensions']}",
                        )
                scale, offset_x, offset_y = NORMALIZATION[
                    (character_id, sequence, frame_id)
                ]
                rejected = [
                    {"path": relative(path), "sha256": sha256(path)}
                    for path in sorted(frame_dir.glob("rejected*.png"))
                ]
                frame_records.append(
                    {
                        "frameId": frame_id,
                        "references": {
                            "reference1Pose": relative(
                                ASSET_ROOT
                                / "miffy"
                                / sequence
                                / "reference-1-frames"
                                / f"{frame_id}.png",
                            ),
                            "reference2Identity": relative(identity),
                        },
                        "prompt": prompt(
                            name,
                            species,
                            wardrobe,
                            sequence,
                            frame_id,
                            state,
                            definition["cellDimensions"],
                        ),
                        "generatedSource": {
                            "path": relative(source),
                            "sha256": sha256(source),
                        },
                        "rejectedSources": rejected,
                        "alphaCleanup": cleanup(character_id),
                        "alphaSource": {
                            "path": relative(alpha),
                            "sha256": sha256(alpha),
                        },
                        "normalization": {
                            "method": (
                                "reviewed raster resize and transparent-canvas "
                                "translation only"
                            ),
                            "targetDimensions": definition["cellDimensions"],
                            "scale": scale,
                            "offsetX": offset_x,
                            "offsetY": offset_y,
                        },
                        "review": {
                            "status": "approved",
                            "checks": [
                                "active runtime reference frame",
                                "identity and fixed wardrobe",
                                "action phase and pose landmarks",
                                "baseline, crop, apparent scale, and prop endpoints",
                                "frame-specific droplet count and placement",
                                "transparent corners, fringe, and complete silhouette",
                                "original-resolution inspection and sequence continuity",
                            ],
                        },
                        "finalFrame": {
                            "path": relative(final),
                            "sha256": sha256(final),
                        },
                    },
                )
            with Image.open(runtime) as sheet:
                if list(sheet.size) != definition["sheetDimensions"]:
                    raise ValueError(
                        f"{runtime}: {list(sheet.size)} != "
                        f"{definition['sheetDimensions']}",
                    )
            record = {
                "version": 1,
                "tool": "built-in Image Generation",
                "characterId": character_id,
                "sequence": sequence,
                "productionContract": {
                    "cellDimensions": definition["cellDimensions"],
                    "layout": definition["layout"],
                    "sheetDimensions": definition["sheetDimensions"],
                    "semanticOrder": list(definition["frames"]),
                },
                "frames": frame_records,
                "assembly": {
                    "method": "lossless reviewed-frame sheet assembly only",
                    "runtimeAsset": {
                        "path": relative(runtime),
                        "sha256": sha256(runtime),
                    },
                },
            }
            (sequence_dir / "generation-record.json").write_text(
                json.dumps(record, indent=2) + "\n",
                encoding="utf-8",
            )


if __name__ == "__main__":
    main()
