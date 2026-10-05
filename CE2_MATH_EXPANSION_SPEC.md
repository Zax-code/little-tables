# Additions, soustractions et fractions du CE2 — spécification produit

Statut : validée pour implémentation (révision 3 : toutes les décisions du 2026-10-05 intégrées, voir §11)  
Date : 2026-10-05  
Périmètre : étendre little tables au-delà de la multiplication avec deux nouveaux domaines du
programme de CE2 : les additions et soustractions jusqu’à 10 000, et les fractions.

Ce document décline la §4.27 « Future math expansion » de `TECHNICAL_PLAN.md`. Il reste
compatible avec les principes produit (§1), la grille d’évaluation (§4.30) et les règles de
`CODING_STANDARDS.md`. Les questions encore ouvertes sont regroupées en §11.

## 1. Référence officielle

Source : programme de mathématiques du cycle 2, annexe 4 de l’arrêté de 2024 (education.gouv.fr),
partie « Cours élémentaire deuxième année », complété par les repères annuels publiés sur éduscol.

Points du programme couverts par cette spécification :

| Domaine          | Attendu de CE2                                                                                                                           | Exemple officiel                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Faits numériques | Connaître les tables d’addition dans les deux sens (égalités à trou)                                                                     | `4 + … = 12`, `5 + 3 = …`, `10 = 7 + …`                             |
| Fluence          | Compléter 15 égalités de ce type en une minute en fin de CE2                                                                             | —                                                                   |
| Calcul mental    | Ajouter 8, 9, 18, 19, 28, 29, 38, 39 à un nombre                                                                                         | « + 38, c’est + 40 puis − 2 »                                       |
| Calcul mental    | Soustraire 9, 19, 29, 39 à un nombre                                                                                                     | « − 29, c’est − 30 puis + 1 »                                       |
| Calcul mental    | Travailler dans le champ numérique du CE2 (nombres et résultats ≤ 10 000), en s’appuyant sur la numération (unités, dizaines, centaines) | doubles et moitiés de 100, 150, 200…                                |
| Calcul posé      | Poser et effectuer des additions et des soustractions en colonnes, avec des entiers ≤ 10 000                                             | —                                                                   |
| Vocabulaire      | Comprendre « terme », « somme », « différence »                                                                                          | « La différence entre 60 et 37 est 23. »                            |
| Fractions        | Fractions de dénominateur ≤ 12 et toutes ≤ 1                                                                                             | —                                                                   |
| Fractions        | Établir des égalités de fractions                                                                                                        | `?/8 = 1/2` ; lesquelles parmi 1/3, 2/4, 3/4, 2/6, 3/6 valent 1/2 ? |
| Fractions        | Placer et lire des fractions sur une bande-unité graduée, à partir de la période 3                                                       | « trois quarts d’unité », « 1 unité + 3/10 »                        |
| Fractions        | Comparer : même dénominateur, même numérateur, ou un dénominateur multiple de l’autre                                                    | 5/12 et 7/12 ; 5/12 et 5/8 ; 7/12 et 5/6                            |
| Fractions        | Additionner et soustraire : même dénominateur, ou un dénominateur multiple de l’autre                                                    | gâteau : 1/10 + 3/10 + 2/10 mangés, reste ?                         |

Le programme précise aussi que la calculatrice n’est pas utilisée au cycle 2. L’app ne propose donc
aucun outil de calcul.

**Choix de périmètre.** On couvre tout le champ numérique du CE2 : nombres et résultats jusqu’à
10 000. On y arrive par niveaux (2, puis 3, puis 4 chiffres), sans pack séparé. Les générateurs
prennent la borne `maxValue` en paramètre : passer au champ du CM1 sera un réglage, pas une
refonte.

## 2. Principes à préserver

Les nouveaux domaines reprennent tels quels les principes de `TECHNICAL_PLAN.md` §1 :

1. **Un seul geste évident.** L’accueil garde un bouton principal unique, l’arrosage du jour. Les
   nouveaux domaines y entrent sans ajouter de deuxième bouton.
2. **Court par conception.** Une séance dure environ 90 secondes. Une opération posée « pèse » plus
   lourd qu’un fait isolé (§6.2).
3. **Aucune mécanique de honte.** Pas de minuteur visible, pas d’écran rouge, et l’erreur se dit
   avec « presque — c’est … ».
4. **Le calme de la question.** Les nouvelles représentations (bandes, colonnes) restent sobres.
   L’animation est réservée au retour après la réponse.
5. **Hors ligne normal.** Tous les exercices sont générés et corrigés sur l’appareil, puis
   synchronisés par l’outbox existant.
6. **Pas d’interface à quatre choix forcée.** Chaque domaine définit ses propres représentations et
   ses propres preuves de maîtrise (§4.27).

## 3. Organisation : des « sentiers » dans le jardin

Le jardin existant reste le même pour tout le monde. Chaque domaine devient un **sentier**, qui
regroupe des **compétences**. Le mot reprend la métaphore déjà utilisée (« le chemin à l’envers »,
« choisis un petit chemin »).

| Sentier (fr)          | Sentier (en) | Compétences                                                                                                            |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| les tables (existant) | the tables   | tables 1–10, 11·12, le chemin à l’envers (÷)                                                                           |
| les petites additions | little sums  | A1 tables d’addition · A2 soustractions associées                                                                      |
| les grands nombres    | big numbers  | C1 calcul avec centaines et milliers · C2 ajouter / retirer 9, 19, 29… · C3 additions posées · C4 soustractions posées |
| les fractions         | fractions    | F1 lire une fraction · F2 fractions égales · F3 la bande graduée · F4 comparer · F5 ajouter et retirer                 |

### 3.1 Activation : automatique, ou manuelle par le parent

**Par défaut, c’est automatique.** Les trois nouveaux sentiers entrent dans l’arrosage du jour quand
les tables de 1 à 10 sont acquises. « Acquises » reprend la règle qui ouvre déjà 11·12 : chaque fait
de `CORE_FACTS` est familiar ou fluent.

- L’ouverture se fête une fois, sur l’écran de célébration : « un nouveau sentier s’ouvre dans ton
  jardin ♡ ».
- Les compétences arrivent ensuite une par une, selon §3.2, avec au plus 2 nouveautés par séance
  (§6.1). L’enfant ne reçoit donc pas tout d’un coup.
- Un profil qui a déjà acquis ses tables au moment de la mise à jour voit les sentiers s’ouvrir à sa
  prochaine séance.
- La multiplication reste dans l’arrosage du jour pour ses révisions dues : les tables ne
  disparaissent pas.

**Le parent peut aussi décider à la main**, dans l’écran Famille, sous la ligne « ce que {name}
apprend à l’école » :

- **ouvrir un sentier avant l’heure**, même si les tables ne sont pas encore acquises ;
- **choisir précisément les compétences** avec un interrupteur chacune, par exemple pour suivre le
  calendrier de la classe (F3, la bande graduée, n’arrive qu’en période 3) ;
- **mettre une activité en avant** : « en ce moment à l’école : les fractions égales ». L’arrosage du
  jour donne alors la priorité à cette compétence (§6.1). On peut aussi la lancer directement,
  depuis Famille ou depuis « choisis un petit chemin » ;
- **choisir la méthode de soustraction posée** de l’école (§4.5).

Le parent peut revenir au mode automatique à tout moment. Un sentier fermé à la main ne se rouvre pas
tout seul.

Le réglage est stocké dans le document profil (`profiles`, schemaVersion 3) et synchronisé. Avant
l’ouverture automatique, un profil existant ne voit aucun changement.

### 3.2 Ouverture progressive à l’intérieur d’un sentier

Les compétences d’un sentier ouvert arrivent dans l’ordre recommandé ci-dessous. Un interrupteur
parent ouvre une compétence tout de suite, sans attendre. La règle est souple, comme
celle de 11·12 : on n’est jamais bloqué sur un score.

| Compétence | S’ouvre quand                                                                     |
| ---------- | --------------------------------------------------------------------------------- |
| A1, C1, F1 | tout de suite                                                                     |
| A2         | au moins 5 faits A1 sont « bien ancrés »                                          |
| C2         | C1 est au moins « en train de pousser » (familiar)                                |
| C3, C4     | A1 est majoritairement familiar ou fluent (les retenues demandent des faits sûrs) |
| F2, F4     | F1 est familiar                                                                   |
| F3         | F2 est familiar, ou interrupteur parent (période 3)                               |
| F5         | F2 est familiar                                                                   |

Une compétence encore fermée apparaît dans Stats avec le ton existant : « ce chemin s’ouvrira quand
… ».

## 4. Les exercices

Chaque exercice précise son **énoncé**, son **mode de réponse**, son **mode de découverte**
(reconnaissance) et son **mode de rappel** (production), ainsi que son **aide** et sa **clé de
maîtrise**. La règle générale reste celle de §4.4 : la reconnaissance accueille, et seul le rappel
fait « bien ancrer » une compétence.

### 4.1 A1 — Tables d’addition (faits jusqu’à 10 + 10)

- **Énoncé** : trois formes tirées au hasard, comme pour × aujourd’hui :
  - `5 + 3 = …`
  - `4 + … = 12`
  - `10 = 7 + …`
- **Découverte** : 4 tuiles. Les leurres sont la réponse ±1, ±2 et la confusion « + / − ».
- **Rappel** : le pavé numérique existant.
- **Clé** : `add:min:max`. Elle est commutative comme `canonicalFactKey`. Il y a 55 faits, de
  1+1 à 10+10, sans les faits triviaux « +0 ».
- **Aide** : « passer par 10 » (`8 + 5 = 8 + 2 + 3`), qui montre une boîte de dix en points
  (le même dessin que les tableaux de points de `fact-rescue`). L’autre aide est « le double d’à
  côté » (`6 + 7 = 6 + 6 + 1`).
- **Fluence** : le seuil de latence du « bien ancré » est aligné sur l’attendu officiel, 15 faits
  en une minute, soit environ 4 secondes par fait. Le chronomètre reste **invisible**.

### 4.2 A2 — Soustractions associées

Sur le modèle de la division (« le chemin à l’envers »), une addition bien ancrée ouvre ses deux
soustractions. Par exemple, `8 + 5 = 13` ouvre `13 − 5` et `13 − 8`.

- **Clé** : `sub:total:part`.
- **Aide** : la famille de calcul « quand tu sais 8 + 5 = 13, tu sais aussi 13 − 5 = 8 ».

### 4.3 C1 — Calcul avec les centaines et les milliers (numération)

Nombres et résultats ≤ 10 000. Le calcul s’appuie sur la valeur de position, sans retenue mentale
complexe. Les familles s’ouvrent dans l’ordre du tableau.

| Famille                      | Exemples                                     |
| ---------------------------- | -------------------------------------------- |
| centaines rondes             | `300 + 400`, `900 − 600`                     |
| dizaines rondes              | `450 + 30`, `680 − 50`                       |
| ± 10 / ± 100                 | `395 + 10`, `802 − 100`                      |
| vers la centaine             | `380 + … = 400`, `35 + … = 100`              |
| vers 1 000                   | `… + 300 = 1 000`, `750 + … = 1 000`         |
| doubles et moitiés           | `2 × 250`, moitié de 600, moitié de 1 200    |
| milliers ronds               | `3 000 + 4 000`, `9 000 − 2 000`             |
| centaines sur les milliers   | `4 500 + 300`, `6 200 − 400`                 |
| ± 10 / ± 100 / ± 1 000       | `3 990 + 10`, `5 020 − 100`, `8 400 + 1 000` |
| vers le millier, vers 10 000 | `4 700 + … = 5 000`, `… + 3 000 = 10 000`    |

Les doubles et moitiés reprennent la liste exacte du programme (doubles de 100, 150, 200, 250,
300, 400, 500 et 600 ; moitiés de 200, 300, 400, 500, 600, 800, 1 000 et 1 200).

- **Mode** : pavé numérique dès le départ, car ces calculs se lisent mal en QCM. La première
  rencontre de chaque famille passe par 4 tuiles.
- **Clé** : une clé par famille, et non par item, car les items sont générés. Par exemple :
  `numeration:round-100`, `numeration:round-1000`, `numeration:step-10`, `numeration:complement-1000`,
  `numeration:double-half`.
- **Aide** : des blocs de base dix dessinés en SVG (gros cube = 1 000, plaque = 100, barre = 10,
  cube = 1), c’est-à-dire
  le matériel multibase cité par le programme. Le bloc qui change est mis en valeur.

### 4.4 C2 — Ajouter ou retirer 9, 19, 29, 39 (et 8, 18, 28, 38)

- **Énoncé** : `247 + 29`, `563 − 19`, `128 + 38`, puis `2 347 + 29` au niveau 4 chiffres. Le
  résultat est ≤ 10 000.
- **Mode** : pavé numérique.
- **Clé** : `nearten:add:9`, `nearten:add:19`, …, `nearten:sub:39`. Cela fait 12 clés.
- **Aide** : la procédure officielle sur une droite numérique, en deux bonds : `+ 30` puis `− 1`,
  avec la phrase « − 29, c’est − 30 puis + 1 ».

### 4.5 C3 / C4 — Additions et soustractions posées

C’est la vraie nouveauté d’interaction de ce sentier.

- **Énoncé** : des nombres posés en colonnes (m, c, d, u), avec le signe à gauche et le trait de
  résultat. Termes et résultat sont ≤ 10 000. La taille augmente par niveaux : 2 chiffres, puis 3,
  puis 4. L’addition passe aussi à trois termes, comme l’exemple de CE1 `76 + 7 + 568`.
- **Saisie** :
  - Les cases du résultat se remplissent de droite à gauche. La case active est mise en valeur et
    passe à gauche après chaque chiffre.
  - Les **retenues** sont facultatives. Elles ne sont jamais notées, mais elles sont enregistrées
    pour l’aide. Leur place dépend de la méthode (voir plus bas).
  - Le pavé est le pavé numérique existant. Une touche ✓ valide l’ensemble, et « ⌫ » efface la case
    active ou recule d’une case.
- **Correction** : on note le résultat final. Si c’est faux, la **première colonne fausse** (de
  droite à gauche) est soulignée doucement, sans rouge.
- **Aide** : la colonne concernée en blocs de base dix, avec l’échange expliqué (« 10 unités font
  1 dizaine : je la note en retenue »).
- **Niveaux** : la clé encode la taille et la difficulté. Par exemple `column:add:3d:carry-1`,
  `column:add:4d:carry-2`, `column:add:3-terms`, `column:sub:3d:borrow-1`, plus `column:sub:zero`
  pour les zéros au milieu, comme `503 − 128` ou `3 000 − 2 158`.

#### Méthode de la soustraction posée

Le programme laisse le choix entre deux algorithmes, « par cassage » ou « par compensation ». Il
demande qu’une école garde **un seul et même algorithme** du CE1 au CM2.

Ce qu’on observe chez les enseignants et les parents :

- La **compensation** est la méthode « traditionnelle » en France, celle que la plupart des parents
  ont apprise. Sur les forums d’enseignants, elle reste un peu plus citée à l’échelle de l’école :
  en 2025, 3 écoles contre 2 dans un fil récent. Les enseignants lui reconnaissent de rester légère
  avec les grands nombres et les zéros, et de préparer la division posée.
- Le **cassage** gagne du terrain en CE1 et CE2, car il se comprend mieux avec le matériel. Dans un
  fil plus ancien (2017), les cinq enseignants qui répondent le préfèrent. Ses limites sont
  connues : les zéros (`3 000 − 2 158`) deviennent lourds à écrire, et les parents sont perdus pour
  aider aux devoirs.
- Certaines méthodes (Cap Maths, Brissiaud) commencent par le cassage puis passent à la
  compensation.

**Décision.** Le défaut est la **compensation**. Le parent peut choisir le **cassage** dans Famille,
pour suivre l’école. Comme seul le résultat est noté, ce choix ne change que deux choses :

| Méthode      | Retenues à l’écran                                                                                                                           | Aide                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| compensation | un petit « 1 » devant le chiffre du haut, et un petit « + 1 » sous la colonne suivante, en bas                                               | « j’ajoute 10 unités en haut et 1 dizaine en bas : l’écart ne change pas » |
| cassage      | on touche un chiffre du haut pour le « casser » : il est barré, remplacé par le chiffre moins 1, et la colonne de droite reçoit « 1 » devant | « je casse 1 dizaine en 10 unités » avec les blocs base dix                |

- **Latence** : elle est **ignorée** dans la maîtrise. Une opération posée n’est pas un fait à
  restituer vite.
- **Rappel** : une opération posée est toujours en production. Il n’y a pas de mode tuiles pour
  C3 et C4.

### 4.6 F1 — Lire une fraction d’un tout

- **Représentation** : une **plate-bande** (rectangle long) partagée en parts égales, dont certaines
  sont plantées de fleurs. Plus rarement, un **pot rond** vu de dessus, partagé en secteurs. Les
  dessins sont en SVG code, avec les tokens `--garden-*` : terre, feuille, fleurs. Il n’y a pas de
  nouvelle image générée.
- **Énoncé** : « quelle part de la plate-bande est fleurie ? ». La variante inverse demande de
  toucher les parts pour fleurir 3/8 de la plate-bande.
- **Découverte** : 4 tuiles fraction. Les leurres sont l’inversion n/d, les parts vides, et le
  nombre de parts fleuries sur le nombre de parts vides.
- **Rappel** : le **pavé fraction** (§5.1), ou l’action de fleurir les parts en les touchant.
- **Clé** : `frac:read:{d}`, une par dénominateur de 2 à 12.

### 4.7 F2 — Fractions égales

- **Énoncés** :
  - Numérateur manquant : `?/8 = 1/2`. Le programme cite cet exemple ; la réponse se fait au pavé
    numérique classique.
  - Dénominateur manquant : `3/4 = 6/?`.
  - « Lesquelles sont égales à 1/2 ? » : 4 ou 5 tuiles, **sélection multiple**, puis ✓.
- **Contrainte** : le dénominateur est ≤ 12, et un dénominateur est multiple de l’autre (2↔4↔8,
  2↔6↔12, 3↔6↔12, 4↔12, 5↔10).
- **Clé** : `frac:equal:{petit d}-{grand d}`. Par exemple `frac:equal:2-8`.
- **Aide** : deux plates-bandes superposées, alignées, avec la phrase du programme : « si je fais
  des parts deux fois plus petites et que j’en prends deux fois plus, j’en prends autant ».

### 4.8 F3 — La bande graduée

Elle correspond au travail de période 3 sur la **bande-unité**.

- **Représentation** : une règle-unité de 0 à 1 (jusqu’à 2 au maximum pour « 1 unité + … »),
  graduée en d-ièmes avec d dans {2, 3, 4, 5, 6, 8, 10, 12}. Une coccinelle (le motif ambiant
  existant) se pose sur une graduation.
- **Énoncés** :
  - Lire : « où est la coccinelle ? ». La réponse est une fraction, ou « 1 unité + n/d ».
  - Placer : « pose la coccinelle sur 3/4 ». L’enfant **touche une graduation**.
  - Égalité : la règle est graduée en dixièmes et on demande « pose-la sur 1/2 ».
- **Rappel** : placer et lire au pavé fraction sont tous deux de la production.
- **Clé** : `frac:line:{d}` et `frac:line:mixed`.
- **Accessibilité** : les graduations sont des boutons avec un nom accessible (« trois quarts »).
  On peut aussi les parcourir avec les flèches du clavier.

### 4.9 F4 — Comparer

- **Énoncé** : `5/12 ☐ 7/12`. L’enfant répond avec trois grosses tuiles `<`, `=`, `>`.
- **Cas** : les trois cas du programme. Même dénominateur, même numérateur, ou un dénominateur
  multiple de l’autre (`7/12 ☐ 5/6`). Les égalités sont incluses.
- **Preuve** : comme l’interface reste un choix (une chance sur trois au hasard), F4 devient « bien
  ancré » sur **6 réussites réparties sur au moins 3 jours**, et non pas après deux rappels comme
  ailleurs.
- **Clé** : `frac:compare:same-d`, `same-n`, `multiple-d`.
- **Aide** : les deux fractions sur deux bandes de même longueur, alignées.

### 4.10 F5 — Ajouter et retirer des fractions

- **Énoncés** : `2/8 + 3/8`, `7/10 − 4/10`, `1/2 + 1/4`, `5/6 − 1/3`, et le complément
  `1 − 3/8`.
- **Contraintes** : le dénominateur est ≤ 12, tous les termes et le résultat sont ≤ 1, et le
  résultat est ≥ 0. Les dénominateurs sont égaux, ou l’un est multiple de l’autre.
- **Petite histoire** (au plus une par séance) : par exemple l’énoncé du gâteau du programme,
  réécrit au jardin : « Miffy arrose 1/10 de la plate-bande, Fenna 3/10… quelle part reste à
  arroser ? ». L’histoire est courte, au présent, et utilise le personnage du profil.
- **Réponse** : le pavé fraction.
- **Équivalences acceptées** : toute fraction égale au résultat, avec un dénominateur ≤ 12, est
  juste (`3/4` ou `6/8`). `1` et `d/d` sont acceptés. Le retour affiche la forme attendue, avec la
  forme de l’enfant si elle diffère : « oui ! 6/8, c’est aussi 3/4 ♡ ».
- **Clé** : `frac:add:same-d`, `frac:sub:same-d`, `frac:add:multiple-d`, `frac:sub:multiple-d`,
  `frac:complement`.
- **Aide** : la plate-bande se remplit de chaque terme, avec le repartage animé en parts plus
  petites quand les dénominateurs diffèrent.

## 5. Nouvelles briques d’interface

Toutes ces briques s’ajoutent à `apps/web/src/components/`. Elles réutilisent `.answer-tile`,
`.keypad-grid`, `.feedback-tray` et les tokens existants.

### 5.1 Pavé fraction (`fraction-keypad.tsx`)

- **Saisie** : deux cases empilées, le numérateur au-dessus du trait et le dénominateur en dessous.
  La case active a le contour `--action-primary`.
- **Pavé** : le pavé existant (0–9, ⌫, ✓) plus une touche « ↕ » qui change de case.
  - Quand le numérateur est saisi, ✓ ne valide pas encore : il passe au dénominateur. Une seconde
    pression sur ✓ valide.
  - Chaque case accepte 2 chiffres au plus.
- **Forme mixte** : pour F3, un interrupteur « + 1 unité » ajoute une partie entière (0, 1 ou 2)
  devant la fraction.
- **Accessibilité** : le nom accessible est lu en toutes lettres (« trois huitièmes »).

### 5.2 Opération posée (`column-operation.tsx`)

- La grille est monospace, avec les chiffres centrés. Les cases de retenue sont en `--ink-muted`,
  plus petites, au-dessus de chaque colonne.
- Une colonne mesure 44 pt de large au minimum (cible tactile iPhone). Avec 5 colonnes (10 000) et
  celle du signe, la grille mesure 264 pt et tient en largeur 320.
- Les cases de retenue suivent la méthode de soustraction choisie (§4.5).
- Le focus du lecteur d’écran suit la case active. Chaque case s’annonce par exemple « chiffre des
  dizaines du résultat ».

### 5.3 Représentations de fractions (`fraction-figure.tsx`)

- Plate-bande, pot et règle-unité sont trois rendus SVG d’une même description
  `{ shape, denominator, filled[] }`.
- Les couleurs viennent de `--garden-soil-*`, `--garden-leaf-*` et `--garden-bloom-*`. Les parts
  fleuries ne se distinguent pas **que** par la couleur : une petite fleur dessinée les marque.
- Le mode sombre vient des tokens existants.
- En mouvement réduit, aucun repartage n’est animé : on fait un fondu simple.

### 5.4 Sélection multiple et comparaison

- `ChoiceGrid` accepte `mode: 'single' | 'multiple' | 'comparison'`. En sélection multiple, la tuile
  choisie est remplie en `--surface-success`, et un bouton ✓ apparaît.
- Les tuiles sont repérées par un identifiant, et non plus par leur valeur numérique.

### 5.5 Écran d’exercice

`practice-screen.tsx` choisit un **rendu par type de question**. Pour l’enfant, le reste ne change
pas : la barre du haut, les points de progression, la réaction du personnage, le plateau de retour,
« tu veux un petit indice ? » et les confettis.

## 6. Séances

### 6.1 L’arrosage du jour

L’arrosage du jour reste **un seul bouton**. Le planificateur mélange les sentiers activés :

1. Il priorise les révisions dues dans tous les sentiers, avec le même score qu’aujourd’hui.
2. Il ajoute au plus **2 nouveautés** par séance, toutes compétences confondues.
3. Si le parent a **mis une activité en avant** (§3.1), elle occupe environ la moitié des points de
   la séance. Le reste sert aux révisions dues.
4. Il garde au plus **2 types d’interaction** par séance (par exemple pavé numérique et pavé
   fraction), pour que la séance reste calme.
5. Il groupe les questions d’un même type d’interaction en petits blocs. À l’intérieur d’un bloc,
   les compétences s’entrelacent.

Un bloom par jour reste attaché à l’arrosage du jour, comme aujourd’hui.

### 6.2 Poids et durée

Chaque question a un poids, pour que la séance reste autour de 90 secondes. La séance vise un
total de **8 points**, entre 6 et 10.

| Type de question                      | Poids |
| ------------------------------------- | ----- |
| fait (×, ÷, +, −), C1, C2, F1, F2, F4 | 1     |
| F3, F5                                | 1,5   |
| opération posée (C3, C4)              | 3     |

Une séance contient au plus 2 opérations posées.

### 6.3 « Choisis un petit chemin »

La feuille existante reçoit une rangée par sentier activé :

- « les petites additions » ;
- « les grands nombres » : calcul malin, ou opérations posées ;
- « les fractions » : avec une puce par compétence ouverte.

Une séance ciblée suit la règle de `focusTable` : n − 2 questions de la compétence choisie et 2
questions entrelacées.

## 7. Progrès, récompenses et textes

### 7.1 Stats

`StatsScreen` reçoit une section par sentier activé. Chaque compétence a une carte sur le modèle de
`TableProgressCard` :

- un titre, par exemple « fractions égales » ;
- une mini-représentation, par exemple deux petites bandes ;
- la barre « bien ancré / en train de pousser / à découvrir » ;
- le bouton « choisir ce chemin ».

Les compétences à items générés (C1–C4, F3–F5) n’ont pas de faits dénombrables. Leur barre montre
les niveaux de la compétence, par exemple `carry-0 / carry-1 / carry-2`.

### 7.2 Jardin

- **Blooms** : rien ne change, un par jour d’arrosage terminé.
- **Portes des coins du jardin** (5, 15, 30 calculs bien ancrés) : elles comptent déjà toutes les
  clés `fluent`. Les nouvelles clés y contribuent. Le texte « Il faut aussi réussir {required}
  multiplications sans aide » devient « … calculs sans aide ».
- **Pas de récompense dédiée** : les nouveaux sentiers font partie du même jeu. Ils font pousser le
  même jardin, avec les mêmes blooms et les mêmes coins, sans décoration ni collection à part.

### 7.3 Ton et vocabulaire

Le ton reste en minuscules, doux, avec la métaphore du jardin et « ♡ ». Exemples :

- Retour juste : « oui ! 276 ♡ », « oui ! 3/4 ♡ ».
- Retour faux : « presque — c’est 276 », « presque — c’est 3/4 ».
- Aide : « tu veux un petit indice ? ».
- Vocabulaire du programme, glissé dans les aides et jamais exigé : « la somme de 247 et 29 est
  276 » ; « 6 huitièmes, c’est pareil que 3 quarts ».

### 7.4 i18n

Toutes les nouvelles clés existent en `en`, `fr` et `zh-Hans`, puisque `Record<TranslationKey,
string>` l’impose déjà.

Un utilitaire `fractionInWords(n, d, locale)` gère les noms de fractions :

- **fr** : « un demi », « trois quarts », « cinq douzièmes ». Les exceptions demi, tiers et quart
  sont traitées.
- **en** : « one half », « three quarters », « five twelfths ».
- **zh-Hans** : « 四分之三 ». Le glossaire de `ZH_HANS_INTEGRATION.md` est à compléter (分数 fraction,
  分子 numérateur, 分母 dénominateur, 竖式 opération posée, 进位 / 退位 retenue).

Le texte des rappels push dit aujourd’hui « tables ». Il devient neutre : « un petit calcul fera
pousser ton jardin ♡ ».

## 8. Découpage en livraisons

Chaque phase est une PR séparée, vérifiée par `pnpm check` et `pnpm doctor`.

| Phase                                                 | Contenu                                                                                                                                                                                                                                       | Visible ? |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 0. Fondations                                         | Union de types question et réponse ; événement v2 (§9) ; validation serveur par type ; générateurs déterministes ; `fractionInWords` ; réglages du profil (mode auto ou manuel, compétences, activité mise en avant, méthode de soustraction) | non       |
| 1. Petites additions + grands nombres (calcul mental) | A1, A2, C1, C2 jusqu’à 10 000 avec le pavé existant (5 chiffres), les aides « passer par 10 », droite numérique et blocs base dix, l’ouverture automatique, l’écran Famille et la section Stats                                               | oui       |
| 2. Opérations posées                                  | `column-operation.tsx`, C3 et C4 jusqu’à 4 chiffres, les deux méthodes de soustraction, poids de séance                                                                                                                                       | oui       |
| 3. Fractions                                          | `fraction-figure.tsx`, `fraction-keypad.tsx`, F1 à F5, sélection multiple et comparaison                                                                                                                                                      | oui       |
| 4. Petites histoires                                  | problèmes courts en une ou deux étapes, au jardin, pour les trois sentiers                                                                                                                                                                    | oui       |

## 9. Impacts techniques

### 9.1 Domaine (`packages/domain`)

`PracticeQuestion` devient une union discriminée par `kind` :

```ts
type PracticeQuestion =
  | MultiplicationQuestion // existant : left, right, operation 'multiply' | 'divide'
  | AdditionFactQuestion // left, right, operation 'add' | 'subtract', blank: 'result' | 'left' | 'right'
  | MentalCalcQuestion // skill, left, right, operation, blank
  | ColumnOperationQuestion // operation, top, bottom
  | FractionQuestion // skill, payload (figure, termes, graduation…)

type PracticeAnswer =
  | { type: 'integer'; value: number }
  | { type: 'fraction'; whole: number; numerator: number; denominator: number }
  | { type: 'comparison'; symbol: '<' | '=' | '>' }
  | { type: 'tick'; index: number }
  | { type: 'selection'; ids: ReadonlyArray<string> }
```

- `isCorrect(question, answer)` remplace `selected === correctAnswer`. Il gère les équivalences de
  fractions.
- Les générateurs prennent la graine de séance en entrée, comme aujourd’hui (temps et hasard
  explicites, voir `CODING_STANDARDS.md`).
- `updateMastery` reste le même modèle. Seules deux choses sont paramétrées **par compétence** :
  - la preuve de rappel, c’est-à-dire ce qui compte comme « keypad » (le pavé fraction ou la
    graduation touchée comptent comme rappel ; pour F4, voir §4.9) ;
  - la prise en compte de la latence, ignorée pour C3 et C4.
- `LearningProgress` reçoit `paths: PathProgress[]` à côté de `tables`.
- Ajout de tests de propriétés fast-check :
  - les générateurs respectent les bornes (≤ 10 000, d ≤ 12, fractions ≤ 1) ;
  - `isCorrect` accepte toute fraction équivalente ;
  - le rejeu d’un même événement reste idempotent.

### 9.2 Événements, stockage et synchronisation

- `AttemptEvent` reçoit un champ `exercise` (union : `kind` + paramètres complets de la question) et
  un champ `answer` (`PracticeAnswer`).
- Les événements sans `exercise` restent interprétés comme aujourd’hui (multiply et divide). Il n’y
  a pas de migration de données, et le rejeu côté serveur continue de fonctionner.
- `left`, `right`, `selected` et `choices` restent remplis pour les anciens types, et facultatifs
  pour les nouveaux.
- **Dexie** :
  - les schémas Effect `AttemptEventSchema`, `StoredPracticeQuestionSchema` et
    `SessionCompletionSchema.finalAnswer` deviennent des unions ;
  - les index ne changent pas (`factKey` reste la clé de compétence) ;
  - une montée de version Dexie n’est utile que si un index change.
- **Serveur** :
  - `AttemptEventSchema` dans `http/app.ts` accepte l’union ;
  - `attempt-ingestion.ts` valide chaque `kind` : il vérifie les bornes, **recalcule la bonne
    réponse depuis les paramètres** et vérifie `correct` ;
  - les bornes actuelles (1..144, 1..12) ne s’appliquent qu’aux multiplications et divisions.
- **Profil** : `schemaVersion` 3 ajoute :

  ```ts
  learningPaths: {
    mode: 'automatic' | 'manual'
    enabledSkills: ReadonlyArray<SkillId> // utilisé en mode manuel
    closedPaths: ReadonlyArray<PathId> // sentiers fermés à la main
    focusSkill: SkillId | null // « en ce moment à l’école »
    subtractionMethod: 'compensation' | 'decomposition'
  }
  ```

  Le repository Mongo migre en lecture : une v2 donne `{ mode: 'automatic', enabledSkills: [],
closedPaths: [], focusSkill: null, subtractionMethod: 'compensation' }`.

- **Ouverture automatique** : c’est une fonction pure du domaine,
  `deriveOpenPaths(snapshot, learningPaths)`, et non un état stocké. Le serveur et le client arrivent
  donc au même résultat en rejouant les événements.
- **Pavé numérique** : la limite passe de 3 à 5 chiffres (10 000), y compris dans `fact-rescue`.

### 9.3 Fichiers web les plus touchés

- `practice-screen.tsx` : rendu par `kind`. Les opérateurs ne sont plus une condition ternaire,
  mais une table `+ − × ÷`.
- `session-insight-copy.ts` : `displayFact` s’appuie sur un formateur par `kind`, et non plus sur
  une regex.
- `fact-rescue.tsx` : aides par compétence.
- `home-screen.tsx`, `stats-screen.tsx`, `family-screen.tsx`, `i18n-catalog.ts`.
- Les `manifest-*.webmanifest` : description plus générale.

## 10. Grille d’évaluation (§4.30)

Score de 0 à 2 sur chaque critère :

| Critère                         | Additions/centaines | Fractions | Commentaire                                                                |
| ------------------------------- | ------------------- | --------- | -------------------------------------------------------------------------- |
| améliore la récupération        | 2                   | 2         | aligné sur le programme suivi en classe                                    |
| motive le retour                | 1                   | 2         | la nouveauté visuelle des plates-bandes                                    |
| réduit l’anxiété ou la friction | 1                   | 1         | les opérations posées sont plus longues ; aucun chrono, un poids de séance |
| reste clair hors ligne          | 2                   | 2         | génération et correction locales                                           |
| respecte la séance de 90 s      | 1                   | 2         | au plus 2 opérations posées                                                |
| mesurable sans pistage invasif  | 2                   | 2         | mêmes événements                                                           |
| accessible                      | 2                   | 1         | les figures demandent un vrai travail d’ARIA                               |
| coût acceptable                 | 1                   | 1         | aucune nouvelle illustration générée ; deux nouvelles interactions         |

## 11. Décisions et questions ouvertes

### Décisions prises (2026-10-05)

1. **Activation** : automatique dans l’arrosage du jour quand les tables de 1 à 10 sont acquises.
   Le parent peut aussi ouvrir à la main, choisir les compétences ou mettre une activité en avant
   (§3.1).
2. **Plafond** : tout le champ du CE2, jusqu’à 10 000, par niveaux de chiffres (§1, §4.3, §4.5).
3. **Soustraction posée** : compensation par défaut, cassage au choix du parent (§4.5).
4. **Arrosage du jour** : les sentiers ouverts se mélangent selon les révisions dues (§6.1). Il n’y
   a pas de « sentier du jour » en rotation.
5. **Fractions non simplifiées** : toujours acceptées en F5, puisque le programme ne demande pas de
   simplifier (§4.10).
6. **Récompenses** : pas de récompense dédiée. Les nouveaux sentiers font partie du même jeu
   (§7.2).

### Reporté

- **Nom de l’app** : on garde « little tables » pour l’instant. Seules les descriptions des
  manifestes et les rappels deviennent plus généraux (§7.4, §9.3).

### Sources des décisions

- Programme du cycle 2, annexe 4 : CE1, « un unique et même algorithme sera privilégié au niveau
  d’une école » ; CE2, champ numérique jusqu’à 10 000.
- Forums Enseignants du primaire : « Méthodes pour la soustraction » (juillet 2025) et « Quelle TO
  pour la soustraction en CE2 ? » (novembre 2017).
- Pass Education, « Quelles sont les 2 techniques de soustraction ? » : la compensation y est
  présentée comme la technique usuelle en France.
