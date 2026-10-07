# Conjugaison du CE2 : verbes du 2e et du 3e groupe — spécification produit

Statut : révision 3 (6 octobre 2026) : points ouverts tranchés (§12), périmètre validé, catalogue exhaustif et 1er groupe
ajoutés avec la spec technique `docs/conjugation/TECHNICAL_SPEC.md`  
Date : 2026-10-06  
Périmètre : ajouter à little tables un sentier « conjugaison » que le parent compose à partir d’un
catalogue de verbes, d’abord ceux du 2e et du 3e groupe (plus les auxiliaires être et avoir), aux
quatre temps du programme de CE2.

Ce document suit le modèle de `CE2_MATH_EXPANSION_SPEC.md` et reste compatible avec
`docs/rewrite/TECHNICAL_SPEC.md` (moteur partagé Rust, `/api/v2`, hors-ligne d’abord) et avec les
principes produit de `TECHNICAL_PLAN.md` §1. Les maquettes sont au board **R6 · Conjugaison** de
[`design/little-tables-rewrite.pen`](design/little-tables-rewrite.pen) (écrans P1 à P3, C11 à C13 et
D7). Les décisions proposées et les questions ouvertes sont regroupées en §12.

## 1. Référence officielle

Source : programme de français du cycle 2 (arrêté du 31 octobre 2024, applicable à la rentrée 2025),
partie « Étude de la langue », et les fiches d’accompagnement publiées sur éduscol (évaluations
nationales, fiches d’intervention « Maîtriser l’accord du verbe avec son sujet », novembre 2024).

Ce que le programme attend, année par année :

| Année | Attendu                                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP    | Conjuguer être et avoir au présent                                                                                                                                                                              |
| CE1   | Conjuguer au présent, à l’imparfait, au futur puis au passé composé être, avoir et les verbes du 1er groupe                                                                                                     |
| CE2   | Conjuguer au présent, à l’imparfait, au futur et au passé composé être, avoir, les verbes du 1er groupe **et les verbes irréguliers du 3e groupe : faire, aller, dire, venir, pouvoir, voir, vouloir, prendre** |
| CM1   | Les mêmes temps pour les verbes du 2e groupe, et confirmation des huit verbes irréguliers                                                                                                                       |
| CM2   | Passé simple et plus-que-parfait ; accord du participe passé employé avec être                                                                                                                                  |

Points à retenir pour l’app :

- **Les quatre temps** sont le présent, l’imparfait, le futur et le passé composé de l’indicatif.
- **Le 2e groupe n’est pas nommé en CE2** dans le programme 2025 : il arrive officiellement en CM1.
  Beaucoup de classes et de manuels de CE2 présentent pourtant _finir_ dès le CE2, d’où la demande du
  parent. Le catalogue le propose donc, mais rien ne s’ouvre sans que le parent le coche (§3).
- La fiche éduscol rappelle les **marques de personne stables** à tous les temps : tu → -s, nous →
  -ons, vous → -ez, ils / elles → -nt ; et, pour les groupes autres que le premier, je → -s ou -x et
  il → -t ou -d. Elle insiste sur le fait que « l’appui sur l’oral ne suffit pas à orthographier »
  (vole / volent) : la conjugaison est d’abord une affaire d’orthographe.
- Elle classe les erreurs des élèves en quatre familles : confusion des marques du pluriel, non
  prise en compte du pluriel, erreur de temps, et désinence incorrecte mais phonétiquement
  cohérente. Ces quatre familles sont la base de nos leurres (§4.3).
- Elle recommande « des exercices courts, systématiques et quotidiens » et des jeux : étiquettes
  pronom / forme conjuguée, memory, classements, devinettes. C’est exactement le format d’un
  arrosage du jour.

## 2. Principes à préserver

Les principes de `TECHNICAL_PLAN.md` §1 et de la spec CE2 (§2) s’appliquent tels quels. Trois
principes propres à ce sentier s’y ajoutent :

1. **L’orthographe est le but.** On ne note pas « ça se dit comme ça » mais « ça s’écrit comme ça ».
   Les accents, les doubles lettres et les marques muettes comptent. Le retour reste doux et explique
   la marque manquante.
2. **Le parent compose, l’app ne devine pas.** Aucun verbe ne s’ouvre tout seul : le sentier existe
   quand le parent a coché au moins un verbe et un temps. Un « programme du CE2 » prêt à cocher
   évite la page blanche.
3. **Le contenu reste en français.** Le verbe, le pronom et le nom du temps s’affichent en français
   quelle que soit la langue de l’interface, car c’est la langue qu’on apprend. Seuls les textes de
   l’interface (consignes, retours, écrans parent) sont traduits.

## 3. Organisation : un sentier « la conjugaison »

Le sentier s’ajoute aux trois sentiers de mathématiques. Il n’a pas de compétences fixes : chaque
**verbe** coché est une compétence, et chaque **temps** coché en est un niveau.

| Sentier (fr)   | Sentier (en) | Compétences                                                                               |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| la conjugaison | conjugation  | un verbe du catalogue par compétence · niveaux = présent, imparfait, futur, passé composé |

### 3.1 Activation : toujours par le parent

- Le sentier est **fermé par défaut**. Un profil existant ne voit aucun changement.
- Dans Famille → enfant → **À l’école**, un groupe « Conjugaison » apparaît sous les sentiers de
  maths (maquette P1) :
  - **« Les verbes »** ouvre le catalogue (P2). Le détail de la ligne indique le nombre de verbes
    cochés et les premiers d’entre eux (« finir, grandir, aller… »).
  - **Quatre interrupteurs**, un par temps. Ils valent pour tous les verbes cochés : « en ce moment
    on fait l’imparfait » se règle en un geste.
  - **« En ce moment en classe »** accepte un couple verbe · temps (« finir · au présent »). Comme
    pour les maths, il occupe environ la moitié des points de l’arrosage (§6.1).
- Le mode **Automatique / Je choisis** des sentiers de maths ne concerne pas la conjugaison : il n’y
  a pas d’ouverture automatique à proposer. Le groupe l’indique en une ligne.
- **Cocher le passé composé coche aussi être et avoir au présent** (ligne explicative sous
  l’interrupteur), car l’auxiliaire est la moitié de la réponse. Le parent peut les décocher
  ensuite dans le catalogue, à ses risques.

### 3.2 Le catalogue (maquette P2)

Un seul écran, derrière le code parent, avec :

- une **recherche** par infinitif (sans accent obligatoire : « reflechir » trouve _réfléchir_) ;
- une carte **« Le programme du CE2 »** avec un bouton « Tout cocher » pour les huit verbes
  irréguliers attendus ;
- des **sections** dans cet ordre : 3e groupe · au programme (les huit), 2e groupe, 3e groupe ·
  autres, les auxiliaires (être, avoir) ;
- une **ligne par verbe** : infinitif, trois formes témoins (« je finis · nous finissons · ils
  finissent ») et un interrupteur ;
- une **fiche verbe** en feuille (P3) au toucher de la ligne : les six formes du temps choisi avec
  la terminaison en rose, un sélecteur des quatre temps, l’interrupteur « dans l’arrosage de
  {name} » et le bouton « en ce moment en classe ». La fiche sert aussi au parent pour les devoirs.

**Périmètre du catalogue** (révision 2). La **recherche couvre tout le lexique** : les 7 771
verbes non défectifs du Lefff (voir `docs/conjugation/TECHNICAL_SPEC.md` §1), ce qui règle les
demandes au cas par cas (_apercevoir, sourire, essayer, servir, comprendre, apprendre_…). Les
**sections** du catalogue, elles, n’affichent que des listes relues (annexe A) : les huit verbes du
programme et leur famille (revenir, devenir, tenir, apprendre, comprendre, refaire, revoir), les
verbes du 2e groupe les plus fréquents en classe, les verbes du 3e groupe courants (partir,
sortir, dormir, lire, écrire, mettre, boire, savoir, devoir, croire, vivre, ouvrir, offrir,
attendre, entendre, répondre, perdre, connaître, courir, rire, suivre, recevoir…), les verbes du
1er groupe courants, et deux impersonnels (falloir, pleuvoir, conjugués à _il_ seulement). Un
verbe trouvé par la recherche mais absent des sections apparaît sous « Autres verbes » une fois
coché.

Le 1er groupe (-er) **entre aussi dans le catalogue** (révision 2) : la spec technique montre qu’il
se conjugue entièrement par règles depuis l’infinitif, donc sans données à embarquer, et des
parents demandent déjà _essayer_. Il n’a pas de section mise en avant au-delà de « 1er groupe ·
courants » : on le trouve par la recherche.

### 3.3 L’item d’apprentissage : un verbe à un temps

La clé de maîtrise est `conj:{verbe}:{temps}`, par exemple `conj:finir:present`. La **personne** est
tirée à chaque question, de façon à ce que les six personnes se succèdent avant de revenir (tirage
sans remise dans la séance, puis mélange).

Pourquoi pas une clé par personne (`conj:finir:present:3p`) :

- 24 clés par verbe au lieu de 4 : avec au plus 2 nouveautés par arrosage, huit verbes demanderaient
  trois mois pour seulement être « vus ». La classe va plus vite que ça.
- Ce que l’enfant doit mémoriser, c’est le système du verbe à ce temps (radical qui change, marques
  de personne), pas six faits indépendants. Une erreur sur _nous pouvons_ rend bien « pouvoir au
  présent » fragile : la clé unique le reflète.
- La personne reste connue dans l’événement (§9.2) : « Ce qui coince » peut dire « finir au présent,
  surtout avec _nous_ et _vous_ » sans clé séparée.

Ordre d’arrivée des nouveautés : le **dernier verbe coché d’abord** (c’est celui que l’enfant voit
en classe), puis présent → imparfait → futur → passé composé parmi les temps cochés. Le couple mis en
avant passe devant tout le reste. Les clés d’un verbe décoché restent dans le snapshot (historique)
mais ne sont plus proposées.

## 4. Les exercices

### 4.1 « La forme qui manque » (exercice principal)

- **Énoncé** : une étiquette « finir · au présent » (bleu ciel, en haut), le pronom en très grand
  (« ils »), puis un trou à compléter. La consigne est lue à voix haute pour le lecteur d’écran :
  « ils… finir, au présent ».
- **Pronoms** : je (ou j’ devant voyelle), tu, il, elle, nous, vous, ils, elles. Les impersonnels
  n’utilisent que _il_.
- **Découverte** (reconnaissance) : 4 tuiles de mots (C11). Les leurres suivent §4.3.
- **Rappel** (production) : la **banque de lettres** (C12, §5.1). C’est la preuve de rappel qui
  fait « bien ancrer » la clé, comme le pavé pour les tables.
- **Passage de l’un à l’autre** : comme pour les tables, la découverte dure tant que la clé n’est
  pas « en train de pousser » (familiar) ; ensuite, rappel.
- **Correction** : comparaison **exacte** après normalisation de la casse, des apostrophes
  typographiques et des espaces. Les accents comptent : _allé_ et _alle_ ne sont pas la même forme.
  Au passé composé, la réponse est « auxiliaire + participe » (« ai fini », « sont allés »).
  La **forme de référence** suit l’orthographe rectifiée de 1990, celle du programme 2025 (_il
  épèle_, _j’espèrerai_, _il connait_) ; la forme traditionnelle (_il épelle_, _il connaît_) et
  _j’essaye_ à côté de _j’essaie_ sont acceptées comme justes (spec technique §1.4).
- **Retour** : « oui ! finissent ♡ » ou « presque — c’était finissent ». Deux retours précisés :
  - seule une lettre accentuée diffère : « presque — il manque l’accent : allé » ;
  - au passé composé avec être, pour je / tu / nous / vous, les formes accordées au féminin ou au
    pluriel (_allée_, _allés_, _allées_) sont **acceptées** et la forme de référence reste au
    masculin (l’accord avec être est un attendu de CM2, voir §12).
- **Latence** : **ignorée** dans la maîtrise. Écrire un mot n’est pas un fait à restituer vite, et la
  fiche éduscol ne fixe aucune fluence de conjugaison.
- **Clé** : `conj:{verbe}:{temps}` (§3.3).

### 4.2 Les indices (« tu veux un petit indice ? »)

Chaque indice montre la forme attendue **découpée** : radical, marque de temps, marque de personne
(C13 : `fin` · `iss` · `ent`, trois couleurs). Les stratégies, dans l’ordre proposé :

| Indice                   | Quand                                   | Exemple                                                                                     |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| la marque de la personne | erreur de personne ou de pluriel        | « avec _ils_ et _elles_, la marque, c’est -ent : ils finiss**ent** »                        |
| le radical qui change    | 3e groupe, radical irrégulier           | « _pouvoir_ a deux radicaux : je **peu**x, tu **peu**x, il **peu**t… nous **pouv**ons »     |
| le verbe cousin          | le verbe suit un modèle déjà bien ancré | « _tenir_ se conjugue comme _venir_ : tu viens, tu tiens »                                  |
| la marque du temps       | erreur de temps                         | « à l’imparfait, on entend -ait : il finiss**ait** » ; « au futur, c’est l’infinitif + -a » |
| auxiliaire + participe   | passé composé                           | « _avoir_ au présent, puis le participe : ils **ont** fin**i** »                            |

Les indices sont des textes et un découpage coloré : aucune nouvelle illustration.

### 4.3 Les leurres (4 tuiles)

Générés par règles à partir des quatre familles d’erreurs d’éduscol, puis dédoublonnés et mélangés
avec la graine de séance :

| Famille                                 | Règle                                                                   | Exemple pour « ils finissent » |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| autre personne, même temps              | une des cinq autres formes du même temps                                | vous finissez · il finit       |
| autre temps, même personne              | la forme du même pronom à un autre temps coché ou connu                 | ils finissaient · ils finiront |
| désinence phonétiquement cohérente      | tables de substitution : -ent ↔ -e / -es ; -ais ↔ -ai / -é ; -ons ↔ -on | finisse · finisent             |
| contamination du 1er groupe (2e groupe) | terminaison du 1er groupe sur le radical                                | ils finient · nous finons      |

Au moins un leurre « phonétiquement cohérent » quand il en existe un, jamais deux leurres de la
même famille si une autre famille est disponible, et jamais une forme qui serait juste pour un autre
pronom affiché (_finissent_ n’est pas un leurre de « elles finissent »).

### 4.4 Plus tard : « quel temps ? » et les étiquettes

Deux exercices secondaires, prévus en phase 3 (§10) :

- **« quel temps ? »** : une phrase courte (« Hier, ils finissaient leur dessin. »), trois grosses
  tuiles passé / présent / futur. C’est un attendu explicite du cycle 2.
- **les étiquettes** : associer pronoms et formes conjuguées, le jeu de la fiche éduscol.

## 5. Nouvelles briques d’interface

Dans `packages/ui`, sur les tokens existants.

### 5.1 La banque de lettres (`LetterBank`)

- **Principe** : les lettres de la réponse, plus 3 à 5 leurres choisis selon la confusion visée (par
  exemple _e_ et _z_ pour une marque de pluriel), mélangées par la graine. Les lettres accentuées
  (é, è, ê, î, ç…) sont des tuiles à part entière. Au passé composé, une tuile **espace**.
- **Pourquoi pas le clavier du téléphone** : il couvre la moitié de l’écran, propose la correction
  automatique et n’est pas lisible pour un enfant de 8 ans. Un clavier complet maison (AZERTY) ne
  tient pas en 320 pt avec des touches de 44 pt.
- **Le trou** : une case au-dessus du pavé, avec un curseur, remplie de gauche à droite. ⌫ efface la
  dernière lettre (la tuile redevient disponible), ✓ valide. Une tuile utilisée reste visible mais
  grisée.
- **Tailles** : touches ≥ 44 × 56 pt, six par rangée, deux rangées de lettres et une rangée
  d’actions. Au-delà de douze tuiles, une troisième rangée.
- **Clavier physique** (iPad) : les touches tapent les lettres, Backspace efface, Entrée valide.
- **Accessibilité** : chaque tuile annonce sa lettre ; la case annonce le texte en cours (« tu as
  écrit pouv ») ; la consigne lue indique le verbe et le temps.
- Composant : `letter-bank.tsx`, réutilisable pour de futures dictées.

### 5.2 Tuiles de mots (`AnswerTiles`)

Les tuiles existantes acceptent des mots : taille de police **adaptée à la longueur** (40 → 26 pt
au-delà de six lettres), une seule ligne, deux colonnes. Les noms accessibles épellent la forme si
elle est ambiguë à l’oral (« finissent, f-i-n-i-s-s-e-n-t »).

### 5.3 Étiquette verbe · temps et découpage de forme

- `VerbChip` : la pastille « finir · au présent » (fond ciel). Elle apparaît sur toutes les
  questions du sentier et dans les feuilles de séance.
- `FormBreakdown` : le découpage radical / marque de temps / marque de personne, trois couleurs
  (label, ciel, rose) et un souligné. Utilisé par les indices et par la fiche verbe du parent.

### 5.4 Écrans parent

- `VerbCatalogueScreen` (P2) : recherche, carte « programme du CE2 », sections, lignes avec
  interrupteur. Enregistrement optimiste comme l’écran À l’école.
- `VerbSheet` (P3) : la fiche verbe en feuille (Vaul), sélecteur de temps en contrôle segmenté.

## 6. Séances

### 6.1 L’arrosage du jour

Le planificateur existant s’applique. Ce qui change :

1. Les clés `conj:*` entrent dans le vivier avec les autres, avec le même score (dû, fragile,
   nouveauté).
2. Elles forment une **famille d’interaction** à part, « lettres ». La règle « au plus deux familles
   par séance » garde donc les séances calmes : une séance mêle au plus la conjugaison et une
   famille de maths.
3. Le couple **mis en avant** (« finir · au présent ») occupe environ la moitié des points, comme
   une compétence mise en avant en maths.
4. Au plus **2 nouveautés** par arrosage, conjugaison comprise (algorithme version 2).

### 6.2 Poids

| Question                            | Poids |
| ----------------------------------- | ----- |
| forme qui manque, tuiles            | 1     |
| forme qui manque, banque de lettres | 1,5   |

Écrire un mot lettre à lettre prend plus de temps qu’un chiffre ; le poids garde la séance autour
de 90 secondes.

### 6.3 « Autres séances » et « Mes verbes »

- La feuille **Autres séances** reçoit une section « la conjugaison » avec une puce par verbe coché.
  Une séance de verbe compte 8 questions sur ce verbe, dans les temps cochés, entrelacées de 2
  questions d’ailleurs (règle de `focusTable`).
- L’onglet **Progrès** reçoit une carte « mes verbes » dès qu’un verbe est coché. Elle ouvre
  l’écran **Mes verbes** (D7) : un tableau verbes × temps cochés, une pastille par case (bien
  ancré / en train de pousser / à découvrir), et le lancement d’une séance de verbe au toucher
  d’une ligne. « Mes chemins » reste réservé aux sentiers de maths.

## 7. Progrès, jardin et textes

### 7.1 Ce qui coince

La vue parent des difficultés liste une clé de conjugaison avec son libellé (« finir au présent »)
et, nouveauté, les **personnes qui posent problème**, calculées à partir des événements (la personne
et la réponse donnée sont dans l’exercice, §9.2) : « surtout avec _nous_ et _vous_ ». Les trois
erreurs les plus fréquentes sont citées telles qu’elles ont été écrites (« finisons »), car c’est ce
que le parent voit dans le cahier.

### 7.2 Jardin

Comme pour les maths : **pas de récompense dédiée**. Un bloom par arrosage terminé, et les clés de
conjugaison bien ancrées comptent dans les portes 5 / 15 / 30 (« calculs sans aide » devient
« réponses sans aide »).

### 7.3 Ton et vocabulaire

Minuscules, douceur, jardin, « ♡ ». Exemples :

- consigne : « touche la bonne forme », « écris la forme avec les lettres » ;
- retour juste : « oui ! finissent ♡ » ;
- retour faux : « presque — c’était finissent », « presque — il manque l’accent : allé » ;
- insight de célébration : « finir au présent est bien ancré ♡ », « tu as écrit pouvons sans aide » ;
- vocabulaire du programme, glissé dans les indices et jamais exigé : radical, terminaison, marque
  de personne, auxiliaire, participe passé.

### 7.4 i18n

- Les textes d’interface existent en `fr`, `en` et `zh-Hans`. Les noms des temps dans l’étiquette
  verbe restent en français partout (« au présent »), avec une aide traduite dans l’espace parent
  (« présent (present tense) »).
- Nouvelles clés : `path.conjugation`, `conj.tense.*`, `conj.pronoun.*`, `conj.hint.*`,
  `conj.catalogue.*`, `school.conjugation*`.
- Le glossaire `ZH_HANS_INTEGRATION.md` est à compléter (动词变位 conjugaison, 现在时 présent,
  未完成过去时 imparfait, 简单将来时 futur, 复合过去时 passé composé, 词根 radical, 词尾 terminaison).

## 8. Les écrans, maquette par maquette (board R6)

| Écran | Contenu                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1    | À l’école : les groupes de maths existants, puis « Conjugaison » (ligne Les verbes, 4 interrupteurs de temps, note) et le couple mis en avant         |
| P2    | Le catalogue : recherche, carte « Le programme du CE2 · Tout cocher », sections 3e groupe au programme / 2e groupe / 3e groupe autres                 |
| P3    | La fiche verbe en feuille : _finir_, modèle, sélecteur de temps, six formes avec terminaison en rose, « dans l’arrosage de Léa », mise en avant       |
| C11   | Séance, découverte : étiquette « finir · au présent », pronom « ils », trou, 4 tuiles (finissent, finisent, finissez, finissaient)                    |
| C12   | Séance, rappel : « nous », case de saisie « pouv▏ », banque de lettres (p o u v o n s + e z t a i), ⌫ et ✓                                            |
| C13   | Retour encourageant : bulle « Hmm… c’était finissent », indice « la marque de ils, c’est -ent » avec `fin · iss · ent`, Autre astuce, À moi d’essayer |
| D7    | Mes verbes : tableau verbes × temps cochés, une pastille par case, légende, séance de verbe au toucher d’une ligne                                    |

Restent à dessiner pendant l’implémentation : la question au passé composé (tuile espace), le
retour juste, la section conjugaison de la feuille Autres séances, « Ce qui coince » avec les
personnes, les états vides (aucun verbe coché), les versions sombres et la largeur 320.

## 9. Impacts techniques

### 9.1 Le catalogue de verbes (`crates/lt-domain`)

- Un fichier de données **embarqué dans le moteur** (`include_str!`), donc identique dans le
  navigateur et sur le serveur : `crates/lt-domain/data/verbs.json`.
- Par verbe : `id` (infinitif ASCII, clé), `infinitive`, `group` (2 ou 3, ou `aux`), `model`
  (verbe cousin, pour l’indice), `auxiliary` (avoir ou être), `participle`, `present` (six formes),
  `futureStem` (`finir-`, `ir-`, `fer-`, `pourr-`…), `imperfectStem` facultatif (seul _être_ en a
  besoin : `ét-`), `impersonal` facultatif, `programme` (vrai pour les huit).
- **Dérivation à l’exécution** : imparfait = radical de _nous_ au présent + -ais, -ais, -ait, -ions,
  -iez, -aient ; futur = `futureStem` + -ai, -as, -a, -ons, -ez, -ont ; passé composé = auxiliaire
  au présent + participe (avec accord pour les sujets féminins ou pluriels quand l’auxiliaire est
  être). Le fichier ne stocke donc que ce qui n’est pas dérivable : environ 15 Ko bruts, moins de
  5 Ko compressés, dans le budget WASM (300 Ko gzip, 247 Ko utilisés).
- **Production des données** : un script `tools/verbs/` génère le fichier à partir d’un lexique
  libre (Lefff, licence LGPL-LR) pour la liste de l’annexe A, puis le fichier est **gelé et relu à
  la main** ; les corrections se font dans le fichier, jamais en régénérant.
- **Tests** : propriété « tout verbe du 2e groupe se conjugue à partir de son radical » ; chaque
  verbe a six formes au présent, un participe, un radical de futur ; vecteurs dorés pour les huit
  verbes du programme aux quatre temps et six personnes (192 formes relues).

### 9.2 Moteur

- `PathId::Conjugation` et `SkillId::Conjugation` (une seule variante : la compétence est le verbe,
  porté par la clé). `skill_for_key` reconnaît `conj:{verbe}:{temps}` ; `interaction_family` renvoie
  `Letters` ; `skill_weight` renvoie 1 ou 1,5 selon le mode ; `latency_limit_ms` renvoie « aucune ».
- `LearningPathSettings` reçoit un champ **facultatif** `conjugation` (serde `default`) :

  ```ts
  conjugation?: {
    verbs: ReadonlyArray<string>      // ids du catalogue, ≤ 60
    tenses: ReadonlyArray<'present' | 'imperfect' | 'future' | 'past-perfect'>
    focus: { verb: string; tense: Tense } | null   // « en ce moment en classe »
  }
  ```

  Un profil sans ce champ est inchangé. `PUT /api/v2/family/profiles/{id}/learning-paths` et la
  colonne JSON `profiles.learning_paths` suffisent : **pas de migration, pas de nouvel endpoint**.
  Le serveur refuse un verbe hors catalogue (`invalid_learning_paths`).

- Nouvelle variante `Exercise::Conjugation { skill, verb, tense, person, expected, choices }` et
  nouvelle réponse `PracticeAnswer::Text { value }`. `expected_answer` recalcule la forme depuis le
  catalogue ; `is_exercise_answer_correct` applique la normalisation de §4.1 ;
  `validate_exercise_attempt` vérifie que `expected` correspond bien au catalogue (le serveur ne
  fait jamais confiance au client). `is_production_exercise` = `choices` vide.
- `create_session` ajoute les clés `verbs × tenses` au vivier quand le réglage est présent ; le
  focus conjugaison est traité comme `focus_skill` (moitié des points). **Les vecteurs dorés ne
  bougent pas** : sans réglage, aucune clé n’est ajoutée.
- `derive_learning_progress` ajoute `conjugation: { verbs: [{ id, tenses: [{ tense, state, counts }] }] }`
  à côté de `paths`, pour D7, la feuille Autres séances et l’écran parent.
- `derive_insights` lit la personne et la réponse dans l’exercice des événements pour §7.1.
- `describe_exercise` fournit l’énoncé parlé et les libellés (pronom avec élision, nom du temps).

### 9.3 Client

- `question-view.tsx` : rendu `conjugation` avec `VerbChip`, pronom, `AnswerTiles` (mots) ou
  `LetterBank`.
- `hints.tsx` : `FormBreakdown` et les cinq stratégies de §4.2.
- `format.ts` : `levelLabel` et `displayFact` pour `conj:*` (« finir au présent »).
- `child-screens.tsx` : groupe Conjugaison, nouvelles routes
  `/parents/children/$profileId/verbs` et la feuille verbe.
- `other-sessions-sheet.tsx`, `paths-screen.tsx`, `insights-screen.tsx`, catalogues i18n.
- Dexie : les schémas Effect `Exercise` et `PracticeAnswer` deviennent des unions plus larges ;
  aucun index ne change, pas de montée de version.

### 9.4 Serveur

- Rien de nouveau côté routes. `ingestion.rs` passe par `validate_exercise_attempt` comme pour les
  autres exercices. Le test de contrat `v2.rs` ajoute un profil avec réglage conjugaison dans les
  fixtures.

## 10. Découpage en livraisons

| Phase | Contenu                                                                                                                                                | Visible ? |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 0     | Catalogue de verbes (données, script, tests), dérivation des temps, variantes `Exercise` / `PracticeAnswer`, réglage `conjugation`, validation serveur | non       |
| 1     | Écrans parent (P1, P2, P3), sentier dans l’arrosage, exercice en **tuiles**, leurres, retour et indices, Mes verbes, Autres séances, Ce qui coince     | oui       |
| 2     | **Banque de lettres**, mode rappel, accents et accord acceptés, insights par personne                                                                  | oui       |
| 3     | « quel temps ? » et les étiquettes                                                                                                                     | oui       |

Chaque phase est une PR, vérifiée par `pnpm check` et `pnpm doctor`. La phase 1 est utilisable
seule : les tuiles suffisent pour découvrir, et la clé plafonne à « en train de pousser » tant que
la banque de lettres n’existe pas (comme une compétence de comparaison).

## 11. Grille d’évaluation (`TECHNICAL_PLAN.md` §4.30)

| Critère                         | Note | Commentaire                                                                          |
| ------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| améliore la récupération        | 2    | répétition espacée sur l’orthographe des formes, exactement ce que la classe demande |
| motive le retour                | 1    | pas de nouveauté visuelle ; le verbe « du moment » suit la classe                    |
| réduit l’anxiété ou la friction | 1    | écrire est plus exposant que choisir ; le découpage coloré et le retour doux aident  |
| reste clair hors ligne          | 2    | catalogue embarqué, correction locale                                                |
| respecte la séance de 90 s      | 2    | poids 1,5 pour la banque de lettres                                                  |
| mesurable sans pistage invasif  | 2    | mêmes événements, personne et réponse dans l’exercice                                |
| accessible                      | 1    | la banque de lettres demande un vrai travail d’ARIA et de clavier physique           |
| coût acceptable                 | 1    | une nouvelle interaction (lettres), un catalogue à relire ; aucune illustration      |

## 12. Décisions proposées et questions ouvertes

### Décisions proposées (confirmées le 6 octobre 2026)

1. **Clé par verbe et par temps**, personne tirée à chaque question (§3.3).
2. **Banque de lettres** plutôt que clavier système pour le rappel (§5.1).
3. **Accents stricts**, avec un retour dédié quand seul l’accent manque (§4.1).
4. **Passé composé avec être** : formes accordées acceptées pour je / tu / nous / vous, forme de
   référence au masculin, pronoms _il_ / _ils_ à la 3e personne (§4.1). L’accord est un attendu de
   CM2 ; on ne le note pas en CE2.
5. **Cocher le passé composé coche être et avoir au présent** (§3.1).
6. **Latence ignorée** pour la conjugaison (§4.1).
7. **Catalogue exhaustif derrière la recherche, sections choisies devant** (§3.2, révision 2) :
   tous les verbes du Lefff se trouvent par la recherche ; les sections n’affichent que les listes
   relues (programme, verbes courants de chaque groupe).
8. **1er groupe inclus**, conjugué par règles (§3.2, révision 2 ; spec technique §1.3).
9. **Pas de récompense dédiée** ; les clés comptent dans les portes du jardin (§7.2).
10. **Aucune ouverture automatique** : le sentier n’existe que par le parent (§3.1).

### Questions ouvertes, tranchées le 6 octobre 2026

- **Focus** : un verbe, avec un temps facultatif qui filtre (spec technique §2.5).
- **Orthographe de référence** : la rectifiée de 1990, comme le programme 2025 ; les formes
  traditionnelles sont acceptées (§4.1, spec technique §1.4).
- **Le pronom _on_** : non. **Verbes en être au passé composé** : _il_ / _ils_ à la 3e personne.
- **Index des verbes** : hors du moteur WASM, chargé à la demande par le catalogue.
- **Verbes cochés par défaut** : aucun, conformément au principe « le parent compose ».
- **Place dans Progrès** : un écran à part « Mes verbes » (D7), ouvert depuis une carte de
  l’onglet Progrès.
- **Limite** : 60 verbes cochés par enfant.
- **Formes témoins** : trois par ligne du catalogue (je, nous, ils au présent).

### Sources

- Programme de français du cycle 2, arrêté du 31 octobre 2024 (BO), partie « Étude de la langue »,
  via les référentiels en ligne qui le reproduisent.
- Éduscol, « Évaluations nationales de début de CM2, fiche d’intervention : Maîtriser l’accord du
  verbe avec son sujet », novembre 2024 (attendus de fin de CM1 et de CM2, familles d’erreurs,
  marques de personne, pistes de jeux).
- Éduscol, fiches d’intervention « Mémoriser les temps : être, avoir, premier groupe » (évaluations
  de début de CE2, 2025).

## Annexe A — catalogue proposé

**Les auxiliaires** : être, avoir.

**3e groupe, au programme du CE2** : aller, faire, dire, venir, pouvoir, voir, vouloir, prendre.

**3e groupe, famille des verbes du programme** : revenir, devenir, tenir, apprendre, comprendre,
refaire, revoir, prévoir, redire.

**2e groupe (modèle finir)** : finir, choisir, grandir, réussir, remplir, obéir, réfléchir, rougir,
nourrir, saisir, bâtir, applaudir, ralentir, atterrir, avertir, guérir, punir, agir, réunir,
franchir, fleurir, vieillir, salir, blanchir, noircir, jaunir, pâlir, maigrir, grossir, bondir,
rugir, surgir, établir, fournir, garantir, accomplir, définir, démolir, envahir, unir, mûrir,
raccourcir, adoucir, refroidir, réjouir, embellir.

**3e groupe, autres verbes courants** : partir, sortir, dormir, courir, lire, écrire, mettre,
boire, savoir, devoir, croire, vivre, ouvrir, offrir, couvrir, découvrir, souffrir, cueillir, rendre,
attendre, entendre, descendre, répondre, perdre, vendre, mordre, connaître, paraître, suivre, battre,
recevoir, sentir, mentir, servir, rire, sourire, conduire, construire, plaire, mourir, naître,
peindre, éteindre, craindre, fuir, asseoir (s’), falloir (il), pleuvoir (il).

Soit 2 + 8 + 9 + 46 + 48 = 113 verbes.
