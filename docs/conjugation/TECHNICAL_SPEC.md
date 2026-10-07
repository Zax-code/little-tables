# Conjugaison — spécifications techniques

Statut : **v0.1 (6 octobre 2026) · proposition**. Décline [`CE2_CONJUGATION_SPEC.md`](../../CE2_CONJUGATION_SPEC.md)
(la spec fonctionnelle, board R6) dans l'architecture de [`docs/rewrite/TECHNICAL_SPEC.md`](../rewrite/TECHNICAL_SPEC.md).
Les points encore ouverts sont en §10, avec la valeur retenue par défaut.

---

## 1. Le lexique

### 1.1 Source : le Lefff

| Sujet      | Choix                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lexique    | **Lefff** (Lexique des formes fléchies du français, Inria), via le paquet npm `french-verbs-lefff` 3.4.0 (`dist/conjugations.json`, 6,3 Mo)                                       |
| Licence    | Données sous **LGPL-LR** (Lesser General Public License for Linguistic Resources) ; le paquet lui-même est Apache-2.0. Les fichiers dérivés restent sous LGPL-LR avec attribution |
| Couverture | **7 826 verbes** : 7 086 du 1er groupe, 312 du 2e, 373 du 3e, 55 défectifs ou parasites (`voici`, `uw`, `gésir`…) à exclure                                                       |
| Temps      | Tout l'indicatif (P présent, I imparfait, F futur, J passé simple), subjonctif, conditionnel, impératif, participes (K) ; on n'en garde que P, I, F et K                          |
| Vérifié    | Les six verbes demandés par une maman sont présents : _apercevoir, sourire, essayer, servir, comprendre, apprendre_                                                               |

Pourquoi pas les autres : Verbiste (6 800 verbes) est en GPL-2, ce qui contaminerait le dépôt ;
Morphalou 3 (LGPL-LR aussi) est bien plus lourd et n'apporte rien de plus pour les verbes ; les
listes Wiktionnaire sont en CC BY-SA et hétérogènes.

### 1.2 Mesures : le lexique se résume à des règles

Un script d'analyse a passé les 7 826 verbes au crible (scratchpad, `analyse.js`, à reprendre
dans `tools/verbs/`) :

| Constat                                                                                                         | Nombre                                     |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1er groupe entièrement dérivable de l'infinitif par **8 familles orthographiques**                              | 7 066 / 7 086                              |
| 1er groupe à traiter à part (familles combinées _-éger_, _-ecer_/_-écer_, futur de _envoyer_, graphies doubles) | 20                                         |
| 2e groupe dérivable de l'infinitif (modèle _finir_)                                                             | 312 / 312                                  |
| 3e groupe : présent irrégulier, à stocker explicitement                                                         | 373                                        |
| Imparfait dérivable du radical de _nous_ au présent (`nous finiss-ons` → `finiss-ais`)                          | 7 442 / 7 771 (sauf _être_ et 6 défectifs) |
| Futur = un radical unique + `-ai, -as, -a, -ons, -ez, -ont`                                                     | 7 771 / 7 771                              |
| Encodage compact **de tout le lexique** (infinitif + famille, ou formes explicites pour le 3e groupe)           | 126 Ko bruts, **36 Ko gzip**               |
| Encodage compact du seul 3e groupe                                                                              | 31 Ko bruts, **8 Ko gzip**                 |

Conclusion : il n'y a pas besoin d'embarquer les formes. Le moteur embarque un **conjugueur par
règles** et un **petit jeu de données** (3e groupe explicite, exceptions, listes), et le Lefff
devient un **oracle de test** : le conjugueur doit reproduire ses 7 771 × 4 temps × 6 personnes
formes, à l'exception des variantes documentées (§1.4).

### 1.3 Ce que le moteur embarque

```
crates/lt-domain/data/
  verbs-irregular.tsv     373 verbes du 3e groupe + être, avoir : présent (6), radical du futur,
                          participe passé, radical de l'imparfait s'il diffère, auxiliaire
  verbs-first-group.tsv   les ~20 verbes du 1er groupe hors familles (envoyer, protéger, dépecer…)
  verbs-lists.json        listes à la main : programme CE2 (8), familles (revenir…), sections du
                          catalogue (2e groupe courants, 3e groupe courants, 1er groupe courants),
                          verbes à auxiliaire être, verbes impersonnels, h aspiré, variantes acceptées
```

Taille attendue dans le WASM : **≈ 12 Ko gzip** de données et ≈ 10 Ko de code, dans le budget de
300 Kio (247 Kio utilisés aujourd'hui, `tools/build-wasm.sh`).

Le **1er groupe n'est pas stocké** : tout verbe en _-er_ se conjugue depuis son infinitif
(§2.3). Il entre donc dans le périmètre à coût nul, ce qui répond à la demande de _essayer_. La
spec fonctionnelle est mise à jour en ce sens (son §3.2 et sa décision 8).

### 1.4 Variantes acceptées (et forme de référence)

Le Lefff suit l'orthographe traditionnelle. L'école enseigne parfois l'orthographe rectifiée de
1990 (le programme 2025 la donne comme référence), et les manuels de CE2 écrivent _j'essaie_.
Règle : **la forme de référence est celle du Lefff**, et les formes suivantes sont **acceptées**
comme justes, avec le retour « oui ! » et, en sous-titre, la forme de référence :

| Famille                                                                           | Référence (Lefff)       | Variante acceptée            |
| --------------------------------------------------------------------------------- | ----------------------- | ---------------------------- |
| _-ayer_ (29 verbes)                                                               | j'essaye, j'essayerai   | j'essaie, j'essaierai        |
| _-eler_ / _-eter_ qui doublent hors _appeler_, _jeter_ et composés (≈ 100 verbes) | j'épelle, je feuillette | j'épèle, je feuillète (1990) |
| _é_er_ au futur (224 verbes)                                                      | j'espérerai             | j'espèrerai (1990)           |
| participe avec _être_, sujets _je, tu, nous, vous_                                | allé                    | allée, allés, allées         |

Les variantes sont calculées par le conjugueur (`accepted_forms`), jamais stockées.

### 1.5 L'index des verbes (recherche et validation)

Le catalogue parent cherche parmi **tous** les verbes non défectifs (7 771), mais le WASM ne doit
pas porter leurs infinitifs. L'index vit donc hors du moteur navigateur :

- `crates/lt-domain/data/verbs-index.txt` : un infinitif par ligne, avec son groupe (`finir\t2`),
  généré ; **embarqué dans le serveur** derrière la feature Cargo `lexicon` (activée par défaut,
  désactivée par `lt-domain-wasm`, comme `tz`). Le serveur l'utilise pour refuser un verbe inconnu
  dans les réglages.
- `apps/app/public/verbs/index.json` : le même index (≈ 60 Ko bruts, ≈ 20 Ko gzip), chargé **à la
  demande** par l'écran catalogue, mis en cache par le service worker en _stale-while-revalidate_
  (pas dans le précache : l'espace parent est rarement hors ligne et l'index n'est pas nécessaire
  pour une séance).
- Le client ne dépend de l'index que pour la recherche ; la conjugaison d'un verbe coché se fait
  dans le moteur, sans l'index.

### 1.6 Le pipeline `tools/verbs/`

Un paquet privé `@little-tables/verbs`, sur le modèle de `tools/golden` :

```
tools/verbs/
  package.json        devDependency french-verbs-lefff, script "generate"
  src/generate.ts     lit conjugations.json, classe chaque verbe, écrit les fichiers de §1.3 et §1.5
                      et le fixture de test de §7.1 ; refuse de continuer si une famille inconnue apparaît
  src/lists.ts        les listes à la main (§1.3), relues et versionnées dans le dépôt
```

- Les fichiers générés sont **versionnés** ; la génération est une étape de maintenance, pas de
  build. Un test CI (`tools/verbs` → `pnpm generate --check`) vérifie que la sortie est identique
  aux fichiers du dépôt, comme pour les fixtures de contrat.
- Chaque fichier généré porte en tête l'attribution Lefff et la licence LGPL-LR ; un
  `THIRD_PARTY_NOTICES.md` à la racine la reprend.
- Montée de version du Lefff : relancer la génération, relire le diff, régénérer le fixture.

---

## 2. Modèle

### 2.1 Identifiants et clés

| Objet    | Forme                                                                           | Exemple                      |
| -------- | ------------------------------------------------------------------------------- | ---------------------------- |
| verbe    | infinitif en minuscules, tel quel (accents compris, car c'est aussi un libellé) | `finir`, `réfléchir`, `être` |
| temps    | `present`, `imperfect`, `future`, `compound-past`                               | `compound-past`              |
| personne | entier 0..5 : je, tu, il/elle, nous, vous, ils/elles                            | `5`                          |
| sujet    | pronom affiché : `je`, `tu`, `il`, `elle`, `nous`, `vous`, `ils`, `elles`       | `elles`                      |
| clé      | `conj:{verbe}:{temps}`                                                          | `conj:finir:present`         |

`skill_for_key` reconnaît `["conj", verb, tense]` où `verb` est non vide, en minuscules et sans
`:`, et `tense` est l'un des quatre temps. La clé transporte des lettres accentuées ; SQLite,
Dexie et les snapshots stockent déjà des chaînes UTF-8 (`fact_key TEXT`), rien ne change.

### 2.2 Types Rust (`crates/lt-domain/src/model.rs`)

```rust
#[serde(rename_all = "kebab-case")]
pub enum Tense { Present, Imperfect, Future, CompoundPast }

#[serde(rename_all = "kebab-case")]
pub enum VerbGroup { First, Second, Third, Auxiliary }

#[serde(rename_all = "camelCase")]
pub struct ConjugationSettings {
    pub verbs: Vec<String>,                 // ≤ 60 infinitifs du catalogue, dans l'ordre d'ajout
    pub tenses: Vec<Tense>,                 // sous-ensemble ordonné des quatre temps
    pub focus: Option<ConjugationFocus>,    // « en ce moment en classe »
}
pub struct ConjugationFocus { pub verb: String, pub tense: Option<Tense> }

pub struct LearningPathSettings {
    pub enabled_skills: Vec<SkillId>,
    pub focus_skill: Option<SkillId>,
    pub mode: PathMode,
    pub subtraction_method: SubtractionMethod,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conjugation: Option<ConjugationSettings>,   // nouveau, facultatif
}

pub enum SkillId { …, Conjugation }                   // une variante : la compétence est le verbe
pub enum PathId { …, Conjugation }

#[serde(rename_all = "camelCase")]
pub struct ConjugationExercise {
    pub skill: SkillId,              // toujours Conjugation (même contrat que les autres exercices)
    pub verb: String,
    pub tense: Tense,
    pub person: u8,                  // 0..5
    pub subject: String,             // pronom affiché, élidé si besoin : "j'"
    pub expected: String,            // forme de référence, recalculée et vérifiée par le serveur
    pub choices: Vec<PracticeAnswer>,// 4 textes en découverte, vide en rappel
    pub letters: Vec<String>,        // banque de lettres en rappel (lettres + leurres, mélangées), vide sinon
}
pub enum Exercise { …, Conjugation(ConjugationExercise) }   // serde tag "kind" = "conjugation"

pub enum PracticeAnswer { …, Text { value: String } }       // tag "type" = "text"
```

`AttemptEvent` ne change pas : `exercise` et `response` portent déjà l'union. Les anciens
événements restent lisibles (variantes ajoutées, aucune retirée).

### 2.3 Le conjugueur (`crates/lt-domain/src/conjugation/`)

```
conjugation/
  mod.rs        API publique : lookup(verb) -> Option<Verb>, conjugate(verb, tense, person, subject) -> Form,
                accepted_forms(..), normalize(..), elide(subject, form)
  lexicon.rs    include_str! des données de §1.3 ; parse paresseux (LazyLock) en IndexMap<String, Verb>
  first_group.rs  classification d'un infinitif en -er dans ses familles et génération des formes
  rules.rs      terminaisons par temps ; imparfait depuis nous-présent ; futur depuis le radical ;
                passé composé = auxiliaire au présent + participe accordé
  exercise.rs   génération d'un exercice (personne, sujet, leurres, banque de lettres), vérification
  index.rs      #[cfg(feature = "lexicon")] l'index complet pour la validation serveur
```

**Familles du 1er groupe** (détectées sur l'infinitif, puis corrigées par `verbs-first-group.tsv`) :

| Famille | Détection                                                                                        | Présent                                  | Futur                                            |
| ------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------ |
| plain   | défaut                                                                                           | `-e -es -e -ons -ez -ent`                | infinitif + `-ai`                                |
| ger     | finit par `ger`                                                                                  | `nous mangeons`                          | régulier                                         |
| cer     | finit par `cer`                                                                                  | `nous lançons`                           | régulier                                         |
| double  | `eler`/`eter` listés (appeler, jeter + composés, et les ≈ 100 verbes qui doublent dans le Lefff) | `j'appelle`, `nous appelons`             | `j'appellerai`                                   |
| e-grave | `e` muet à l'avant-dernière syllabe (lever, acheter, geler…)                                     | `je lève`, `nous levons`                 | `je lèverai`                                     |
| e-acute | `é` à l'avant-dernière syllabe (espérer)                                                         | `j'espère`, `nous espérons`              | `j'espérerai` (référence), `j'espèrerai` accepté |
| yer-i   | finit par `oyer`/`uyer`                                                                          | `j'emploie`, `nous employons`            | `j'emploierai`                                   |
| ayer    | finit par `ayer`                                                                                 | `je paye` (référence), `je paie` accepté | `je payerai` / `je paierai`                      |

Les familles se **combinent** (_protéger_ = e-acute + ger, _dépecer_ = e-grave + cer) ; la liste
des familles doubles est petite et vient du fichier d'exceptions. _envoyer_ et _renvoyer_ y
portent leur radical de futur `enverr-`.

**2e groupe** : tout verbe en _-ir_ dont le Lefff donne `nous -issons` ; conjugaison depuis le
radical (`fin-`). _haïr_ est une exception du fichier (hais, hais, hait, haïssons…).

**3e groupe** : les six formes du présent, le radical du futur et le participe viennent du fichier ;
l'imparfait se dérive de _nous_ sauf pour _être_ (`ét-`). Les impersonnels n'ont que la personne 2.

**Passé composé** : auxiliaire au présent (être ou avoir, depuis `verbs-lists.json`, `avoir` par
défaut) + participe. Avec être, le participe s'accorde avec le sujet (`elle est allée`). Les sujets
proposés pour un verbe en être sont limités aux pronoms masculins (`il`, `ils`) à la 3e personne
(décision fonctionnelle §12.4), et les formes accordées sont acceptées aux autres personnes.

**Élision** : `je` devient `j'` devant une voyelle ou un _h_ muet ; la liste des _h_ aspirés du
catalogue (hacher, haïr, hurler, hausser, heurter, hisser, hocher, hanter, harceler, hennir…) est dans
`verbs-lists.json`. L'exercice porte le sujet déjà élidé (`"j'"`) et la forme sans le pronom.

**Normalisation d'une réponse** (`normalize`) : NFC, minuscules, espaces réduits à un, apostrophes
typographiques (’ ʼ) ramenées à `'`, trait d'union conservé. Les accents sont conservés : c'est
l'objet de l'exercice. `is_exercise_answer_correct` compare `normalize(réponse)` à
`normalize(référence)` ou à l'une des variantes acceptées. `describe_exercise` ajoute
`accentOnly: true` quand la réponse ne diffère de la référence que par des signes diacritiques
(retour « presque — il manque l'accent »).

### 2.4 Génération d'un exercice (`generate_exercise("conj:finir:present", rng, recall)`)

Dans cet ordre de tirages, pour rester déterministe avec la graine de séance :

1. **Personne** : un tirage dans les personnes possibles (6, ou 1 pour un impersonnel). Pour
   limiter les répétitions dans une séance, le générateur reçoit, comme aujourd'hui, le `Rng`
   partagé ; la séance ne contient jamais deux fois la même clé (dédoublonnage existant), donc deux
   questions sur _finir au présent_ ne se suivent pas dans un même arrosage.
2. **Sujet** : à la 3e personne, un tirage entre masculin et féminin (sauf verbe en être au passé
   composé : masculin), puis élision.
3. **Référence** : `conjugate(verb, tense, person, subject)`.
4. **Découverte** (`recall == false`) : 4 tuiles = référence + 3 leurres, tirés dans cet ordre de
   priorité parmi les familles de la spec fonctionnelle §4.3, dédoublonnés, différents de la
   référence et de toute variante acceptée, puis mélangés :
   - autre personne, même temps (tirage parmi les cinq autres formes) ;
   - autre temps, même personne (parmi les temps cochés, sinon les quatre) ;
   - désinence phonétiquement cohérente (table de substitutions sur la terminaison, par exemple
     `ent → e`, `ent → es`, `ent → ant`, `ais → ai`, `ais → é`, `ons → on`, `ez → é`, `é → er`, `é → ez`,
     `it → is`, `is → it`, `ssent → sent`) ;
   - contamination du 1er groupe pour un verbe du 2e (`ils finient`, `nous finons`) ;
   - en dernier recours, une autre personne encore.
5. **Rappel** (`recall == true`) : `choices` vide et `letters` = lettres de la référence (avec
   l'espace du passé composé) + leurres : la ou les lettres de la terminaison alternative la plus
   plausible (par exemple `e`, `z` quand la réponse finit par `ent`), complétées par des lettres
   fréquentes jusqu'à atteindre 12 tuiles (18 au-delà de 11 lettres), le tout mélangé. Le
   client ne pioche rien d'autre : il n'y a pas d'aléa côté interface.

`is_production_exercise(Conjugation)` = `choices.is_empty()`. `is_exercise_well_formed` vérifie :
verbe connu du moteur (`lookup`), personne valide pour le verbe, sujet cohérent avec la personne,
`expected == conjugate(..)`, 4 tuiles distinctes contenant la référence en découverte, `letters`
contenant toutes les lettres de la référence en rappel.

### 2.5 Intégration dans le moteur existant

| Point                      | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InteractionFamily`        | nouvelle variante `Letters` ; `interaction_family("conj:…") == Letters`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `SkillDefinition`          | une entrée `Conjugation` (path `Conjugation`, gate `All`, weight 1.0) ; `skill_weight` renvoie **1.5** pour une clé `conj:` en rappel (le poids dépend de la question, pas de la clé : `Candidate::weight` consulte `mastery.state.is_stable()`)                                                                                                                                                                                                                                    |
| `latency_limit_ms`         | `None` pour `conj:` (déjà le comportement par défaut pour les compétences générées)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `SkillDefinition::keys`    | pour `Conjugation` : `settings.conjugation` → produit `verbs.rev() × tenses` (dernier verbe coché d'abord, temps dans l'ordre présent, imparfait, futur, passé composé) ; `prerequisite` = `true` ; aucune ouverture automatique (`derive_open_skills` traite `Conjugation` comme forcée dès qu'un verbe et un temps sont cochés)                                                                                                                                                   |
| `create_session`           | rien de plus : les clés entrent dans le vivier via `open_skills`, avec `skill_index` = rang d'introduction ; `limit_families` garde ≤ 2 familles, `Letters` comprise                                                                                                                                                                                                                                                                                                                |
| Focus                      | `LearningPathSettings.conjugation.focus` devient un **focus par clé** : `focus_keys: Vec<String>` (les clés du verbe, filtrées par le temps s'il est donné). Le code de `focus_candidates` filtre sur `candidate.key()` au lieu de `fact.skill` quand un focus conjugaison est présent ; le reste (`fill_focus`, moitié du budget) est inchangé. Un `focus_skill` maths et un focus conjugaison en même temps : le focus conjugaison l'emporte (un seul « en ce moment en classe ») |
| `answer`                   | `selected` reste 0 pour une réponse `Text` ; `response` porte le texte                                                                                                                                                                                                                                                                                                                                                                                                              |
| `mastery_state`            | inchangé : le rappel à la banque de lettres est un `Keypad`, donc la preuve de rappel existante                                                                                                                                                                                                                                                                                                                                                                                     |
| `derive_learning_progress` | nouveau champ `conjugation: Vec<VerbProgress { verb, group, tenses: Vec<TenseProgress { tense, state }> }>` à côté de `paths` ; `paths` ne liste pas la conjugaison (ses compétences ne sont pas des `SkillId` fixes)                                                                                                                                                                                                                                                               |
| `derive_insights`          | `Struggle` reçoit `persons: Vec<PersonStruggle { person, mistakes }>` (calculé depuis `exercise.person` des tentatives fausses) et `common_wrong_answer` fonctionne déjà avec `Text`                                                                                                                                                                                                                                                                                                |
| `derive_session_insight`   | `displayFact` côté client lit `conj:` (§5.4) ; le moteur ne change pas                                                                                                                                                                                                                                                                                                                                                                                                              |
| `api.rs`                   | nouvelles opérations : `conjugate { verb, tense }` → les six formes (fiche verbe), `verbInfo { verb }` → groupe, auxiliaire, modèle, impersonnel ; `describeExercise` enrichi (`accentOnly`, `reference`, `breakdown: { stem, infix, ending }` pour l'indice)                                                                                                                                                                                                                       |
| Vecteurs dorés             | **inchangés** : sans `conjugation` dans les réglages, aucune clé n'est ajoutée et aucun tirage supplémentaire n'a lieu                                                                                                                                                                                                                                                                                                                                                              |

Le découpage `breakdown` (radical / marque de temps / marque de personne) est calculé par les
règles : pour le 2e groupe `fin` · `iss` · `ent`, pour l'imparfait `finiss` · `ai` · `ent`, pour le
futur `finir` · `` · `ont`, pour le 3e groupe le radical est la partie commune aux six formes
(`peu`/`pouv` → le découpage montre la forme entière avec la terminaison seule en couleur).

---

## 3. Réglages et contrat `/api/v2`

- **Schéma** : `LearningPathSettings.conjugation` facultatif ; dans `packages/engine/src/schema.ts` :

  ```ts
  export const Tense = Schema.Literal('present', 'imperfect', 'future', 'compound-past')
  export const ConjugationSettings = Schema.Struct({
    focus: Schema.NullOr(Schema.Struct({ tense: Schema.NullOr(Tense), verb: Schema.NonEmptyString })),
    tenses: Schema.Array(Tense).pipe(Schema.maxItems(4)),
    verbs: Schema.Array(Schema.NonEmptyString).pipe(Schema.maxItems(60)),
  })
  export const LearningPathSettings = Schema.Struct({ …, conjugation: Schema.optional(ConjugationSettings) })
  ```

- **Endpoint** : `PUT /api/v2/family/profiles/{id}/learning-paths` inchangé. Le serveur ajoute à
  sa validation : verbes distincts, tous dans l'index (`lt_domain::conjugation::index`), ≤ 60 ;
  temps distincts ; focus cohérent (verbe coché, temps coché ou `null`). Sinon
  `400 invalid_learning_paths`.
- **Stockage** : la colonne JSON `profiles.learning_paths` absorbe le nouveau champ. **Pas de
  migration.** Un profil sans le champ est servi sans lui (`skip_serializing_if`), et le client
  applique le défaut `undefined` → sentier fermé.
- **Fixtures de contrat** : `crates/lt-server/tests/v2.rs` ajoute un profil avec réglage
  conjugaison dans `v2-responses.json` (régénération avec `UPDATE_CONTRACT=1`), et
  `packages/api-contract` le décode en mode strict.
- **Ingestion** : `decode_attempt` reconnaît déjà un exercice avec `left == right == 0` ;
  `rejection_reason` passe par `validate_exercise_attempt`, qui recalcule la forme. Aucune route
  nouvelle. Les tentatives ne portent pas le réglage : un verbe décoché après coup reste validable.
- **Insights** : `GET /profiles/{id}/insights` renvoie `persons` dans chaque `Struggle` (champ
  ajouté, facultatif côté schéma pour la compatibilité des clients en cache).

---

## 4. Client (`apps/app`)

### 4.1 Flux de données

- `useLearningProgress(state, paths)` lit `progress.conjugation` pour D7, la feuille Autres séances
  et l'écran parent. Rien à charger de plus : le moteur connaît les verbes cochés via `paths`.
- Nouvelle politique dans `data/practice.ts` : `policies.verb(paths, verb)` = 8 questions,
  `focus: { verb, tense: null }`, 2 questions d'ailleurs (règle `focusTable`). Le `PracticePolicy`
  gagne `focusVerb?: { verb, tense }` (hors arrosage, comme `focusSkill`).
- Index des verbes : `data/verbs-index.ts` charge `/verbs/index.json` avec `fetch` dans un
  `Effect` mis en cache en mémoire ; recherche sans accents (`normalize('NFD')` + suppression des
  diacritiques), sur le préfixe puis la sous-chaîne, 20 résultats au plus.

### 4.2 Nouvelles briques (`packages/ui`)

- `LetterBank` (`practice.tsx`) : `letters: ReadonlyArray<string>`, `value`, `onKey(letter | 'erase' | 'submit')`,
  `disabled`. Rangées de 6 (`grid-cols-6`), tuiles `min-h-14` (56 pt), lettre en `text-title-2`
  `font-black` ; une tuile consommée passe en `opacity-45` et `aria-disabled`. L'espace est une tuile
  `␣` nommée « espace ». ⌫ et ✓ reprennent le style du `NumberPad`. Clavier physique : `onKeyDown`
  au niveau du panneau (lettres présentes dans la banque, Backspace, Enter) ; les touches absentes
  sont ignorées sans message.
- `AnswerTiles` : prop `size: 'number' | 'word'` ; `word` passe la police à `text-title-2` et
  autorise `break-words` sur une seule ligne (`whitespace-nowrap`, réduction à `text-title-3`
  au-delà de 11 caractères).
- `VerbChip` et `FormBreakdown` (`display.tsx`), sans logique.

### 4.3 Séance

- `question-view.tsx` : `case 'conjugation'` → `ConjugationQuestion` : `VerbChip` (verbe + temps
  en français, `conj.tense.*` non traduit), sujet en `bigText`, `Blank` avec le texte saisi, puis
  `ChoiceTiles` (`size="word"`) ou `LetterBank`. `Response` = `{ response: { type: 'text', value } }`.
- `session-screen.tsx` : la bulle utilise `expectedAnswerText` étendu au `Text` ; quand
  `description.accentOnly`, le texte « presque — il manque l'accent : {reference} ».
- `hints.tsx` : `ConjugationHint` avec `FormBreakdown(description.breakdown)` et les cinq
  stratégies (marque de personne, radical qui change, verbe cousin via `verbInfo.model`, marque du
  temps, auxiliaire + participe). Le choix de la stratégie suit la réponse fausse : personne
  différente → marque de personne ; temps différent → marque du temps ; sinon radical.
- `format.ts` : `formatAnswer` / `answerWords` pour `Text` ; `levelLabel('conj:finir:present')` →
  « finir au présent » (`conj.level` = `{verb} {tense}` avec `conj.tense.present` = « au présent ») ;
  `exerciseStatement` et `spokenPrompt` : « ils… finir, au présent ».

### 4.4 Espace parent

- Routes : `/parents/children/$profileId/verbs` (catalogue, P2) ; la fiche verbe (P3) est une
  `Sheet` du catalogue.
- `child-screens.tsx` (`SchoolSettings`) : groupe « Conjugaison » (ligne Les verbes, 4 `Switch`
  de temps, note), et la liste « En ce moment en classe » reçoit, après les compétences maths, une
  ligne par verbe coché (`focus: { verb, tense: null }`) ; le choix d'un temps se fait dans la
  fiche verbe. `persist` envoie toujours l'objet complet.
- `verbs-screen.tsx` : recherche (`TextField` + index), carte programme (`Tout cocher` = union
  des 8 verbes), sections depuis `verbs-lists.json` servi dans l'index (`sections` du JSON), lignes
  avec les trois formes témoins obtenues par `engine.conjugate` (je, nous, ils au présent),
  `Switch` optimiste comme aujourd'hui. Un verbe trouvé par la recherche mais hors sections
  s'affiche sous « Autres verbes ».
- `verb-sheet.tsx` : `engine.conjugate(verb, tense)` pour les six formes, `FormBreakdown` par
  ligne, `SegmentedControl` des temps, `Switch` « dans l'arrosage de {name} » et bouton « en ce
  moment en classe » (focus `{ verb, tense }`).
- `insights-screen.tsx` : sous-titre « surtout avec nous et vous » depuis `persons`.

### 4.5 Stockage local et sync

- Dexie : les schémas Effect `Exercise` et `PracticeAnswer` s'élargissent ; aucun index ne change,
  **pas de montée de version**.
- Les événements de conjugaison transitent par l'outbox existant. Un ancien client qui recevrait
  (via bootstrap) un snapshot avec des clés `conj:` les ignore dans l'interface, sans erreur : les
  clés inconnues passent déjà par `levelLabel` qui renvoie la clé brute.

### 4.6 i18n

- Nouveaux groupes de clés dans `i18n/messages/conjugation.ts` (`en`, `fr`, `zh`) : `conj.tense.*`
  (libellés français, identiques dans les trois langues, plus `conj.tenseHelp.*` traduits pour
  l'espace parent), `conj.pronoun.*`, `conj.touchForm`, `conj.writeForm`, `conj.hint.*`,
  `conj.level`, `verbs.*` (catalogue), `school.conjugation*`, `hard.persons`.
- `i18n.test.ts` continue de vérifier que chaque langue a chaque clé et les mêmes variables.

---

## 5. Serveur (`crates/lt-server`)

- `v2.rs::update_learning_paths` : validation de §3 (fonction pure `validate_learning_paths` dans
  `lt-domain`, testée unitairement, réutilisée par l'import).
- `ingestion.rs` : aucun changement de code ; les tests ajoutent une tentative de conjugaison juste,
  une fausse, une avec `expected` falsifié (rejetée `inconsistent_attempt`) et une en découverte
  dont la réponse n'est pas parmi les tuiles (rejetée).
- Feature Cargo `lexicon` activée pour `lt-server` (index complet) ; `lt-domain-wasm` la désactive.
- Rappels Web Push : le texte devient neutre (« un petit calcul ou un verbe… ») — même décision que
  pour les maths, à traiter dans `lt-push` avec les trois langues.

---

## 6. Taille, performance, hors ligne

- WASM : + ≈ 22 Ko gzip attendus (données + code). Le script `tools/build-wasm.sh` fait respecter
  le budget ; on mesure au premier lot et on remonte le budget à 320 Kio seulement si nécessaire,
  en le disant dans la PR.
- Parse du lexique : `LazyLock` au premier `lookup`, ≈ 400 lignes, négligeable.
- `conjugate` est pur et sans allocation notable ; `create_session` en appelle au plus 8 par séance.
- Hors ligne : rien de nouveau n'est requis pour une séance. Le catalogue parent sans réseau
  utilise l'index en cache s'il existe, sinon affiche les sections (qui viennent du moteur) et
  désactive la recherche avec un message.

---

## 7. Tests

### 7.1 Oracle Lefff

- `tools/verbs` écrit `crates/lt-domain/tests/fixtures/lefff-forms.json.gz` : pour chaque verbe non
  défectif, les 6 formes de P, I, F et le participe (≈ 7 771 × 19 chaînes, ≈ 250 Ko gzip, dans la
  même lignée que les vecteurs dorés).
- `crates/lt-domain/tests/conjugation.rs` : pour chaque verbe, `conjugate` égale la forme Lefff
  pour les trois temps simples ; les variantes de §1.4 sont vérifiées dans `accepted_forms`. Un
  verbe qui échoue bloque la CI : c'est le test qui garantit « le dictionnaire est exhaustif ».
- Passé composé : vecteurs à la main pour les verbes en être (accords) et les impersonnels.

### 7.2 Propriétés (`proptest`)

- `normalize` est idempotente et conserve les accents.
- En découverte, les 4 tuiles sont distinctes, contiennent la référence, et aucun leurre n'est
  une forme acceptée.
- En rappel, `letters` contient chaque lettre de la référence au moins autant de fois qu'elle y
  apparaît.
- `generate_exercise` est déterministe pour une graine donnée.
- Un arrosage avec réglage conjugaison contient ≤ 2 familles, ≤ 2 nouveautés, et jamais deux fois
  la même clé.

### 7.3 Non-régression

- Vecteurs dorés et `new_items.rs` inchangés et verts.
- Contrat `/api/v2` (`v2.rs` + `api-contract`) avec le nouveau profil.
- Vitest : `LetterBank` (saisie, effacement, clavier physique, accessibilité avec axe),
  `ConjugationQuestion` (découverte et rappel), `verbs-screen` (recherche sans accents, cocher,
  programme), `levelLabel` et `formatAnswer` pour `Text`.
- `tools/verbs --check` en CI : les fichiers générés sont à jour.
- `pnpm check` et `pnpm doctor` à chaque lot.

---

## 8. Lots de livraison

| Lot | Contenu                                                                                                                                                                                                             | Sortie                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| C0  | `tools/verbs`, données de §1.3 et §1.5, `THIRD_PARTY_NOTICES.md`, module `conjugation/` (lexique, familles, règles, variantes, normalisation), oracle Lefff, opérations `conjugate` / `verbInfo`                    | moteur vert, aucun changement visible |
| C1  | Types (`Tense`, `ConjugationSettings`, `Exercise::Conjugation`, `PracticeAnswer::Text`), `skill_for_key`, clés et vivier, générateur en **découverte** (tuiles, leurres), validation, contrat, schémas TS, fixtures | moteur et serveur prêts               |
| C2  | Espace parent : groupe Conjugaison, catalogue, fiche verbe, focus ; `VerbChip` ; `ConjugationQuestion` en tuiles ; retour ; `levelLabel` ; D7 ; Autres séances ; i18n                                               | **première version utilisable**       |
| C3  | `LetterBank`, génération en rappel, variantes acceptées et `accentOnly`, indices avec `FormBreakdown`, `persons` dans Ce qui coince                                                                                 | parité avec la spec fonctionnelle     |
| C4  | « quel temps ? », étiquettes (fonctionnelle §4.4), rappels Web Push neutres                                                                                                                                         | plus tard                             |

Chaque lot est une PR ; C0 et C1 peuvent être fusionnés sans effet pour les familles (aucun
réglage ne les active).

---

## 9. Risques

| Risque                                                      | Mitigation                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Conjugueur par règles faux sur un verbe rare                | l'oracle Lefff couvre tous les verbes ; une divergence est un test rouge, pas un bug en production                                |
| Budget WASM                                                 | données ≈ 12 Ko gzip ; mesure au lot C0, marge de 50 Kio                                                                          |
| Désaccord école / référence (1990, _essaie_)                | variantes acceptées (§1.4) ; la forme de l'école n'est jamais comptée fausse                                                      |
| Liste des verbes en être, h aspiré, impersonnels incomplète | listes à la main relues ; le fichier est une donnée, une correction est une PR d'une ligne                                        |
| Index 20 Ko sur mobile parent                               | chargé à la demande, en cache SWR ; recherche en mémoire                                                                          |
| Réglage avec un verbe retiré du catalogue                   | le serveur refuse les nouveaux réglages inconnus ; les clés déjà apprises restent dans le snapshot et sont ignorées par le vivier |

---

## 10. Points ouverts (valeur par défaut)

1. **Focus par verbe plutôt que par couple verbe · temps** dans l'arrosage : retenu (§2.5) ; la
   fiche verbe permet tout de même de préciser un temps, qui filtre les clés mises en avant.
2. **Référence Lefff + variantes acceptées** plutôt que référence rectifiée 1990 : retenu (§1.4),
   une seule source de vérité ; à revoir si une école impose 1990 dans les retours.
3. **Pronom _on_** : non (fonctionnelle §12).
4. **Verbes en être à la 3e personne** : masculin seulement ; si l'on veut _elle est allée_ plus
   tard, c'est une donnée (`subjects`) et non une règle à changer.
5. **Index hors WASM** : retenu ; l'alternative (36 Ko gzip dans le moteur) reste possible si le
   chargement à la demande gêne.
6. **Limite de 60 verbes cochés** : par profil ; au-delà, le catalogue affiche « retire un verbe
   d'abord ».
