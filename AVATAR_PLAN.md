# Family avatar implementation plan

Status: compact character preset selection is implemented; additional designed raster avatar assets
remain future work.

## Product model

A family signs in with one Google account. That account owns multiple family member
profiles. Each member chooses a preset avatar and keeps an isolated practice history, mastery
snapshot, garden, rewards, and stats. The avatar is profile metadata, not part of authentication,
and the same selection is returned by the server on every device.

The first catalog is a small cast of calm, rounded characters from the existing Little Tables
garden world. It reuses the in-repo Miffy face and adds Pip, an original round-eared field mouse
with a clearly different silhouette. The existing permanent selection IDs now identify one exact
character/variant pair:

- `sprout`: Miffy with a coral backplate;
- `sunbeam`: Miffy with a sunshine backplate;
- `bluebell`: Pip with a sage scarf;
- `berry`: Pip with a berry scarf.

Keeping these IDs preserves every existing profile while making each stored choice an exact,
recognizable preset. Miffy uses existing reviewed artwork; Pip is a compact original inline vector.
Both characters remain legible in the profile switcher, and their tasteful palette variants provide
choice without making the selector large.

## Designed raster bases

Use the Codex `imagegen` skill and its built-in image-generation path for the designed raster base
avatars. Generate each distinct character as its own request rather than asking one batch image for
unrelated characters. Classify the work as `illustration-story` or `stylized-concept`, state that
the asset is a square profile-avatar cutout, and provide the shared garden palette, framing,
line-weight, edge, and originality constraints in every prompt.

For each character:

1. Generate low-cost square explorations with generous padding and no text, logo, watermark,
   props, cast shadow, or scenery.
2. Review silhouette recognition at 32, 48, and 96 CSS pixels before refining details.
3. Select one base and iterate with one targeted change at a time.
4. For project-ready cutouts, use a perfectly flat chroma-key background with a key color absent
   from the subject, then use the skill's installed chroma-key removal helper.
5. Verify alpha corners, subject coverage, clean antialiased edges, palette, and consistency before
   copying the final PNG source into the workspace.
6. Produce optimized WebP derivatives programmatically and retain the reviewed PNG master outside
   `apps/web/public/` if the existing asset pipeline follows that convention.

Do not generate by naming a living artist or asking for an exact Dick Bruna/Miffy reproduction.
Prompts should describe the project's own visual grammar directly.

## Safe programmatic variants

Programmatic palette variations are appropriate only when they preserve the reviewed drawing:

- recolor a flat, separately masked garment or small accessory;
- map a known flat fill to an approved semantic palette token;
- produce light/dark UI backplates outside the character raster;
- derive WebP sizes and density variants from the same reviewed master.

Do not hue-rotate the entire raster. It can contaminate black line work, white fur, blush, edge
pixels, and intentional contrast. Do not recolor eyes, face marks, skin/fur identity, shadows, or
antialiased outlines. If a variant needs a new silhouette, pose, facial construction, texture, or
lighting, treat it as a separately designed base and review it independently.

## Proposed asset manifest

Add a versioned manifest such as `apps/web/public/avatars/manifest.json`:

```json
{
  "schemaVersion": 1,
  "catalogVersion": "2026-01",
  "defaultAvatarId": "sprout",
  "avatars": [
    {
      "id": "sprout",
      "characterId": "meadow-rabbit",
      "variantId": "coral-overalls",
      "labelKey": "family.avatar.sprout",
      "src": "/avatars/sprout.webp",
      "width": 256,
      "height": 256,
      "dominantToken": "avatar-sprout-surface",
      "altKey": "family.avatarAlt.sprout",
      "generationPrompt": "assets/prompts/avatar-meadow-rabbit.md",
      "sourceMaster": "assets/generated/avatar-meadow-rabbit-master.png"
    }
  ]
}
```

`id` is permanent profile data. Never reuse a retired ID for a different appearance. `characterId`
groups variants of one designed character; `variantId` identifies the reviewed palette/design
combination. Dimensions make layout deterministic. Translation keys keep labels and alt text out
of the asset file. Prompt and source-master fields preserve provenance for future regeneration.
Production code should validate the manifest, fall back to `defaultAvatarId` for missing or retired
entries, and preload only the active avatar plus picker thumbnails.

## Selection flow

The active-profile switcher shows each member's chosen preset. In family management, adding a member
requires a name and offers the full preset grid; the first preset is selected by default. Editing a
member allows renaming and changing the preset in one save. A choice is previewed at its real compact
size, has a visible selected state that does not depend on color alone, and includes a localized
accessible name. Saving sends the stable avatar ID to the existing family-profile endpoint. The
server validates it against the allowed catalog IDs and returns the profile; the client then
refreshes family metadata and caches it for offline switching.

Catalog upgrades must not rewrite member choices. A retired asset remains served until a replacement
flow exists, or its manifest entry explicitly points to a reviewed backward-compatible fallback.

## Originality and protected-character constraints

The owner-approved Miffy option must reuse the existing in-repo character artwork rather than
introducing a new imitation. Every companion character must be original and substantially distinct:

- do not trace, edit, or imitate unrelated external copyrighted characters;
- require a distinct species/silhouette, facial geometry, proportions, and project palette;
- favor original non-rabbit companions such as Pip for future additions;
- keep filenames, labels, and metadata clear about which option is Miffy and which is original;
- reject an original companion that could be mistaken for an unrelated established character.

Before shipping, conduct a side-by-side review at thumbnail and full size for silhouette, face,
proportions, costume, pose, and overall commercial impression. Record the accepted prompt, master,
reviewer, and originality notes with the manifest. If a design feels borderline, redesign it rather
than relying on minor palette changes.

## Delivery checklist for the future asset task

- Approve a character brief and originality checklist before generation.
- Generate and review distinct raster bases with the `imagegen` skill.
- Validate transparent edges and thumbnail readability.
- Create only safe masked palette derivatives.
- Add optimized files, prompt provenance, and the validated manifest.
- Map current stable preset IDs to final assets.
- Add manifest decoding, fallback, preload, and visual-selection tests.
- Run the full repository check and React Doctor audit.
