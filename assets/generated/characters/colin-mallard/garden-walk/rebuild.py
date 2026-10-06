#!/usr/bin/env python3
"""Rebuild Colin's v2 walk from built-in generated phases and one W3 core.

Requires Pillow and NumPy. Only selects, resizes and composites generated
rasters; no subject pixels are drawn. Material RGB offsets match water G1.
Run with --clean-alpha to repeat the recorded v1 chroma processing (green key).
"""
from collections import Counter
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory
import argparse
import json
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SEQUENCE = Path(__file__).resolve().parent
REPO = SEQUENCE.parents[4]
sys.path.insert(0, str(REPO / 'tools/asset-pipeline'))
from character_asset_pipeline import assemble, normalize, protect_foreground_interior
from character_alpha import _retained_components

CELL, BOB, BASELINE, BODY_CENTER = 627, 19, 572, 285
SCALE, OFFSET_X, OFFSET_Y = 1.04, -25, 6
BACKGROUND = '#eff5e9'
WATER_SHEET = REPO / 'apps/app/public/characters/colin-mallard/garden-water-sheet.webp'
MATERIALS = ('head', 'yellow', 'vest', 'body', 'wing', 'scarf', 'can')


def material_mask(pixels, material):
    r, g, b, a = (pixels[..., i].astype(float) for i in range(4))
    visible = (a > 0) & (np.maximum.reduce([r, g, b]) > 100)
    masks = {
        'head': (g > r * 1.8) & (g > b * 1.25) & (r < 70),
        'yellow': (r > 200) & (g > 120) & (b < g * .3),
        'vest': (g > r * 1.15) & (r > 50) & (b < g * .8),
        'body': (r > 90) & (r < 210) & (g > r * .35) & (g < r * .75) & (b < g * .8),
        'wing': (r > 110) & (r < 220) & (abs(r - g) < 35) & (abs(g - b) < 30),
        'scarf': (b > r * 1.12) & (r > 100) & (g < r * .85),
        'can': (b > g * 1.2) & (b > 90) & (r < 90),
    }
    return visible & masks[material]


def dominant(image, material):
    pixels = np.asarray(image)
    colors = pixels[..., :3][material_mask(pixels, material) & (pixels[..., 3] == 255)]
    counts = Counter(map(tuple, colors.tolist()))
    assert counts, f'No opaque {material} pixels'
    return min(counts, key=lambda rgb: (-counts[rgb], rgb))


def canonical(image):
    pixels = np.array(image)
    # Repeat the chroma helper's 8-unit alpha noise floor after resampling.
    pixels[pixels[..., 3] <= 8] = 0
    return Image.fromarray(pixels)


def select(image, mask):
    pixels = np.array(image)
    pixels[..., 3] = np.minimum(pixels[..., 3], np.asarray(mask))
    return canonical(Image.fromarray(pixels))


def region(points):
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def source_region(points):
    return region([(round(x * SCALE) + OFFSET_X, round(y * SCALE) + OFFSET_Y) for x, y in points])


def match_palette(image, source, target):
    pixels = np.asarray(image)
    corrected = np.array(image)
    for material in MATERIALS:
        chosen = material_mask(pixels, material)
        offset = np.array(target[material]) - np.array(source[material])
        corrected[..., :3][chosen] = np.clip(pixels[..., :3][chosen].astype(int) + offset, 0, 255)
    dark = np.max(pixels[..., :3], axis=2) <= 100
    assert np.array_equal(corrected[dark], pixels[dark])
    assert np.array_equal(corrected[..., 3], pixels[..., 3])
    return canonical(Image.fromarray(corrected))


def legs_mask(image, index):
    # Follow each generated body hem and overlap its existing black edge.
    hems = [
        [(0, 468), (204, 467), (227, 484), (260, 499), (301, 505), (331, 503), (363, 493), (393, 476), (CELL, 476)],
        [(0, 464), (213, 464), (237, 480), (265, 493), (300, 500), (333, 499), (365, 488), (391, 475), (CELL, 475)],
        [(0, 466), (204, 466), (230, 486), (262, 499), (304, 505), (335, 501), (366, 489), (394, 473), (CELL, 473)],
        [(0, 463), (211, 463), (242, 482), (268, 494), (304, 501), (335, 499), (366, 488), (390, 475), (CELL, 475)],
    ]
    mask = np.asarray(source_region(hems[index] + [(CELL, CELL), (0, CELL)])).copy()
    pixels = np.asarray(image)
    yellow = material_mask(pixels, 'yellow')
    yellow[:450] = False
    nearby = np.asarray(Image.fromarray((yellow * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))) > 0
    # Generated shin/foot yellow and its own black outline only; no hem/tail/can.
    mask[~nearby] = 0
    return Image.fromarray(mask)


def clean_alpha():
    helper = Path.home() / '.codex/skills/.system/imagegen/scripts/remove_chroma_key.py'
    with TemporaryDirectory(prefix='colin-alpha-') as temp:
        temp = Path(temp)
        for i in range(1, 5):
            folder = SEQUENCE / f'W{i}'
            source = folder / 'generated-source.png'
            modes = {
                'soft': ['--auto-key', 'border', '--soft-matte', '--transparent-threshold', '12', '--opaque-threshold', '220', '--despill', '--edge-contract', '1'],
                'edge': ['--key-color', '#00ff00', '--soft-matte', '--transparent-threshold', '12', '--opaque-threshold', '220', '--despill', '--edge-contract', '1'],
                'hard': ['--key-color', '#00ff00', '--tolerance', '64'],
            }
            for name, settings in modes.items():
                subprocess.run([sys.executable, str(helper), '--input', str(source), '--out', str(temp / f'{name}.png'), '--force', *settings], check=True)
            protect_foreground_interior(source, temp / 'soft.png', temp / 'edge.png', temp / 'hard.png', folder / 'alpha-source.png', 3, 50)


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='colin-walk-v2-') as temp:
        for i in range(1, 5):
            output = Path(temp) / f'W{i}.png'
            normalize(SEQUENCE / f'W{i}/alpha-source.png', output, CELL, CELL, SCALE, OFFSET_X, OFFSET_Y)
            normalized.append(Image.open(output).convert('RGBA'))
    water = Image.open(WATER_SHEET).convert('RGBA').crop((0, 0, CELL, CELL))
    target = {m: dominant(water, m) for m in MATERIALS}
    sources = [{m: dominant(im, m) for m in MATERIALS} for im in normalized]
    master = normalized[2]
    forward_mask = source_region([(375, 309), (CELL, 309), (CELL, 379), (428, 379), (388, 357), (382, 336)])
    # Keep the entire blue handle and its generated black outline in the core.
    can_mask = Image.fromarray((material_mask(np.asarray(master), 'can') * 255).astype('uint8'))
    near_handle = np.asarray(can_mask.filter(ImageFilter.MaxFilter(9))) > 0
    master_pixels = np.asarray(master)
    # A proximity mask alone would retain a beige free-wing arc as a fringe.
    protected_handle = (np.asarray(can_mask) > 0) | (near_handle & (np.max(master_pixels[..., :3], axis=2) < 100))
    forward_pixels = np.array(forward_mask)
    forward_pixels[protected_handle] = 0
    forward_mask = Image.fromarray(forward_pixels)
    backward_mask = source_region([(0, 308), (254, 308), (245, 332), (230, 360), (216, 385), (204, 410), (0, 410)])
    forward = select(master, forward_mask)
    backward = select(normalized[0], backward_mask)
    core_legs = np.asarray(source_region([(0, 467), (204, 467), (230, 487), (262, 501), (304, 506), (335, 503), (366, 491), (394, 475), (CELL, 475), (CELL, CELL), (0, CELL)])).copy()
    blue = Image.fromarray((material_mask(np.asarray(master), 'can') * 255).astype('uint8'))
    protected_can = np.asarray(blue.filter(ImageFilter.MaxFilter(9))) > 0
    core_legs[protected_can] = 0
    yellow = material_mask(np.asarray(master), 'yellow')
    yellow[:450] = False
    core_legs[yellow] = 255
    excluded = np.maximum(np.asarray(forward_mask), core_legs)
    core = select(master, Image.fromarray(255 - excluded))
    core = match_palette(core, sources[2], target)

    frames = []
    for i, image in enumerate(normalized):
        bob = BOB if i in (1, 3) else 0
        frame = Image.new('RGBA', (CELL, CELL))
        legs = select(image, legs_mask(image, i))
        bottom = legs.getchannel('A').getbbox()[3]
        top = (490, 472, 490, 475)[i]
        target_top = (496, 477, 496, 477)[i]
        # Fit generated legs to the fixed sole baseline. Narrow their footprint
        # around the body axis to match Colin's watering-sheet webbed-foot size.
        fitted = legs.crop((0, top, CELL, bottom)).resize((round(CELL * .85), BASELINE - target_top), Image.Resampling.LANCZOS)
        leg_canvas = Image.new('RGBA', (CELL, CELL))
        leg_canvas.alpha_composite(fitted, (round(BODY_CENTER * .15), target_top))
        if i in (1, 3):
            lifted_box = (0, 0, 260, CELL) if i == 1 else (320, 0, CELL, CELL)
            lifted = leg_canvas.crop(lifted_box)
            cleared = np.array(leg_canvas)
            cleared[lifted_box[1]:lifted_box[3], lifted_box[0]:lifted_box[2]] = 0
            leg_canvas = Image.fromarray(cleared)
            leg_canvas.alpha_composite(lifted, (lifted_box[0], -8))
            shin_boxes = {1: (270, 529, 330, 539), 3: (240, 529, 299, 540)}
            shin = leg_canvas.crop(shin_boxes[i])
            shin = shin.resize((shin.width, 32), Image.Resampling.LANCZOS)
            leg_canvas.alpha_composite(shin, (shin_boxes[i][0], 501))
        frame.alpha_composite(match_palette(leg_canvas, sources[i], target))
        arm, palette = (forward, sources[2]) if i in (1, 2) else (backward, sources[0])
        frame.alpha_composite(match_palette(arm, palette, target), (0, -bob))
        frame.alpha_composite(core, (0, -bob))
        frame = canonical(frame)
        retained = _retained_components(frame.getchannel('A').tobytes(), CELL, CELL, 100)
        frame = select(frame, Image.frombytes('L', frame.size, bytes(retained)))
        assert frame.getchannel('A').getbbox()[3] == BASELINE, (i, frame.getchannel('A').getbbox())
        assert all(frame.getpixel(p)[3] == 0 for p in ((0, 0), (626, 0), (0, 626), (626, 626)))
        pixels = np.asarray(frame)
        hard = ((pixels[..., 3] > 100) * 255).astype('uint8')
        main = np.frombuffer(bytes(_retained_components(hard.tobytes(), CELL, CELL, 10000)), dtype='uint8').reshape(CELL, CELL)
        assert not np.any((pixels[..., 3] == 255) & (main == 0)), f'W{i+1} detached limb'
        r, g, b, a = (pixels[..., j] for j in range(4))
        assert not np.any((a > 0) & (g > 180) & (r < 60) & (b < 60)), f'W{i+1} chroma fringe'
        frames.append(frame)
    # The backward-wing phases must not retain W3's forward-wing stump.
    for i in (0, 3):
        bob = BOB if i == 3 else 0
        stump = np.asarray(frames[i].crop((379, 366 - bob, 390, 376 - bob)))
        assert not np.any(material_mask(stump, 'wing') & (stump[..., 3] == 255))
    opaque_core = np.asarray(core)[..., 3] == 255
    for i, frame in enumerate(frames):
        bob = BOB if i in (1, 3) else 0
        aligned = np.zeros_like(np.asarray(core))
        aligned[bob:] = np.asarray(frame)[:CELL - bob]
        assert np.array_equal(aligned[opaque_core], np.asarray(core)[opaque_core]), f'W{i+1} core changed'
        for box in ((178, 60, 477, 321), (130, 438, 195, 490)):
            x0, y0, x1, y1 = box
            assert frame.crop((x0, y0 - bob, x1, y1 - bob)).tobytes() == frames[0].crop(box).tobytes(), (i, box)
        for material in MATERIALS:
            sampled = dominant(frame, material)
            assert max(abs(a-b) for a,b in zip(sampled, target[material])) <= 3, (i, material, sampled, target[material])
        frame.save(SEQUENCE / f'W{i+1}/final-frame.png')
    runtime = REPO / 'apps/app/public/characters/colin-mallard/garden-walk-sheet.webp'
    assemble([SEQUENCE / f'W{i}/final-frame.png' for i in range(1, 5)], runtime, 2, 2, CELL, CELL)
    sheet = canonical(Image.open(runtime).convert('RGBA'))
    sheet.save(runtime, lossless=True, method=6, exact=True)
    for i, frame in enumerate(frames):
        x,y = i % 2 * CELL, i // 2 * CELL
        assert sheet.crop((x,y,x+CELL,y+CELL)).tobytes() == frame.tobytes()
    review = SEQUENCE / 'review'
    review.mkdir(exist_ok=True)
    copyfile(runtime, review / 'runtime-sheet.webp')
    water.save(review / 'water-reference.png')
    assert water.getchannel('A').getbbox()[3] == BASELINE
    board = Image.new('RGB', (CELL * 4, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(board)
    phases = ('right contact', 'left passing', 'left contact', 'right passing')
    for i,frame in enumerate(frames):
        board.paste(frame, (i*CELL, 40), frame)
        draw.text((i*CELL+20, 12), f'W{i+1} - {phases[i]}', fill='black')
        draw.line((i*CELL, BASELINE+39, (i+1)*CELL, BASELINE+39), fill='#9aae9d')
    board.save(review / 'frames-side-by-side.png')
    comparison = Image.new('RGB', (CELL * 2, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(comparison)
    for i,(frame,label) in enumerate(zip((frames[0],water), ('Walk W1', 'Water G1 (unchanged)'))):
        comparison.paste(frame, (i*CELL,40), frame)
        draw.text((i*CELL+20,12),label,fill='black')
        draw.line((i*CELL+BODY_CENTER,390,i*CELL+BODY_CENTER,580),fill='#9aae9d')
    draw.line((0,BASELINE+39,CELL*2,BASELINE+39),fill='#9aae9d')
    comparison.save(review / 'walk-water-comparison.png')
    animation=[]
    for frame in frames:
        background=Image.new('RGBA',frame.size,BACKGROUND)
        background.alpha_composite(frame)
        animation.append(background.convert('RGB').resize((313,313),Image.Resampling.LANCZOS))
    animation[0].save(review/'walk-loop.gif',save_all=True,append_images=animation[1:],duration=[140,150,140,150],loop=0,disposal=2)
    metrics={'sourcePalettes':sources,'waterPalette':target,'finalPalettes':[{m:dominant(f,m) for m in MATERIALS} for f in frames], 'baseline':BASELINE,'bob':BOB,'bodyCenterX':BODY_CENTER,'normalization':{'scale':SCALE,'offsetX':OFFSET_X,'offsetY':OFFSET_Y},'alphaBounds':[f.getchannel('A').getbbox() for f in frames], 'masterFrame':'W3','sharedCorePixelCount':int(opaque_core.sum())}
    (review/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print(json.dumps(metrics))
    print('Shared core/head/tail, bob, palette, baseline, corners and lossless cells passed.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clean-alpha',action='store_true')
    args=parser.parse_args()
    if args.clean_alpha:
        clean_alpha()
    rebuild()
