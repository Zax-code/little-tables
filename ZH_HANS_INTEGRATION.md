# zh-Hans integration checklist

This branch localizes every translation key present at baseline commit `2a986ba`, plus the new
three-language selector. The parallel personalized-garden and family-profile branches are still
changing copy, so their added keys must receive `zh-Hans` entries when those branches are merged.
Map the final key names to the semantic inventory below; do not copy English or French as a
temporary fallback.

## Personalized garden

Localize keys for:

- first-visit garden guidance: heading, explanation, dismiss action, and accessibility label;
- the “How it grows” heading, open/close action, daily-bloom rule, three-blooms-per-plant pacing,
  extra-practice rule, and mastery-gate explanation;
- the visible next goal, including grow, bloom, unlock, complete, and mastery-gated states;
- post-daily-session bloom/progress outcomes;
- post-extra-practice outcomes;
- same-day home states that explain when the next bloom is available.

Use or adapt this vocabulary:

| Meaning                                                                          | Suggested zh-Hans                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| How the garden grows                                                             | 花园怎样长大                                             |
| One completed daily watering session earns one bloom per day.                    | 每天完成一次“今日浇水”，每天最多获得一朵花。             |
| Three daily blooms grow one plant.                                               | 收集三朵每日小花，就能养成一株植物。                     |
| Today’s bloom is safely in your garden. Come back tomorrow for the next one.     | 今天的小花已经安心待在花园里。明天回来，就能迎接下一朵。 |
| Practice again                                                                   | 再练一次                                                 |
| No extra bloom today; practice still strengthens math skills.                    | 今天不会多开一朵花，不过每次练习都会让算式记得更牢。     |
| Great practice! The garden grows once per day; the next bloom is ready tomorrow. | 练得真好！花园每天长大一次，明天就能迎接下一朵花。       |
| Next goal                                                                        | 下一个小目标                                             |
| Mastery gate                                                                     | 再记牢 {count} 道算式，就能开启下一章。                  |

Also revisit existing Chinese values for `watering.doneCopy`, `watering.extra`,
`watering.rewardEarned`, `garden.extraCopy`, and any five-petal copy if the garden branch changes
their English/French meaning or replaces five-bloom pacing.

## Family profiles

Localize keys for:

- current-profile identity and the one-tap switcher;
- profile-picker heading, open/close action, and accessibility labels;
- family-management heading, introduction, back action, and empty/loading/error states;
- add, rename, save, cancel, remove, and pending states;
- child-name labels, validation, duplicate/max-profile errors, and safe retry copy;
- avatar selection heading, option names/descriptions, selected state, and accessibility labels;
- removal confirmation, the “last profile cannot be removed” rule, and server failure copy.

Use or adapt this vocabulary:

| Meaning                                | Suggested zh-Hans                |
| -------------------------------------- | -------------------------------- |
| Who is practicing?                     | 谁要来练习？                     |
| Switch learner                         | 换一位练习者                     |
| Practicing as {name}                   | 现在是 {name} 在练习             |
| Manage family profiles                 | 管理家庭成员                     |
| Add a child                            | 添加孩子                         |
| Child’s name                           | 孩子的名字                       |
| Choose an avatar                       | 选择头像                         |
| Rename                                 | 修改名字                         |
| Remove profile                         | 移除成员                         |
| Keep at least one profile.             | 至少保留一位家庭成员。           |
| Could not save that change. Try again. | 这次修改没有保存好，请再试一次。 |

Removal copy is parent-facing and must state plainly whether progress is permanently deleted. Keep
profile names and original character names unchanged; translate generic avatar descriptors.

## Merge hotspots and verification

- `apps/web/src/i18n-catalog.ts`: add every integrated key to `simplifiedChinese`. Its typed record
  and the completeness test intentionally fail on omissions or placeholder mismatches.
- `apps/web/src/components/language-toggle.tsx`: preserve the three-choice selector. The family
  branch may add a profile ID to reminder synchronization; carry that new argument into the
  selector’s change handler.
- `apps/web/src/screens/home-screen.tsx` and `apps/web/src/styles.css`: check that the profile
  switcher, language selector, and sound control do not overlap at narrow or wide breakpoints.
- `apps/web/src/reminder-subscription.ts`: preserve `zh-Hans` transport while adopting any
  profile-scoped endpoint/body changes.
- `apps/server/src/repositories/attempt-repository.ts` and
  `apps/server/src/application/daily-reminders.ts`: preserve the `zh-Hans` reminder locale schema
  and notification copy.

After integration, run the i18n, selector, profile, garden, reminder, and full workspace checks.
Any new date shown in collection/profile UI should use `Intl.DateTimeFormat(locale, ...)`; counts
can remain Arabic numerals, which are natural in this child-facing Chinese UI.
