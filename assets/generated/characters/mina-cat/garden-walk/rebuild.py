#!/usr/bin/env python3
"""Rebuild Mina's v2 walk from generated rasters and one rigid W3 master.

Requires Pillow and NumPy. Masks select generated artwork; no subject pixels
are drawn. RGB material offsets match the unchanged watering sheet. Chroma
cleanup settings and source provenance are recorded in generation-record.json.
"""
from collections import Counter
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SEQUENCE = Path(__file__).resolve().parent
REPO = SEQUENCE.parents[4]
sys.path.insert(0, str(REPO / 'tools/asset-pipeline'))
from character_asset_pipeline import assemble, normalize  # noqa: E402
from character_alpha import _retained_components  # noqa: E402

CELL, BOB, BASELINE = 627, 19, 572
BACKGROUND = '#eff5e9'
WATER_SHEET = REPO / 'apps/app/public/characters/mina-cat/garden-water-sheet.webp'
WALK_SWATCHES = {
    'fur': (275, 185, 350, 230),
    'cream': (400, 280, 420, 300),
    'cardigan': (260, 440, 300, 458),
    'collar': (300, 336, 335, 342),
    'can': (365, 447, 405, 475),
}
WALK_SWATCHES = {key: (x0 - 10, y0, x1 - 10, y1)
                 for key, (x0, y0, x1, y1) in WALK_SWATCHES.items()}
WATER_SWATCHES = {
    'fur': (230, 175, 270, 215),
    'cream': (275, 295, 330, 325),
    'cardigan': (210, 455, 255, 480),
    'collar': (280, 346, 320, 353),
    'can': (325, 455, 365, 485),
}


def material_mask(pixels, material):
    r, g, b, a = (pixels[..., i].astype(float) for i in range(4))
    visible = (a > 0) & (np.maximum.reduce([r, g, b]) > 100)
    masks = {
        'fur': (np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b]) < 22) & (r < 200),
        'cream': (r > 210) & (g > 170) & (b > 130) & (r > b + 20),
        'cardigan': (r > 120) & (b > g + 8) & (r > g + 8),
        'collar': (r > 180) & (g > 100) & (b < 140) & (g < r * .9),
        'can': (b > r * 1.3) & (b > g * 1.1) & (b > 80),
    }
    return visible & masks[material]


def dominant(image, material):
    pixels = np.asarray(image)
    colors = pixels[..., :3][material_mask(pixels, material) & (pixels[..., 3] == 255)]
    counts = Counter(map(tuple, colors.tolist()))
    assert counts, f'No opaque {material} pixels in swatch'
    return min(counts, key=lambda rgb: (-counts[rgb], rgb))


def region(points):
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon([(x - 10, y) for x, y in points], fill=255)
    return mask


def select(image, mask):
    pixels = np.array(image)
    pixels[..., 3] = np.minimum(pixels[..., 3], np.asarray(mask))
    pixels[pixels[..., 3] == 0] = 0
    return Image.fromarray(pixels)


def canonical(image):
    pixels = np.array(image)
    pixels[pixels[..., 3] == 0] = 0
    return Image.fromarray(pixels)


def match_palette(image, source, target):
    """Change RGB only; retain source shading, geometry, alpha and dark lines."""
    pixels = np.asarray(image)
    corrected = np.array(image)
    for material in source:
        selected = material_mask(pixels, material)
        offset = np.array(target[material]) - np.array(source[material])
        corrected[..., :3][selected] = np.clip(
            pixels[..., :3][selected].astype(int) + offset, 0, 255,
        )
    assert np.array_equal(corrected[..., 3], pixels[..., 3])
    dark = np.max(pixels[..., :3], axis=2) <= 100
    assert np.array_equal(corrected[dark], pixels[dark])
    return canonical(Image.fromarray(corrected))


def legs_mask(index):
    # Reviewed polygon joins follow each generated skirt's black hem. The
    # rigid master supplies the complete garment; only feet/shins are selected.
    hems = [
        [(0, 502), (205, 502), (230, 511), (270, 522), (325, 526), (370, 525), (428, 510), (CELL, 510)],
        [(0, 490), (215, 490), (244, 502), (282, 508), (320, 511), (365, 511), (403, 504), (CELL, 504)],
        [(0, 500), (210, 500), (238, 511), (275, 522), (325, 527), (375, 524), (434, 510), (CELL, 510)],
        [(0, 490), (220, 490), (254, 496), (290, 502), (337, 505), (380, 497), (430, 480), (CELL, 480)],
    ]
    return region(hems[index] + [(CELL, CELL), (0, CELL)])


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='mina-walk-v2-') as temporary:
        for i in range(1, 5):
            output = Path(temporary) / f'W{i}.png'
            normalize(SEQUENCE / f'W{i}/alpha-source.png', output, CELL, CELL, 1.05, -8, 12)
            normalized.append(Image.open(output).convert('RGBA'))
    water_sheet = Image.open(WATER_SHEET).convert('RGBA')
    water = water_sheet.crop((0, 0, CELL, CELL))
    master = normalized[2]
    source = {k: dominant(master.crop(box), k) for k, box in WALK_SWATCHES.items()}
    target = {k: dominant(water.crop(box), k) for k, box in WATER_SWATCHES.items()}

    forward_mask = region([(402, 334), (404, 344), (405, 350), (409, 362),
                           (413, 374), (417, 386), (420, 394), (423, 407),
                           (CELL, 407), (CELL, 334)])
    # The raised spout just touches the free-arm bounds; protect every blue
    # pixel and its black outline so backward-arm phases retain the full can.
    blue = Image.fromarray((material_mask(np.asarray(master), 'can') * 255).astype('uint8'))
    protected_can = np.asarray(blue.filter(ImageFilter.MaxFilter(9))) > 0
    selected = np.array(forward_mask)
    selected[protected_can] = 0
    forward_mask = Image.fromarray(selected)
    forward_arm = select(master, forward_mask)
    backward_arm = select(normalized[0], region([
        (200, 356), (280, 326), (267, 367), (245, 405),
        (220, 421), (195, 410), (184, 389),
    ]))
    removed = np.maximum(np.asarray(forward_mask), np.asarray(legs_mask(2)))
    core = select(master, Image.fromarray(255 - removed))
    retained = _retained_components(core.getchannel('A').tobytes(), CELL, CELL, 100)
    core = select(core, Image.frombytes('L', core.size, bytes(retained)))
    core = match_palette(core, source, target)
    frames = []
    for i, image in enumerate(normalized):
        bob = BOB if i in (1, 3) else 0
        frame = Image.new('RGBA', (CELL, CELL))
        legs = select(image, legs_mask(i))
        bottom = legs.getchannel('A').getbbox()[3]
        top = 480 if i in (0, 2) else 460
        target_top = (450, 469, 480, 480)[i] - bob
        fitted = legs.crop((0, top, CELL, bottom)).resize(
            (CELL, BASELINE - target_top), Image.Resampling.LANCZOS,
        )
        frame.alpha_composite(match_palette(fitted, source, target), (-6 if i == 0 else 0, target_top))
        arm = forward_arm if i in (1, 2) else backward_arm
        frame.alpha_composite(match_palette(arm, source, target), (0, -bob))
        frame.alpha_composite(core, (0, -bob))
        frame = canonical(frame)
        assert frame.size == (CELL, CELL)
        assert frame.getchannel('A').getbbox()[3] == BASELINE
        assert all(frame.getpixel(p)[3] == 0 for p in ((0, 0), (626, 0), (0, 626), (626, 626)))
        frames.append(frame)

    opaque_core = np.asarray(core)[..., 3] == 255
    for i, frame in enumerate(frames):
        bob = BOB if i in (1, 3) else 0
        aligned = np.array(Image.new('RGBA', core.size))
        aligned[bob:] = np.asarray(frame)[:CELL - bob]
        assert np.array_equal(aligned[opaque_core], np.asarray(core)[opaque_core])
        # Complete head rectangle, including transparent silhouette margins.
        assert frame.crop((215, 90 - bob, 450, 324 - bob)).tobytes() == frames[0].crop((215, 90, 450, 324)).tobytes()
        for material, (x0, y0, x1, y1) in WALK_SWATCHES.items():
            sampled = dominant(frame.crop((x0, y0 - bob, x1, y1 - bob)), material)
            assert max(abs(a - b) for a, b in zip(sampled, target[material])) <= 3, (material, sampled, target[material])
        for material in ('fur', 'can'):
            sampled = dominant(frame, material)
            expected = dominant(water_sheet, material)
            assert max(abs(a - b) for a, b in zip(sampled, expected)) <= 3, (material, sampled, expected)
        frame.save(SEQUENCE / f'W{i + 1}/final-frame.png')

    runtime = REPO / 'apps/app/public/characters/mina-cat/garden-walk-sheet.webp'
    assemble([SEQUENCE / f'W{i}/final-frame.png' for i in range(1, 5)], runtime, 2, 2, CELL, CELL)
    sheet = canonical(Image.open(runtime).convert('RGBA'))
    sheet.save(runtime, lossless=True, method=6, exact=True)
    for i, frame in enumerate(frames):
        x, y = i % 2 * CELL, i // 2 * CELL
        assert sheet.crop((x, y, x + CELL, y + CELL)).tobytes() == frame.tobytes()
    review = SEQUENCE / 'review'
    review.mkdir(exist_ok=True)
    copyfile(runtime, review / 'runtime-sheet.webp')
    water.save(review / 'water-reference.png')
    assert water.getchannel('A').getbbox()[3] == BASELINE
    board = Image.new('RGB', (CELL * 4, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(board)
    phases = ('right contact', 'left passing', 'left contact', 'right passing')
    for i, frame in enumerate(frames):
        board.paste(frame, (i * CELL, 40), frame)
        draw.text((i * CELL + 20, 12), f'W{i + 1} - {phases[i]}', fill='black')
        draw.line((i * CELL, BASELINE + 39, (i + 1) * CELL, BASELINE + 39), fill='#9aae9d')
    board.save(review / 'frames-side-by-side.png')
    comparison = Image.new('RGB', (CELL * 2, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(comparison)
    for i, (frame, label) in enumerate(zip((frames[0], water), ('Walk W1', 'Water G1 (unchanged)'))):
        comparison.paste(frame, (i * CELL, 40), frame)
        draw.text((i * CELL + 20, 12), label, fill='black')
        draw.line((i * CELL + 310, 385, i * CELL + 310, 580), fill='#9aae9d')
    draw.line((0, BASELINE + 39, CELL * 2, BASELINE + 39), fill='#9aae9d')
    comparison.save(review / 'walk-water-comparison.png')
    animation = []
    for frame in frames:
        background = Image.new('RGBA', frame.size, BACKGROUND)
        background.alpha_composite(frame)
        animation.append(background.convert('RGB').resize((313, 313), Image.Resampling.LANCZOS))
    animation[0].save(review / 'walk-loop.gif', save_all=True, append_images=animation[1:],
                      duration=[140, 150, 140, 150], loop=0, disposal=2)
    metrics = {
        'sourcePalette': source, 'waterPalette': target,
        'dominantFur': dominant(frames[0], 'fur'), 'waterDominantFur': dominant(water_sheet, 'fur'),
        'dominantCanBlue': dominant(frames[0], 'can'), 'waterDominantCanBlue': dominant(water_sheet, 'can'),
        'baseline': BASELINE, 'bob': BOB, 'bodyCenterX': 310,
        'alphaBounds': [frame.getchannel('A').getbbox() for frame in frames],
    }
    (review / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
    print(json.dumps(metrics))
    print('Exact shared core/head/tail, bob, water palette/baseline and lossless cells passed.')


if __name__ == '__main__':
    rebuild()
