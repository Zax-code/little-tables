# Garden walk, version 2: brief for Codex

One Codex session per character, in this order: **miffy**, malo-bear, fenna-fox, mina-cat,
paco-dog, colin-mallard. Miffy goes first: her approved frames become the pose reference of the
five others. Paste the shared brief, then that character's section.

## Shared brief (paste every time)

You are in the `little-tables` repository (`/Users/zax/Develop/little-tables`). Regenerate the
garden walking animation of ONE character with your built-in image generation and the existing
helpers (`~/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py`,
`tools/asset-pipeline/`). Do not touch any other character or any other scene.

**What is wrong today.** In `apps/app/public/characters/<id>/garden-walk-sheet.webp`, frames 2
and 4 are nearly the same standing pose, so the walk reads as a two-frame shuffle. The stride is
timid, and from one frame to the next the head changes shape and size.

**The animation.** A calm, cheerful children's-book walk to the right, carrying the blue watering
can in the front paw/hand (upright, never pouring, no water). The app plays the four frames in
order W1 → W2 → W3 → W4 in a loop, about 0.58 s per loop, and mirrors the sheet to walk left.

| Frame | Phase                 | Legs                                                                | Body                                  |
| ----- | --------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| W1    | Contact, right foot   | Right foot forward, heel on the ground; left foot behind, toes down | Lowest point                          |
| W2    | Passing, left lifts   | Right leg straight under the body; left foot lifted, passing        | Highest point (about 3 % of a cell up) |
| W3    | Contact, left foot    | Left foot forward, heel on the ground; right foot behind, toes down | Lowest point, same as W1              |
| W4    | Passing, right lifts  | Left leg straight under the body; right foot lifted, passing        | Highest point, same as W2             |

The free arm swings opposite to the forward leg. The can arm stays bent and carries the can at
the same height in every frame, apart from the body bob.

**Invariants: identical in all four frames.** These are the point of this work; check each one
before accepting a frame.

- Head: exactly the same shape, size, features, ear shape and angle, and position relative to the
  body. Only the whole-body bob moves it. Face right, profile as in the reference.
- Body size, proportions, outfit, colours and line weight.
- The watering can: same model, size, colour and angle (spout to the right).
- Framing: same scale, and the same horizontal centre of the body in the cell. Feet on the same
  baseline in W1 and W3, while W2 and W4 lift the body, not the baseline.

**Output contract.** Unchanged from version 1, so the app needs no code change:

- Four frames, each 627 × 627 px, transparent background (flat chroma green at generation, then
  `remove_chroma_key.py` with the settings recorded in version 1's `generation-record.json`), clean
  corners and no fringe.
- Assembled into `apps/app/public/characters/<id>/garden-walk-sheet.webp`, 1254 × 1254, as a
  2 × 2 grid: W1 top left, W2 top right, W3 bottom left, W4 bottom right.
- Keep the same apparent scale and baseline as `garden-water-sheet.webp` of the same character.
  The app switches between the two sheets at the same spot, so the character must not jump in
  size or height.
- Sources under `assets/generated/characters/<id>/garden-walk/W1…W4/`, with
  `generated-source.png`, `alpha-source.png`, `final-frame.png`. Keep rejected attempts as
  `rejected-generated-source-<n>.png`. Update `generation-record.json` to version 2 with each
  frame's prompt, references, SHA-256s and review notes.

**Review before you finish.**

1. Put the four frames side by side and check every invariant above.
2. Play the loop (an animated preview: GIF, or the sheet in a small HTML page with the app's CSS
   `steps` animation). It must read as a walk, with no head popping.
3. Compare with the same character's `garden-water-sheet.webp` at the same size.
4. Regenerate any frame that fails, and record why.

Then run `corepack pnpm check`. Commit on a branch named `assets/garden-walk-v2-<id>` with a
Conventional Commit message (`feat(assets): …`), push, and open a pull request with the four
frames and the preview attached. Do not merge it.

## Per character

### miffy (first)

- Identity reference: `assets/generated/characters/miffy/home-reference/canonical-full-body-home.png`.
- Pose reference: none better exists. Use the version 1 frames in
  `assets/generated/characters/miffy/garden-walk/W1.png…W4.png` only for scale, framing and the
  can, and create the four phases above.
- Miffy: white rabbit, two upright ears, dot eyes, an × mouth, pink dress with a collar, white
  feet. Keep her simple Dick Bruna-like style and the round head.

### malo-bear

- Identity: `assets/generated/characters/malo-bear/home-reference/canonical-full-body-home.png`.
- Pose: the approved Miffy version 2 frames (`assets/generated/characters/miffy/garden-walk/W1…W4/final-frame.png`).
  Same phases, scale, framing, baseline and can position, with Malo's proportions and outfit.

### fenna-fox

- Identity: `assets/generated/characters/fenna-fox/home-reference/canonical-full-body-home.png`.
- Pose: Miffy version 2, as above.
- Keep the open warm-ochre vest, blue neckerchief, tail and toe marks unchanged in every frame.
  The tail sways at most slightly; its size never changes.

### mina-cat

- Identity: `assets/generated/characters/mina-cat/home-reference/canonical-full-body-home.png`.
- Pose: Miffy version 2, as above. Keep the tail's size constant.

### paco-dog

- Identity: `assets/generated/characters/paco-dog/home-reference/canonical-full-body-home.png`.
- Pose: Miffy version 2, as above. Ears may bounce slightly with the bob, but keep their shape and
  length.

### colin-mallard

- Identity: `assets/generated/characters/colin-mallard/home-reference/canonical-full-body-home.png`.
- Pose: Miffy version 2, adapted to a duck's short legs and webbed feet: the same four phases, a
  smaller stride, the same bob. The can is held under the wing as in version 1.

The roster sheet `assets/generated/characters/roster-reference/canonical-full-body-home-roster-normalized.png`
shows the six characters' relative sizes; keep them.
