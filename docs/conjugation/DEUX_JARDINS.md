# Deux jardins : les maths et le pré des verbes

Plan d'implémentation, à valider. Planche **R8 · Deux jardins** dans
`design/little-tables-rewrite.pen`, exports dans `design/exports/r8/`. Fait suite au pré des verbes
(`PRE_DES_VERBES.md`, PR #84 à #87).

## 1. Ce qui change pour l'enfant

| Écran             | Changement                                                                                                                                                                                                          | Export                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1 · Aujourd'hui  | Deux arrosages : « Arroser le jardin des maths » (rose) et « Arroser le pré des verbes » (soleil). Deux cartes au-dessus : la plante en cours et le verbe qui a soif.                                               | `A1-aujourdhui-deux-arrosages.png`    |
| D2 · Jardin       | Le jardin des maths : la ligne « Le pré des verbes » disparaît, le pré a son onglet.                                                                                                                                | `D2-jardin-des-maths.png`             |
| D8 · Onglet Pré   | Un 4e onglet « Pré » (icône `flower-2`). En haut, une scène où le personnage de l'enfant arrose les fleurs des verbes travaillés aujourd'hui, comme dans `GardenWorld` ; dessous, la grille par groupe déjà livrée. | `D8-onglet-pre.png`                   |
| D11 · Célébration | Après l'arrosage du pré : « +1 arrosage du pré », « Le pré a fleuri », les verbes arrosés, le compte des floraisons du pré, « Voir mon pré ».                                                                       | `D11-celebration-arrosage-du-pre.png` |

Sans verbe coché, rien ne change : 3 onglets, un seul arrosage.

## 2. Règles

- **Deux arrosages du jour.** L'arrosage des maths ne pose plus de clé `conj:`. L'arrosage du pré ne
  pose que les verbes et temps cochés, composé comme l'arrosage des maths (5 à 8 questions, deux
  nouveautés au plus, le verbe « en ce moment en classe » mis en avant).
- **Deux floraisons, une par jour chacune.** Le jardin garde son registre (`gardenBloomCount`,
  `rewardedDayKeys`), seulement nourri par l'arrosage des maths. Le pré gagne le sien
  (`meadowBloomCount`, `meadowRewardedDayKeys`), nourri par l'arrosage du pré.
- **Ma semaine** fleurit un jour dès qu'un des deux arrosages est fait (`practiceDayKeys` inchangé).
- **Papillons et séance « Mes verbes »** restent tels quels ; la séance « Mes verbes » reste dans
  Autres séances et ne donne pas de floraison.
- **La carte « Tes verbes ont soif »** est remplacée par la carte du pré de l'accueil, qui reprend le
  même verbe (`meadow.thirst`).

## 3. Moteur et serveur

- `SessionKind` gagne `meadow-watering`. L'algorithme de composition `3` (`ALGORITHM_VERSION_3`)
  garde la règle de la version 2 et sépare les jardins : son arrosage du jour n'a plus de clé
  `conj:`, et `kind: meadow-watering` compose l'arrosage du pré sur ces seules clés. Les versions 1
  et 2 ne changent pas (anciens clients, vecteurs golden).
- `derive_garden_reward_ledger` ignore `extra-practice` et `meadow-watering` ;
  `derive_meadow_reward_ledger` ne compte que `meadow-watering`, une floraison par jour.
- Pas de migration : le pré n'a pas d'historique importé à préserver, le serveur dérive son
  registre des événements et l'ajoute au bootstrap (`meadowBloomCount`, `meadowRewardedDayKeys`,
  optionnels pour les anciens clients). `lt-store` relit `meadow-watering` (sinon une séance sans
  type compterait comme un arrosage du jardin).
- Le rappel du soir ne change pas : il se tait dès que l'enfant a pratiqué dans la journée.

## 4. App

- `ChildTabBar` : onglet « Pré » vers `/garden/meadow` quand un verbe est coché ; l'écran du pré perd
  son bouton retour et gagne la scène.
- `meadow/meadow-scene.tsx` : la mécanique de `garden-scene.tsx` (marche, arrosage, `Sprite`) sur les
  pots des verbes arrosés aujourd'hui, au plus 3.
- `today-screen.tsx` : deux cartes et deux boutons ; `policies.daily` et `policies.meadow`.
- `completeSession` : la floraison du pré pour `meadow-watering` ; la célébration D11.

## 5. Questions ouvertes

Choix par défaut retenus pour ce lot, à revoir plus tard :

1. Les floraisons du pré restent un compte (rien à débloquer).
2. Le parent ne désactive pas un arrosage ; sans verbe coché, il n'y a qu'un arrosage.
3. Les maths d'abord.

## 6. Découpage proposé

1. `feat(domain): water the meadow` — `meadow-watering`, composition, registre du pré, tests.
2. `feat(server): serve the meadow blooms` — bootstrap, contrat `/api/v2`.
3. `feat(app): two gardens` — onglet, scène, accueil, célébration, textes, tests.
