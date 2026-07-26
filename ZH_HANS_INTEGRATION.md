# zh-Hans integration notes

## Current coverage

Simplified Chinese covers every current typed catalog key, including family profiles, the
six-character avatar roster, selected-character scenes, first-visit garden guidance, once-per-day
watering, three-day growth goals, mastery gates, rewards, empty/error states, and accessibility
copy.

The shared Chinese vocabulary is:

| Product meaning                     | zh-Hans           |
| ----------------------------------- | ----------------- |
| daily session                       | 今天的小练习      |
| watering progress unit              | 次浇水            |
| multiplication fact becoming fluent | 记牢一道乘法题    |
| growing / familiar                  | 成长中 / 慢慢熟悉 |
| garden collection                   | 花园图鉴          |
| family profile                      | 家人的个人资料    |

`little tables` remains the product name. Miffy uses her established Chinese name, `米菲`. The
original character first names are localized for natural recognition in Chinese: Malo `马洛`,
Fenna `芬娜`, Mina `米娜`, Paco `帕科`, and Colin `科林`.

The language selector keeps all three choices and synchronizes an existing reminder subscription
for the active profile. The app also sends the selected locale to the service worker, so a visible
fallback notification does not revert to French when Chinese is selected. Locale-specific PWA
manifests keep install-sheet metadata in the selected language. Only the French manifest advertises
the current French screenshots; English and Chinese omit them until matching captures exist.

## Selected-character integration

Authenticated character scenes use the active profile’s selected character. Every `asset.*`
accessibility description and both garden caretaker descriptions share a `{character}` placeholder
across English, French, and Chinese. The placeholder is populated from the localized
`family.avatar.*` name, with natural Chinese word order such as `{character}正在轻轻浇水。`.

Any future scene, decode failure, preload status, or character-specific error key needs a nonblank
`zh-Hans` entry with the same placeholders as English. Keep generic ambient copy, including
`ambient.wateringCan`, independent of a specific character.

Retired avatar IDs `sunbeam`, `bluebell`, and `berry` must continue to resolve to `米菲` without
rewriting stored profiles. Pre-authentication Miffy art remains the approved safe fallback.

## Verification guardrails

- `apps/web/src/i18n-catalog.ts` uses typed records, and `apps/web/src/i18n.test.ts` checks exact key
  completeness and placeholder parity for every locale.
- Counts use Arabic numerals, which are natural here. If a future screen shows a user-facing date,
  format it with `Intl.DateTimeFormat(locale, ...)`.
- `apps/web/public/manifest-*.webmanifest` must stay aligned when install metadata changes. Do not
  add French screenshots to the English or Chinese manifest; first capture matching localized UI.
