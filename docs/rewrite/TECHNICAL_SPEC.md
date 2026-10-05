# little tables — Spécifications techniques de la réécriture

Statut : **v0.2 (5 octobre 2026) · prête pour le lot 1**. Les points encore ouverts sont regroupés en §8.4 avec,
pour chacun, la valeur retenue par défaut si personne ne tranche.

Ce document décrit la réécriture complète de little tables avec :

- **Rust** pour le serveur et pour le moteur pédagogique partagé ;
- **Effect v3 / TypeScript** pour toute la logique applicative côté client (services, schémas, hors-ligne, sync) ;
- **React** pour l'interface ;
- un **système de composants de type shadcn/ui** (primitives Radix, Tailwind CSS v4, variantes CVA), adapté aux Human
  Interface Guidelines d'Apple.

La réécriture conserve toutes les fonctionnalités existantes. Les références :

- **Inventaire de l'existant** : boards 00 à 13 de [`design/little-tables-rewrite.pen`](../../design/little-tables-rewrite.pen),
  captures dans [`design/assets/legacy/`](../../design/assets/legacy/). La matrice de couverture (board 13) renvoie
  vers les sections de ce document.
- **Maquettes du redesign** : boards R0 à R5 du même fichier, exportées dans [`design/exports/`](../../design/exports/).
  Elles font foi pour l'interface (§6).

---

## 1. Objectifs et non-objectifs

### 1.1 Objectifs

1. **Parité fonctionnelle totale** avec l'application actuelle (§3 à §5 et matrice de couverture).
2. **Expérience mobile excellente**, iPhone d'abord, conforme aux HIG : zones tactiles ≥ 44 pt, action principale
   au pouce, feuilles, grands titres, safe areas, taille de texte réglable, mode sombre, mouvement réduit.
3. **Une seule implémentation du moteur pédagogique**, exécutée à l'identique sur le serveur (natif) et dans le
   navigateur (WebAssembly).
4. **Hors-ligne d'abord** conservé : une séance entière sans réseau ; sync transparente.
5. **Espace enfant et espace parent séparés** (absent aujourd'hui).
6. Dette corrigée (board 12) : déconnexion, CSRF, admin codé en dur, recalcul complet à chaque bootstrap, clés mortes.

### 1.2 Non-objectifs

- Application native App Store (on reste une PWA).
- Nouveaux contenus pédagogiques au-delà des 11 compétences actuelles.
- Sign in with Apple (décision §8.2).
- Changement d'hébergement : même VPS, même Caddy, même port `32140`. Seul le mode de déploiement change (§7.3).
- « Se déconnecter de tous les appareils » : la déconnexion ne concerne que l'appareil courant (§5.2).

---

## 2. Architecture cible

### 2.1 Vue d'ensemble

```
┌──────────────────────────── Navigateur (PWA) ────────────────────────────┐
│ React 19 + TanStack Router  ──  UI (packages/ui, style shadcn + HIG)      │
│        │                                                                  │
│ Effect v3 runtime (ManagedRuntime)                                        │
│   ├─ DomainEngine  ──► lt-domain.wasm (Rust → wasm-bindgen)               │
│   ├─ LocalStore    ──► IndexedDB (Dexie) : events, outbox, state          │
│   ├─ SyncService   ──► HttpClient Effect (schémas api-contract)           │
│   ├─ Auth, Profile, ParentLock, Reminder, Pwa, Preferences, I18n          │
│ Service worker (Workbox) : précache (bundles + wasm + art), push          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ HTTPS JSON /api/v2 (cookie de session)
┌───────────────────────────────────▼──────────────────────────────────────┐
│ Serveur Rust (axum + tokio), un binaire ; release = binaire + build web   │
│   ├─ lt-domain (natif)   ├─ lt-server (routes, config, import, CLI)       │
│   ├─ lt-store (SQLite)   ├─ lt-auth (Google ID token, session, CSRF, PIN) │
│   ├─ lt-push (Web Push VAPID, worker de rappels)                          │
│   └─ adaptateur /api/v1 (transition, retiré au lot 5)                     │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                SQLite (WAL) · /var/lib/little-tables/little-tables.db
```

### 2.2 Organisation du dépôt

Workspace pnpm + workspace Cargo dans le même dépôt.

```
crates/
  lt-domain/        moteur pédagogique pur (sans I/O, sans horloge, sans aléa implicite)
  lt-domain-wasm/   bindings wasm-bindgen (JSON in / JSON out)
  lt-auth/          vérification Google, session HMAC, CSRF, code parent
  lt-store/         SQLite (sqlx), migrations, projection des snapshots
  lt-push/          Web Push, worker de rappels
  lt-server/        binaire axum, config, adaptateur v1, PWA servie, import Mongo vérifié, commandes admin
apps/
  web/              PWA React
packages/
  ui/               système de composants + tokens
  api-contract/     schémas Effect et client de l'API v2 (écrits à la main, vérifiés contre le serveur, §2.4)
  engine/           façade Effect autour de lt-domain.wasm (l'ancien packages/domain disparaît au lot 5)
  local-store/      Dexie + schémas Effect
  i18n/             catalogues fr / en / zh-Hans typés
tools/
  golden/           moteur TS actuel gelé + générateur de vecteurs de test (§7.2)
  build-wasm.sh     compilation du moteur pour le navigateur, budget de taille contrôlé
deploy/             unité systemd, timer de sauvegarde, Caddy, script de release
```

### 2.3 Choix structurants

| Sujet                 | Choix                                                                           | Pourquoi                                                                               |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Moteur partagé        | Crate Rust `lt-domain`, natif + WASM                                            | Une seule source de vérité, exécutée à l'identique hors-ligne et au serveur.           |
| Framework HTTP        | axum 0.8 + tokio + tower-http                                                   | Standard de fait, middlewares (compression, traces, limites).                          |
| Base de données       | SQLite (WAL) via `sqlx`, bibliothèque embarquée                                 | Usage familial, zéro service à opérer, sauvegarde `.backup`, aligné sur le VPS (§5.7). |
| Contrat API           | Types Rust → JSON Schema ; schémas Effect vérifiés contre lui en CI             | Pas de générateur de code à maintenir ; toute dérive casse la CI (§2.4).               |
| Client logique        | Effect v3 (Layer, Context.Tag, Schema, Schedule)                                | Erreurs explicites, retries, ressources, testabilité.                                  |
| Cache serveur côté UI | TanStack Query alimenté par des programmes Effect                               | Cache, invalidation, états de chargement éprouvés.                                     |
| Routage               | TanStack Router                                                                 | Loaders, préchargement des illustrations, garde d'accès dans le routeur.               |
| Composants            | shadcn/ui copié dans le dépôt, Radix, Tailwind v4, CVA, Vaul (feuilles), Sonner | Composants possédés, accessibles, adaptés aux HIG.                                     |
| Animations            | `motion` + CSS                                                                  | Ressorts, `AnimatePresence`, `prefers-reduced-motion`.                                 |
| Stockage local        | IndexedDB via Dexie, schémas Effect                                             | Continuité, migration des bases existantes (§4.6).                                     |

### 2.4 Contrat entre Rust et TypeScript

1. Les schémas Effect de `packages/api-contract` sont **écrits à la main** (lisibles, annotés), en réutilisant ceux du
   moteur (`@little-tables/engine/schema`).
2. `crates/lt-server/tests/v2.rs` appelle chaque endpoint et enregistre une réponse par endpoint dans
   `tests/fixtures/v2-responses.json` ; le test compare la **forme** (clés et types) des réponses à celle du fichier
   versionné (`UPDATE_CONTRACT=1` le régénère).
3. `packages/api-contract` décode ce fichier avec ses schémas en mode strict (propriétés en trop refusées). Une dérive
   côté Rust casse le premier test, une dérive côté TypeScript le second. Plus simple qu'un export JSON Schema
   (schemars) et sans générateur de code.
4. Le WASM reçoit et renvoie du JSON (`serde-wasm-bindgen`) ; la façade `packages/engine` décode ses sorties avec les
   mêmes schémas. Les dates traversent la frontière en millisecondes UTC, les clés de jour en chaînes `YYYY-MM-DD`.

---

## 3. Moteur pédagogique (`lt-domain`)

Le moteur est une **réécriture fidèle** des règles actuelles (`packages/domain`), prouvée par les vecteurs dorés
(§7.2). Les règles exhaustives sont au board 11 du fichier Pencil ; ce chapitre fixe le périmètre, l'API et les
quelques changements assumés.

### 3.1 Réglages de parcours (par profil)

- `LearningPathSettings { enabledSkills (≤ 11), focusSkill | null, mode: automatic | manual, subtractionMethod: compensation | decomposition }`,
  défaut `{ [], null, automatic, compensation }`.
- Une compétence cochée est toujours ouverte ; en mode automatique elle s'ouvre si les 55 faits de base sont
  familiers ou fluides **et** que son prérequis est rempli. Niveaux ouverts en séquence selon la porte (`all`, `seen`,
  `familiar`).
- `subtractionMethod` n'affecte que l'affichage et les indices, jamais la correction.

### 3.2 Exercices

- 11 compétences, 3 parcours ; clés, générateurs, `expectedAnswer`, `isExerciseWellFormed`, `isProductionExercise`,
  `validateExerciseAttempt` identiques à l'existant.
- Types : `arithmetic`, `column`, `fraction-read` (lire / construire), `fraction-equal`, `fraction-pick`,
  `fraction-line` (lire / placer), `fraction-compare`, `fraction-operation` (dont histoire).
- Réponses : `integer`, `fraction` (entier 0..2), `comparison`, `tick`, `selection`. Équivalences de fractions acceptées.

### 3.3 Séance

- Questions × et ÷ : tuiles (4 choix) tant que le fait n'est pas familier, puis pavé.
- Erreur : copie de la question 3 places plus loin, dernière question retirée (longueur constante).
- Latence mesurée (3 s pour ×/÷, 4 s pour +/−, aucune limite pour les colonnes) ; jamais affichée à l'enfant.
- Astuces : rangées, commutativité, pont depuis un fait fluide (ancres 10, 5, 2, 1, 12, 11, 9, 8, 7, 6, 4, 3) ;
  parcours : cadres de dix, sauts, blocs base 10, doubles/moitiés, colonne par colonne, plates-bandes, règle.
  **Changement assumé** : l'astuce de la droite graduée ne révèle plus la position exacte (board 05b).

### 3.4 Composition des séances

- Arrosage du jour : budget `min(8, max(5, dus_ou_fragiles))` points ; ≤ 2 opérations posées ; ≤ 2 familles
  d'interaction ; focus école ≈ moitié des points.
- Séances alternatives : 5 rapides ; focus table (8) ; 11·12 (8) ; division (6) ; compétence (8, ou 9 pour une colonne).
- RNG : LCG `state = state × 1664525 + 1013904223 (mod 2³²)`, Fisher-Yates depuis la fin. **Bit-exact** (§7.2).
- La limite « ≤ 2 nouveaux éléments par séance » de la spec CE2 n'était pas tenue par l'ancien code : l'arrosage
  complétait avec d'autres nouveautés quand les révisions ne remplissaient pas le budget, et un focus parent en
  ajoutait au-delà de deux. Le lot 1 reproduit ce comportement bit à bit (`algorithmVersion: "1"`, vecteurs dorés).
  **Version 2** (décidée le 5 octobre 2026, utilisée par la nouvelle PWA) : l'arrosage du jour ajoute au plus 2
  éléments jamais vus, focus et sentiers compris ; si les révisions ne remplissent pas le budget, la séance est plus
  courte. Exception : un enfant sans rien à réviser garde l'introduction de 5 questions. La politique porte
  `algorithmVersion: "2"`, la séance aussi, et chaque événement l'enregistre (le serveur le conserve). Le calcul
  de maîtrise ne change pas : le snapshot reste en version 1.

### 3.5 Jardin et récompenses

- 1 floraison par jour d'apprentissage, uniquement via l'arrosage du jour ; ledger fusionné par max + union.
- 9 fleurs, 3 chapitres, 3 floraisons par fleur ; fleurs de fin de chapitre verrouillées jusqu'à 5 / 15 / 30 faits fluides.
- Ordre des fleurs personnalisé par profil (préfixe historique conservé pour les profils existants).
- Récompenses : collection, pot rose (5 floraisons), étincelles (10 fluides), décors de chapitres.
- Insight de fin de séance par priorité : enracinés > familiers > erreurs rattrapées > rappels au pavé > faits pratiqués.

### 3.6 Rythme

- Semaine = 7 derniers jours ; « semaine fleurie » à 3 jours ; retour court ≥ 2 jours, long ≥ 7 jours.
- Pétales : 5 si l'arrosage est fait, sinon `min(4, ceil(index / total × 5))`.

### 3.7 API du crate

```rust
pub type UnixMillis = i64;          // horodatage UTC
pub type DayKey = String;           // "YYYY-MM-DD", calculé par l'appelant dans le fuseau du learner

pub fn reduce(snapshot: &LearningSnapshot, attempts: &[AttemptEvent]) -> LearningSnapshot;
pub fn create_session(input: &SessionInput, policy: &SessionPolicy, now: UnixMillis, today: &DayKey, seed: u32) -> PracticeSession;
pub fn answer(session: &PracticeSession, response: &PracticeAnswer, at: UnixMillis, day: &DayKey, event_id: &str) -> AnswerOutcome;
pub fn validate_attempt(attempt: &AttemptEvent) -> Result<(), AttemptRejection>;
pub fn derive_open_skills(..) / derive_path_progress(..) / derive_learning_progress(..);
pub fn derive_practice_rhythm(.., today: &DayKey) -> PracticeRhythm;
pub fn derive_garden_reward_ledger(..) / merge_garden_reward_ledgers(..) / derive_garden_progress(..) / derive_rewards(..);
pub fn derive_session_insight(..) / derive_rescue_strategies(..);
pub fn derive_insights(attempts: &[AttemptEvent], range_days: u16, today: &DayKey) -> ParentInsights;   // §5.6
```

Contraintes :

- pas d'I/O, pas d'horloge ni d'aléa implicites ; `seed`, `now`, `today` et `event_id` sont fournis par l'appelant ;
- **aucune base de fuseaux horaires dans le WASM** : les clés de jour sont calculées côté client avec `Intl`
  (comportement actuel, `learningDayKey` est déjà stocké dans chaque événement). Le serveur n'a besoin de fuseaux que
  pour les rappels (`chrono-tz`, natif uniquement, feature-gated) ;
- `reduce` applique les événements dans l'ordre fourni ; c'est l'appelant qui trie par `(answeredAt, sequence)` (§5.4) ;
- `AttemptEvent` gagne un champ optionnel `algorithmVersion` (défaut `"1"` à la lecture d'anciens événements).

---

## 4. Client : hors-ligne, stockage et sync (Effect v3)

### 4.1 Services Effect

| Service             | Rôle                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `DomainEngine`      | Façade typée du WASM, chargement paresseux, `Effect.cached`.                                             |
| `LocalStore`        | IndexedDB par profil ; transactions ; erreurs taguées (`StoreDecodeError`, `QuotaExceeded`).             |
| `PracticeService`   | Démarrer, répondre, reprendre, terminer une séance (transactionnel).                                     |
| `SyncService`       | Vider les outbox, bootstrap, fusion, renouvellement. `Schedule` exponentiel avec jitter, plafonné.       |
| `AuthService`       | Statut, grant hors-ligne, connexion, déconnexion, onboarding du prénom.                                  |
| `ProfileService`    | Profils, profil actif, réglages scolaires, heure de rappel.                                              |
| `ParentLockService` | Définir / vérifier / réinitialiser le code parent, cache hors-ligne (§6.4).                              |
| `ReminderService`   | Permission, abonnement push, locale et fuseau.                                                           |
| `PwaService`        | Enregistrement du SW, mises à jour, récupération après erreur, installation.                             |
| `Preferences`       | Réglages appareil : langue, son, apparence, taille du texte, cartes vues (localStorage, schémas Effect). |
| `I18n`, `Sound`     | Catalogues et carillon.                                                                                  |

Le runtime est un `ManagedRuntime` unique ; les tests remplacent les couches par des doubles en mémoire. Pas de
service « haptique » : `navigator.vibrate` est appelé en best-effort depuis `Sound` et n'est jamais porteur
d'information.

### 4.2 Modèle de données local (IndexedDB)

Base `little-tables-v3:{profileId}` :

- `events` : `&eventId, sessionId, [sessionId+sequence], answeredAt` ;
- `outbox` : `&eventId, createdAt` ;
- `state` : une ligne `current` (séance active, snapshot, dernière complétion, ledger, collection, jours) ;
- `meta` : `algorithmVersion`, `schemaVersion`, compteur et dernières raisons des événements rejetés par le serveur.

Les écritures d'une réponse (événement + outbox + état) sont **atomiques** (une transaction Dexie).

Hors base : `little-tables:preferences` (langue, son, apparence, taille du texte), `little-tables:active-profile`,
`little-tables:profiles-cache`, `little-tables:auth-grant`, `little-tables:parent-lock`, `little-tables:seen-cards`.

### 4.3 Sync

- Déclencheurs : démarrage (+1,5 s), retour en ligne, retour au premier plan, fin de séance.
- Étapes, dans l'ordre : (1) vider l'outbox de **tous** les profils par lots de 100 ; (2) seulement si toutes les
  outbox sont vides, `GET /profiles/{id}/bootstrap` du profil actif et fusion ; (3) `POST /auth/refresh`.
- Fusion : snapshot serveur gagnant ; `completedSessions` = max ; ledger = max + union ; collection serveur gagnante ;
  jours = union ; séance active locale conservée.
- Acquittement : acceptés, doublons et rejetés sont retirés de l'outbox ; les rejets sont comptés dans `meta` et
  visibles dans l'espace parent (ligne « Synchronisation »).
- 401 → grant invalidé, retour à l'écran de connexion. 403 sur un profil → profil retiré du cache local.
- L'enfant ne voit jamais l'état de sync ; le parent voit « À jour », « En attente (n) » ou « Erreur ».

### 4.4 Session hors-ligne

Grant local `{displayName, profileId, expiresAt, nameChoiceRequired}` validé par schéma ; ouvre l'app sans réseau
jusqu'à expiration ; effacé à la déconnexion ou si le serveur répond « déconnecté ».

### 4.5 PWA

- Workbox `injectManifest` : précache des bundles, du `.wasm` (hash dans le nom) et des illustrations du personnage
  par défaut ; autres images en CacheFirst ; API jamais en cache.
- Mises à jour : vérification toutes les 60 s quand visible + focus/online ; bannière non bloquante (maquette B5) ;
  écran de récupération (B4) branché sur l'error boundary du routeur.
- Manifestes localisés (fr, en, zh-Hans), `display: standalone`, portrait, icônes masquables.
- Installation : instructions iOS + `beforeinstallprompt` ailleurs, depuis l'espace parent et une fois en bannière
  après la première séance.
- Push : affichage localisé, clic → focus ou ouverture.

### 4.6 Migration des données appareil

Au premier lancement de la nouvelle PWA : lecture des bases `little-tables-v1` (profil « lou ») et
`little-tables-v2:{id}`, copie des événements et de l'outbox vers `v3`, reprise des clés `localStorage` existantes
sous leurs nouveaux noms. Les anciennes bases ne sont supprimées qu'après une sync réussie. **Livrée avec la
première version de la nouvelle PWA (lot 3)**, sinon les événements non synchronisés des appareils seraient perdus.

---

## 5. Serveur Rust

### 5.1 Configuration

| Variable                                | Rôle                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `PORT`, `HOST`                          | Écoute (défaut `127.0.0.1:32140` en production)                                                          |
| `PUBLIC_ORIGIN`                         | **Nouveau.** `https://math.leaetzak.love` ; sert aux vérifications d'origine et à VAPID                  |
| `DATABASE_PATH`                         | **Nouveau.** Défaut `/var/lib/little-tables/little-tables.db`                                            |
| `SESSION_SECRET`, `GOOGLE_CLIENT_ID`    | Inchangés                                                                                                |
| `ADMIN_EMAILS`                          | **Nouveau.** Remplace l'email codé en dur                                                                |
| `GOOGLE_ALLOWED_EMAILS`                 | Inchangé (liste blanche d'amorçage)                                                                      |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Inchangés (`VAPID_SUBJECT` dérivé de `PUBLIC_ORIGIN`)                                                    |
| `APP_REVISION`, `RUST_LOG`              | Révision affichée par `/health/ready` ; niveau de logs                                                   |
| `AUTH_MODE=disabled`                    | **Nouveau.** Identité de développement sans Google ; refusé si `NODE_ENV`-équivalent `LT_ENV=production` |

`WEB_DIST_PATH` est conservée : la release contient le build web à côté du binaire (`web/`), ce qui permet au lot 3
de remplacer la PWA sans recompiler le serveur. Retirées : `MONGODB_URI`, `MONGODB_DATABASE`,
`LITTLE_TABLES_UNSAFE_EPHEMERAL` (remplacée par `LT_ENV=smoke`). En production, toute variable obligatoire manquante
empêche le démarrage. Les commandes `little-tables admin …` n'ont besoin que de `DATABASE_PATH`.

Sans Google (`AUTH_MODE=disabled` ou secrets absents hors production), le serveur agit comme une famille de
développement créée au démarrage (premier enfant `lou`) ; contrairement à l'ancien serveur, les profils demandés
doivent lui appartenir, puisque la base impose les clés étrangères.

### 5.2 Authentification et sécurité des requêtes

- Connexion Google : vérification de l'ID token (JWKS Google en cache, audience = client ID, `email_verified`).
- Allowlist : admins (`ADMIN_EMAILS`) → bloqués en base → env → base. Retirer un email incrémente `session_version`.
- Session : cookie `little-tables-session` HttpOnly, Secure, SameSite=Lax, 30 jours, HMAC-SHA256, renouvelé par
  `POST /auth/refresh`. Format conservé pour ne pas déconnecter les familles au déploiement.
- **Déconnexion** : `POST /auth/logout` efface le cookie (et le client efface grant, cache profils et code parent).
  Le cookie reste stateless ; une révocation globale passe par `session_version` (retrait de l'email).
- **Protection CSRF**, simple et suffisante pour une SPA même origine : chaque requête mutante doit porter l'en-tête
  `X-Little-Tables: 1` (un navigateur ne l'ajoute jamais à une requête cross-site simple) **et** un `Origin` ou
  `Sec-Fetch-Site` compatible avec `PUBLIC_ORIGIN`. Pas de jeton double-submit.
- Onboarding : `POST /family/onboarding {name}` crée le premier enfant (atomique sur `onboarding_complete`).

### 5.3 Endpoints (`/api/v2`)

| Méthode      | Chemin                                            | Rôle                                                                          |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| GET          | `/health/live`, `/health/ready`                   | Santé (`revision`, `status`)                                                  |
| GET          | `/auth/status`                                    | Statut, `isAdmin`, `googleClientId`, expiration                               |
| POST         | `/auth/google` · `/auth/logout` · `/auth/refresh` | Connexion · déconnexion · renouvellement                                      |
| POST         | `/family/onboarding`                              | Prénom du premier enfant                                                      |
| GET/POST     | `/family/profiles`                                | Lister · créer                                                                |
| PATCH/DELETE | `/family/profiles/{id}`                           | Modifier (nom, avatar, `reminderMinute`) · retirer (dernier interdit)         |
| PUT          | `/family/profiles/{id}/learning-paths`            | Réglages scolaires                                                            |
| GET          | `/family/parent-lock`                             | État : `configured`, `lockedUntil`, `pinSalt` (périme le cache hors-ligne)    |
| PUT          | `/family/parent-lock`                             | Définir ou changer le code (code courant requis s'il existe)                  |
| POST         | `/family/parent-lock/verify`                      | Vérifier ; renvoie `{pinHashParams, pinSalt}` pour le cache hors-ligne (§6.4) |
| DELETE       | `/family/parent-lock`                             | Réinitialiser ; exige un ID token Google frais dans le corps                  |
| GET          | `/profiles/{id}/bootstrap`                        | État complet du profil                                                        |
| POST         | `/profiles/{id}/attempts`                         | Ingestion d'un lot d'événements (≤ 100)                                       |
| POST         | `/profiles/{id}/garden/introduction-seen`         | Carte d'intro vue                                                             |
| GET          | `/profiles/{id}/insights?range=7d\|30d&today=…`   | Vue parent des difficultés (§5.6) ; `today` = jour d'apprentissage de l'app   |
| GET          | `/notifications/config`                           | Clé publique VAPID uniquement                                                 |
| POST/DELETE  | `/profiles/{id}/notifications/subscriptions`      | Abonner · désabonner (`DELETE …/subscriptions?endpoint=…`)                    |
| GET/POST     | `/admin/allowed-emails`                           | Lister · ajouter (admins, sinon 403)                                          |
| DELETE       | `/admin/allowed-emails/{email}`                   | Retirer (409 pour un admin)                                                   |
| GET          | `/*`                                              | PWA ; redirections de navigation `/` ↔ `/sign-in` ; `index.html` sans cache   |

Le profil passe dans le chemin. Les préférences d'appareil (langue, son, apparence, taille du texte) ne sont pas
synchronisées ; l'heure de rappel l'est (champ du profil).

**Adaptateur `/api/v1`** (lots 2 → 5) : le serveur Rust sert aussi le contrat v1 actuel à l'identique (mêmes chemins,
même en-tête `x-little-tables-profile-id`, même JSON de bootstrap), pour que la PWA actuelle fonctionne sans
changement pendant la transition. Il est validé en rejouant la suite de tests existante d'`apps/web` contre le serveur
Rust (§7.2). En pratique, les tests HTTP de l'ancien serveur (`apps/server/src/http/*.test.ts`) sont portés en Rust
(`crates/lt-server/tests/v1.rs`) ; les tests d'`apps/web` simulent le réseau et ne peuvent pas viser un vrai serveur.

**Calendrier** : le lot 2 livre l'adaptateur v1 seul ; l'API v2 est construite au lot 3 avec son unique client, la
nouvelle PWA, pour en fixer les formes sur des besoins réels.

### 5.4 Ingestion et bootstrap

- Validation par `lt-domain::validate_attempt` (raisons inchangées : `duplicate_in_batch`, `invalid_answer`,
  `inconsistent_attempt`). Insertion `ON CONFLICT(event_id) DO NOTHING` dans une transaction par lot ; les conflits
  sont renvoyés en `duplicates`.
- **Durcissement** : unicité de `(profile_id, session_id, sequence)`, vérifiée à l'ingestion. Un second événement pour le même rang
  d'une même séance (cas : séance reprise sur deux appareils) est rejeté avec la raison `duplicate_sequence`. C'est un
  comportement nouveau, documenté dans les notes de version.
- **Projection incrémentale** `learning_snapshots` : chaque profil garde son snapshot et un filigrane
  `(last_answered_at, last_sequence)`. À l'ingestion, dans la même transaction :
  - si tous les nouveaux événements sont postérieurs au filigrane, ils sont appliqués par `reduce` dans l'ordre
    `(answered_at, sequence)` (chemin rapide) ;
  - sinon (événement en retard venu d'un autre appareil), le snapshot est recalculé depuis zéro pour ce profil
    (quelques milliers d'événements au plus, quelques millisecondes).
    Le résultat est ainsi toujours identique à un recalcul complet, ce que la CI vérifie sur des historiques
    synthétiques désordonnés. `little-tables admin rebuild-snapshots` recalcule tout.
- Bootstrap : lecture du snapshot, du ledger et de la collection ; aucun rejeu.

### 5.5 Rappels Web Push

- Worker tokio toutes les 60 s, non réentrant ; par abonnement : envoi si `heure locale ≥ reminder_minute du profil`,
  jour local ≠ dernier envoi, et aucune réponse ce jour-là ; TTL 6 h ; 404/410 → suppression.
- Le fuseau reste par abonnement (celui de l'appareil) ; l'heure de rappel est **par profil** (`profiles.reminder_minute`,
  défaut 18 h 00, pas de 15 min, plage 7 h – 21 h, `null` = désactivé). Le worker fait la jointure ; rien n'est dupliqué
  sur l'abonnement.
- Aucun rappel tant que le profil n'a terminé aucune séance (nouveau : aujourd'hui le rappel part dès l'abonnement).
- Textes localisés fr / en / zh-Hans ; `tag` par jour.

### 5.6 Vue parent des difficultés

`GET /profiles/{id}/insights?range=7d|30d`, calculé par `lt-domain::derive_insights` à partir des événements de la
période :

- faits et compétences à retravailler : taux d'erreur ≥ 40 % sur ≥ 3 réponses, rechutes (`lapseCount`), faits lents
  (latence médiane au-dessus du seuil), avec la réponse fausse la plus fréquente ;
- régularité : jours pratiqués, semaines fleuries ; temps : somme des latences plafonnées à 30 s par question ;
- progression : faits devenus familiers / fluides sur la période ; « bien parti » = tables et compétences entièrement
  enracinées.

Réservé à l'espace parent ; jamais de score ni de comparaison entre enfants.

### 5.7 Stockage : SQLite

`sqlx` avec requêtes vérifiées à la compilation ; migrations versionnées dans `crates/lt-store/migrations`.
Réglages : `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000` ; une connexion
d'écriture, un pool de lecture.

| Table                | Colonnes principales                                                                                                                                                    | Contraintes / index                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `families`           | `google_subject` PK, `onboarding_complete`, `created_at`, `updated_at`                                                                                                  |                                                                                                         |
| `profiles`           | `id` PK (UUID, ou `lou` pour le profil historique), `family_subject` FK, `name`, `avatar_id`, `learning_paths` JSON, `reminder_minute` NULL, `created_at`, `updated_at` | index `family_subject`                                                                                  |
| `attempt_events`     | `event_id` PK, `profile_id` FK, `session_id`, `sequence`, `answered_at`, `learning_day_key`, `fact_key`, `payload` JSON, `received_at`                                  | index `(profile_id, answered_at, sequence)` ; `(profile_id, session_id, sequence)` unique à l'ingestion |
| `learning_snapshots` | `profile_id` PK, `algorithm_version`, `snapshot` JSON, `last_answered_at`, `last_sequence`, `updated_at`                                                                |                                                                                                         |
| `garden_collections` | `profile_id` PK, `awarded_flower_ids` JSON, `flower_order` JSON, `bloom_count`, `rewarded_day_keys` JSON, `introduction_seen`, `catalog_version`                        |                                                                                                         |
| `allowed_emails`     | `email` PK, `status`, `session_version`, `added_at`, `added_by`, `removed_at`, `removed_by`                                                                             |                                                                                                         |
| `push_subscriptions` | `endpoint` PK, `profile_id` FK, `keys_auth`, `keys_p256dh`, `expiration_time`, `locale`, `timezone`, `last_sent_day_key`, `updated_at`                                  | index `profile_id`                                                                                      |
| `parent_locks`       | `family_subject` PK, `pin_hash` (Argon2id), `pin_salt`, `failed_attempts`, `locked_until`, `updated_at`                                                                 |                                                                                                         |

Toutes les clés étrangères vers `profiles` sont `ON DELETE CASCADE` : retirer un enfant supprime ses événements,
son snapshot, son jardin et ses abonnements (le dialogue dit « définitif », le serveur fait pareil). Règles reprises
des repositories actuels : dernier profil non supprimable, `lou` réservé à l'admin, avatar inconnu → `sprout`, ordre
des fleurs = préfixe historique puis mélange.

**Migration depuis MongoDB** (une seule fois, lot 2) :

1. `mongodump` de la production + copie hors VPS.
2. `apps/server/src/tools/export-for-rust.ts`, livré dans l'image Node actuelle, lit MongoDB **sans écrire** et produit
   un export JSON : familles (avatars normalisés), événements, jardins, accès, abonnements, et pour chaque profil le
   bootstrap calculé par le code inchangé de l'ancien serveur sur des copies en mémoire (les jardins manquants y sont
   créés comme au prochain bootstrap et exportés ainsi). Un document de profil d'avant les familles bloque l'export.
3. `little-tables admin import export.json` charge une base vide, refuse les enregistrements d'enfants retirés sauf
   `--allow-orphans`, puis recalcule chaque bootstrap et exige l'égalité avec celui de l'ancien serveur (nombres comparés
   par valeur). Échec = pas de bascule. La règle `(profile_id, session_id, sequence)` est appliquée à l'ingestion, pas
   en contrainte SQL : les doublons historiques s'importent tels quels.
4. Bascule courte (les outbox des appareils absorbent la fenêtre) ; Mongo arrêté mais conservé 30 jours ; retrait
   du conteneur, du volume et des Quadlets après accord explicite.

Sauvegardes : `sqlite3 .backup` avant chaque déploiement et chaque nuit (timer systemd), rotation 14 jours, copie
hors VPS.

### 5.8 Observabilité et limites

- `tracing` JSON : identifiant de requête, route, durée, statut ; jamais d'email, de jeton ni de code parent.
- Limites : taille de corps (256 Ko), débit par IP sur `/auth/*` et `/family/parent-lock/verify` (IP lue dans
  `X-Forwarded-For` uniquement si la connexion vient de la boucle locale, c'est-à-dire de Caddy), timeouts.
- En-têtes de sécurité conservés dans Caddy (CSP compatible Google Identity Services, HSTS, COOP).

---

## 6. Interface, design et système de composants

### 6.1 Principes (HIG)

- **Clarté** : une intention principale par écran ; texte court ; aucun jargon technique côté enfant.
- **Déférence** : illustrations et jardin servent le contenu sans le recouvrir.
- **Profondeur** : onglets + piles ; feuilles pour les choix secondaires ; transitions push/pop et feuille qui monte.
- Zones tactiles ≥ 44 × 44 pt ; action principale dans la moitié basse ; safe areas ; barre d'onglets flottante en bas.
- Typographie Nunito (arrondie, proche de SF Rounded) sur une échelle en `rem` ; taille réglable dans l'espace parent
  (Safari iOS n'applique pas Dynamic Type aux PWA) ; contraste AA, AAA pour les nombres des exercices.
- Clair et sombre (tokens du board R0) ; `prefers-reduced-motion` et `prefers-reduced-transparency` respectés.
- Retour multisensoriel : visuel + son optionnel ; haptique best-effort.

### 6.2 Architecture d'information (maquettes R1 à R5)

- **Espace enfant**, barre d'onglets à 3 entrées :
  - **Aujourd'hui** (A1–A4) : bouton principal en bas (« Arroser mon jardin » / « Reprendre » / « Petite séance bonus »),
    plante en cours, semaine fleurie ; « Autres séances » en feuille (A5) ; pastille profil en haut à gauche → feuille
    « Qui joue ? » (A6) ; cadenas en haut à droite → espace parent.
  - **Jardin** (D2) : scène d'un chapitre, balayage horizontal entre chapitres, jardinier derrière la rangée de pots,
    pots vides cadenassés pour les plantes verrouillées ; herbier (D3) en pile ; règles (D4) en feuille.
  - **Progrès** (D5) : résumé, grille des tables, chemins ; détail d'une table (D6) en pile.
- **Séance** (C1–C10) : plein écran ; question en haut, panneau de réponse en bas avec un **pavé unique** ; Miffy
  accoudée au bord du panneau (§6.7) ; pause confirmée (C10).
- **Célébration** (D1) → « Voir mon jardin ».
- **Accès** (B1–B5) : connexion, prénom, hors-ligne, récupération, bannière de mise à jour.
- **Espace parent** (E1–E9), derrière le code : enfants, réglages, compte ; profil d'un enfant ; « À l'école » ;
  « Ce qui coince » ; ajout d'un enfant ; rappels et préférences ; « Qui peut entrer » (admins) ; retrait d'un enfant.

Ce que le redesign déplace ou retire volontairement par rapport à l'existant :

| Existant                                      | Redesign                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Langue et son sur l'accueil                   | Espace parent → Réglages                                                                  |
| Carte rappel 18 h sur l'accueil               | Espace parent → profil de l'enfant (la permission push se demande sur l'appareil utilisé) |
| Carte « nouveaux chemins »                    | Une feuille unique à l'ouverture des chemins, puis les chips de la feuille A5             |
| Carte installation                            | Bannière une fois après la première séance + ligne « Installer » dans l'espace parent     |
| Lien « gérer qui peut entrer »                | Espace parent → Compte (admins seulement)                                                 |
| Statut de sync sur l'accueil                  | Espace parent → Synchronisation                                                           |
| Pastille « n en progrès » en séance           | Retirée (la barre de progression suffit)                                                  |
| 11·12 et ÷ dans l'onglet Progrès              | Chips « Bonus » de la feuille A5 ; l'onglet Progrès n'affiche que l'état                  |
| Rideau de fleurs à chaque changement d'onglet | Conservé uniquement pour séance → célébration → jardin                                    |
| Prévisualisation `?blooms=N`                  | Outil de dev uniquement                                                                   |

### 6.3 Maquettes : état et reste à faire

Livrées (42 écrans, 390 × 844, clair, et 6 en sombre) : boards R1 à R5. Restent à dessiner avant ou pendant le lot 3,
en réutilisant les composants existants :

- séance : soustraction à trou, numération, presque-dizaines, soustraction posée, fraction à construire, égalité de
  fractions et « coche toutes les égales », droite graduée en lecture, opération de fractions avec histoire ;
- feuille « nouveaux chemins » ; écran « Mes chemins » (détail des compétences et niveaux) ;
- espace parent : choix du personnage, sélecteur « en ce moment à l'école », sélecteur d'heure de rappel, taille du
  texte, définir le code parent (première fois), code oublié ;
- états : vide, chargement, erreur réseau de chaque écran ; largeurs 320 et 430 pt ; versions sombres restantes.

### 6.4 Code parent

- 4 chiffres, défini en ligne au premier appui sur le cadenas, haché Argon2id côté serveur.
- **Hors-ligne** : après une vérification en ligne réussie, le client stocke un hachage local PBKDF2 (WebCrypto,
  100 000 itérations, sel fourni par le serveur) du code ; la vérification hors-ligne se fait contre ce hachage. Le
  serveur reste la référence ; changer le code invalide le cache à la prochaine sync.
- Anti-force brute : 5 échecs → verrou 15 min (serveur et local), puis le compte repart de zéro. Un code faux répond
  403 `wrong_pin` avec `remainingAttempts`, un code verrouillé 423 `parent_lock_locked` avec `lockedUntil`.
  Réinitialisation : reconnexion Google (ID token émis il y a moins de 10 min, même `sub`) puis nouveau code.
- Une fois ouvert, l'espace parent reste déverrouillé 5 min ou jusqu'au retour à l'espace enfant.

### 6.5 Système de composants (`packages/ui`)

Tokens (noms identiques au board R0, en clair et sombre) : `bg`, `surface`, `surface-2`, `label`, `label-2`,
`label-3`, `separator`, `tint`, `tint-soft`, `on-tint`, `leaf`, `leaf-soft`, `sun`, `sun-soft`, `sky`, `sky-soft`,
`danger`, `danger-soft`, `soil`, `glass`, `scrim` ; rayons 16 / 22 / 28 / 44 ; échelle typographique 13 / 15 / 17 /
20 / 24 / 28 / 34 / 64 ; police Nunito.

| Catégorie   | Composants                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure   | `AppShell`, `StatusBarInset`, `TabBar` (flottante), `NavigationBar` (grand titre), `Sheet` (Vaul), `AlertDialog`, `Toast`/`Banner`                                                                |
| Actions     | `Button` (primary, tinted, gray, destructive ; 3 tailles), `IconButton`, `SegmentedControl`, `Switch`, `Chip`                                                                                     |
| Données     | `List`/`ListRow` (inset grouped), `Card`, `ProgressRing`, `ProgressBar`, `WeekStrip`, `Badge`, `Avatar`, `EmptyState`                                                                             |
| Saisie      | `TextField`, `Picker`, `TimePicker`, `PinPad`                                                                                                                                                     |
| Exercices   | `AnswerTiles`, `NumberPad` (entier, fraction, colonne), `ColumnOperation`, `FractionText`, `FractionBed`, `FractionPot`, `NumberLine` + coccinelle, `HintPanel`, `CharacterDock` + `SpeechBubble` |
| Jardin      | `GardenScene`, `PlantIllustration` (9 plantes × 3 états + pot vide), `Caretaker`, `FlowerCurtain`                                                                                                 |
| Personnages | `CharacterIllustration` (9 scènes × 6 personnages, Miffy par défaut et en repli, préchargement)                                                                                                   |

Règles : chaque composant documenté dans Ladle avec ses états, testé avec axe, sans dépendance à la logique métier.

### 6.6 Internationalisation et accessibilité

- Catalogues fr (défaut), en, zh-Hans typés par clés ; pluriels ICU ; retrait des ~40 clés mortes.
- Énoncés parlés pour chaque exercice, descriptions riches du jardin et des barres.
- Navigation clavier complète (iPad), focus visibles, rôles ARIA des tuiles, du curseur et du pavé.

### 6.7 Mouvement

- **Miffy en séance** (`CharacterDock`) : en attente, tête et pattes dépassent du panneau, respiration de 2 px sur
  3 s ; bonne réponse : elle se hisse d'un ressort (≈ 0,5 s, léger dépassement), bras levés, bulle « Oui ! n ♡ » ;
  erreur : la tête sort calmement, main au menton, bulle « Hmm… c'était n », puis l'indice s'affiche sous elle.
- **Jardin** : le jardinier se déplace entre les plantes toutes les 3 s, toujours derrière la rangée de pots dont
  l'espacement reste régulier ; la plante arrosée « boit ».
- **Transitions** : push/pop pour les piles, feuille pour les choix, rideau de fleurs pour séance → célébration → jardin.
- `prefers-reduced-motion` : fondus simples, jardinier immobile en pose d'arrosage, pas de confettis.

---

## 7. Qualité, outillage et exploitation

### 7.1 Commandes

`pnpm check` : `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, build WASM + contrôle de taille
(< 300 Ko gzip), test de contrat des schémas (§2.4), Prettier, ESLint, typecheck, Vitest, Playwright (WebKit mobile +
Chromium), build. `pnpm doctor` reste exigé pour chaque PR web.

### 7.2 Tests

- **Vecteurs dorés** : première tâche du lot 1, **avant tout changement** de `packages/domain` : le moteur TS actuel
  est copié tel quel dans `tools/golden/legacy-domain` et un générateur produit des fixtures JSON (sessions,
  distracteurs, exercices, snapshots, ledger, récompenses, insights) pour des milliers de graines et d'historiques,
  y compris des historiques désordonnés. `lt-domain` doit les reproduire bit à bit.
- Propriétés (proptest) : rejouer = no-op ; réduction déterministe ; une séance ne rend jamais un fait fluide ; une
  erreur n'augmente jamais la stabilité ; projection incrémentale = recalcul complet.
- Serveur : SQLite temporaire (migrations, concurrence, cascade) ; import Mongo sur un jeu anonymisé (Mongo en
  conteneur de test seulement) ; tests HTTP axum ; **suite de tests actuelle d'`apps/web` rejouée contre
  l'adaptateur v1** ; tests de contrat client Effect ↔ serveur.
- E2E Playwright (iPhone) : connexion mockée, chaque type d'exercice, hors-ligne puis sync, changement de profil,
  code parent, mise à jour du SW. Régression visuelle des écrans clés.

### 7.3 Déploiement

Modèle « release immuable systemd », identique à Love Letters, Loup-Garou et Raclettefin ; plus de conteneur.

- Artefact : binaire `x86_64-unknown-linux-gnu` (glibc : `aws-lc`, utilisé par rustls, ne vise pas musl simplement ;
  construit sur Ubuntu 24.04, glibc plus ancienne que celle de Debian 13) avec SQLite embarqué, plus le build web dans
  `web/` ; archive `little-tables-<sha>.tar.gz` + SHA-256, publiée en artefact de CI (30 jours).
- VPS : `/opt/little-tables/releases/<sha>/`, lien atomique `/opt/little-tables/current`, état dans
  `/var/lib/little-tables/` (base + sauvegardes), secrets dans `/etc/little-tables/little-tables.env`.
- `little-tables.service` : utilisateur système dédié `little-tables` (pas de `DynamicUser`, pour que le timer de
  sauvegarde partage le même compte), `ProtectSystem=strict`, `StateDirectory=little-tables`, `NoNewPrivileges`,
  `PrivateTmp`, `MemoryMax=256M`, écoute `127.0.0.1:32140` (Caddy inchangé). `little-tables-backup.timer` quotidien.
- Pipeline : `verify` (qui construit et teste aussi l'archive) → `deploy` par la clé SSH à commande forcée
  (`deploy-release <sha> <sha256>`, archive sur l'entrée standard ; `status`, `public-health`). Bascule unique :
  `deploy/RUST_CUTOVER_RUNBOOK.md`. Script de déploiement : vérifie la somme, **arrête le service**, `.backup`, applique les migrations
  avec le nouveau binaire (`little-tables admin migrate`), bascule le lien, démarre, contrôle `/health/ready` + révision.
  En cas d'échec : arrêt, restauration de la sauvegarde, lien précédent, redémarrage. Indisponibilité de quelques
  secondes, acceptable pour un usage familial.
- Quadlets, volume Mongo et image GHCR retirés après la période de conservation (§5.7).
- Smoke test en CI sur le binaire de release : `/` → `/sign-in`, 401 sur les API protégées, `no-store` sur `/sign-in`,
  contrat v1 et v2.

---

## 8. Plan de livraison

| Lot | Contenu                                                                                                                                                       | Sortie                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 0   | Specs v0.2, inventaire Pencil, maquettes R0–R5                                                                                                                | **Fait**                                |
| 1   | Vecteurs dorés ; `lt-domain` + WASM ; `packages/ui` (tokens, composants de base, Ladle)                                                                       | Parité moteur prouvée                   |
| 2   | Serveur Rust + SQLite, adaptateur v1, import Mongo vérifié, déploiement systemd, sauvegardes                                                                  | Bascule serveur, PWA actuelle inchangée |
| 3   | Nouvelle PWA : espace enfant, séance, célébration, jardin, progrès, migration IndexedDB, déconnexion, espace parent **minimal** (enfants, école, préférences) | Bêta famille                            |
| 4   | Code parent, vue des difficultés, heure de rappel par enfant, écrans restants (§6.3), mode sombre complet, taille du texte                                    | Parité complète + nouveautés            |
| 5   | Retrait de `/api/v1`, de l'ancien code web/serveur, des clés historiques ; décision `algorithmVersion 2`                                                      | Fin de la réécriture                    |

### 8.1 Risques

- Divergence du moteur → vecteurs dorés générés avant toute modification, bit-exact exigé.
- Perte d'événements locaux → migration IndexedDB livrée avec la première PWA (lot 3), suppression après sync.
- Taille du WASM → pas de base de fuseaux dans le WASM, budget 300 Ko gzip contrôlé en CI.
- Migration Mongo → SQLite → comparaison automatique des bootstraps, Mongo conservé 30 jours.
- Projection incrémentale → égalité avec le recalcul complet prouvée par proptest.

### 8.2 Décisions prises

| Sujet              | Décision (5 octobre 2026)                                                            |
| ------------------ | ------------------------------------------------------------------------------------ |
| Stockage           | SQLite ; MongoDB migré puis retiré                                                   |
| Déploiement        | Release immuable systemd, utilisateur système dédié ; Quadlets et image GHCR retirés |
| Espace parent      | Code à 4 chiffres, cache hors-ligne PBKDF2, reset par reconnexion Google             |
| Personnages        | Miffy par défaut ; usage familial privé (liste blanche)                              |
| Périmètre ajouté   | Heure de rappel par enfant, vue des difficultés, mode sombre, taille du texte        |
| Hors périmètre     | Sign in with Apple ; déconnexion globale                                             |
| Contrat API        | Schémas Effect manuels vérifiés contre le JSON Schema Rust (pas de générateur)       |
| CSRF               | En-tête obligatoire + contrôle d'origine (pas de double-submit)                      |
| Séquence dupliquée | Rejetée (`duplicate_sequence`) ; contrainte unique en base                           |

### 8.3 Pourquoi SQLite

Volume et concurrence d'un usage familial très faibles, aucun service à opérer ni à surveiller, sauvegarde `.backup`
déjà pratiquée sur le VPS, typage fort avec `sqlx`, alignement sur la majorité des services de l'hôte. PostgreSQL
resterait le choix d'une diffusion large ; le changement serait localisé dans `lt-store`.

### 8.4 Points ouverts

Tranchés le 5 octobre 2026 :

1. `algorithmVersion 2` : adoptée (§3.4), plafond de 2 nouveautés par arrosage dans la nouvelle PWA.
2. Contrainte `duplicate_sequence` : confirmée en principe ; revue au moment de l'import Mongo selon le nombre de
   doublons historiques.
3. Espace parent déverrouillé 5 min.
4. Rappel quotidien envoyé seulement après une première séance terminée (nouveau comportement, voir §5.5).
5. Personnages : les 6 existants, aucun nouveau.
