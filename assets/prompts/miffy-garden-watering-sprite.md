# Miffy garden — watering sprite sheet

Use case: illustration-story

Asset type: 4-frame character sprite sheet for a mobile garden game

Primary request: Regenerate the garden Miffy as a clean four-frame watering animation. Make one 2-by-2 sprite sheet with four equal square cells. The exact same white rabbit character appears in every cell, wearing the same coral-pink dress and holding the same blue watering can. Remove the flower and plant entirely. Frame 1 (top-left): can held upright at chest, ready. Frame 2 (top-right): can lifted and tilted slightly toward the lower right, water just beginning. Frame 3 (bottom-left): can tilted farther toward the lower right, with a short arc of 3-4 blue water droplets leaving the spout. Frame 4 (bottom-right): can fully tipped toward the lower right, with a longer arc of 5-6 blue droplets falling from the spout. Keep the rabbit's feet, head, ears, body size, and screen position perfectly consistent across all four cells; animate only the paws, watering can angle, and water droplets. The spout must clearly point down and outward so it can water a plant below the character.

Input images: `apps/web/public/generated/miffy-garden.png` is the current garden character and watering-can identity reference. `assets/generated/miffy-character-sheet-alpha.png` is the broader character model/style reference. Preserve the recognizable proportions, black hand-drawn outline, dot eyes, cross mouth, coral dress, and blue can.

Scene/backdrop: one perfectly flat solid `#00ff00` chroma-key background across the entire sheet, including gutters. No floor, shadows, gradient, texture, or lighting variation.

Composition/framing: centered character in each equal cell, generous identical padding, full ears and feet visible, no clipping, no panel borders, no labels.

Style/medium: polished soft digital children's illustration with slightly imperfect black ink contours, matching the supplied references.

Constraints: exactly four frames and one character per frame; no flower, no plant, no pot, no text, no captions, no watermark, no extra props, no cast shadow; do not use `#00ff00` in the character. Prioritize frame-to-frame consistency and a readable watering motion at 150px character height.
