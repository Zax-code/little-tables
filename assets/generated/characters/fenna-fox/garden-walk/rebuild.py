#!/usr/bin/env python3
"""Rebuild Fenna v2 from generated rasters with one invariant W1 master.

Requires Pillow. Uses the existing normalize/assemble helpers. All subject
pixels are generated artwork: polygon masks select pixels, never draw them.
Chroma cleanup settings and immutable source provenance are in the record.
"""
from collections import Counter
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

SEQUENCE = Path(__file__).resolve().parent
REPO = SEQUENCE.parents[4]
sys.path.insert(0, str(REPO / 'tools/asset-pipeline'))
from character_asset_pipeline import assemble, normalize  # noqa: E402
from character_alpha import _retained_components  # noqa: E402

CELL, BOB, BASELINE = 627, 19, 572
BACKGROUND = '#eff5e9'
WATER_SHEET = REPO / 'apps/app/public/characters/fenna-fox/garden-water-sheet.webp'
WALK_SWATCHES = {
    'fur': (280, 192, 380, 242),
    'vest': (260, 427, 310, 454),
    'neckerchief': (325, 342, 365, 357),
    'muzzle': (330, 293, 380, 317),
    'tail': (151, 457, 180, 479),
}
WATER_SWATCHES = {
    'fur': (275, 165, 350, 215),
    'vest': (231, 446, 266, 478),
    'neckerchief': (280, 349, 328, 371),
    'muzzle': (253, 302, 294, 327),
    'tail': (195, 476, 211, 491),
}


def dominant(image, material=None, bin_size=8):
    counts = Counter()
    raw = image.tobytes()
    for i in range(0, len(raw), 4):
        r, g, b, a = raw[i:i + 4]
        if a != 255 or max(r, g, b) < 100:
            continue
        if material == 'fur' and not (r > 150 and g < .55 * r and b < .5 * g):
            continue
        counts[tuple(c // bin_size * bin_size for c in (r, g, b))] += 1
    assert counts
    return min(counts, key=lambda color: (-counts[color], color))


def region(points):
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def select(image, mask):
    result = image.copy()
    result.putalpha(Image.frombytes('L', image.size, bytes(
        min(a, m) for a, m in zip(image.getchannel('A').tobytes(), mask.tobytes())
    )))
    return result


def canonical(image):
    raw = image.tobytes()
    return Image.frombytes('RGBA', image.size, b''.join(
        raw[i:i + 4] if raw[i + 3] else bytes(4) for i in range(0, len(raw), 4)
    ))


def match_palette(image, source, target, bob=0):
    """Offset material RGB only, retaining alpha, shading and dark outlines.

    Geometric scarf selection protects the blue can. Fur, vest and cream are
    separated by their chroma. The tail has its own spatial material selection and RGB anchor.
    """
    offsets = {k: tuple(b - a for a, b in zip(source[k], target[k])) for k in source}
    result = image.copy()
    pixels, output = image.load(), result.load()
    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = pixels[x, y]
            if not a or max(r, g, b) <= 100:
                continue
            material = None
            if r > 150 and g < .55 * r and b < .5 * g:
                master_y = y + bob
                tail_edge = 250 if master_y < 481 else max(0, 240 - (master_y - 481) * 1.6)
                material = 'tail' if 410 < master_y < 507 and x < tail_edge else 'fur'
            elif r > 180 and .55 * r <= g < .8 * r and b < 100:
                material = 'vest'
            elif r > 220 and g > 180 and b > 150:
                material = 'muzzle'
            elif b > r * 1.3 and y + bob < 379 and x < 394:
                material = 'neckerchief'
            if material:
                output[x, y] = (*[max(0, min(255, c + d))
                                    for c, d in zip((r, g, b), offsets[material])], a)
    assert image.getchannel('A').tobytes() == result.getchannel('A').tobytes()
    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = pixels[x, y]
            if max(r, g, b) <= 100 or (b > r * 1.3 and y + bob >= 379):
                assert output[x, y] == pixels[x, y]
    return result


def lower_parts(image, cutoff, contour, protection=3):
    """Select generated legs; protect vest/can fill and their original outlines."""
    mask = region(contour + [(CELL, cutoff), (CELL, CELL), (0, CELL)])
    protected = Image.new('L', image.size)
    can_mask = Image.new('L', image.size)
    skin_mask = Image.new('L', image.size)
    pp, cp, kp, ip = protected.load(), can_mask.load(), skin_mask.load(), image.load()
    for y in range(cutoff - 10, 515):
        for x in range(CELL):
            r, g, b, a = ip[x, y]
            vest = r > 180 and .55 * r <= g < .8 * r and b < 100
            can = b > r * 1.3 and b > 80
            if a and vest:
                pp[x, y] = 255
            if a and can:
                cp[x, y] = 255
            if a > 128 and r > 150 and g < .55 * r and b < .5 * g:
                kp[x, y] = 255
    nearby = protected.filter(ImageFilter.MaxFilter(protection)).load()
    near_can = can_mask.filter(ImageFilter.MaxFilter(7 if protection == 9 else 15)).load()
    near_skin = skin_mask.filter(ImageFilter.MaxFilter(7)).load()
    mp = mask.load()
    for y in range(cutoff, CELL):
        for x in range(CELL):
            r, g, b, a = ip[x, y]
            can_outline = near_can[x, y] and not (protection == 3 and near_skin[x, y])
            if pp[x, y] or cp[x, y] or ((nearby[x, y] or can_outline) and max(r, g, b) < 150):
                mp[x, y] = 0
    return mask


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='fenna-walk-v2-') as temporary:
        for i in range(1, 5):
            output = Path(temporary) / f'W{i}.png'
            normalize(SEQUENCE / f'W{i}/alpha-source.png', output, CELL, CELL, .928, 24, 43)
            normalized.append(Image.open(output).convert('RGBA'))
    water_sheet = Image.open(WATER_SHEET).convert('RGBA')
    water = water_sheet.crop((0, 0, CELL, CELL))
    target = {k: dominant(water.crop(box), bin_size=1) for k, box in WATER_SWATCHES.items()}
    master = normalized[0]
    source = {k: dominant(master.crop(box), bin_size=1) for k, box in WALK_SWATCHES.items()}

    backward_mask = region([
        (181, 333), (280, 333), (272, 361), (264, 377), (257, 392),
        (246, 416), (183, 416),
    ])
    # Follow W3's exposed torso edge: the backward arm in W1 conceals it.
    boundary = backward_mask.load()
    exposed = normalized[2].load()
    for y in range(354, 417):
        xs = [x for x in range(230, 279) if exposed[x, y][3] > 128]
        if xs:
            for x in range(181, 280):
                boundary[x, y] = 255 if x < min(xs) else 0
    # The exposed-edge reference includes its scarf bow. Preserve W1's exact
    # blue bow and adjacent black outline rather than treating it as a limb.
    scarf = Image.new('L', master.size)
    sp, mp = scarf.load(), master.load()
    for y in range(310, 361):
        for x in range(230, 320):
            r, g, b, a = mp[x, y]
            if a and b > r * 1.3 and b > 80:
                sp[x, y] = 255
    near_scarf = scarf.filter(ImageFilter.MaxFilter(7)).load()
    for y in range(310, 361):
        for x in range(230, 320):
            if sp[x, y] or (near_scarf[x, y] and max(mp[x, y][:3]) < 100):
                boundary[x, y] = 0
    backward_arm = select(master, backward_mask)
    forward_arm = select(normalized[2], region([
        (381, 338), (CELL, 338), (CELL, 391), (407, 391), (397, 373),
    ]))
    cutoffs = (481, 451, 481, 455)
    contours = [
        [(0, 507), (202, 505), (213, 501), (229, 495), (237, 487), (240, 481)],
        [(0, 479), (221, 479), (258, 459), (252, 451)],
        [(0, 507), (202, 505), (213, 501), (229, 495), (237, 487), (240, 481)],
        [(0, 487), (236, 487), (249, 470), (250, 455)],
    ]
    legs_masks = [lower_parts(im, cutoff, contour) for im, cutoff, contour in zip(
        normalized, cutoffs, contours,
    )]
    master_legs = lower_parts(master, cutoffs[0], contours[0], protection=9)
    removed = bytes(max(a, b) for a, b in zip(backward_mask.tobytes(), master_legs.tobytes()))
    core = select(master, Image.frombytes('L', master.size, bytes(255 - v for v in removed)))
    # Chroma/mask interpolation may detach a few old leg-edge pixels from the
    # master. Retain connected raster regions, preserving all subject geometry.
    retained = _retained_components(core.getchannel('A').tobytes(), CELL, CELL, 100)
    core = select(core, Image.frombytes('L', core.size, bytes(retained)))
    frames = []
    for i, im in enumerate(normalized):
        bob = BOB if i in (1, 3) else 0
        frame = Image.new('RGBA', (CELL, CELL))
        legs = select(im, legs_masks[i])
        bounds = legs.getchannel('A').getbbox()
        # Fit generated lower legs between the unchanged waist join and soles.
        # Only leg rasters stretch; the invariant master is never rescaled.
        top = cutoffs[i]
        fitted = legs.crop((0, top, CELL, bounds[3])).resize(
            (CELL, BASELINE - top), Image.Resampling.LANCZOS,
        )
        frame.alpha_composite(fitted, ((0, -12, -8, -6)[i], top))
        frame.alpha_composite(forward_arm if i in (1, 2) else backward_arm, (0, -bob))
        frame.alpha_composite(core, (0, -bob))
        frame = canonical(match_palette(frame, source, target, bob))
        assert frame.size == (CELL, CELL)
        assert frame.getchannel('A').getbbox()[3] == BASELINE
        assert all(frame.getpixel(p)[3] == 0 for p in ((0, 0), (626, 0), (0, 626), (626, 626)))
        frames.append(frame)

    mapped_core = match_palette(core, source, target)
    opaque_core = [(x, y) for y in range(CELL) for x in range(CELL)
                   if core.getpixel((x, y))[3] == 255]
    for i, frame in enumerate(frames):
        bob = BOB if i in (1, 3) else 0
        assert all(frame.getpixel((x, y - bob)) == mapped_core.getpixel((x, y)) for x, y in opaque_core)
        # Split the head's lower strip from the free-arm/scarf area at left.
        for x0, y0, x1, y1 in ((234, 80, 472, 318), (280, 318, 472, 338)):
            assert frame.crop((x0, y0 - bob, x1, y1 - bob)).tobytes() == frames[0].crop((x0, y0, x1, y1)).tobytes()
        fur = dominant(frame, 'fur', bin_size=1)
        water_fur = dominant(water_sheet, 'fur', bin_size=1)
        assert max(abs(a - b) for a, b in zip(fur, water_fur)) <= 3, (fur, water_fur)
        for material, (x0, y0, x1, y1) in WALK_SWATCHES.items():
            sampled = dominant(frame.crop((x0, y0 - bob, x1, y1 - bob)), bin_size=1)
            assert max(abs(a - b) for a, b in zip(sampled, target[material])) <= 3, (material, sampled, target[material])
        frame.save(SEQUENCE / f'W{i + 1}/final-frame.png')

    runtime = REPO / 'apps/app/public/characters/fenna-fox/garden-walk-sheet.webp'
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
        draw.line((i * CELL + 320, 370, i * CELL + 320, 580), fill='#9aae9d')
    draw.line((0, BASELINE + 39, CELL * 2, BASELINE + 39), fill='#9aae9d')
    comparison.save(review / 'walk-water-comparison.png')
    animation = []
    for frame in frames:
        bg = Image.new('RGBA', frame.size, BACKGROUND)
        bg.alpha_composite(frame)
        animation.append(bg.convert('RGB').resize((313, 313), Image.Resampling.LANCZOS))
    animation[0].save(review / 'walk-loop.gif', save_all=True, append_images=animation[1:],
                      duration=[140, 150, 140, 150], loop=0, disposal=2)
    metrics = {'sourcePalette': source, 'waterPalette': target, 'dominantFur': dominant(frames[0], 'fur', bin_size=1),
               'waterDominantFur': dominant(water_sheet, 'fur', bin_size=1), 'baseline': BASELINE, 'bob': BOB,
               'bodyCenterX': 320, 'alphaBounds': [frame.getchannel('A').getbbox() for frame in frames]}
    (review / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
    print(json.dumps(metrics))
    print('Exact shared core, 19px bob, water palette/baseline and lossless sheet cells passed.')


if __name__ == '__main__':
    rebuild()
