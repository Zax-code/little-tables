# Le pré des verbes : encourager la conjugaison

Plan d'implémentation. Design validé le 8 octobre 2026 : planche **R7 · Encourager la
conjugaison** dans `design/little-tables-rewrite.pen`, exports dans `design/exports/r7/`.

## 1. Le problème

Un parent rapporte que sa fille ne choisit que les maths. Deux causes dans l'app :

- L'arrosage du jour garde au plus deux familles d'interaction (`limit_families`,
  `crates/lt-domain/src/engine.rs`). Avec deux ou trois sentiers maths actifs, la famille
  « lettres » (conjugaison) est souvent écartée en silence.
- Seul l'arrosage du jour fait fleurir le jardin (`derive_garden_reward_ledger`,
  `crates/lt-domain/src/garden.rs`). Une séance « Mes verbes » choisie ne donne rien de visible.

## 2. Les trois mécaniques retenues

| Écran                  | Mécanique                                                                                                                                                                                                                                                                                                 | Export                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A7 · Aujourd'hui       | **Tes verbes ont soif** : carte d'invitation quand aucun verbe n'a été arrosé depuis 3 jours, avec un verbe nommé et un bouton qui lance sa séance.                                                                                                                                                       | `A7-aujourdhui-verbes-ont-soif.png`                |
| D2b · Jardin           | Une ligne **Le pré des verbes · n papillons** dans les liens du jardin, et le « moment du jour » peut annoncer un papillon.                                                                                                                                                                               | `D2b-jardin-entree-du-pre.png`                     |
| D8 · Le pré des verbes | **Un second jardin**, écran à part, trié par groupe de verbes, trois cartes par rangée, qui défile (jusqu'à 60 verbes). Une fleur par verbe coché, son nom, un point par temps coché avec son état. Sur chaque fleur, le cycle de son papillon (œufs, chenille, chrysalide) et les papillons déjà sortis. | `D8-le-pre-des-verbes.png`, `R7-fleurs-du-pre.png` |
| D11 · Célébration      | Après une séance de verbe : l'étape franchie (œufs, chenille, chrysalide) ou chip **+1 papillon** avec son espèce, et un insight en conjugaison.                                                                                                                                                          | `D11-celebration-seance-de-verbes.png`             |
| D12 · Feuille          | **Comment pousse un verbe** : quatre règles.                                                                                                                                                                                                                                                              | `D12-feuille-comment-pousse-un-verbe.png`          |

Invariants : le ledger des floraisons (`gardenBloomCount`, `rewardedDayKeys`) et la règle « une
floraison par jour » ne changent pas. Le pré n'ajoute **aucun état persistant** : tout se dérive du
snapshot et des réglages du parent. Pas de monnaie, pas de classement, rien ne bloque les maths.

## 3. Règles du domaine

Tout vit dans `crates/lt-domain`, exposé par `api.rs`, `lt-domain-wasm` et `packages/engine`.

### 3.1 `derive_meadow`

```rust
pub struct MeadowInput<'a> {
    pub settings: Option<&'a ConjugationSettings>, // réglages du parent
    pub snapshot: &'a LearningSnapshot,
    pub today_key: &'a str,
}

pub struct MeadowVerb {
    pub verb: String,
    pub group: VerbGroup,            // auxiliary | first | second | third
    pub silhouette: MeadowSilhouette, // voir §3.2
    pub palette: MeadowPalette,       // voir §3.2
    pub stage: MeadowStage,           // seed | growing | mature
    pub tenses: Vec<(Tense, MasteryState)>, // les temps cochés, dans l'ordre du parent
    pub life: MeadowLife,                   // empty | eggs | caterpillar | big-caterpillar | chrysalis
    pub butterflies: Vec<MeadowButterfly>,  // { species, day_key }, du plus ancien ; ils restent
    pub last_worked_day_key: Option<String>, // dernier jour avec une réponse juste, tous temps
}

pub struct MeadowThirst { pub verb: String, pub days_since: i64 }

pub struct MeadowProgress {
    pub verbs: Vec<MeadowVerb>,        // dans l'ordre : auxiliaires, 1er, 2e, 3e groupe ; puis l'ordre du parent
    pub butterflies: i64,              // tous les papillons du pré
    pub thirst: Option<MeadowThirst>,  // None sans verbe coché, ou si un verbe a été vu il y a moins de 3 jours
}
```

- **Stade.** Les clés sont `conj:{verbe}:{temps}` (`conjugation::key`) pour les temps cochés.
  `seed` si tous les temps sont `unseen`. `mature` si tous sont `fluent`. `growing` sinon.
- **Cycle du papillon** (`verb_cycle`). Les jours travaillés d'un verbe sont les jours de
  `successful_day_keys` de toutes ses clés `conj:{verbe}:{temps}`, cochées ou non (décocher un temps
  ne fait jamais reculer), à partir de `MEADOW_CYCLE_START` (2026-10-10 : les papillons de l'ancien
  pré, un par jour travaillé de la semaine, sont partis). Chaque jour travaillé avance le cycle
  d'une étape : œufs, chenille, grosse chenille, puis chrysalide au 4e jour. Le premier jour
  travaillé au moins `MEADOW_CHRYSALIS_WAIT` (3) jours après la chrysalide fait sortir le papillon ;
  le suivant pond de nouveaux œufs. Il faut donc au moins 5 jours de travail sur 8 jours de
  calendrier : un papillon par verbe et par semaine au plus. Les papillons restent dans le pré.
  L'espèce (citron, paon-du-jour, azuré, piéride, vulcain, machaon) est tirée par le hash FNV de
  `{verbe}:{jour}`, jamais deux fois de suite la même sur un verbe : aléatoire mais identique sur
  tous les appareils. Le snapshot ne compte pas les réponses par jour : un jour compte dès une
  réponse juste.
- **Soif.** `last` = le plus récent `last_reviewed_day_key` parmi toutes les clés de conjugaison
  des verbes cochés. Soif si aucun verbe coché n'a été vu, ou si `days_between(last, today) >= 3`.
  Le verbe proposé est, parmi les verbes cochés déjà vus, celui dont le dernier jour est le plus
  ancien ; sinon le premier verbe coché. `days_since` vaut 0 quand rien n'a été vu.
- **Changement d'une séance** (`meadow_change(attempts, before, after) -> Option<MeadowChange>`) :
  pour les verbes demandés, compare le cycle avant et après la séance ; un papillon sorti d'abord,
  sinon l'étape la plus avancée, le premier verbe demandé à égalité. `None` si rien n'a bougé,
  comme à la deuxième séance du jour. Utilisé par la célébration.

### 3.2 Silhouettes et palettes

Déterministes à partir du verbe, calculées une seule fois en Rust :

```rust
fn verb_hash(verb: &str) -> u32 // FNV-1a 32 bits sur les octets UTF-8 de l'infinitif
```

| Groupe                  | Famille de silhouettes (`verb_hash % n`) |
| ----------------------- | ---------------------------------------- |
| auxiliary (être, avoir) | `sunflower`, `tulip`                     |
| first                   | `daisy`, `cosmos`, `bellflower`          |
| second                  | `cornflower`, `dahlia`                   |
| third                   | `poppy`, `anemone`                       |

Palette = `MEADOW_PALETTES[verb_hash / 7 % 10]` (diviser avant le modulo pour découpler de la
silhouette). Deux verbes d'un groupe partagent une famille, jamais la même paire
(silhouette, palette) tant qu'il y a moins de 20 à 30 verbes dans le groupe ; les collisions
au-delà sont acceptées.

Les palettes, plus vives que celles du jardin, deviennent des jetons CSS `--meadow-*` dans
`apps/app/src/styles.css` (même nom en mode sombre, valeurs à ajuster) :

| Nom      | Pétales   | Accent    | Cœur      | Pot       |
| -------- | --------- | --------- | --------- | --------- |
| gold     | `#FFC21C` | `#FFE27A` | `#7A4A2E` | `#E8B04A` |
| rose     | `#F2688F` | `#FFB3C6` | `#FFF1C2` | `#F08A9B` |
| indigo   | `#5B5BD6` | `#A98BF0` | `#FFF1C2` | `#7C7FD1` |
| coral    | `#FF5A47` | `#FF9A5C` | `#FFD33D` | `#E8955E` |
| violet   | `#9B4DD6` | `#A98BF0` | `#FFD33D` | `#B48BD9` |
| mint     | `#4CC48F` | `#FFFFFF` | `#FFD33D` | `#6FC79A` |
| red      | `#F0362B` | `#FF5A47` | `#7A4A2E` | `#F08A9B` |
| white    | `#FFFFFF` | `#FFE27A` | `#FFD33D` | `#B48BD9` |
| peach    | `#FF9A5C` | `#FFB3C6` | `#7A4A2E` | `#E8955E` |
| lavender | `#A98BF0` | `#E6DCFF` | `#FFD33D` | `#7C7FD1` |

Feuilles : `#6FAE4A` et `#4F9A3C`. Contour : `--ink-primary`. Terre et liseré du pot : les jetons
du jardin.

### 3.3 Composition de l'arrosage (optionnel, à décider)

Question ouverte notée sur la planche : garantir une place à la famille « lettres » dans
`limit_families` quand la conjugaison est cochée. Ne pas le faire dans ce lot ; mesurer d'abord
l'effet de l'invitation.

## 4. Côté app

### 4.1 Dessin des fleurs

Même mécanique que le jardin : `apps/app/src/garden/garden-plant-illustration.tsx` (tige, feuilles,
pot, `gardenPlantViewBox = "0 0 112 152"`, `scale(.8)`) et `garden-plant-renderers.tsx` (têtes).

- Nouveau `apps/app/src/meadow/meadow-plant-renderers.tsx` : neuf têtes `MatureHead` dans le
  repère 140 × 190 avant `scale(.8)`, centre (70, 62) :
  - `sunflower` : 14 ellipses rx 6 ry 15 à 24 du centre, cœur r 15 couleur `center`, disque r 9 `#5A3A24`.
  - `tulip` : trois pétales en courbes (voir les tracés dans la planche Pencil, nœuds `tulipe · rose`).
  - `daisy` : 10 ellipses rx 5 ry 17 à 20, cœur r 9.
  - `cosmos` : 8 ellipses rx 10 ry 17 à 18, anneau accent de 8 ellipses rx 6 ry 11 à 12 décalé de 22,5°, cœur r 7.
  - `bellflower` : cloche (tracé dans la planche), bande accent au centre.
  - `cornflower` : 9 losanges pointus (pointe à 29, base à 7), anneau accent de 9 losanges plus courts décalé de 20°, cœur r 7.
  - `dahlia` : deux anneaux de 8 ellipses (rx 8 ry 18 à 20, puis rx 7 ry 13 à 13 décalé de 22,5°), cœur r 8.
  - `poppy` : contour à 4 lobes (rayon intérieur 10, extérieur 30, décalé de 45°), cœur noir r 9, point `center` r 4.
  - `anemone` : contour à 6 lobes (11, 28), cœur accent r 11, point noir r 5.
  - Tous les tracés sont dans le `.pen` (planche R7, rangée « Les fleurs du pré », un nœud `path` par forme avec `geometry` SVG) : les recopier plutôt que les redessiner.
- Un seul bourgeon pour toutes les familles (`growing`) : deux pétales fermés en pointe, couleurs
  `petal` et `accent`. `seed` : le corps `dormant` du jardin, sans tête.
- `apps/app/src/meadow/meadow-plant.tsx` : `<MeadowPlant verb={MeadowVerb} />`, même API que `Plant`.

### 4.2 Écrans

- `apps/app/src/app/derived.ts` : `useMeadow(state, paths)` qui appelle `engine.deriveMeadow`.
- `apps/app/src/child/today-screen.tsx` : la carte **Tes verbes ont soif** sous le bonjour quand
  `meadow.thirst` n'est pas nul et qu'aucune séance n'est en cours. Fond `bg-sun-soft`, mascotte
  (`scene="practice-encourage"`), eyebrow, titre « « aller » attend depuis 3 jours » (ou « n'a
  jamais été arrosé » à 0 jour), bouton `policies.verb(paths, verb)` avec « 8 questions ». Ne pas
  l'afficher à la première visite.
- `apps/app/src/garden/garden-screen.tsx` : ligne `ListRow` « Le pré des verbes » en tête des
  liens, détail « n papillons », icône `flower-2` sur tuile `sun`, visible seulement avec au moins
  un verbe coché.
- Nouvelle route `/garden/meadow` dans `apps/app/src/routes.tsx` et
  `apps/app/src/meadow/meadow-screen.tsx` : `NavigationBar` retour « Jardin », titre « Le pré des
  verbes », pastille « n papillons dans le pré », sections par groupe (auxiliaires
  « Être et avoir », puis 1er, 2e, 3e groupe ; une section vide n'apparaît pas), grille de trois
  cartes par rangée. Carte : `bg-surface` (`bg-surface-2` et nom en `text-label-2` pour `seed`),
  plante, nom du verbe (`lang="fr"`), un point par temps (`leaf` fluent, `sun` familiar,
  `sun-soft` bordé `sun` learning, `separator` unseen, comme `progress/verbs-screen.tsx`). En
  haut à droite de la plante, l'étape du cycle (`meadow-life.tsx`) ; la chenille dort quand le pré a
  soif. En haut à gauche, le dernier papillon sorti et « ×n » s'il y en a plusieurs. Taper une
  carte lance `policies.verb`.
- Papillon : un petit SVG dessiné en code (`apps/app/src/meadow/butterfly.tsx`), environ 42 × 36,
  ailes peintes selon l'espèce. Œufs, chenilles et chrysalide dans `meadow-life.tsx`, même cadre
  52 × 44, même contour et mêmes yeux.
- `apps/app/src/reward/celebration-screen.tsx` : `SessionCompletion` garde `meadowChange`
  (calculé dans `completeSession` avec `engine.meadowChange`, entre `sessionStartSnapshot` et le
  snapshot final). Une étape : la fleur du verbe, la bête du cycle, « Une chenille » et « Une
  chenille est née sur « aller ». ». Un papillon : chip `+1 papillon` sur `sun-soft`, le nom de
  l'espèce, « Il est sorti de sa chrysalide sur « aller ». Il reste dans le pré. », puis « n
  papillons dans le pré ». Le CTA devient « Voir le pré des verbes » vers `/garden/meadow`.
- `apps/app/src/reward/insight.ts` : quand toutes les clés d'un insight `facts-became-fluent`
  sont `conj:{verbe}:{temps}` d'un même verbe, écrire « Tu sais conjuguer « aller » au futur » (un
  temps) ou « Tu sais conjuguer « aller » » (plusieurs).
- `apps/app/src/meadow/meadow-help-sheet.tsx`, ouverte depuis la ligne « Comment pousse un verbe »
  du pré : quatre règles avec tuile d'icône (`flower` sun, `sprout` tint, `sparkles` sky,
  `droplets` leaf) :
  1. Un verbe, une fleur. Chaque verbe coché par tes parents a sa fleur dans le pré, à côté du jardin.
  2. Un temps, un pétale. Quand tu sais un temps par cœur, un pétale s'ouvre.
  3. Les papillons. Chaque jour où tu travailles un verbe, sa chenille grandit. Après la chrysalide,
     attends 3 jours : la fois suivante, un papillon en sort et reste dans le pré.
  4. Un arrosage par jour. Le pré ne change pas la règle du jardin : une floraison par jour, avec l'arrosage.

### 4.3 Textes

Dans `apps/app/src/i18n/messages/conjugation.ts`, en anglais et en français ; les verbes et les
temps restent en français partout. Clés à créer : `meadow.title`, `meadow.back`,
`meadow.butterfliesWeek` (pluriel), `meadow.verbsCount`, `meadow.group.auxiliary` (« Être et
avoir »), `meadow.group.first|second|third`, `meadow.help`, `meadow.rule.*`, `today.thirstEyebrow`,
`today.thirstTitle` (`{verb}`, `{days}`), `today.thirstNever`, `today.thirstWater`,
`today.thirstQuestions`, `garden.meadowRow`, `garden.meadowDetail`, `garden.momentButterfly`,
`celebration.butterfly`, `celebration.butterflyName`, `celebration.butterflyWhere`,
`celebration.butterflyWeek`, `celebration.seeMeadow`, `insight.verbRooted`,
`insight.verbRootedTense`.

## 5. Tests

- `crates/lt-domain` : tests unitaires de `derive_meadow` (stade par état des temps ; papillon à
  trois formes justes le même jour et pas à deux ; fenêtre de 7 jours ; soif à 3 jours et verbe
  proposé le plus ancien ; `verb_hash` stable sur « être », « aller », « finir » avec les valeurs
  attendues écrites en dur ; silhouette et palette par groupe), de `meadow_visit`, et un test
  proptest : deux verbes différents d'un groupe de moins de 10 verbes n'ont jamais la même paire.
- Contrat `/api/v2` : rien à changer, le pré est dérivé sur l'appareil.
- `apps/app` (Vitest, moteur WebAssembly réel) : la carte de soif apparaît après trois jours sans
  conjugaison et pas à la première visite ; la ligne du pré n'apparaît pas sans verbe coché ; le
  pré groupe et trie ; la célébration montre le papillon après une séance de verbe ; l'insight de
  conjugaison ; un test de rendu par silhouette (snapshot SVG léger, comme pour le jardin).

## 6. Découpage en PR

1. `feat(domain): derive the verb meadow` — `derive_meadow`, `meadow_visit`, hash, silhouettes,
   palettes, API wasm et facade `packages/engine`, tests.
2. `feat(app): the verb meadow screen` — jetons `--meadow-*`, renderers, `MeadowPlant`, papillon,
   route, écran, feuille d'aide, ligne du jardin, textes, tests.
3. `feat(app): invite to water the verbs` — carte de soif, célébration avec papillon, insight,
   tests.

Chaque PR : `corepack pnpm check` et `corepack pnpm doctor` verts, captures des écrans visibles.
