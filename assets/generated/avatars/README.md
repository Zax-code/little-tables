# Generated family avatar artwork

The avatar picker uses owner-approved transparent raster artwork copied into the app without
generative modification. Miffy's approved PNG is deterministically scaled and recentered on its
existing transparent canvas so every character can use the same portrait-framing CSS; the
character artwork itself was not regenerated, redrawn, or recolored.

The shipped transparent PNGs are:

- `apps/web/public/avatars/miffy.png`
- `apps/web/public/avatars/malo-bear.png`
- `apps/web/public/avatars/fenna-fox.png`
- `apps/web/public/avatars/mina-cat.png`
- `apps/web/public/avatars/paco-dog.png`
- `apps/web/public/avatars/colin-mallard.png`

The `source/` directory contains discarded intermediate chroma-key inputs from the earlier avatar
iteration; it is not the source of the currently shipped picker artwork.

Character-specific color is applied only to the picker's circular backdrop and ring. The raster
artwork itself is never recolored by the app.
