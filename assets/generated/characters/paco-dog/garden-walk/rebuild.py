#!/usr/bin/env python3
"""Rebuild Paco's walk from generated phases and one invariant W3 raster.

Requires Pillow and NumPy. Selections reuse generated artwork without drawing
subject pixels. RGB material offsets match the unchanged watering sheet.
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
WATER_SHEET = REPO / 'apps/app/public/characters/paco-dog/garden-water-sheet.webp'
MATERIALS = ('fur', 'ears', 'stripe', 'mint', 'can')


def material_mask(pixels, material):
    r, g, b, a = (pixels[..., i].astype(float) for i in range(4))
    visible = (a > 0) & (np.maximum.reduce([r, g, b]) > 100)
    masks = {
        'fur': (r > 210) & (g > 175) & (b > 140) & (r > b + 12),
        'ears': (r > 140) & (g < r * .78) & (g > r * .35) & (b < g * .7),
        'stripe': (b > r + 5) & (g > r + 3) & (r > 100),
        'mint': (g > r + 15) & (g > b - 5) & (r > 75),
        'can': (b > r * 1.5) & (b > g * 1.2) & (b > 70) & (r < 100),
    }
    return visible & masks[material]


def dominant(image, material):
    pixels = np.asarray(image)
    colors = pixels[..., :3][material_mask(pixels, material) & (pixels[..., 3] == 255)]
    counts = Counter(map(tuple, colors.tolist()))
    assert counts, f'No opaque {material} pixels'
    return min(counts, key=lambda rgb: (-counts[rgb], rgb))


def region(points):
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def canonical(image):
    pixels = np.array(image)
    pixels[pixels[..., 3] == 0] = 0
    return Image.fromarray(pixels)


def select(image, mask):
    pixels = np.array(image)
    pixels[..., 3] = np.minimum(pixels[..., 3], np.asarray(mask))
    return canonical(Image.fromarray(pixels))


def match_palette(image, source, target):
    pixels = np.asarray(image)
    corrected = np.array(image)
    for material in MATERIALS:
        chosen = material_mask(pixels, material)
        offset = np.array(target[material]) - np.array(source[material])
        corrected[..., :3][chosen] = np.clip(
            pixels[..., :3][chosen].astype(int) + offset, 0, 255,
        )
    assert np.array_equal(corrected[..., 3], pixels[..., 3])
    dark = np.max(pixels[..., :3], axis=2) <= 100
    assert np.array_equal(corrected[dark], pixels[dark])
    return canonical(Image.fromarray(corrected))


def leg_mask(image, index, master=False):
    # Follow each generated black shirt hem. Keep overlap in its existing line,
    # while the single master supplies the entire shirt and watering can.
    hems = [
        [(0, 490), (215, 487), (240, 501), (260, 508), (280, 513), (300, 516), (340, 518), (370, 517), (410, 509), (470, 505), (CELL, 505)],
        [(0, 470), (215, 461), (240, 474), (260, 482), (280, 488), (300, 491), (340, 493), (370, 492), (410, 481), (CELL, 481)],
        [(0, 485), (215, 482), (240, 496), (260, 504), (280, 510), (300, 513), (340, 516), (370, 515), (410, 508), (470, 502), (CELL, 502)],
        [(0, 480), (215, 470), (240, 484), (260, 492), (280, 499), (300, 501), (340, 503), (370, 500), (410, 486), (CELL, 482)],
    ]
    contour = [(x - 3, y + (4 if master else 3)) for x, y in hems[index]]
    selected = np.array(region(contour + [(CELL, CELL), (0, CELL)]))
    can_pixels = material_mask(np.asarray(image), 'can')
    can_pixels[:, :330] = False
    blue = Image.fromarray((can_pixels * 255).astype('uint8'))
    protected = np.asarray(blue.filter(ImageFilter.MaxFilter(9))) > 0
    selected[protected & (~material_mask(np.asarray(image), 'fur') if not master else True)] = 0
    selected[:, 480:] = 0
    if not master:
        pixels = np.asarray(image)
        skin = material_mask(pixels, 'fur')
        adjacent = np.asarray(Image.fromarray((skin * 255).astype('uint8')).filter(ImageFilter.MaxFilter(15))) > 0
        neutral = (pixels[..., 0].astype(int) >= pixels[..., 1].astype(int) - 12) & (pixels[..., 0].astype(int) >= pixels[..., 2].astype(int) - 12)
        selected[~(skin | (adjacent & neutral))] = 0
    return Image.fromarray(selected)


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='paco-walk-v2-') as temporary:
        for i in range(1, 5):
            output = Path(temporary) / f'W{i}.png'
            normalize(SEQUENCE / f'W{i}/alpha-source.png', output, CELL, CELL, 1, 17, 28)
            normalized.append(Image.open(output).convert('RGBA'))
    water_sheet = Image.open(WATER_SHEET).convert('RGBA')
    water = water_sheet.crop((0, 0, CELL, CELL))
    target = {m: dominant(water_sheet, m) for m in MATERIALS}
    sources = [{m: dominant(im, m) for m in MATERIALS} for im in normalized]
    master = normalized[2]
    # Select the exposed free paw without the scarf bow or adjacent blue can.
    arm_mask = region([(416, 354), (CELL, 354), (CELL, 408), (416, 408)])
    selected = np.array(arm_mask)
    protected = material_mask(np.asarray(master), 'mint') | material_mask(np.asarray(master), 'can')
    protected = np.asarray(Image.fromarray((protected * 255).astype('uint8')).filter(ImageFilter.MaxFilter(11))) > 0
    selected[protected] = 0
    arm_mask = Image.fromarray(selected)
    forward_arm = select(master, arm_mask)
    backward_arm = select(normalized[0], region([
        (0, 345), (270, 345), (256, 359), (242, 386), (227, 418), (215, 436), (0, 436),
    ]))
    removed = np.maximum(np.asarray(arm_mask), np.asarray(leg_mask(master, 2, master=True)))
    core = select(master, Image.fromarray(255 - removed))
    retained = _retained_components(core.getchannel('A').tobytes(), CELL, CELL, 100)
    core = select(core, Image.frombytes('L', core.size, bytes(retained)))
    core = match_palette(core, sources[2], target)
    frames = []
    for i, image in enumerate(normalized):
        bob = BOB if i in (1, 3) else 0
        frame = Image.new('RGBA', (CELL, CELL))
        legs = select(image, leg_mask(image, i))
        retained_legs = _retained_components(legs.getchannel('A').tobytes(), CELL, CELL, 100)
        legs = select(legs, Image.frombytes('L', legs.size, bytes(retained_legs)))
        bottom = legs.getchannel('A').getbbox()[3]
        top = (480, 450, 480, 465)[i]
        target_top = (480, 455, 480, 455)[i]
        fitted = legs.crop((0, top, CELL, bottom)).resize(
            (CELL, BASELINE - target_top), Image.Resampling.LANCZOS,
        )
        if i == 1:
            # The generated can occludes the upper support shin. Reuse the
            # unobscured straight shin below it, extending it beneath the hem;
            # keep the original paw raster at its fixed baseline.
            fitted_pixels = np.array(fitted)
            fitted_pixels[:, 300:430] = 0
            fitted = Image.fromarray(fitted_pixels)
            shin = legs.crop((300, 508, 430, 537)).resize((130, 50), Image.Resampling.LANCZOS)
            paw = legs.crop((300, 537, 430, bottom))
            paw = paw.crop((0, 0, paw.width, paw.getchannel('A').getbbox()[3]))
            frame.alpha_composite(match_palette(shin, sources[i], target), (300, 488))
            frame.alpha_composite(match_palette(paw, sources[i], target), (300, BASELINE - paw.height))
        frame.alpha_composite(match_palette(fitted, sources[i], target), (0, target_top))
        arm, source = (forward_arm, sources[2]) if i in (1, 2) else (backward_arm, sources[0])
        frame.alpha_composite(match_palette(arm, source, target), (0, -bob))
        frame.alpha_composite(core, (0, -bob))
        frame = canonical(frame)
        retained = _retained_components(frame.getchannel('A').tobytes(), CELL, CELL, 100)
        frame = select(frame, Image.frombytes('L', frame.size, bytes(retained)))
        assert frame.size == (CELL, CELL)
        assert frame.getchannel('A').getbbox()[3] == BASELINE, (i,frame.getchannel('A').getbbox(),bottom)
        assert all(frame.getpixel(p)[3] == 0 for p in ((0, 0), (626, 0), (0, 626), (626, 626)))
        frames.append(frame)
    opaque_core = np.asarray(core)[..., 3] == 255
    for i, frame in enumerate(frames):
        bob = BOB if i in (1, 3) else 0
        aligned = np.array(Image.new('RGBA', core.size))
        aligned[bob:] = np.asarray(frame)[:CELL - bob]
        assert np.array_equal(aligned[opaque_core], np.asarray(core)[opaque_core])
        # Entire head, including its transparent margins, is identical after bob.
        assert frame.crop((190, 125 - bob, 490, 341 - bob)).tobytes() == frames[0].crop((190, 125, 490, 341)).tobytes()
        assert frame.crop((402, 345 - bob, 428, 374 - bob)).tobytes() == frames[0].crop((402, 345, 428, 374)).tobytes()
        assert all(frame.getpixel((x, y - bob))[3] == 255 for x, y in ((416, 362), (417, 365)))
        for material in ('fur', 'can'):
            sampled = dominant(frame, material)
            assert max(abs(a - b) for a, b in zip(sampled, target[material])) <= 3, (material, sampled, target[material])
        frame.save(SEQUENCE / f'W{i + 1}/final-frame.png')
    runtime = REPO / 'apps/app/public/characters/paco-dog/garden-walk-sheet.webp'
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
        draw.line((i * CELL + 325, 385, i * CELL + 325, 580), fill='#9aae9d')
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
        'sourcePalettes': sources, 'waterPalette': target,
        'dominantFur': [dominant(f, 'fur') for f in frames],
        'waterDominantFur': target['fur'],
        'dominantCanBlue': [dominant(f, 'can') for f in frames],
        'waterDominantCanBlue': target['can'],
        'baseline': BASELINE, 'bob': BOB, 'bodyCenterX': 325,
        'alphaBounds': [frame.getchannel('A').getbbox() for frame in frames],
    }
    (review / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
    print(json.dumps(metrics))
    print('Exact shared head/core/tail, bob, water palette/baseline and lossless cells passed.')


if __name__ == '__main__':
    rebuild()
