# zh-Hans integration notes

## Current coverage

The branch is rebased onto local `main` at `2a9d790`. Simplified Chinese covers every current typed
catalog key, including family profiles, the six-character avatar roster, first-visit garden
guidance, once-per-day watering, three-day growth goals, mastery gates, rewards, empty/error states,
and accessibility copy.

The shared Chinese vocabulary is:

| Product meaning                     | zh-Hans           |
| ----------------------------------- | ----------------- |
| daily session                       | 今天的小练习      |
| watering progress unit              | 次浇水            |
| multiplication fact becoming fluent | 记牢一道乘法题    |
| growing / familiar                  | 成长中 / 慢慢熟悉 |
| garden collection                   | 花园图鉴          |
| family profile                      | 家人的档案        |

`little tables` remains the product name. Miffy uses her established Chinese name, `米菲`. The
original character first names are localized for natural recognition in Chinese: Malo `马洛`,
Fenna `芬娜`, Mina `米娜`, Paco `帕科`, and Colin `科林`.

The language selector keeps all three choices and synchronizes an existing reminder subscription
for the active profile. The app also sends the selected locale to the service worker, so a visible
fallback notification does not revert to French when Chinese is selected.

## Later selected-character integration

The approved “selected profile character everywhere” work has not yet landed on `main`. During that
integration, update these existing Miffy-specific keys in all three locales rather than adding
English-only copy:

- `ambient.wateringCan`;
- every `asset.*` accessibility description;
- `garden.plotCaretakerHere` and `garden.plotCaretakerAway`.

Prefer a `{character}` placeholder shared by English, French, and Chinese, populated from the
existing localized `family.avatar.*` names. In Chinese, write the action around the interpolated
name naturally (for example, `{character}正在轻轻浇水。`); do not mechanically substitute a name into
English word order. Any new scene, decode failure, preload status, or character-specific error key
introduced by that work also needs a nonblank `zh-Hans` entry with identical placeholders.

Retired avatar IDs `sunbeam`, `bluebell`, and `berry` must continue to resolve to `米菲` without
rewriting stored profiles. Pre-authentication Miffy art remains the approved safe fallback.

## Verification guardrails

- `apps/web/src/i18n-catalog.ts` uses typed records, and `apps/web/src/i18n.test.ts` checks exact key
  completeness and placeholder parity for every locale.
- Counts use Arabic numerals, which are natural here. If a future screen shows a user-facing date,
  format it with `Intl.DateTimeFormat(locale, ...)`.
- The generated PWA manifest still has one static French description and screenshot labels for all
  app languages; it is not driven by the in-app selector. If install-sheet metadata becomes part of
  localization scope, provide locale-specific manifests rather than mixing three languages in one.
