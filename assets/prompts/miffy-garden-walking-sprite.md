# Miffy garden walking sprite

## Generation mode

Codex built-in image generation (`gpt-image-2`; snapshot not exposed).

## References

- `apps/web/public/generated/miffy-garden-watering-sprite.png`
- `assets/generated/miffy-character-sheet-alpha.png`

## Prompt

Use case: illustration-story

Asset type: 4-frame walk-cycle sprite sheet for a mobile garden game

Primary request: Create a clean four-frame side-view walking animation for the exact same Miffy character from the supplied references. Make one 2-by-2 sprite sheet with four equal square cells. In every frame she faces to the right and carries the same blue watering can securely at waist height without pouring it. Frame 1 (top-left): right foot forward, left foot back. Frame 2 (top-right): passing pose with feet closer and body slightly higher. Frame 3 (bottom-left): left foot forward, right foot back. Frame 4 (bottom-right): second passing pose with feet closer and body slightly lower. Add only a tiny natural arm/can bob and ear bounce. Keep her identity, head, ears, coral-pink dress, blue can, scale, baseline, and cell position extremely consistent. The walk must read clearly when played as a looping game sprite at roughly 150px character height.

Input images: Image 1 is the new watering-sprite identity, outfit, and blue-can reference. Image 2 is the broader character model/style reference. Preserve the white rabbit, black hand-drawn outline, dot eye, cross mouth, coral dress, and simple rounded proportions.

Scene/backdrop: one perfectly flat solid `#00ff00` chroma-key background across the entire sheet, including gutters. No floor, shadows, gradient, texture, or lighting variation.

Composition/framing: centered character in each equal cell, shown in a readable right-facing side or three-quarter profile, identical generous padding, full ears and feet visible, feet aligned to a consistent ground baseline, no clipping, no panel borders, no labels.

Style/medium: polished soft digital children's illustration with slightly imperfect black ink contours, matching the supplied references.

Constraints: exactly four frames and one character per frame; she must carry the watering can but no water may leave it; no flower, plant, pot, text, caption, watermark, extra props, cast shadow, or baseline line; do not use `#00ff00` in the character. Prioritize frame-to-frame consistency and a clear alternating walk cycle.
