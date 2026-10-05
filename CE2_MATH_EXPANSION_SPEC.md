# Little Tables — fractions, additions et soustractions CE2

Statut : proposition de spécification à discuter avant implémentation.

Date : 4 octobre 2026.

Objet : étendre l’apprentissage tout en conservant le rituel, le jardin et la direction artistique de la PWA.

## 1. Intention et périmètre

Permettre à un enfant de travailler les additions et soustractions avec des nombres à trois chiffres, puis les fractions, dans les mêmes petites séances rassurantes que les tables de multiplication.

La promesse reste : ouvrir l’application, pratiquer un peu, faire grandir son jardin et repartir avec une réussite. Les nouvelles notions doivent apporter leurs propres supports pédagogiques, tout en conservant le personnage choisi, les profils familiaux et les récompenses existantes.

Ce document spécifie le produit et les critères de réalisation. Il ne modifie pas encore le fonctionnement de l’application. Les choix proposés ci-dessous sont des décisions produit ; les exigences officielles sont résumées séparément.

## 2. Référence officielle et limites de couverture

### Programme applicable

Éduscol indique que le programme de mathématiques du cycle 2 publié au BO du 31 octobre 2024 s’applique depuis la rentrée 2025. C’est la référence retenue pour le CE2 en 2026–2027, plutôt que les anciens attendus ou les évaluations de début de CE2.

Source : [Éduscol — programme en vigueur et ressources du cycle 2](https://eduscol.education.gouv.fr/4746/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-2).

### Attendus pertinents pour cette extension

- Les entiers et le calcul posé s’étendent jusqu’à 10 000 ; le calcul mental est privilégié lorsqu’il convient.
- Les fractions étudiées sont au plus égales à 1, avec un dénominateur au plus égal à 12.
- Le CE2 travaille les égalités de fractions, les comparaisons à même dénominateur, même numérateur ou dénominateurs multiples, puis les additions et soustractions à dénominateurs identiques ou multiples.
- Les fractions représentent aussi des longueurs : une unité partagée, une règle graduée, éventuellement une longueur exprimée en unités entières plus une fraction.
- Les procédures additives comprennent l’ajout de 8, 9, 18, 19, 28, 29, 38, 39 et le retrait de 9, 19, 29, 39.
- Des problèmes donnent du sens aux opérations. Pour les procédures de calcul mental, le repère de fin de CE2 est de quinze résultats en trois minutes.

Source : [programme officiel, PDF, pages 19 à 24](https://www.education.gouv.fr/sites/default/files/document/Annexe%204%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20du%20cycle%202-403821.pdf). La pagination indiquée correspond au lecteur PDF, en comptant la première page comme page 1.

Le [livret d’accompagnement CE2, pages 8 à 15](https://eduscol.education.gouv.fr/sites/default/files/document/2025livretaccompagnementmathce2pdf-122974.pdf) fournit des exemples pédagogiques pour le travail des fractions. Ses séquences sont des propositions d’enseignement, pas un calendrier obligatoire de déblocage dans la PWA.

### Couverture produit proposée

La première livraison cible la demande « avec les centaines » : opérandes entiers de 0 à 999, résultats d’addition pouvant aller jusqu’à 1 998, soustractions à résultat positif ou nul. Ainsi, un passage à 1 000 est traité correctement et ne devient pas une erreur artificielle.

Une extension ultérieure couvrira les entiers et résultats jusqu’à 10 000. La première livraison sera présentée comme un entraînement ciblé sur des notions du CE2 ; elle ne prétendra pas couvrir tout le programme. Monnaie à virgule, géométrie, autres mesures, données et autres compétences du CE2 restent hors de cette extension.

Les exercices rapides portent sur des fractions entre 0 et 1. Un parcours de longueur pourra montrer « 1 unité + une fraction » ; il ne demandera pas de transformer cette longueur en fraction impropre.

## 3. Point de départ dans la PWA

Le code actuel est la référence pour l’intégration ; le plan technique initial décrit aussi des fonctionnalités qui ont évolué.

| Élément actuel                                                            | Conséquence pour l’extension                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Accueil avec une action principale d’arrosage ou de reprise               | Conserver cette entrée directe ; placer le choix des notions dans les modes secondaires          |
| Arrosage de 5 à 8 questions, selon les révisions disponibles              | Garder ce budget ; ne pas multiplier les séances quotidiennes par matière                        |
| Séances supplémentaires, tables ciblées, tables 11–12 et division inverse | Ajouter les nouveaux parcours au système de modes et de contenu                                  |
| Un seul progrès quotidien récompensé par profil                           | Toutes les matières partagent le même arrosage et le même jardin                                 |
| QCM puis clavier numérique pour les faits familiers                       | Réutiliser pour le calcul mental ; ajouter des interactions pour les fractions et le calcul posé |
| Profils familiaux avec personnage choisi                                  | Isoler progression, préférences de parcours et séances par profil                                |
| Français, anglais et chinois simplifié                                    | Traduire toutes les nouvelles consignes et les libellés accessibles                              |
| Fonctionnement local, IndexedDB et synchronisation différée               | Génération, validation et explications doivent fonctionner hors ligne                            |

Références : [accueil](apps/web/src/screens/home-screen.tsx), [lanceur de séances](apps/web/src/hooks/use-practice-launcher.ts), [moteur](packages/domain/src/learning-engine.ts), [stockage local](packages/local-store/src/practice-store.ts), [catalogue de langues](apps/web/src/i18n-catalog.ts).

## 4. Navigation et rituel quotidien

### Accueil

Conserver les trois onglets Accueil, Jardin et Progrès. Sous le bouton principal, l’entrée secondaire des modes devient « Choisir une activité » et présente :

- Tables, avec les choix actuels et la division lorsqu’elle est disponible.
- Additions et soustractions, avec « Calculer de tête » et « Poser un calcul ».
- Fractions, avec « Découvrir les parts », « Comparer », « Mesurer » et « Calculer » selon la progression.

Chaque carte contient un petit symbole, un titre et une phrase concrète. Exemple : « Additions et soustractions — Jouons avec les centaines ». Les matières ne prennent pas la forme de nouveaux mondes à acheter ou de nouveaux onglets.

Une séance en cours reste prioritaire : le bouton principal reprend exactement cette séance ; choisir un autre mode ne l’écrase pas. Les activités secondaires expliquent « Termine ou quitte ta séance pour changer d’activité » si nécessaire. Quitter garde les réponses déjà enregistrées et ne valide pas un arrosage incomplet.

### Activation des nouveaux parcours

Pour les profils existants, le parcours quotidien reste celui d’aujourd’hui tant qu’un nouveau module n’a pas été choisi. Commencer une première découverte active ce module dans les futures propositions quotidiennes. Cette préférence est propre au profil et synchronisée.

Les additions, soustractions et fractions sont accessibles sans maîtriser toutes les multiplications. Leur progression dépend de leurs propres prérequis. Un enfant peut revoir une découverte à tout moment ; une étape plus avancée peut être essayée explicitement avec davantage d’aide, même si elle n’est pas encore recommandée.

### Composition de l’arrosage

Un arrosage conserve 5 à 8 questions au total, toutes matières confondues. La séance cible une famille principale parmi les modules activés et peut inclure jusqu’à deux rappels déjà connus d’une autre famille. Une séance de découverte ou de calcul posé reste centrée sur son sujet pour éviter les changements répétés d’interface.

Les révisions dues, les erreurs récentes et la confiance du lecteur déterminent le contenu. À priorité comparable, faire tourner les familles d’une séance à l’autre ; enregistrer ce choix pour que reprendre ou recharger ne change pas le programme de la séance. Les matières moins pratiquées doivent retrouver une place, sans afficher un retard à rattraper.

Introduire au maximum une nouvelle compétence par séance et, hors découverte initiale, au maximum deux exercices nouveaux. Compléter avec des variations de compétences déjà abordées. Une découverte initiale comporte cinq exercices guidés ou progressifs sur une seule compétence.

Les séances de fractions ou de calcul posé visent environ deux à trois minutes. Pour ce contenu, l’accueil affiche le nombre réel d’exercices et une estimation adaptée ; la promesse « 90 secondes » n’est pas forcée sur une tâche conceptuelle. Aucun compte à rebours n’est visible.

## 5. Additions et soustractions : progression proposée

Les codes ci-dessous identifient des compétences produit, indépendantes des nombres exacts rencontrés. Les exemples sont des exercices proposés pour l’application.

| Code | Compétence                                 | Exemple                                           | Support initial                           |
| ---- | ------------------------------------------ | ------------------------------------------------- | ----------------------------------------- |
| N1   | Comprendre centaines, dizaines et unités   | 462 contient 4 centaines, 6 dizaines, 2 unités    | Plaques, barres et unités ; décomposition |
| A1   | Ajouter des centaines ou dizaines entières | 340 + 200 ; 426 + 30                              | Bonds sur une ligne et décomposition      |
| A2   | Additionner sans regroupement              | 243 + 125                                         | Décomposition puis clavier                |
| A3   | Franchir une dizaine ou une centaine       | 268 + 7 ; 395 + 20                                | Passage par un nombre repère              |
| A4   | Compenser pour calculer mentalement        | 326 + 19 ; 457 + 38                               | Ajouter un nombre rond puis ajuster       |
| A5   | Poser une addition, avec retenues          | 286 + 157 ; 678 + 459                             | Colonnes et retenues explicites           |
| S1   | Retirer des centaines ou dizaines entières | 760 − 300 ; 486 − 40                              | Décomposition ou bonds                    |
| S2   | Soustraire sans échange                    | 584 − 231                                         | Décomposition puis clavier                |
| S3   | Franchir une dizaine ou une centaine       | 402 − 5 ; 650 − 70                                | Passage par un nombre repère              |
| S4   | Compenser pour calculer mentalement        | 543 − 29                                          | Retirer un nombre rond puis ajuster       |
| S5   | Poser une soustraction, avec échanges      | 532 − 178 ; 600 − 247                             | Échange d’une centaine ou d’une dizaine   |
| P1   | Choisir l’opération dans un petit problème | Une réserve de 240 graines reçoit 135 graines     | Schéma partie/tout et choix d’opération   |
| P2   | Résoudre un problème en deux étapes        | 320 graines, puis 125 ajoutées, puis 80 utilisées | Deux résultats intermédiaires conservés   |

### Ordre et difficultés

N1 est un prérequis proposé, avec une courte vérification permettant de le passer si l’enfant le connaît. Les branches addition et soustraction progressent ensuite séparément. Une réussite en A5 ne valide pas S5.

Introduire un seul obstacle à la fois : d’abord l’alignement, puis une retenue ou un échange, puis plusieurs, puis les zéros intermédiaires et le passage au millier. La taille des nombres et la difficulté de procédure constituent deux dimensions distinctes.

Le parcours mental ne doit pas transformer chaque opération à trois chiffres en calcul posé. Le support suggère une stratégie utile et accepte directement un résultat correct obtenu autrement. Les étapes d’explication restent affichées avec des égalités exactes : par exemple `326 + 20 = 346`, puis `346 − 1 = 345`.

### Interaction pour calculer de tête

QCM de quatre réponses au démarrage lorsque quatre distracteurs pertinents existent, puis clavier numérique avec validation explicite. Prévoir une saisie jusqu’à quatre chiffres pour les résultats de la première livraison. Ne jamais valider automatiquement à la saisie du dernier chiffre.

Les distracteurs reflètent une difficulté réelle : confusion de position, retenue oubliée, compensation dans le mauvais sens, erreur d’une dizaine. Les choix restent distincts et adaptés au niveau.

### Interaction pour poser un calcul

Utiliser une carte verticale avec des colonnes identifiées par leur nom complet accessible : milliers, centaines, dizaines, unités. Les intitulés visibles peuvent être abrégés. Afficher la colonne des milliers lorsqu’elle est utile, notamment pour une somme supérieure à 999.

Deux étapes de progression :

1. **Calcul accompagné** : opérandes déjà alignés ; sélection d’une colonne, saisie d’un résultat, puis manipulation d’une retenue ou d’un échange. Une case active possède un contour net ; le clavier reste dans la zone du pouce.
2. **Calcul autonome** : l’enfant positionne les chiffres des opérandes dans la grille, puis calcule. La saisie et le déplacement se font par boutons ou sélection de case, sans imposer un glisser-déposer. L’alignement et le résultat sont évalués séparément.

Une opération complète compte pour un exercice et un point de progression de séance. Chaque touche ou étape de colonne ne crée pas une nouvelle récompense ni une nouvelle réussite de compétence.

Pour la soustraction accompagnée, utiliser par défaut la méthode par échange, cohérente avec le matériel de numération : une centaine devient dix dizaines, une dizaine devient dix unités. Expliquer les échanges successifs dans `600 − 247`. Identifier la méthode dans l’aide ; ne pas mélanger échange et compensation sur une même grille. Le mode de résultat libre accepte un enfant qui calcule avec une autre méthode apprise en classe. La prise en charge guidée d’une seconde méthode pourra être ajoutée séparément.

## 6. Fractions : progression proposée

| Code | Compétence                                                    | Exemple proposé                                              | Interaction                                     |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| F1   | Identifier des parts égales et l’unité de référence           | Choisir une bande réellement partagée en quatre parts égales | Sélection de schéma                             |
| F2   | Lire et représenter une fraction                              | Montrer 3/5 d’une bande                                      | Colorier des parts par tap, puis lire ou saisir |
| F3   | Reconnaître une même quantité avec des partitions différentes | 2/4 et 1/2                                                   | Superposer des bandes de même longueur          |
| F4   | Comparer et ordonner des fractions                            | 2/7 et 5/7 ; 3/8 et 3/4 ; 2/3 et 5/6                         | Boutons <, =, > et bandes communes              |
| F5   | Placer une fraction sur une graduation                        | Placer 3/4 entre 0 et 1                                      | Choix d’une graduation et validation            |
| F6   | Mesurer avec une unité fractionnée                            | Longueur de 1 unité + 2/5 d’unité                            | Bande-unité reportée et règle graduée           |
| F7   | Additionner ou soustraire à partition commune                 | 2/7 + 3/7 ; 5/8 − 2/8                                        | Parts ajoutées ou retirées puis réponse         |
| F8   | Calculer après changement de partition simple                 | 1/3 + 1/6 ; 3/4 − 1/8                                        | Repartitionner une bande, puis calculer         |
| F9   | Résoudre un petit problème de fractions                       | Une bande est peinte sur 2/8, puis sur 3/8 supplémentaires   | Modèle, calcul, résultat contextualisé          |

### Règles de contenu

F1–F2 reprennent les bases avant d’introduire l’équivalence et la mesure. F3 précède les comparaisons avec dénominateurs différents et F8 ; F5 précède F6. F7 requiert la compréhension des parts, sans attendre la maîtrise de toutes les mesures.

Commencer avec des partitions en 2, 3 et 4 ; étendre progressivement jusqu’à 12, y compris les dénominateurs moins courants. Les paliers ne suivent pas une date scolaire imposée : l’enfant peut explorer une représentation avant de savoir répondre seul.

Les calculs générés donnent un résultat entre 0 et 1 inclus. Pour deux dénominateurs différents, l’un doit être un multiple de l’autre ; leur partition commune reste au plus égale à 12. Ne pas générer un calcul tel que `1/3 + 1/4` dans ce parcours. Pas de multiplication ni de division de fractions.

La reconnaissance de zéro et de l’unité est explicite : une bande vide vaut 0 ; une bande entièrement remplie vaut 1. Le clavier accepte les entiers 0 et 1 dans ces exercices ainsi qu’une écriture fractionnaire équivalente.

### Présentation et saisie

Présenter les fractions avec un numérateur au-dessus d’un dénominateur, séparés par une barre. L’écriture linéaire `3/5` sert aux documents et aux échanges de données ; l’interface affiche une vraie composition typographique.

Pour la saisie, proposer deux cases « nombre de parts prises » et « nombre de parts égales », puis introduire les termes numérateur et dénominateur dans l’aide. Une consigne courte accompagne la fraction : « Colorie trois cinquièmes de la bande ».

Par défaut, accepter toutes les écritures exactes équivalentes autorisées par le champ de réponse : `2/4` et `1/2` expriment la même quantité. Ne pas exiger une fraction irréductible. Si l’exercice demande précisément une écriture en huitièmes, une réponse équivalente dans une autre partition reçoit « C’est la même quantité ; écris-la maintenant en huitièmes ». Cet ajustement de format ne compte pas comme une erreur de valeur.

Les QCM de fractions contiennent une seule réponse correcte en valeur. Deux fractions équivalentes ne peuvent pas être deux choix concurrents d’un QCM simple. Un exercice d’équivalence avec plusieurs bonnes réponses doit annoncer la sélection multiple et l’évaluer comme telle.

### Représentations

La bande rectangulaire est le support principal : elle facilite la comparaison, la repartition et le passage à la longueur. Les disques ou autres surfaces régulières servent ensuite à vérifier que la notion ne dépend pas d’un seul dessin.

Toujours rendre l’unité visible. Comparer des quantités sur des bandes de même longueur ; des bandes d’unités différentes ne servent pas à conclure sur une comparaison de fractions. Les parts sont égales géométriquement, pas seulement en nombre.

La droite graduée indique 0, 1 et des intervalles réguliers. Les zones tactiles des graduations sont agrandies sans modifier leur position mathématique ; si elles se chevauchent sur un petit écran, proposer des boutons précédent/suivant pour déplacer un marqueur jusqu’à une graduation exacte. Aucun jugement ne repose sur une approximation du doigt en pixels.

Dans F6, l’unité est une référence graphique relative. Ne pas prétendre mesurer des centimètres physiques sur un écran de taille inconnue. Les graduations et longueurs sont produites par le code, en SVG ou HTML ; les illustrations décoratives ne définissent jamais la géométrie mathématique.

## 7. Aide, retour d’erreur et maîtrise

### Expérience d’une réponse

Reprendre le fonctionnement actuel : réponse validée explicitement, confirmation douce, explication disponible, bouton pour continuer. Le personnage encourage sans masquer le calcul. L’enfant peut demander « Montre-moi » avant ou après sa réponse.

Après une erreur, montrer la bonne réponse avec une explication liée à la difficulté : « Dix unités font une dizaine » ou « Ici, toutes les parts ont la même taille ». Les erreurs de dénominateur se montrent sur une bande ; les erreurs de retenue dans une colonne. Aucun écran rouge, vie perdue ou récompense retirée.

Réintroduire la compétence avec un autre exemple après des exercices intermédiaires, ou dans une séance ultérieure si le budget est atteint. Une correction copiée juste après révélation n’est pas une preuve de rappel autonome.

### Ce qui progresse

Conserver le suivi actuel par fait pour multiplication et division. Pour ces nouveaux sujets, suivre une compétence et un palier de difficulté, avec la représentation et le type d’aide utilisés. Réussir cinq fois une même addition ne suffit pas à maîtriser les additions avec retenue.

Les états internes peuvent conserver `unseen`, `learning`, `familiar`, `fluent`, avec des libellés adaptés : « À découvrir », « En train de pousser », « Bien compris », « Bien ancré ». Pour une compétence conceptuelle, `fluent` signifie une maîtrise autonome durable, sans seuil de vitesse hérité des multiplications.

Seuil initial proposé pour « Bien ancré » : au moins six réussites autonomes sur trois jours d’apprentissage distincts, dont trois sur des exemples nouveaux, avec au moins 80 % de réussite sur les dix dernières tentatives autonomes disponibles. Une compétence de fraction doit être réussie dans deux représentations adaptées ; le calcul posé doit inclure l’alignement autonome et le cas de retenue ou d’échange ciblé. Versionner ces seuils pour pouvoir les ajuster.

Une réponse assistée contribue à l’apprentissage et au rituel, mais ne compte pas parmi les réussites autonomes. Enregistrer l’ouverture d’une aide, la révélation éventuelle du résultat et le passage d’un mode guidé à un mode libre. Un QCM peut établir la familiarité ; la maîtrise exige aussi des réponses produites ou des placements/constructions sans indices de solution.

La latence aide à comprendre l’aisance en calcul mental ; elle ne déclasse pas une réponse conceptuelle lente mais juste. Exclure du temps actif les périodes où l’application est masquée ou suspendue. Le repère scolaire de fluence n’est pas un objectif imposé aux fractions ou aux opérations posées.

## 8. Direction artistique et composition des écrans

### Continuité visuelle

Réutiliser Fredoka, le fond crème, les cartes presque blanches, le rose d’action, les contours doux, les grands arrondis et les espaces généreux de [styles.css](apps/web/src/styles.css). Tous les nouveaux composants utilisent les tokens sémantiques existants ; les couleurs pédagogiques supplémentaires éventuelles doivent aussi être des tokens.

Des touches de vert doux peuvent accompagner la numération et de bleu doux les longueurs. Le bouton principal reste rose. Les symboles mathématiques, les légendes et les données ne dépendent jamais uniquement de ces couleurs.

Conserver le personnage choisi dans le profil et les réactions actuelles. Le jardin garde sa collection, son ordre personnalisé et son rythme de croissance. Les supports scolaires sont dessinés avec le même soin que les cartes de la PWA, sans ajouter de textures de cahier, de tableau noir ou de longues pages de cours.

### Composition d’une question

Du haut vers le bas :

1. Retour discret et progression en fleurs, dimensionnée au nombre réel d’exercices.
2. Une consigne courte, puis l’opération ou la fraction en grands caractères.
3. Une seule zone pédagogique : bande, droite ou grille en colonnes.
4. La réponse et le bouton de validation dans la zone confortable du pouce.
5. « Montre-moi » et le personnage en accompagnement léger.

La zone mathématique reste stable pendant la réponse. Les confettis et grands mouvements sont réservés aux retours et à la célébration. Avec un clavier personnalisé affiché, le personnage peut être réduit pour garder visibles la consigne et le contrôle actif.

Exemples de moments visuels :

- **326 + 19** : opération centrale, bouton d’aide révélant deux bonds `+20`, puis `−1`, quatre réponses ou un clavier selon le niveau.
- **Colorier 3/5** : bande claire de cinq cases identiques, remplissage rose doux, repère « une unité », validation après sélection.
- **532 − 178** : grille alignée, colonne sélectionnée encadrée, échange visualisé entre centaines et dizaines, puis saisie du chiffre.

### Accessibilité et langues

Tester à 320 px de largeur et avec un zoom texte à 200 %, sans perte de consigne ou de réponse. Toutes les actions ont une cible d’au moins 44 × 44 px, y compris les contrôles alternatifs d’une graduation. Le tap et le clavier permettent toutes les tâches ; le glisser-déposer est facultatif.

Les lecteurs d’écran annoncent l’opération, les fractions, l’unité, les cases actives, les sélections et le retour de validation. Prévoir des descriptions comme « trois cinquièmes », « deux parts coloriées sur cinq » et « colonne des dizaines, retenue de un ».

Respecter la préférence de mouvement réduit et le son désactivé. Les nouvelles consignes et descriptions accessibles existent en français, anglais et chinois simplifié ; changer la langue ne change pas le parcours ni les unités de référence. L’alignement sur le CE2 français est expliqué dans les informations de parcours, quelle que soit la langue d’interface.

## 9. Jardin, célébration et écran Progrès

Terminer un arrosage produit le même progrès de jardin, que la séance porte sur des tables, des centaines ou des fractions. Une seule progression quotidienne est attribuable par profil et journée d’apprentissage. Les séances supplémentaires peuvent renforcer la maîtrise, sans accélérer la collection quotidienne.

Une séance terminée avec de l’aide ou des erreurs reste un effort récompensable. Un abandon garde l’historique, sans attribuer la récompense de fin. Plusieurs étapes de calcul posé ne sont pas plusieurs arrosages.

La célébration reprend le composant et le personnage existants avec une observation concrète : « Tu as comparé des fractions » ou « Tu as retrouvé comment échanger une dizaine ». Elle distingue clairement progrès pédagogique et progrès du jardin.

L’onglet Progrès présente quatre familles : Tables, Division, Additions et soustractions, Fractions. Conserver le détail des tables actuelles. Les nouveaux modules affichent des compétences plutôt qu’un compteur de milliers de calculs possibles. Aucune moyenne globale ne mélange vitesse des tables et compréhension des fractions.

Les portes du jardin actuellement fondées sur les tables gardent leurs règles lors de cette extension. Les nouvelles compétences ne doivent pas les ouvrir implicitement. Une évolution future de ces portes demandera une règle explicite et une migration dédiée.

## 10. Contraintes de domaine, persistance et synchronisation

### Modèle pédagogique

Étendre le moteur par des familles de questions typées : faits existants, calcul entier, calcul en colonnes, fraction, comparaison et longueur. Le rendu consomme la question générée ; il ne décide pas seul de la bonne réponse ou de la compétence validée.

Une question contient une identité stable, la compétence et son palier, les données mathématiques, la représentation, le mode de réponse, les contraintes de saisie et la version du contenu. La génération prend le temps et une graine en entrée pour rester déterministe.

Les fractions sont des couples d’entiers avec dénominateur strictement positif. L’égalité se vérifie exactement, sans décimales flottantes ; conserver la partition affichée même si une valeur normalisée sert à comparer. Une réponse de comparaison est un choix de relation ; une réponse de longueur peut contenir une partie entière et une fraction.

Le modèle actuel `selected: number` et les choix numériques ne suffisent pas à ces réponses. Spécifier une union de réponses validée dans le domaine, le stockage et les schémas HTTP. Une tentative contient le résultat brut, la valeur évaluée, l’aide utilisée et, lorsqu’elles sont pédagogiquement utiles, les étapes de colonne. Le serveur recalcule la validité et ne fait pas confiance au booléen `correct` fourni par le client.

Ne pas confondre identité d’exercice et identité de compétence. Les additions peuvent partager des observations sur l’inversion des termes ; les soustractions restent orientées. Les clés des nouvelles compétences n’entrent jamais en collision avec les clés existantes des faits.

### Durabilité

Sauvegarder la séance avant de naviguer, puis chaque réponse atomiquement avec la progression locale et l’outbox. Pour une grille ou une bande en cours, conserver le brouillon et l’étape active sans créer une tentative à chaque tap. Une reprise après fermeture retrouve le même exercice, les mêmes choix, le brouillon et l’état d’aide.

Les événements validés restent immuables et idempotents par identifiant. La reprise d’une séance se fait sur le même appareil ; un autre appareil récupère les tentatives synchronisées, la progression et les préférences, sans promettre la reprise d’un brouillon qui n’a pas été envoyé.

Toutes les données sont isolées par profil, y compris les modules activés et les paliers. Les appels API conservent les contrôles d’identité existants. Ni l’élargissement du contenu ni un changement de profil ne contournent l’authentification requise pour l’usage hors ligne.

### Migration et versions mixtes

Prévoir une migration IndexedDB et des schémas serveur compatibles avec les anciennes tentatives et séances. Une ancienne tentative sans opération continue d’être une multiplication. Les nouvelles compétences démarrent sans historique inventé ; les scores, rappels et récompenses actuels restent conservés.

Livrer la lecture serveur des nouveaux formats avant leur émission par le client. Le bootstrap indique la version de contenu prise en charge ; le client active les nouveaux parcours après une première confirmation compatible, puis les conserve utilisables hors ligne. Un ancien client ne reçoit pas des événements qu’il ne peut pas décoder : prévoir une négociation de version ou une vue de synchronisation compatible.

Le service worker précache les supports et les traductions nécessaires. Une mise à jour ne remplace pas les données d’une séance active ; les définitions nécessaires à sa reprise restent disponibles jusqu’à sa fin. Tester une outbox ancienne, une nouvelle outbox et une séance active lors du déploiement et du retour à une version précédente.

Points d’intégration : [moteur public](packages/domain/src/learning-engine.ts), [PracticeScreen](apps/web/src/screens/practice-screen.tsx), [Dexie](packages/local-store/src/practice-store.ts), [validation des tentatives serveur](apps/server/src/application/attempt-ingestion.ts), [synchronisation](apps/web/src/sync.ts), [service worker](apps/web/src/sw.ts).

## 11. Découpage de réalisation

Chaque lot doit traverser domaine, stockage, API et interface lorsqu’il produit des tentatives ; aucun nouveau type de réponse ne doit fonctionner uniquement dans le navigateur.

1. **Socle et premier calcul entier** : formats versionnés, migration et compatibilité, entrée de parcours, N1/A1/S1, mode de réponse existant adapté, récompense quotidienne commune et tests de non-régression.
2. **Calcul mental avec centaines** : A2–A4/S2–S4, aides ciblées, suivi par compétence, P1, Progrès et langues.
3. **Calcul posé** : A5/S5, brouillons persistants, grille accompagnée puis autonome, retenues, échanges successifs et passage au millier ; P2 en séance dédiée.
4. **Fractions visuelles** : F1–F5, réponse rationnelle et comparaison, bandes, équivalences, graduation et critères de maîtrise.
5. **Fractions et longueurs/calcul** : F6–F9, dénominateurs jusqu’à 12, opérations avec partitions multiples et problèmes courts.
6. **Intégration quotidienne et validation visuelle** : rotation des modules activés, plafonds de séance, célébration, retour après absence et essais sur iPhone/PWA installée.

Les lots 1 à 6 constituent le périmètre décrit, même si les modules sont ouverts progressivement. L’extension des entiers jusqu’à 10 000 reste un lot ultérieur clairement identifié.

## 12. Critères d’acceptation

| Cas                                                     | Résultat attendu                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Profil existant qui n’a pas choisi de nouveau module    | Parcours de tables et historique inchangés                                                                |
| Première découverte de fractions sans tables maîtrisées | Accès possible, exercices guidés, aucune dépendance aux portes des tables                                 |
| `678 + 459`                                             | 1 137 accepté ; colonne des milliers disponible                                                           |
| `600 − 247`                                             | 353 accepté ; explication d’échanges successifs sans valeur impossible dans une colonne                   |
| Calcul généré de soustraction                           | Opérandes et résultat entiers dans le périmètre, jamais de résultat négatif                               |
| Réponse `2/4` à une quantité de `1/2`                   | Juste, sauf ajustement de partition explicitement demandé et expliqué                                     |
| `1/3 + 1/6`                                             | 1/2 ou 3/6 accepté ; aide montrant une partition commune                                                  |
| Générateur de calculs de fractions                      | Résultats entre 0 et 1, dénominateurs autorisés et multiples pour les opérations à partitions différentes |
| QCM de fractions                                        | Aucune deuxième réponse équivalente à la bonne réponse                                                    |
| Bande ou graduation                                     | Géométrie exacte, unité visible, interaction accessible sans précision gestuelle imposée                  |
| Réponse après affichage du résultat                     | Effort enregistré, aucune validation de maîtrise autonome                                                 |
| Dix réussites sur un seul jour                          | Aucune acquisition immédiate de maîtrise durable                                                          |
| Changement de profil                                    | Jardin, progression, préférence et brouillon du bon profil                                                |
| Fermeture pendant une opération posée                   | Reprise de la grille et de la case active sans double tentative                                           |
| Deux séances ou appareils sur la même journée           | Au plus une progression quotidienne du jardin après réconciliation                                        |
| Mode avion après activation compatible                  | Exercices, aides, réponses et reprise disponibles ; synchronisation différée                              |
| Rejeu du même événement                                 | Aucun nouveau progrès ni récompense                                                                       |
| Ancienne outbox et ancienne séance                      | Lecture et synchronisation conservées après migration                                                     |
| Langue changée ou mouvement réduit                      | Consignes, accès aux réponses et feedback complets                                                        |

La validation de l’implémentation inclura des tests de comportement et de propriétés pour les bornes numériques, les fractions exactes, les distracteurs, le suivi par compétence, les migrations et l’idempotence. Les parcours de colonne et de bande auront des tests d’interaction et de reprise. Vérifier visuellement petit écran, zoom, clavier, lecteur d’écran et mouvement réduit, puis exécuter `corepack pnpm check` et `corepack pnpm doctor` avant de pousser chaque livraison.

## 13. Décisions retenues pour préparer l’implémentation

- Commencer avec les centaines et identifier séparément l’extension jusqu’à 10 000.
- Donner aux fractions des manipulations et aux calculs posés une grille dédiée.
- Conserver un seul jardin et un seul arrosage quotidien par profil.
- Activer un module après sa première découverte, sans bloquer les fractions derrière les tables.
- Évaluer la maîtrise conceptuelle sur plusieurs jours, plusieurs exemples et des réponses autonomes.
- Utiliser l’échange comme méthode guidée initiale de soustraction, avec un mode de résultat libre.
- Garder le nom, les personnages et les trois onglets actuels ; adapter les textes de présentation pour accueillir les nouvelles notions.

Ces choix rendent la proposition implémentable. Leur validation produit précède le développement des nouveaux modules.
