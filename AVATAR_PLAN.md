# Family character avatar plan

Status: durable per-profile avatars and the approved initial character roster are implemented.

## Product direction

A Google account owns multiple family member profiles. Each profile stores one avatar ID alongside
its isolated practice history, mastery, garden, rewards, and stats. The server restores that avatar
on every device and after later login.

An avatar choice represents one distinct character, not a colorway. Character artwork has one
canonical palette: body, clothing, accessories, face, and outline are never recolored by the app.
Each character has its own coordinated circular backdrop and ring; selection also includes a
visible check and border, so it never depends on color alone.

Miffy keeps the established in-repo artwork and name. The four original animals use generated
raster artwork rather than code-drawn SVGs:

- `sprout`: Miffy;
- `malo-bear`: Malo the bear cub / Malo l’ourson;
- `fenna-fox`: Fenna the fox / Fenna le renard;
- `mina-cat`: Mina the cat / Mina le chat;
- `paco-dog`: Paco the floppy-eared dog / Paco le chien.

The original animals use simple front-facing silhouettes, restrained linework, calm fixed colors,
and proportions intended to form a coherent children’s-app cast while remaining clearly original.
Generation provenance and chroma-key sources are documented in `assets/generated/avatars/`.

## Compatibility and migration

There is no destructive database rewrite. The schema continues to decode historical IDs so existing
profiles and stored documents remain readable:

- `sunbeam` is a retired Miffy colorway ID;
- `bluebell` and `berry` are retired IDs for the rejected mouse/colorway direction.

All three retired IDs now display the unchanged canonical Miffy asset as a compatibility fallback.
Simply loading a profile does not mutate its stored value. If the family later submits that
profile’s edit form, the visible Miffy choice stores canonical ID `sprout`; the family can instead
explicitly choose any approved animal. New profiles can store only the five selectable IDs above.
No retired ID is reused for a new character.

This preserves database readability and avoids guessing an assignment among the new original
animals. The fallback is deliberately limited to the already-established Miffy artwork rather than
shipping the rejected mouse or an unapproved generic icon.

## Selection and renderer design

The add-member and edit pickers read `selectableAvatarIds`. Each catalog entry provides:

- a permanent profile ID and localized character name;
- one canonical transparent raster asset;
- one fixed character identity and palette;
- semantic backdrop and ring tokens;
- optical positioning for the face/head at rendered picker size.

Do not add hue rotation, recoloring masks, palette selectors, variant names, multiple presets of the
same animal, or code-drawn character SVGs. A new animal is a separately generated and reviewed
character with a new permanent ID.

## Accessibility and interaction

At picker size, position each asset by the optical center of its face/head rather than its raw
bitmap bounds. Preserve visible keyboard focus, a non-color selected check/border, localized
character names, and at least 44 px controls.

Profile switching keeps its brief outgoing/incoming transition, named status announcement, switch
lock, and reduced-motion zero-delay path. The removal flow keeps its in-app alert dialog with
cancel as default focus, explicit destructive confirmation, Escape handling, focus containment and
return, and reduced-motion styling.

## Later decisions

- Whether to expand the roster beyond the approved initial five characters.
- Whether retired mouse IDs should eventually receive a dedicated owner-approved migration flow
  instead of the current non-mutating Miffy fallback.
