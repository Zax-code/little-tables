#!/usr/bin/env python3
"""Rebuild Miffy's v2 walk from generated rasters, without drawing subject pixels.

Run from any directory with Pillow installed. The existing asset-pipeline helpers
normalize sources and assemble the sheet. Raster selections keep one invariant
head/body/carrying-arm/can master while retaining generated feet and free arms.
Chroma removal precedes this step; its exact settings are in generation-record.json.
"""
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
BACKGROUND = '#eff5e9'


def region(points):
    """Select existing raster pixels; this mask never adds character pixels."""
    mask = Image.new('L', (CELL, CELL))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def feet_region(image):
    """Select the white feet and surrounding original outlines, below the hem."""
    mask = Image.new('L', image.size)
    pixels, selected = image.load(), mask.load()
    for y in range(475, CELL):
        for x in range(CELL):
            red, green, blue, alpha = pixels[x, y]
            if alpha > 100 and min(red, green, blue) > 180:
                selected[x, y] = 255
    grown = mask.filter(ImageFilter.MaxFilter(15))
    selected = grown.load()
    for x in range(CELL):
        colored = [
            y for y in range(475, 530)
            if pixels[x, y][3] > 100
            and max(pixels[x, y][:3]) - min(pixels[x, y][:3]) > 50
        ]
        if colored:
            # Keep the existing black dress/can edge with the invariant core.
            for y in range(475, max(colored) + 5):
                selected[x, y] = 0
    return grown


def select(image, mask):
    output = image.copy()
    output.putalpha(Image.frombytes('L', image.size, bytes(
        min(alpha, selection)
        for alpha, selection in zip(image.getchannel('A').tobytes(), mask.tobytes())
    )))
    return output


def rebuild():
    normalized = []
    with TemporaryDirectory(prefix='miffy-walk-v2-') as temporary:
        for index in range(1, 5):
            output = Path(temporary) / f'W{index}.png'
            normalize(
                SEQUENCE / f'W{index}/alpha-source.png', output,
                CELL, CELL, 1.05, -40, -20 if index in (1, 3) else -10,
            )
            with Image.open(output) as image:
                normalized.append(image.convert('RGBA'))

    backward_mask = region([
        (0, 330), (241, 337), (232, 352), (223, 372), (218, 391),
        (215, 405), (209, 426), (203, 446), (0, 446),
    ])
    forward_mask = region([(384, 333), (CELL, 333), (CELL, 420), (384, 420)])
    master = normalized[0]
    # Trim at the existing torso outline, preserving its original black pixels.
    # The leftmost part is the free sleeve/hand, not the invariant torso.
    contour = [(246, 337), (237, 352), (228, 372), (223, 391), (220, 405), (214, 426), (208, 446)]
    pixels, selected = master.load(), backward_mask.load()
    for y in range(348, 447):
        for (x0, y0), (x1, y1) in zip(contour, contour[1:]):
            if y0 <= y <= y1:
                expected = round(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
                break
        dark = [x for x in range(expected - 4, expected + 5)
                if max(pixels[x, y][:3]) < 70 and pixels[x, y][3] > 128]
        if dark:
            boundary = min(dark, key=lambda x: abs(x - expected))
            while boundary > expected - 3 and boundary - 1 in dark:
                boundary -= 1
            for x in range(250):
                selected[x, y] = 255 if x < boundary else 0
    backward_arm = select(master, backward_mask)
    forward_arm = select(normalized[2], forward_mask)
    excluded = bytes(max(a, b) for a, b in zip(
        backward_mask.tobytes(), feet_region(master).tobytes(),
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
        feet = select(normalized[index], feet_region(normalized[index]))
        frame.alpha_composite(feet, (0, 570 - feet.getchannel('A').getbbox()[3]))
        frame.alpha_composite(forward_arm if index in (1, 2) else backward_arm, (0, bob))
        frame.alpha_composite(core, (0, bob))
        # Canonical hidden RGB makes PNG and lossless WebP cells byte-identical.
        rgba = frame.tobytes()
        frame = Image.frombytes('RGBA', frame.size, b''.join(
            rgba[offset:offset + 4] if rgba[offset + 3] else bytes(4)
            for offset in range(0, len(rgba), 4)
        ))
        frame.save(SEQUENCE / f'W{index + 1}/final-frame.png')
        assert frame.getchannel('A').getbbox()[3] == 570
        assert frame.getpixel((0, 0))[3] == 0
        frames.append(frame)

    # Exact shared head/ears/eye/mouth raster, with only the 19px rigid bob.
    head = frames[0].crop((185, BOB, 424, 333)).tobytes()
    for index, frame in enumerate(frames):
        bob = BOB if index in (1, 3) else 0
        assert frame.crop((185, BOB - bob, 424, 333 - bob)).tobytes() == head

    runtime = REPO / 'apps/app/public/characters/miffy/garden-walk-sheet.webp'
    assemble([SEQUENCE / f'W{i}/final-frame.png' for i in range(1, 5)], runtime, 2, 2, CELL, CELL)
    review = SEQUENCE / 'review'
    review.mkdir(exist_ok=True)
    with Image.open(runtime) as assembled:
        # Preserve canonical transparent RGB too (the helper uses WebP's default).
        rgba = assembled.convert('RGBA').tobytes()
        sheet = Image.frombytes('RGBA', assembled.size, b''.join(
            rgba[offset:offset + 4] if rgba[offset + 3] else bytes(4)
            for offset in range(0, len(rgba), 4)
        ))
    sheet.save(runtime, lossless=True, method=6, exact=True)
    copyfile(runtime, review / 'runtime-sheet.webp')
    with Image.open(REPO / 'apps/app/public/characters/miffy/garden-water-sheet.webp') as sheet:
        water = sheet.convert('RGBA').crop((0, 0, CELL, CELL))
    water.save(review / 'water-reference.png')

    board = Image.new('RGB', (CELL * 4, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(board)
    for index, frame in enumerate(frames):
        board.paste(frame, (index * CELL, 40), frame)
        draw.text((index * CELL + 20, 12), f'W{index + 1}', fill='black')
        draw.line((index * CELL, 609, (index + 1) * CELL, 609), fill='#9aae9d')
    board.save(review / 'frames-side-by-side.png')
    comparison = Image.new('RGB', (CELL * 2, CELL + 40), BACKGROUND)
    draw = ImageDraw.Draw(comparison)
    for index, (frame, label) in enumerate(zip((frames[0], water), ('Walk W1', 'Water G1 (unchanged)'))):
        comparison.paste(frame, (index * CELL, 40), frame)
        draw.text((index * CELL + 20, 12), label, fill='black')
    draw.line((0, 609, CELL * 2, 609), fill='#9aae9d')
    comparison.save(review / 'walk-water-comparison.png')
    animation = []
    for frame in frames:
        background = Image.new('RGBA', frame.size, BACKGROUND)
        background.alpha_composite(frame)
        animation.append(background.convert('RGB').resize((313, 313), Image.Resampling.LANCZOS))
    animation[0].save(
        review / 'walk-loop.gif', save_all=True, append_images=animation[1:],
        duration=[140, 150, 140, 150], loop=0, disposal=2,
    )
    print('Rebuilt four 627px frames and lossless 1254px sheet; invariant head and baseline checks passed.')


if __name__ == '__main__':
    rebuild()
