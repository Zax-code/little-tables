# Selected Profile Character Everywhere — Implementation Plan

## Purpose

Make the selected family member's avatar character the companion used throughout the authenticated
application. The supported cast will be:

1. Miffy (existing artwork, unchanged)
2. Malo, the bear cub
3. Fenna, the fox
4. Mina, the cat
5. Paco, the floppy-eared dog
6. Colin, the mallard

Each family profile already owns a durable `avatarId`; that persisted selection will choose the
character artwork. A profile switch must change both profile data and companion art together, and a
later login must restore the same combination.

This is an implementation plan only. It does not authorize generating artwork or changing
application code.

## Owner-approved decision record

The owner has reviewed and approved this plan as the implementation blueprint. The following
decisions are final unless the owner explicitly revises them:

1. The selected family profile's persisted `avatarId` must drive the character everywhere in
   authenticated application experiences.
2. Only verified actively used assets and frames are in scope. Unused experiments, orphaned
   outputs, historical sources, and test-only references remain excluded from regeneration.
3. Retain the existing Miffy originals unchanged and generate exactly five animal variants for
   every active non-SVG scene or frame. Use the built-in Image Generation tool and the approved
   two-reference workflow: the active Miffy original supplies pose, action, composition, framing,
   and state; the approved target avatar supplies species, silhouette, canonical appearance, and
   accessory.
4. Preserve existing SVG assets as SVGs. Do not introduce programmatically drawn animal artwork,
   and leave the complete application-icon family unchanged.
5. Miffy is the approved privacy-safe pre-authentication and startup fallback until the
   authenticated account and selected profile are known.
6. Route-specific, selected-character asset loading is approved. Do not preload the complete
   six-character roster at startup.

Remaining scene-specific accessory details beyond the fixed wardrobes below are a later
art-direction review. They do not block the approved architecture, catalog, profile propagation,
loading strategy, or generation workflow.

## Canonical full-body home references and wardrobe contracts

The owner has approved the following canonical full-body references. These project-bound PNGs are
the mandatory **Reference 2 identity and wardrobe inputs** for future generated character scenes:

| Character | Approved project-relative reference                                                     | Fixed approved wardrobe and identity details                                                                                  |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Miffy     | `assets/generated/characters/miffy/home-reference/canonical-full-body-home.png`         | Established Miffy appearance with pink dress. Retain existing production Miffy scene originals rather than regenerating them. |
| Malo      | `assets/generated/characters/malo-bear/home-reference/canonical-full-body-home.png`     | Cream short-sleeve T-shirt and brick-red neckerchief.                                                                         |
| Fenna     | `assets/generated/characters/fenna-fox/home-reference/canonical-full-body-home.png`     | Open warm-ochre vest, blue neckerchief, visible tail, and visible toe-line marks.                                             |
| Mina      | `assets/generated/characters/mina-cat/home-reference/canonical-full-body-home.png`      | Lilac cardigan and yellow collar.                                                                                             |
| Paco      | `assets/generated/characters/paco-dog/home-reference/canonical-full-body-home.png`      | Pale blue-and-cream striped sailor shirt and mint neckerchief.                                                                |
| Colin     | `assets/generated/characters/colin-mallard/home-reference/canonical-full-body-home.png` | Leafy-green vest and lavender neckerchief.                                                                                    |

The approved normalized visual roster is:

`assets/generated/characters/roster-reference/canonical-full-body-home-roster-normalized.png`

Each individual canonical reference uses one unified 1024×1536 transparent canvas. The normalized
top alignment, optical body placement, and foot/ground baseline encoded in these files form a shared
roster contract. Preserve their transparent padding and relative top/baseline placement; do not
independently crop, scale, or vertically recenter one character in a way that breaks comparison with
the other roster members. The roster sheet is the quick visual check for this normalized
relationship, while the individual PNG is the generation input.

For every future animal scene or animation frame:

- **Reference 1** remains the verified active Miffy production scene or extracted active frame. It
  mandates the action, pose or cycle phase, camera, crop, composition, prop geometry, and
  user-facing state.
- **Reference 2** is the target character's canonical full-body file listed above. It mandates the
  species, silhouette, face, fixed canonical colors, wardrobe, and character-specific marks.

These files are provenance/reference assets only. They are not immediately shipped runtime assets,
must not be wired into production scene components yet, and do not replace any active Miffy scene
or app-icon file. Future scene generation may adapt anatomy naturally to the Reference 1 action,
but it must preserve the approved Reference 2 wardrobe and recognizable identity.

## Scope and non-negotiable constraints

- Replace only visuals that are verified to render in a current user-facing path. A Miffy-like file
  is not automatically in scope merely because it exists in the repository.
- Retain every current Miffy original as the Miffy member of the roster. Do not redraw or recolor it.
- Generate five animal variants for every actively used Miffy visual or animation frame.
- Preserve existing SVGs as SVGs. There are no actively used Miffy SVGs today, so this rule does not
  authorize creating new animal SVGs.
- Generate every non-SVG animal visual with the built-in Image Generation tool. Do not draw it with
  SVG, canvas, CSS, or other programmatic geometry.
- Do not change the PWA/app icon or its source prompt. It remains the unique Miffy icon for every
  profile.
- Keep plant, pot, flower, water-landing, sparkle, and confetti rendering unchanged except for
  coordinate adjustments required to align with a generated character.
- Use inclusive family-member terminology in product copy.

## How live use was classified

An asset is **active and required** only when it has all of the following evidence:

1. a current code or HTML reference;
2. a render, route-loader, startup-preload, or error-boundary path that can execute; and
3. public/build delivery (the file is under `apps/web/public`, or is otherwise imported by Vite).

An asset is **derived/runtime-adjacent** when it is shipped to users but is not selected directly at
runtime, such as a PWA screenshot. An asset is **legacy/source-only** when no current render/import
path exists, even if Vite copies it from `public`. Public copying alone does not make an orphaned
file part of the regeneration matrix. Tests and planning/prompt documents are supporting references,
not runtime use.

## Active non-SVG inventory

All paths in this table are relative to the repository root.

| Current Miffy asset                                              | Format and size                                         | Semantic role and depicted state                                                                                              | Verified live-use evidence                                                                                                                                                                                                       | Replacement contract                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/generated/miffy-google-connect.webp`            | RGBA WebP, 256×256                                      | Close-up face used as the pre-authentication Google-connect identity image.                                                   | `apps/web/src/assets.ts` → `googleConnectIcon`; rendered by `components/auth-gate.tsx`; startup preload in `apps/web/index.html`. Current in-progress `profile-avatar.tsx` edits no longer use this file for the profile avatar. | Five square face portraits are required by the “five variants per active Miffy original” rule. Preserve generous transparent padding, optical face centering, and recognition at 30, 42, and 64 px. They may be selected only when an authenticated profile is safely known; unresolved pre-authentication always uses Miffy. |
| `apps/web/public/avatars/miffy.png`                              | RGBA PNG, 1254×1254                                     | Canonical Miffy family-profile picker/switcher portrait: centered head and upper body with a pink neckerchief.                | Current in-progress `components/profile-avatar.tsx` edits render this file for `sprout` and retired Miffy-compatible IDs; the profile-avatar component is used by family management and profile switching.                       | The five corresponding animal identity portraits already exist under `apps/web/public/avatars/` in the current in-progress worktree, including Colin. Treat them as reference-2 candidates, not new scene-generation work. Confirm owner approval, optical framing, and final commit state before using them.                 |
| `apps/web/public/generated/miffy-home.webp`                      | RGBA WebP, 320×494                                      | Calm, front-facing idle/welcome illustration: full Miffy in a pink dress holding a red tulip.                                 | `assets.ts` → `characterAssets.home`; `components/bunny.tsx`; rendered on `screens/home-screen.tsx` and three `auth-gate.tsx` states; startup preload in `index.html`.                                                           | Five portrait cutouts with full ears/head, feet, flower, and alpha padding intact. In authenticated home, resolve by selected profile. The 2.8 s, 2 px idle float remains a CSS/Motion treatment. Pre-auth states use the safe fallback.                                                                                      |
| `apps/web/public/generated/miffy-practice.webp`                  | RGBA WebP, 327×377                                      | Neutral practice state: Miffy peeks over the feedback baseline with both paws visible.                                        | `assets.ts` → `characterAssets.practice`; `practice-bunny.tsx`; idle render in `practice-screen.tsx`; route/startup preload.                                                                                                     | Five idle cutouts. Preserve the bottom occlusion line, paw placement, face scale, and optical center because CSS translates the image behind the question area.                                                                                                                                                               |
| `apps/web/public/generated/miffy-practice-correct.webp`          | RGBA WebP, 669×922                                      | Correct-answer reaction: Miffy springs above the baseline with raised paws and a delighted face.                              | `assets.ts`; `practice-bunny.tsx`; feedback render in `practice-screen.tsx`; eager idle-time and startup preload.                                                                                                                | Five reaction cutouts. Preserve the bottom baseline, raised-limb silhouette, and headroom. Motion remains scale `0.88 → 1.025 → 1` and y `68 → -9 → 0` over 0.82 s.                                                                                                                                                           |
| `apps/web/public/generated/miffy-practice-encourage.webp`        | RGBA WebP, 785×931                                      | Supportive correction reaction: slight head tilt, one paw at cheek, one paw on the baseline; thoughtful rather than punitive. | `assets.ts`; `practice-bunny.tsx`; feedback render in `practice-screen.tsx`; eager idle-time and startup preload.                                                                                                                | Five reaction cutouts. Preserve the cheek gesture, head tilt, baseline hand, and calm expression. Motion remains scale `0.96 → 1` and y `60 → 0` over 0.88 s.                                                                                                                                                                 |
| `apps/web/public/generated/miffy-update-recovery-v3.webp`        | RGBA WebP, 1005×1210                                    | Recovery/error illustration: kneeling Miffy beside a tipped orange flowerpot, spilled soil, flower, and pink retry arrow.     | `assets.ts` → `updateRecoveryAsset`; rendered by `components/app-error-screen.tsx`, which is the root route error component.                                                                                                     | Five portrait cutouts preserving pot, soil, flower, retry arrow, foreground layering, and the readable “small mishap, try again” tone. Resolve from the most recently authenticated selected profile when available; otherwise use Miffy.                                                                                     |
| `apps/web/public/generated/miffy-celebration-sprite-simple.webp` | RGBA WebP, 1672×418; four horizontal 418×418 cells      | Reward celebration hop. Four states form anticipation, airborne action, and landing/reset.                                    | `assets.ts` → `celebrationSprite`; `components/celebration-sprite.tsx`; `celebration-screen.tsx`; celebration route loader and startup preload; CSS sprite playback.                                                             | Generate five sets of four frames, then mechanically normalize and assemble five 4×1 sheets. Preserve equal cell bounds, baseline, character scale, headroom, and alpha.                                                                                                                                                      |
| `apps/web/public/generated/miffy-garden-walking-sprite.webp`     | RGBA WebP, 1254×1254; four 627×627 cells in a 2×2 sheet | Right-facing walk cycle while carrying an upright blue watering can without pouring.                                          | `assets.ts`; `components/garden-walking-sprite.tsx`; `garden-plot.tsx` caretaker walking phase; garden/collection route loaders and startup preload; CSS sprite playback.                                                        | Generate five sets of four right-facing frames, then assemble five 2×2 sheets. Preserve feet baseline, body and can scale, can grip, full silhouette, and transparent cell padding. CSS mirrors the sheet for left-facing travel.                                                                                             |
| `apps/web/public/generated/miffy-garden-watering-sprite.webp`    | RGBA WebP, 1254×1254; four 627×627 cells in a 2×2 sheet | Four-stage watering action: ready, initial tilt, short pour, full pour.                                                       | `assets.ts`; `components/garden-watering-sprite.tsx`; `garden-plot.tsx` caretaker watering phase; garden/collection route loaders and startup preload; CSS sprite playback.                                                      | Generate five sets of four frames, then assemble five 2×2 sheets. Preserve feet baseline, head/body location, can spout endpoint, pour direction, and water-droplet arc. CSS mirrors for the opposite side, and procedural landing water must still meet the spout.                                                           |

### Required animation frame contracts

Percent ranges are the current CSS holds, not generation instructions to interpolate.

| Sequence and duration     | Frame                                 | Current depiction and behavior                                                                                            | Crop, scale, and layer constraints                                                                                                                    |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Celebration, 1.8 s loop   | C1, x=0%, held 0–30%                  | Upright standing/rest pose, both arms raised, feet together; establishes the reward cheer.                                | 418×418 cell; same center and ground line as C2–C4. This is also the reduced-motion frame.                                                            |
| Celebration, 1.8 s loop   | C2, x=33.333%, held 36–49%            | Compressed crouch/anticipation, arms still raised.                                                                        | Keep head and torso lower without changing apparent character size or horizontal center.                                                              |
| Celebration, 1.8 s loop   | C3, x=66.667%, held 55–68%            | Extended airborne hop, legs separated/one foot forward, arms raised. The container also moves y `0 → -18 → -28 → -18 px`. | Leave enough transparent headroom for the container hop; do not bake the global y translation into the frame.                                         |
| Celebration, 1.8 s loop   | C4, x=100%, held 74–100%              | Upright landing/reset, feet together, arms raised.                                                                        | Must loop into C1 without a horizontal or scale pop.                                                                                                  |
| Garden walk, 0.58 s loop  | W1, top-left, held 0–24%              | Right foot forward and left foot back; right-facing character carries the can at waist height.                            | 627×627 cell; CSS uses x `-10 px`; preserve full head/ears, feet, and upright can.                                                                    |
| Garden walk, 0.58 s loop  | W2, top-right, held 25–49%            | Passing pose, feet close, body slightly higher; tiny arm/can and head/ear bob.                                            | CSS uses x `calc(100% + 10 px)`; align the visual center with W1.                                                                                     |
| Garden walk, 0.58 s loop  | W3, bottom-left, held 50–74%          | Left foot forward and right foot back.                                                                                    | CSS uses x `-10 px`, y `calc(100% + 6 px)`; match W1 stride amplitude and baseline.                                                                   |
| Garden walk, 0.58 s loop  | W4, bottom-right, held 75–100%        | Second passing pose, feet close, body slightly lower.                                                                     | CSS uses x `calc(100% + 12 px)`, y `calc(100% + 6 px)`; loop cleanly to W1. The sheet is rendered at `scale(1.175)` inside a 150 px caretaker square. |
| Garden watering, 3 s loop | G1, top-left, held 0–48% and 97–100%  | Ready/idle: can upright at chest, no active pour.                                                                         | 627×627 cell; fixed body and feet baseline; preserve can and spout geometry.                                                                          |
| Garden watering, 3 s loop | G2, top-right, held 49–60% and 89–96% | Can lifted and tilted; water starts/stops.                                                                                | Only limbs, can angle, and early droplets should change substantially.                                                                                |
| Garden watering, 3 s loop | G3, bottom-left, held 61–73%          | Can tilted farther; short arc of roughly 3–4 droplets.                                                                    | This is the reduced-motion frame (`background-position: 0 100%`), shown with static procedural landing droplets/ripple.                               |
| Garden watering, 3 s loop | G4, bottom-right, held 74–88%         | Fully tipped can; longer arc of roughly 5–6 droplets.                                                                     | Spout and last in-frame droplet must visually connect to the separately positioned CSS landing effect.                                                |

`garden-plot.tsx` places every character in a nominal 150×150 caretaker box and computes a target
from `caretakerX`, `caretakerY`, `waterX`, and `waterY`. Its Motion transition is 0.18 s when settling
into watering and route-dependent while walking. Each animal must fit that existing coordinate
contract; if anatomy makes that impossible, store character-specific optical bounds and pour-point
offsets in the catalog rather than moving plant targets.

## Active matrix and generation count

The Miffy column uses existing originals. Every animal cell below is a required non-SVG output.
Static assets require one output per animal; animation rows show the number of separately generated
semantic frames before deterministic sheet assembly.

| Scene                        | Miffy                  | Malo               | Fenna              | Mina               | Paco               | Colin              | New Image Generation calls |
| ---------------------------- | ---------------------- | ------------------ | ------------------ | ------------------ | ------------------ | ------------------ | -------------------------: |
| Google-connect face          | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Family-profile portrait      | existing candidate     | existing candidate | existing candidate | existing candidate | existing candidate | existing candidate |                          0 |
| Home/welcome with tulip      | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Practice idle peek           | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Practice correct reaction    | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Practice encourage reaction  | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Update/recovery illustration | existing               | 1                  | 1                  | 1                  | 1                  | 1                  |                          5 |
| Celebration C1–C4            | existing 4-frame sheet | 4                  | 4                  | 4                  | 4                  | 4                  |                         20 |
| Garden walk W1–W4            | existing 4-frame sheet | 4                  | 4                  | 4                  | 4                  | 4                  |                         20 |
| Garden watering G1–G4        | existing 4-frame sheet | 4                  | 4                  | 4                  | 4                  | 4                  |                         20 |
| **Total newly generated**    | **retained**           | **18 frames**      | **18**             | **18**             | **18**             | **18**             |                     **90** |

The required deliverables are 30 static files and 15 assembled sprite sheets, produced from 90
separately reviewed animal-frame generations. The existing six family-profile portraits are
identity references and do not add calls. Generating a whole sheet in one call is not the default:
it reduces calls but makes exact pose, crop, and state fidelity harder to control.

## Present but intentionally outside the regeneration matrix

| Candidate                                                                          | Classification and evidence                                                                                                                                          | Semantic role/disposition                                                                                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `miffy-celebration-loop.webp`                                                      | **Orphaned legacy.** No component or asset-registry reference; explicitly excluded from Workbox precache by `apps/web/vite.config.ts`. Public copying is incidental. | Abandoned 12-frame, 6 s celebration experiment. Do not generate animal variants. Remove in a later audited cleanup or retain as provenance.        |
| `miffy-celebration-poster.png`                                                     | **Orphaned legacy.** No import, HTML reference, manifest entry, or runtime lookup.                                                                                   | Static poster for the abandoned celebration loop. No variants.                                                                                     |
| `miffy-celebration-sprite-v2.png`                                                  | **Orphaned legacy.** No current code/HTML reference.                                                                                                                 | Nine-cell predecessor/candidate board for the active four-frame sheet. Keep only as provenance; no variants.                                       |
| `miffy-garden.png`                                                                 | **Source-only.** Referenced by `assets/prompts/miffy-garden-watering-sprite.md` and `assets/generated/manifest.json`, not by runtime code.                           | Historical garden/watering identity reference. It may inform QA, but the active watering frames are the pose references. No direct variants.       |
| `miffy-rig-arms-*.png`, `miffy-rig-parts-*.png`, and `miffy-rig-v1/*.png`          | **Orphaned experiments.** Repository search finds no runtime imports, CSS URLs, route paths, or build-manifest consumption.                                          | Abandoned separated-body/rigging experiment. It is not an active canvas/SVG/Lottie pipeline. Do not regenerate or revive it.                       |
| `assets/generated/miffy-character-sheet.png` and `miffy-character-sheet-alpha.png` | **Source-only.** Consumed only by prompt/manifest history and `tools/asset-pipeline/crop_character_sheet.py`; not served by the app.                                 | Four-quadrant historical source for home, practice, celebration, and watering concepts. Active production assets supersede it. No direct variants. |
| `assets/generated/miffy-garden-{walking,watering}-sprite-source.png`               | **Source-only.** Recorded as chroma/source provenance in `assets/generated/manifest.json`; no runtime path.                                                          | Pre-background-removal source sheets. No direct variants; preserve for provenance.                                                                 |
| `tools/asset-pipeline/crop_character_sheet.py`                                     | **Legacy tooling.** No application runtime use; hard-codes `miffy-{scene}.png`.                                                                                      | Do not use it to programmatically draw characters. A future neutral sheet-assembly utility may only crop/normalize generated pixels.               |
| `assets/prompts/miffy-*.md` and Miffy entries in `assets/generated/manifest.json`  | **Documentation/provenance.** Not runtime visuals.                                                                                                                   | Preserve as production history. Add per-character generation records rather than rewriting Miffy history.                                          |
| Miffy assertions in `*.test.ts(x)`                                                 | **Test-only references.** Tests do not cause artwork to render in production.                                                                                        | Update tests to assert the selected character or safe fallback; they create no generation work.                                                    |
| Miffy descriptions in `TECHNICAL_PLAN.md` and `AVATAR_PLAN.md`                     | **Planning-only references.**                                                                                                                                        | Update only where architecture or current behavior would otherwise be misleading. They create no visual variants.                                  |

### Derived runtime-adjacent assets

`apps/web/public/screenshots/home-narrow.png` and `home-wide.png` are shipped PWA manifest
screenshots and currently depict Miffy on the home screen. They are not live scene assets and must
not receive five Image Generation variants. After integration, recapture the canonical Miffy home
screen at the declared dimensions. A manifest cannot choose a screenshot by signed-in profile, so
the roster remains demonstrated in in-app QA captures rather than the install metadata.

### Permanently excluded app-icon family

Do not alter or variant:

- `assets/generated/little-tables-app-icon-master.png`
- `apps/web/public/icons/favicon-32.png`
- `apps/web/public/icons/apple-touch-icon.png`
- `apps/web/public/icons/icon-{192,512}.png`
- `apps/web/public/icons/icon-maskable-{192,512}.png`
- `assets/prompts/little-tables-app-icon.md`
- the app-icon record in `assets/generated/manifest.json`

## SVG, procedural, and animation-renderer audit

- No current Miffy SVG file, inline Miffy SVG, Lottie file, GIF, canvas renderer, or CSS-drawn Miffy
  was found.
- Existing SVG components draw plants, flowers, pots, locks, navigation, and the garden book. They
  stay SVG and do not need character variants.
- Current character animation is raster-frame selection plus CSS/Motion transforms:
  `celebration-sprite.tsx`, `garden-walking-sprite.tsx`, `garden-watering-sprite.tsx`,
  `practice-bunny.tsx`, and `bunny.tsx`.
- `garden-plot.tsx` and `styles.css` procedurally render the water landing/ripple and plant-drink
  response. These are not character replacements, but they are a required layer-alignment test for
  every watering sheet.
- Sparkles and celebration confetti remain procedural/shared effects.

If a Miffy SVG is added before implementation begins, inventory its runtime reachability. Preserve
an active existing SVG as an SVG and create its five variants by editing the existing vector
structure. Do not use Image Generation to make a raster stand-in and do not introduce a new SVG for
a raster original.

## Current code and copy seams to replace

| Seam                                                                                | Current issue                                                                      | Planned change                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/assets.ts`                                                            | Singleton Miffy paths and alt keys.                                                | Introduce a typed six-character, scene-complete catalog with asset paths, display name, optical bounds, and optional garden pour-point offsets.                                                                           |
| `components/bunny.tsx` and `practice-bunny.tsx`                                     | “Bunny” names and singleton assets assume one species.                             | Rename to character-neutral components and resolve assets through the selected-character hook. Preserve motion timing.                                                                                                    |
| `celebration-sprite.tsx`, `garden-walking-sprite.tsx`, `garden-watering-sprite.tsx` | Hard-coded singleton sheets.                                                       | Resolve the active character's sheet and character-aware accessible label.                                                                                                                                                |
| `garden-plot.tsx`                                                                   | Caretaker geometry assumes one silhouette/can location.                            | Read normalized catalog geometry while keeping plant targets and motion state machine shared.                                                                                                                             |
| `profile-avatar.tsx`                                                                | Separate avatar mapping and bespoke Miffy branch can diverge from scene selection. | Resolve the same canonical character ID/catalog used everywhere else.                                                                                                                                                     |
| `auth-gate.tsx` and `app-error-screen.tsx`                                          | Render outside or across the authenticated profile boundary.                       | Use the explicitly defined safe fallback rules below, not stale data from another account.                                                                                                                                |
| `router.tsx`, `preload-images.ts`, and `index.html`                                 | Route/startup preloads point to Miffy singleton files.                             | Preload the current profile character's current-route scenes after identity resolution; retain only the minimum pre-auth Miffy fallback at document startup.                                                              |
| `apps/web/src/i18n-catalog.ts`                                                      | English/French alt and caretaker text names Miffy.                                 | Use character-name interpolation or neutral companion copy for all six characters. Keep Miffy as Miffy where she is actually selected. Apply equivalent catalog consistency to Chinese only where required by typed keys. |
| `apps/web/src/styles.css`                                                           | Class names and fixed sprite assumptions encode Miffy-era geometry.                | Rename character-facing classes where useful; preserve timings and reduced-motion states; add catalog-driven CSS variables only for measured optical offsets.                                                             |
| `apps/web/vite.config.ts` and `src/sw.ts`                                           | Current glob/cache strategy assumes a small flat generated directory.              | Define versioned character asset paths, precache only critical fallback files, and runtime-cache active-profile scenes without downloading all 90 frames on first load.                                                   |

## Character identity, persistence, and propagation

### Canonical mapping

Add a domain-level `CharacterCatalog` (or an equally narrow shared module) that maps durable avatar
IDs to a canonical character:

| Persisted `avatarId`                   | Canonical character          |
| -------------------------------------- | ---------------------------- |
| `sprout`                               | Miffy                        |
| `malo-bear`                            | Malo                         |
| `fenna-fox`                            | Fenna                        |
| `mina-cat`                             | Mina                         |
| `paco-dog`                             | Paco                         |
| `colin-mallard`                        | Colin                        |
| retired `sunbeam`, `bluebell`, `berry` | Miffy compatibility fallback |

The current worktree contains in-progress, uncommitted schema/test/UI edits adding
`colin-mallard`, plus uncommitted `colin-mallard.png` and `miffy.png` profile portraits.
Implementation must verify their owner-approval and commit status, then reconcile those edits rather
than duplicate or overwrite them. The final catalog must have compile-time completeness checks for
all six selectable characters and all required scenes.

### Existing durable path

`ChildProfile.avatarId` is already stored per family profile by
`apps/server/src/repositories/mongo-profile-repository.ts`, returned through the family-profile API,
cached on-device by `family-profile-device.ts`, and exposed as
`FamilyProfileContext.activeProfile.avatarId` by `family-profile-provider.tsx`. The server's
missing/invalid-avatar fallback remains Miffy, so existing profiles migrate safely without a bulk
database rewrite.

Do not create a second character preference. The selected profile's persisted `avatarId` is the
source of truth for:

- profile/avatar picker imagery;
- home and practice illustrations;
- celebration art;
- garden caretaker animation;
- authenticated recovery imagery;
- route and offline preloading.

### Render-tree strategy

1. Resolve `activeProfile.avatarId` once in a `SelectedCharacterProvider` nested inside
   `FamilyProfileProvider`.
2. Expose a small `useSelectedCharacter()` interface returning the canonical ID, display name,
   scene resolver, and geometry metadata.
3. Have every character-rendering component use that interface instead of importing a singleton
   Miffy path.
4. During profile switching, preload the target character's currently visible route assets, then
   atomically commit profile data and character. Preserve the current switch lock/transition so
   rapid switches cannot mix one member's learning state with another member's art.
5. If an animal scene fails to decode, show a neutral loading/retry treatment first; use Miffy only
   as an explicit asset-error fallback and do not persist that fallback over the member's choice.

### Pre-authentication boundary

`AuthGate` wraps `FamilyProfileProvider` in `apps/web/src/main.tsx`, so a selected profile is not
safely known before Google authentication. A device cache may belong to a previously signed-out
account and must not be used to personalize the sign-in screen.

Recommended rule:

- show the established Miffy connect/home art before authentication and while account identity is
  unresolved;
- switch to the active profile's character only after that authenticated account's profiles load;
- keep Miffy on unrecoverable startup errors where no authenticated profile is available.

This is the only intentional “Miffy still appears” behavior outside a Miffy-selected profile, plus
the fixed app icon. The owner has approved this privacy-safe boundary.

## Asset organization and loading

Use stable, versionable paths:

```text
apps/web/public/characters/<character-id>/
  connect-profile.webp
  home.webp
  practice-idle.webp
  practice-correct.webp
  practice-encourage.webp
  update-recovery.webp
  celebration-sheet.webp
  garden-walk-sheet.webp
  garden-water-sheet.webp
```

Keep review/provenance artifacts outside `public`, for example:

```text
assets/generated/characters/<character-id>/<scene>/
  reference-1-pose.png
  reference-2-identity.png
  generated-source.png
  final-frame.png
  generation-record.json
```

Use content-hashed production output or a character-asset version in the cache key. Startup should
not decode every character. Preload:

1. the minimum Miffy pre-auth artwork in `index.html`;
2. the selected character's home/profile assets after profile bootstrap;
3. route-specific practice, celebration, or garden assets on navigation/intent;
4. likely reaction frames while the idle practice scene is displayed.

Retain Cache First behavior for immutable versioned images, but update the cache namespace and
garbage-collect obsolete versions. Test offline switching only among profiles whose character
assets have already been cached; show a clear loading state rather than another member's character
when an uncached asset is unavailable.

## Required two-reference Image Generation workflow

Use the built-in Image Generation tool once for every distinct animal asset/frame.

### Why this is the default

Each input has a separate job:

- **Reference 1 — active Miffy asset or extracted frame:** defines the semantic state: exact pose,
  action phase, prop angle, composition, camera, crop, baseline, and transparent padding.
- **Reference 2 — approved target profile avatar:** defines identity: animal species, canonical
  silhouette, face, fixed body colors, and established accessory.

This separation is more reliable than describing either side from memory. It keeps frame timing
compatible with existing CSS and garden coordinates while preventing the Miffy source from
overriding the selected animal's identity. It also makes QA objective: pose is compared to reference
1, character identity to reference 2.

For each target animal:

1. Inspect both local references at original detail before generation.
2. Extract an active sprite sheet into exact source cells without altering pixels. Do not use an
   abandoned source board in place of the active runtime frame.
3. Call built-in Image Generation separately for each semantic frame. Do not request multiple
   different frames through a count parameter.
4. Generate against a flat chroma-key background when alpha is needed. Choose a key absent from the
   subject; for a green-headed mallard, use magenta rather than green.
5. Copy project-bound outputs from the tool's generated-image directory into the worktree.
6. Remove the key with the Image Generation skill's local helper
   `remove_chroma_key.py` using auto-key, soft matte, and despill. Validate corner alpha, subject
   coverage, and color fringe; retry generation with an edge contract if cleanup is ambiguous.
7. Mechanically normalize transparent bounds/canvas size and assemble reviewed frames into a sheet.
   This step may crop/pack pixels but must not draw or invent character pixels.
8. Record tool, references, prompt, dimensions, key color, cleanup settings, reviewer status, and
   output hash in a provenance manifest.

### Prompt template

```text
USE CASE / OUTPUT
Create one production raster frame for <scene> / <sequence frame ID>.
Output <dimensions/aspect>, one character, flat <chroma-key> background, no text.

REFERENCE ROLES
Reference 1 is the pose-and-composition contract. Preserve its action phase, camera,
framing, ground line, optical center, negative space, prop location/angle, and state.
Reference 2 is the identity contract. Replace Miffy with <character name/species>;
preserve this character's canonical silhouette, face, fixed colors, and accessory.
Do not blend species or retain rabbit features.

SEMANTIC STATE
The frame depicts <plain-language action/state>.
It supports <home/practice feedback/reward/garden behavior>.
Within <sequence>, it is frame <n of total>, between <previous state> and <next state>.

POSE / LANDMARKS
Match <head center, eye line, limb/wing/paw positions, foot baseline>.
Place <watering-can spout/flower/pot/arrow> at <measured landmark>.
For garden frames, face right; left-facing playback is produced by mirroring.

STYLE
Use the approved target avatar's simple flat children's-book language:
solid untextured fills, restrained linework, calm canonical colors, minimal features.
No gradients, shading, gloss, painterly texture, photorealism, or complex detail.

FRAMING / ALPHA CONTRACT
Keep the complete silhouette inside the safe area with <padding>.
Match the reference's crop and apparent character scale.
Use only the flat key behind the subject; no key color inside the subject.

INVARIANTS
Keep <canonical accessory> unchanged. Keep the shared action prop <description>.
For an animation, match the approved neighboring frame's character size,
line weight, colors, accessory, and baseline.

AVOID
No Miffy/rabbit ears, X mouth, pink dress, or other source identity unless this is
the Miffy original. No extra limbs, props, droplets, shadows, scenery, text, logo,
watermark, or border beyond what the semantic frame explicitly requires.
```

The action prop and target character accessory are separate. A watering can, flowerpot, flower, or
retry arrow belongs to the scene and should track reference 1. A collar or other approved canonical
character accessory tracks reference 2. Do not automatically put Miffy's dress on every animal.

### Per-frame visual QA

Approve every frame individually before sheet assembly:

- **Runtime proof:** confirm the source is the active runtime file/frame, not a legacy board.
- **Semantic state:** a reviewer can name the intended pose/action phase without seeing the filename.
- **Identity:** species, silhouette, canonical colors, face, and accessory match reference 2; no
  rabbit/Miffy leakage.
- **Pose landmarks:** head/face center, limb or wing positions, feet/ground line, and action direction
  match reference 1.
- **Prop continuity:** flower, pot, arrow, can grip, can angle, spout endpoint, and droplets are
  correct for this state.
- **Crop and alpha:** complete silhouette, sufficient headroom, transparent corners, no clipped
  extremities, holes, key fringe, halo, or accidental subject transparency.
- **Optical framing:** face/head—not merely the raster bounds—is centered at actual rendered size;
  apparent scale matches neighboring frames.
- **Style:** flat fills, restrained linework, no gradients/gloss/shading/texture, no text or
  watermark.
- **Animation continuity:** compare flicker overlay/onion skin with previous and next frames for
  baseline, scale, color, line weight, accessory, and center drift.
- **Playback:** run the assembled sheet at 1× and slow motion; verify frame order, CSS holds, clean
  loop, and no cell bleed.
- **Reduced motion:** confirm C1 and G3 remain complete, meaningful static states; practice reactions
  render without entrance movement.
- **Mirroring:** verify garden walk and pour in both directions. Text/asymmetric accidental marks must
  not appear when mirrored.
- **Layer alignment:** at responsive widths, the watering spout/droplets meet the CSS landing effect
  and the intended plant; no water lands from the character's body.
- **Responsive crop:** inspect phone-short, phone-tall, and desktop layouts at the component's actual
  CSS dimensions.

## Implementation sequence

### Phase 0 — Freeze contracts and references

- Re-run the reachability audit immediately before generation; remove any newly retired scene from
  scope and add any newly active one with evidence.
- Confirm Colin's final approved avatar asset before using it as reference 2. Accessory refinements
  can follow in the non-blocking art-direction review.
- Measure active Miffy cell bounds, baselines, optical head centers, garden spout endpoints, and
  target coordinates into a machine-readable contract.
- Apply the approved pre-authentication Miffy fallback and confirm the existing retired-ID behavior.

### Phase 1 — Add the character/catalog seam without visual behavior change

- Land the six-character domain catalog and `colin-mallard` schema support.
- Map retired avatar IDs to Miffy without rewriting stored IDs.
- Add scene completeness, file existence, and geometry tests.
- Route current Miffy imports through the resolver while every profile still resolves to existing
  Miffy assets. This creates a reversible integration seam.

### Phase 2 — Generate and approve static scenes

- Use each active Miffy static asset as reference 1 and the approved animal avatar as reference 2.
- Complete face/home/practice/recovery assets one character at a time.
- Integrate behind a development-only character-audit route or fixture grid; do not expose partial
  rosters in normal navigation.

### Phase 3 — Generate and approve animation frames

- Extract C1–C4, W1–W4, and G1–G4 from the active WebP sheets.
- Generate, clean, inspect, and approve one frame per call.
- Normalize/assemble deterministic 4×1 and 2×2 sheets and verify exact CSS order/timing.
- Tune catalog geometry only when measured anatomy requires it.

### Phase 4 — Propagate the selected profile

- Add `SelectedCharacterProvider` and convert profile, home, practice, celebration, garden, and
  authenticated recovery components.
- Coordinate profile-switch transition and target-character prefetch.
- Convert accessible labels and caretaker status to character-aware EN/FR wording.

### Phase 5 — Loading, offline, and cache migration

- Replace static Miffy route loaders with selected-character route/intent preloads.
- Reduce document startup preloads to safe pre-auth essentials.
- Version runtime image caching; verify upgrade removes stale sheets without losing profile data.
- Test reconnect, profile switching, and decode failures.

### Phase 6 — Cleanup and derived artifacts

- Recapture canonical Miffy PWA screenshots; do not generate them.
- Remove orphaned public experiments only in a separately reviewed cleanup after confirming no
  production URL depends on them.
- Update provenance and planning docs. Preserve original sources and discarded generations outside
  the runtime bundle.

## Verification plan

### Automated checks

- Domain tests: all six selectable IDs decode; retired IDs remain accepted and map to Miffy;
  missing/invalid stored avatars use the safe default.
- Mongo/Testcontainers: two accounts with multiple profiles persist independent avatar choices;
  switching, logout, reconnect, and later login restore each profile's character unchanged.
- Catalog tests: every canonical character has every required scene, valid dimensions, accessible
  name, and geometry; no active scene path is missing.
- Component tests: each visual resolves from `activeProfile.avatarId`; changing profile changes the
  visual without mixing learning/garden state; pre-auth uses the documented fallback.
- Routing/preload tests: only the active character and route-relevant assets are requested; reaction
  preloads follow the idle practice scene; failed decode does not show another member's character.
- Sprite tests: sheet dimensions/cell count, frame order, CSS timing, mirrored facing, and
  reduced-motion static positions remain exact.
- Cache/service-worker tests: versioned animal assets cache and update correctly; app icons remain
  untouched.
- Repository guard: no active component, router, or startup preload imports a flat
  `/generated/miffy-*` scene path after migration, except documented pre-auth fallback and fixed
  icon references. Legacy/provenance files are allowed only outside active reachability.
- Run `corepack pnpm check` and `corepack pnpm doctor`, including Mongo Testcontainers with the
  available Docker-compatible runtime.

### Visual and behavioral QA

- Build a six-column scene audit for all nine deliverable scenes and all 12 animation frames.
- Test authenticated flows with at least two accounts and two profiles under one account.
- On home, practice idle/correct/encourage, celebration, and garden, switch profiles and verify an
  atomic character/state transition.
- Inspect phone-short, phone-tall, tablet, and desktop breakpoints, standard and reduced motion,
  left/right garden targets, light/dark/high-contrast modes if supported, and offline reconnect.
- Verify app icon, install icon, favicon, and maskable icon pixels/hashes are unchanged.
- Use visual diffs against Miffy to evaluate composition and runtime contract, not to force animal
  anatomy into a rabbit silhouette.

## Acceptance criteria

- Every verified active Miffy scene has exactly one approved version for each of the five original
  animals; all six characters are selectable through durable family profiles.
- Every authenticated character surface derives from the selected profile's persisted `avatarId`.
- Profile switching and reconnect restore the correct character together with that profile's
  garden, watering progress, attempts, and upcoming flower; no reroll or cross-profile flash occurs.
- Static and animated replacements preserve the documented semantic role, frame order, timing,
  crop, scale, baseline, prop, and layer constraints.
- Reduced-motion users receive complete static states with no unnecessary animation.
- Non-SVG animal pixels come only from the built-in Image Generation workflow; deterministic tooling
  only removes backgrounds, normalizes canvases, converts formats, and assembles sheets.
- No abandoned experiment is regenerated merely because it is present under `public` or
  `assets/generated`.
- Existing SVGs remain SVG, and no new programmatically drawn animal asset is introduced.
- The application-icon family is byte-for-byte unchanged.

## Risks and later art-direction reviews

1. **Pre-authentication identity:** Miffy is approved as the privacy-safe sign-in/startup fallback
   because the authenticated account's active profile is unavailable outside
   `FamilyProfileProvider`.
2. **Colin reference readiness:** the worktree has an in-progress Colin raster and schema/test/UI
   edits. Confirm that this exact raster is owner-approved and committed before treating it as
   reference 2.
3. **Scene-specific accessories:** the canonical wardrobes in the approved full-body references are
   fixed. Review only additional scene-specific items during later art-direction QA. Reference 2
   carries the fixed wardrobe and identity; reference 1 contributes the scene's action prop and
   composition. This review does not block the approved architecture.
4. **Anatomy and action:** wings, paws, ear height, tails, and quadruped silhouettes cannot always
   copy Miffy's limb geometry literally. Approve species-natural adaptations that preserve the
   semantic action and measured prop landmarks.
5. **Garden geometry:** a shifted spout or baseline can disconnect generated water from procedural
   landing layers. Prefer per-character catalog offsets over per-plant special cases.
6. **Cross-frame drift:** 60 animation-frame generations create consistency risk. Gate each frame,
   compare neighboring frames, and approve a character sequence before starting the next.
7. **Performance:** six complete rosters can substantially increase install/cache size. Use
   route-specific, selected-character loading rather than precaching the matrix.
8. **Legacy public URLs:** orphaned files under `public` are copied into builds even when unused.
   Exclude them from generation now; remove them only after checking deployed URL dependencies.
9. **PWA screenshots:** install metadata cannot reflect a signed-in selected profile. Keep canonical
   Miffy screenshots and use separate QA grids to demonstrate the roster.
10. **Miffy rights:** retaining Miffy in the roster and fixed app icon preserves the existing
    licensing/release risk recorded in `TECHNICAL_PLAN.md`; this remains a release gate.
