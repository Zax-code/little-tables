#!/usr/bin/env python3
"""Rebuild Malo's v2 walk using generated rasters and one invariant W1 core.

Requires Pillow. Chroma-key settings are recorded in generation-record.json.
Selections reuse original artwork; no subject pixels or outlines are drawn.
A deterministic RGB palette lookup matches the unchanged watering sheet.
"""
from collections import Counter
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from shutil import copyfile

from PIL import Image, ImageDraw, ImageFilter

SEQUENCE = Path(__file__).resolve().parent
REPO = SEQUENCE.parents[4]
sys.path.insert(0, str(REPO / 'tools/asset-pipeline'))
from character_asset_pipeline import assemble, normalize  # noqa: E402

CELL = 627
BOB = 19
BASELINE = 572
BACKGROUND = '#eff5e9'


def region(points):
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def feet_region(image, index=0):
    """Select below each generated shirt hem; overlap its existing black edge."""
    hems = [
        [(0, 466), (188, 460), (214, 473), (251, 483), (300, 486), (350, 486), (430, 477), (CELL, 477)],
        [(0, 472), (216, 449), (246, 461), (290, 465), (350, 465), (390, 460), (CELL, 460)],
        [(0, 463), (188, 459), (214, 472), (251, 481), (300, 486), (350, 486), (430, 478), (CELL, 478)],
        [(0, 477), (275, 462), (320, 464), (380, 462), (425, 459), (CELL, 459)],
    ]
    mask = region(hems[index] + [(CELL, CELL), (0, CELL)])
    # Blue can pixels belong exclusively to the invariant master.
    pixels, selected = image.load(), mask.load()
    for y in range(445, CELL):
        for x in range(CELL):
            r, g, b, alpha = pixels[x, y]
            if alpha and b > 70 and b > r * 1.4:
                selected[x, y] = 0
    # Exclude the original cream hem; the shared master provides its exact edge.
    for x in range(CELL):
        cream = [y for y in range(445, 495) if pixels[x, y][3] > 100
                 and min(pixels[x, y][:3]) > 150]
        if cream:
            for y in range(445, max(cream) + 2):
                selected[x, y] = 0
    leg_right = (475, 388, 475, 432)[index]
    for y in range(445, CELL):
        for x in range(leg_right, CELL):
            selected[x, y] = 0
    # Preserve the can's actual blue raster and adjacent black outline, not a
    # rectangle that would also erase the forward leg underneath the can.
    blue = Image.new('L', image.size)
    blue_pixels = blue.load()
    for y in range(440, 495):
        for x in range(CELL):
            r, g, b, alpha = pixels[x, y]
            if alpha > 100 and b > 70 and b > r * 1.4:
                blue_pixels[x, y] = 255
    near_blue = blue.filter(ImageFilter.MaxFilter(9)).load()
    for y in range(440, 495):
        for x in range(CELL):
            r, g, b, alpha = pixels[x, y]
            if blue_pixels[x, y] or (near_blue[x, y] and max(r, g, b) < 90):
                selected[x, y] = 0
    return mask


def select(image, mask):
    output = image.copy()
    output.putalpha(Image.frombytes('L', image.size, bytes(
        min(alpha, selection)
        for alpha, selection in zip(image.getchannel('A').tobytes(), mask.tobytes())
    )))
    return output


def canonical(image):
    rgba = image.tobytes()
    return Image.frombytes('RGBA', image.size, b''.join(
        rgba[offset:offset + 4] if rgba[offset + 3] else bytes(4)
        for offset in range(0, len(rgba), 4)
    ))


WATER_SHEET = REPO / 'apps/app/public/characters/malo-bear/garden-water-sheet.webp'
PALETTE_BIN = 8
PALETTE_TOLERANCE = 3
# Interior swatches in G1, avoiding outlines, eyes, nose, and can.
WATER_SWATCHES = {
    'innerEar': (203, 112, 225, 139),
    'muzzle': (290, 247, 313, 282),
    'shirt': (205, 433, 265, 468),
    'scarf': (284, 322, 349, 347),
}
WALK_SWATCHES = {
    'innerEar': (241, 117, 265, 140),
    'muzzle': (404, 231, 425, 249),
    'shirt': (218, 424, 289, 449),
    'scarf': (310, 312, 351, 328),
}


def is_fur(rgb):
    red, green, blue = rgb
    return red > 100 and .36 * red < green < .7 * red and blue < .6 * green


def dominant_color(image, fur_only=False):
    """Modal opaque RGB in fixed 8-unit bins; deterministic tie ordering."""
    counts = Counter()
    data = image.tobytes()
    for offset in range(0, len(data), 4):
        red, green, blue, alpha = data[offset:offset + 4]
        if alpha != 255 or max(red, green, blue) <= 100:
            continue
        if fur_only and not is_fur((red, green, blue)):
            continue
        counts[tuple(c // PALETTE_BIN * PALETTE_BIN for c in (red, green, blue))] += 1
    assert counts, 'Palette sample has no opaque material pixels'
    return min(counts, key=lambda rgb: (-counts[rgb], rgb))


def palette_contract(master, water_sheet):
    source = {'fur': dominant_color(master, fur_only=True)}
    target = {'fur': dominant_color(water_sheet, fur_only=True)}
    water = water_sheet.crop((0, 0, CELL, CELL))
    for material in WATER_SWATCHES:
        source[material] = dominant_color(master.crop(WALK_SWATCHES[material]))
        target[material] = dominant_color(water.crop(WATER_SWATCHES[material]))
    return source, target


def inner_ear_mask(master):
    """Select the generated inner-ear fill enclosed by its original black lines."""
    mask = Image.new('L', master.size)
    selected, pixels = mask.load(), master.load()
    queue = [(255, 125)]
    while queue:
        x, y = queue.pop()
        if not (0 <= x < CELL and 0 <= y < CELL) or selected[x, y]:
            continue
        red, green, blue, alpha = pixels[x, y]
        if alpha < 128 or not is_fur((red, green, blue)):
            continue
        selected[x, y] = 255
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    assert 100 < sum(bool(a) for a in mask.tobytes()) < 2000, 'Inner ear contour is open'
    return mask


def match_palette(frame, bob, source, target, ear_mask):
    """RGB lookup on assembled generated rasters: no alpha or geometry changes.

    One material offset per channel preserves source shading/texture. Outlines,
    facial black pixels and every blue-can pixel are returned byte-for-byte.
    Raw generated and alpha-cleaned sources remain immutable provenance inputs.
    """
    offsets = {material: tuple(b - a for a, b in zip(source[material], target[material]))
               for material in source}
    pixels, ears = frame.load(), ear_mask.load()
    output = frame.copy()
    corrected = output.load()
    lookup = {}
    for y in range(CELL):
        master_y = y + bob
        for x in range(CELL):
            red, green, blue, alpha = pixels[x, y]
            if not alpha or max(red, green, blue) <= 100:
                continue
            material = None
            if is_fur((red, green, blue)):
                material = 'innerEar' if master_y < CELL and ears[x, master_y] else 'fur'
            elif red > 110 and red > green * 2 and red > blue * 2:
                material = 'scarf'
            elif red > 220 and min(red, green, blue) > 140:
                material = 'muzzle' if master_y < 303 else 'shirt'
            if material:
                key = (material, red, green, blue)
                if key not in lookup:
                    lookup[key] = tuple(max(0, min(255, c + delta))
                                        for c, delta in zip((red, green, blue), offsets[material]))
                corrected[x, y] = (*lookup[key], alpha)
    assert output.getchannel('A').tobytes() == frame.getchannel('A').tobytes()
    # Protect exact linework and the watering-can raster, not just their bounds.
    for y in range(CELL):
        for x in range(CELL):
            red, green, blue, alpha = pixels[x, y]
            if max(red, green, blue) <= 100 or blue > red:
                assert corrected[x, y] == pixels[x, y]
    return output


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='malo-walk-v2-') as temporary:
        for index in range(1, 5):
            output = Path(temporary) / f'W{index}.png'
            normalize(SEQUENCE / f'W{index}/alpha-source.png', output,
                      CELL, CELL, 1.05, -14, -11)
            with Image.open(output) as image:
                normalized.append(image.convert('RGBA'))
    master = normalized[0]
    backward_mask = region([
        (0, 290), (249, 290), (244, 303), (232, 327), (220, 350), (211, 369),
        (204, 389), (198, 407), (187, 440), (0, 440),
    ])
    # W3 exposes the shirt's left contour where W1's swinging arm overlaps it.
    # Use that contour only as a mask; all retained torso pixels still come from W1.
    selected = backward_mask.load()
    outline = normalized[2].load()
    for y in range(290, 441):
        visible = [x for x in range(160, 255) if outline[x, y][3] > 100]
        if visible:
            boundary = min(visible)
            for x in range(255):
                selected[x, y] = 255 if x < boundary else 0
    backward_arm = select(master, backward_mask)
    forward_arm = select(normalized[2], region([
        (401, 292), (CELL, 292), (CELL, 374), (420, 374), (414, 346),
    ]))
    # Keep only shirt/hem and can pixels below y445 in the master. Brown skin
    # below the hem belongs to generated legs, never to the invariant torso.
    core_feet = Image.new('L', master.size)
    selected = core_feet.load()
    pixels = master.load()
    cream = Image.new('L', master.size)
    blue = Image.new('L', master.size)
    cp, bp = cream.load(), blue.load()
    for y in range(435, 500):
        for x in range(CELL):
            r, g, b, alpha = pixels[x, y]
            if alpha > 50 and min(r, g, b) > 140:
                cp[x, y] = 255
            if alpha > 50 and b > 70 and b > r * 1.4:
                bp[x, y] = 255
    near_cream = cream.filter(ImageFilter.MaxFilter(9)).load()
    near_blue = blue.filter(ImageFilter.MaxFilter(9)).load()
    for y in range(445, CELL):
        for x in range(CELL):
            r, g, b, alpha = pixels[x, y]
            keep = cp[x, y] or bp[x, y] or (
                max(r, g, b) < 100 and (near_cream[x, y] or near_blue[x, y])
            )
            selected[x, y] = 0 if keep else 255
    excluded = bytes(max(a, b) for a, b in zip(
        backward_mask.tobytes(), core_feet.tobytes(),
    ))
    raster = master.tobytes()
    core = Image.frombytes('RGBA', master.size, b''.join(
        raster[index * 4:index * 4 + 4] if not excluded[index] else bytes(4)
        for index in range(CELL * CELL)
    ))
    frames = []
    for index in range(4):
        bob = -BOB if index in (1, 3) else 0
        frame = Image.new('RGBA', (CELL, CELL))
        feet = select(normalized[index], feet_region(normalized[index], index))
        bounds = feet.getchannel('A').getbbox()
        # Extend the generated shins to meet the shared bobbed hem, with fixed soles.
        leg_top = 460 if index in (0, 2) else 445
        cropped = feet.crop((0, leg_top, CELL, bounds[3]))
        target_top = 451 if index in (0, 2) else 431
        cropped = cropped.resize((CELL, BASELINE - target_top), Image.Resampling.LANCZOS)
        frame.alpha_composite(cropped, (0, target_top))
        frame.alpha_composite(forward_arm if index in (1, 2) else backward_arm, (0, bob))
        frame.alpha_composite(core, (0, bob))
        frame = canonical(frame)
        assert frame.getchannel('A').getbbox()[3] == BASELINE
        assert all(frame.getpixel(p)[3] == 0 for p in ((0, 0), (626, 0), (0, 626), (626, 626)))
        frames.append(frame)
    # Full head/ear/face equality, and core torso/carrying arm/can equality.
    for box in ((190, 45, 460, 290), (248, 290, 400, 303), (250, 320, 400, 441)):
        expected = frames[0].crop(box).tobytes()
        for index, frame in enumerate(frames):
            bob = BOB if index in (1, 3) else 0
            x0, y0, x1, y1 = box
            assert frame.crop((x0, y0 - bob, x1, y1 - bob)).tobytes() == expected

    # Regression checks for the two defects found during independent review.
    assert all(frames[2].getpixel((x, 489))[3] == 255 for x in range(350, 425))
    for y in range(445, 465):
        for x in range(202, 261):
            red, green, blue, alpha = frames[3].getpixel((x, y))
            assert not (alpha > 100 and red > 120 and 60 < green < 180 and blue < 100)

    opaque_core = [(x, y) for y in range(CELL) for x in range(CELL)
                   if core.getpixel((x, y))[3] == 255]
    for index, frame in enumerate(frames):
        bob = BOB if index in (1, 3) else 0
        assert all(frame.getpixel((x, y - bob)) == core.getpixel((x, y))
                   for x, y in opaque_core)

    with Image.open(WATER_SHEET) as reference:
        water_sheet = reference.convert('RGBA')
    source_palette, target_palette = palette_contract(frames[0], water_sheet)
    ears = inner_ear_mask(frames[0])
    frames = [match_palette(frame, BOB if index in (1, 3) else 0,
                            source_palette, target_palette, ears)
              for index, frame in enumerate(frames)]
    for index, frame in enumerate(frames):
        fur = dominant_color(frame, fur_only=True)
        assert max(abs(a - b) for a, b in zip(fur, target_palette['fur'])) <= PALETTE_TOLERANCE, (
            f'W{index + 1} fur {fur} differs from watering fur {target_palette["fur"]}'
        )
        bob = BOB if index in (1, 3) else 0
        for material, (x0, y0, x1, y1) in WALK_SWATCHES.items():
            sampled = dominant_color(frame.crop((x0, y0 - bob, x1, y1 - bob)))
            assert max(abs(a - b) for a, b in zip(sampled, target_palette[material])) <= PALETTE_TOLERANCE
        frame.save(SEQUENCE / f'W{index + 1}/final-frame.png')
    # Palette mapping must retain the approved shared head and its 19px bob.
    for index, frame in enumerate(frames):
        bob = BOB if index in (1, 3) else 0
        assert frame.crop((190, 45 - bob, 460, 290 - bob)).tobytes() == frames[0].crop((190, 45, 460, 290)).tobytes()
    print(f'Palette anchors: {source_palette} -> {target_palette}; all fur deltas <= {PALETTE_TOLERANCE}.')

    runtime = REPO / 'apps/app/public/characters/malo-bear/garden-walk-sheet.webp'
    assemble([SEQUENCE / f'W{i}/final-frame.png' for i in range(1, 5)], runtime, 2, 2, CELL, CELL)
    review = SEQUENCE / 'review'
    review.mkdir(exist_ok=True)
    with Image.open(runtime) as assembled:
        sheet = canonical(assembled.convert('RGBA'))
    sheet.save(runtime, lossless=True, method=6, exact=True)
    for index, frame in enumerate(frames):
        x, y = index % 2 * CELL, index // 2 * CELL
        assert sheet.crop((x, y, x + CELL, y + CELL)).tobytes() == frame.tobytes()
    copyfile(runtime, review / 'runtime-sheet.webp')
    with Image.open(REPO / 'apps/app/public/characters/malo-bear/garden-water-sheet.webp') as sheet:
        water = sheet.convert('RGBA').crop((0, 0, CELL, CELL))
    assert water.getchannel('A').getbbox()[3] == BASELINE
    water.save(review / 'water-reference.png')
    board = Image.new('RGB', (CELL * 4, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(board)
    phases = ('right contact', 'left passing', 'left contact', 'right passing')
    for index, frame in enumerate(frames):
        board.paste(frame, (index * CELL, 40), frame)
        draw.text((index * CELL + 20, 12), f'W{index + 1} - {phases[index]}', fill='black')
        draw.line((index * CELL, BASELINE + 39, (index + 1) * CELL, BASELINE + 39), fill='#9aae9d')
    board.save(review / 'frames-side-by-side.png')
    comparison = Image.new('RGB', (CELL * 2, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(comparison)
    for index, (frame, label) in enumerate(zip((frames[0], water), ('Walk W1', 'Water G1 (unchanged)'))):
        comparison.paste(frame, (index * CELL, 40), frame)
        draw.text((index * CELL + 20, 12), label, fill='black')
    draw.line((0, BASELINE + 39, CELL * 2, BASELINE + 39), fill='#9aae9d')
    comparison.save(review / 'walk-water-comparison.png')
    animation = []
    for frame in frames:
        background = Image.new('RGBA', frame.size, BACKGROUND)
        background.alpha_composite(frame)
        animation.append(background.convert('RGB').resize((313, 313), Image.Resampling.LANCZOS))
    animation[0].save(review / 'walk-loop.gif', save_all=True, append_images=animation[1:],
                      duration=[140, 150, 140, 150], loop=0, disposal=2)
    print('Rebuilt Malo v2: invariant raster, 19px bob, water baseline and exact sheet cells passed.')


if __name__ == '__main__':
    rebuild()
