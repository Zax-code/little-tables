# Miffy character sheet

Generated with the built-in GPT Image tool on 2026-07-12. This is the master
prompt for regenerating the four transparent character assets used in the app.

> Use case: illustration-story. Asset type: high-resolution character pose
> master sheet for a mobile learning app, intended to be cut into four separate
> transparent PNG assets. Create an exact classic Miffy-style white rabbit
> character: perfectly simple geometric silhouette, two long upright oval ears,
> round head merging into body, two tiny black dot eyes, one small black X mouth,
> bold slightly organic black outlines, flat colors, no shading, no gradients,
> no fur texture, no extra facial features, no text. She wears a plain pale-pink
> A-line dress. Compose a clean 2x2 grid with generous empty spacing and no
> dividers: top-left standing and holding one red tulip; top-right peeking over a
> very short thin black ledge with paws visible; bottom-left joyful little jump
> with arms raised; bottom-right watering one pink tulip with a small blue
> watering can. Each pose must fit fully inside its own quadrant and never touch
> another pose. Background must be one perfectly flat solid #00ff00 chroma-key
> green across the entire image, with no green used anywhere in the artwork.
> Centered orthographic front view, iconic Dutch children's-book screen-print
> aesthetic, crisp clean edges, consistent character proportions across all
> four cells, no border, no captions, no logos, no mockup, no environment.

Post-processing removes the chroma-key with the image-generation skill helper,
then `tools/asset-pipeline/crop_character_sheet.py` splits and trims the sheet.
