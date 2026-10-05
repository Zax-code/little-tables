#!/usr/bin/env python3
"""Write reproducible provenance records for reviewed static character scenes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "assets/generated/characters"
PUBLIC_ROOT = ROOT / "apps/app/public/characters"

CHARACTERS = {
    "malo-bear": ("Malo", "bear", "cream short-sleeve T-shirt and brick-red neckerchief"),
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
    "colin-mallard": ("Colin", "mallard", "leafy-green vest and lavender neckerchief"),
}

SCENES = {
    "connect-profile": {
        "dimensions": [256, 256],
        "state": (
            "A centered head-and-upper-torso connect/profile portrait, matching the Miffy "
            "reference's friendly expression, crop, optical scale, and generous padding."
        ),
    },
    "home": {
        "dimensions": [320, 494],
        "state": (
            "The character stands full-body and presents one red tulip in the same hand, "
            "with the same flower endpoint, baseline, headroom, and negative space as Miffy."
        ),
    },
    "practice-idle": {
        "dimensions": [327, 377],
        "state": (
            "The character peeks over the bottom edge with both paws or species-natural wing "
            "tips visible, matching the idle practice crop and baseline."
        ),
    },
    "practice-correct": {
        "dimensions": [669, 922],
        "state": (
            "A joyful correct-answer reaction with closed happy eyes and both arms, paws, or "
            "species-natural wings raised, matching Miffy's apparent scale and foot baseline."
        ),
    },
    "practice-encourage": {
        "dimensions": [785, 931],
        "state": (
            "A gentle encouraging thinking pose with a small head tilt and one paw or "
            "species-natural wing at the cheek, matching Miffy's baseline and framing."
        ),
    },
    "update-recovery": {
        "dimensions": [1005, 1210],
        "state": (
            "The character kneels thoughtfully at left beside the same tipped orange pot, "
            "fallen red tulip, spilled soil, and clockwise pink retry arrow. Preserve prop "
            "layering, angle, endpoints, ground line, and right-side negative space."
        ),
    },
}

OFFSETS: dict[tuple[str, str], dict[str, float | int]] = {
    ("malo-bear", "practice-idle"): {"offsetY": 26},
    ("fenna-fox", "practice-idle"): {"offsetY": 5},
    ("mina-cat", "practice-idle"): {"offsetY": 9},
    ("paco-dog", "practice-idle"): {"offsetY": -2},
    ("colin-mallard", "practice-idle"): {"offsetY": 15},
    ("malo-bear", "practice-correct"): {"offsetY": 28},
    ("fenna-fox", "practice-correct"): {"offsetY": 33},
    ("mina-cat", "practice-correct"): {"offsetY": 42},
    ("paco-dog", "practice-correct"): {"offsetY": 33},
    ("colin-mallard", "practice-correct"): {"offsetY": 67},
    ("malo-bear", "practice-encourage"): {"offsetY": 35},
    ("fenna-fox", "practice-encourage"): {"offsetY": 20},
    ("mina-cat", "practice-encourage"): {"offsetY": 45},
    ("paco-dog", "practice-encourage"): {"offsetY": 60},
    ("colin-mallard", "practice-encourage"): {"offsetY": 3},
    ("malo-bear", "update-recovery"): {"offsetY": 105},
    ("fenna-fox", "update-recovery"): {"offsetY": 101},
    ("mina-cat", "update-recovery"): {"offsetY": 68},
    ("paco-dog", "update-recovery"): {"scale": 0.97, "offsetX": 15, "offsetY": 115},
    ("colin-mallard", "update-recovery"): {
        "scale": 0.93,
        "offsetX": 35,
        "offsetY": 139,
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cleanup(character_id: str, scene: str) -> dict[str, object]:
    settings: dict[str, object] = {
        "autoKey": "border",
        "softMatte": True,
        "transparentThreshold": 12,
        "opaqueThreshold": 220,
        "despill": True,
        "edgeContract": 1,
    }
    if (
        character_id == "colin-mallard" and scene != "update-recovery"
    ) or (character_id == "mina-cat" and scene == "home"):
        settings["foregroundInteriorProtection"] = {
            "edgeDespillKeyColor": "#ff00ff",
            "hardKeyColor": "#ff00ff",
            "hardTolerance": 64,
            "erosionPixels": 3,
            "minimumComponentPixels": 50,
            "removeBorderComponents": True,
            "method": "restore generated RGB only inside eroded opaque matte",
        }
    return settings


def prompt(
    character_name: str,
    species: str,
    wardrobe: str,
    scene: str,
    dimensions: list[int],
    state: str,
) -> str:
    if character_name == "Colin" and scene == "update-recovery":
        return """Production raster correction for one existing update-recovery frame only.

REFERENCE ROLES
Reference 1 is the authoritative active Miffy action/composition contract: preserve the kneeling thoughtful pose, tipped orange pot, fallen red tulip, spilled soil, clockwise pink retry arrow, prop layering, angles, endpoints, ground relationship, crop, visual scale, baseline, headroom, and right-side negative space.
Reference 2 is the mandatory Colin identity and wardrobe contract: Colin is the approved mallard with the exact canonical green head, orange beak and feet, leafy-green vest, lavender neckerchief, brown body, simple restrained black linework, proportions, and facial design.
Reference 3 is the already-reviewed Colin update-recovery source whose opaque subject pixels, pose, expression, props, prop positions, composition, and framing must remain visually unchanged. Correct only its flat cyan chroma-key background.

OUTPUT
Return exactly one frame, not a sheet. Preserve Reference 3 as faithfully as possible but replace the entire cyan background with a perfectly flat, uniform solid #0000FF royal-blue chroma-key background suitable for local removal. Keep Colin’s head fully green and unchanged. Keep the complete silhouette and every prop fully inside the same safe area. The pink retry arrow must remain solid, smooth, complete, clearly pink, and unchanged, with no holes, speckles, transparency simulation, or color shift. No shadows, scenery, text, logo, watermark, border, extra objects, extra flowers, extra soil, or altered wardrobe. Do not retain any cyan or magenta backdrop pixels. Do not create transparency; use only the flat royal-blue key behind the unchanged opaque illustration."""
    key = "magenta" if character_name == "Colin" or scene == "home" else "green"
    return f"""USE CASE / OUTPUT
Create one production raster frame for {scene}.
Output exact {dimensions[0]}:{dimensions[1]} aspect, one character, flat chroma-key {key} background, no text.

REFERENCE ROLES
Reference 1 is the active Miffy pose-and-composition contract. Preserve its action, camera, framing, ground line, optical center, negative space, props, and state.
Reference 2 is the identity contract. Replace Miffy with {character_name}, the approved {species}; preserve the canonical silhouette, face, fixed colors, and wardrobe. Do not blend species or retain rabbit features.

SEMANTIC STATE
{state}

STYLE
Use the approved canonical character reference's simple flat children's-book language: solid restrained fills, simple black linework, calm canonical colors, and minimal features. No photorealism, painterly texture, complex detail, text, logo, watermark, border, shadows, or scenery.

FRAMING / ALPHA CONTRACT
Keep the complete silhouette and every required prop inside the safe area. Match the active Miffy reference's crop, apparent scale, baseline, prop endpoints, and transparent-padding contract. Use only flat chroma key behind the subject.

INVARIANTS
Keep {wardrobe} unchanged. Keep all required scene props separate from the wardrobe and in the Reference 1 positions.

AVOID
No Miffy or rabbit ears, X mouth, pink dress, source-species leakage, extra limbs, extra props, extra flowers, extra droplets, text, logo, watermark, or border."""


def main() -> None:
    for character_id, (name, species, wardrobe) in CHARACTERS.items():
        identity = ASSET_ROOT / character_id / "home-reference/canonical-full-body-home.png"
        for scene, definition in SCENES.items():
            scene_dir = ASSET_ROOT / character_id / scene
            source = scene_dir / "generated-source.png"
            alpha = scene_dir / "alpha-source.png"
            final = scene_dir / "final-frame.png"
            runtime = PUBLIC_ROOT / character_id / f"{scene}.webp"
            missing = [path for path in (identity, source, alpha, final, runtime) if not path.exists()]
            if missing:
                raise FileNotFoundError(", ".join(str(path) for path in missing))
            with Image.open(final) as image:
                size = list(image.size)
            if size != definition["dimensions"]:
                raise ValueError(f"{final}: {size} != {definition['dimensions']}")
            references = {
                "reference1Pose": str(
                    ASSET_ROOT / "miffy" / scene / "reference-1-pose.png",
                ).replace(f"{ROOT}/", ""),
                "reference2Identity": str(identity).replace(f"{ROOT}/", ""),
            }
            rejected = [
                {
                    "path": str(path).replace(f"{ROOT}/", ""),
                    "sha256": sha256(path),
                }
                for path in sorted(scene_dir.glob("rejected*.png"))
            ]
            if character_id == "colin-mallard" and scene == "update-recovery":
                references["reference3CorrectionSource"] = str(
                    scene_dir / "rejected-generated-source-cyan-green-conflict.png",
                ).replace(f"{ROOT}/", "")
            record = {
                "version": 1,
                "tool": "built-in Image Generation",
                "characterId": character_id,
                "scene": scene,
                "references": references,
                "prompt": prompt(
                    name,
                    species,
                    wardrobe,
                    scene,
                    definition["dimensions"],
                    definition["state"],
                ),
                "productionDimensions": definition["dimensions"],
                "generatedSource": {
                    "path": str(source).replace(f"{ROOT}/", ""),
                    "sha256": sha256(source),
                },
                **({"rejectedSources": rejected} if rejected else {}),
                "alphaCleanup": {
                    "helper": (
                        "~/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
                    ),
                    **cleanup(character_id, scene),
                },
                "normalization": {
                    "method": "reviewed raster resize and transparent-canvas translation only",
                    "targetDimensions": definition["dimensions"],
                    "scale": 1,
                    "offsetX": 0,
                    "offsetY": 0,
                    **OFFSETS.get((character_id, scene), {}),
                },
                "review": {
                    "status": "approved",
                    "checks": [
                        "identity and fixed wardrobe",
                        "pose and semantic state",
                        "crop, visual scale, baseline, and prop endpoints",
                        "transparent corners and edge fringe",
                        "original-resolution visual inspection",
                    ],
                },
                "finalFrame": {
                    "path": str(final).replace(f"{ROOT}/", ""),
                    "sha256": sha256(final),
                },
                "runtimeAsset": {
                    "path": str(runtime).replace(f"{ROOT}/", ""),
                    "sha256": sha256(runtime),
                },
            }
            (scene_dir / "generation-record.json").write_text(
                json.dumps(record, indent=2) + "\n",
                encoding="utf-8",
            )


if __name__ == "__main__":
    main()
