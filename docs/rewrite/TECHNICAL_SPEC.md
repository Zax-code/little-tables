# little tables — Spécifications techniques de la réécriture

Statut : brouillon v0.1 (5 octobre 2026) · à valider avant le démarrage du lot 1.

Ce document décrit la réécriture complète de little tables avec :

- **Rust** pour le serveur et pour le moteur pédagogique partagé ;
- **Effect v3 / TypeScript** pour toute la logique applicative côté client (services, schémas, hors-ligne, sync) ;
- **React** pour l'interface ;
- un **système de composants de type shadcn/ui** (primitives Radix, Tailwind CSS v4, variantes CVA), adapté aux Human Interface Guidelines d'Apple.

La réécriture conserve toutes les fonctionnalités existantes. L'inventaire de référence est le fichier Pencil
[`design/little-tables-rewrite.pen`](../../design/little-tables-rewrite.pen) (boards 00 à 13, captures dans
[`design/assets/legacy/`](../../design/assets/legacy/)). Sa **matrice de couverture** (board 13) renvoie vers les
sections de ce document. Le design actuel sert uniquement de checklist : le redesign n'est pas contraint par lui.

---

## 1. Objectifs et non-objectifs

### 1.1 Objectifs

1. **Parité fonctionnelle totale** avec l'application actuelle (voir §3 à §5 et la matrice de couverture).
2. **Expérience mobile excellente**, iPhone d'abord, conforme aux HIG : zones tactiles ≥ 44 pt, actions principales
   au pouce, feuilles (sheets) natives, grands titres, safe areas, Dynamic Type, mode sombre, mouvement réduit.
3. **Une seule implémentation du moteur pédagogique**, exécutée à l'identique sur le serveur (natif) et dans le
   navigateur (WebAssembly), ce qui supprime le risque de divergence actuel entre deux exécutions du même code TS.
4. **Hors-ligne d'abord** conservé : l'enfant peut faire toute une séance sans réseau ; la sync est transparente.
5. **Séparer l'espace enfant et l'espace parent** (absent aujourd'hui).
6. Corriger la dette listée au board 12 (déconnexion, CSRF, admin codé en dur, recalcul complet à chaque bootstrap…).

### 1.2 Non-objectifs (lot 1)

- Application native App Store (on reste une PWA ; l'architecture ne l'empêche pas plus tard).
- Nouveaux contenus pédagogiques au-delà des 11 compétences actuelles.
- Changement d'hébergement : même VPS, Caddy, Podman Quadlets, GHCR, déploiement avec rollback automatique.

---

## 2. Architecture cible

### 2.1 Vue d'ensemble

```
┌──────────────────────────── Navigateur (PWA) ────────────────────────────┐
│ React 19 + TanStack Router  ──  UI (packages/ui, style shadcn + HIG)      │
│        │                                                                  │
│ Effect v3 runtime (ManagedRuntime)                                        │
│   ├─ DomainEngine  ──► lt-domain.wasm (Rust → wasm-bindgen)               │
│   ├─ LocalStore    ──► IndexedDB (Dexie) : events, outbox, projections    │
│   ├─ SyncService   ──► HttpApiClient (schémas générés)                    │
│   ├─ AuthService, ProfileService, ReminderService, PwaService, I18n       │
│ Service worker (Workbox) : précache, images, push                         │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ HTTPS JSON /api/v2 (cookie de session)
┌───────────────────────────────────▼──────────────────────────────────────┐
│ Serveur Rust (axum + tokio)                                               │
│   ├─ lt-domain (natif)   ├─ lt-api (handlers, schémas serde/schemars)     │
│   ├─ lt-store (MongoDB)  ├─ lt-auth (Google ID token, sessions, CSRF)     │
│   ├─ lt-push (Web Push VAPID, worker de rappels)                          │
│   └─ fichiers statiques de la PWA (même origine)                          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                              MongoDB 7 (inchangé)
```

### 2.2 Organisation du dépôt

Workspace pnpm + workspace Cargo dans le même dépôt.

```
crates/
  lt-domain/        moteur pédagogique pur (no_std-friendly, sans I/O)
  lt-domain-wasm/   bindings wasm-bindgen + tsify (types TS générés)
  lt-api/           types HTTP (serde + schemars) = source de vérité du contrat
  lt-auth/          vérification Google, sessions HMAC, CSRF, allowlist
  lt-store/         repositories MongoDB + implémentations mémoire (tests)
  lt-push/          envoi Web Push, worker de rappels
  lt-server/        binaire axum (main), config, wiring, statiques
apps/
  web/              PWA React
packages/
  ui/               système de composants (shadcn adapté HIG) + tokens
  api-contract/     schémas Effect générés depuis le JSON Schema de lt-api
  domain/           façade Effect autour de lt-domain.wasm
  local-store/      Dexie + schémas Effect
  i18n/             catalogues fr / en / zh-Hans typés
tools/
  golden/           générateur de vecteurs de test depuis l'ancien moteur TS
  codegen/          JSON Schema → Effect Schema
deploy/             inchangé dans son principe (Quadlets, Caddy, scripts)
```

### 2.3 Choix structurants et justification

| Sujet                 | Choix                                                                               | Pourquoi                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Moteur partagé        | Crate Rust `lt-domain` compilé natif + WASM                                         | Une seule source de vérité, exécutée à l'identique hors-ligne et au serveur.                                    |
| Framework HTTP        | axum 0.8 + tokio + tower-http                                                       | Standard de fait, middlewares (compression, traces, limites).                                                   |
| Base de données       | MongoDB 7 conservé, driver officiel `mongodb`                                       | Continuité des données de production et des Quadlets ; schémas documents identiques (§5.6).                     |
| Contrat API           | Types Rust (`serde` + `schemars`) → JSON Schema → Effect Schema généré              | Le serveur est la source de vérité ; le client ne peut pas dériver. CI vérifie que le code généré est à jour.   |
| Client logique        | Effect v3 (Layer, Context.Tag, Schema, Stream, Schedule)                            | Gestion explicite des erreurs, retries, ressources, testabilité.                                                |
| Cache serveur côté UI | TanStack Query alimenté par des programmes Effect                                   | Cache, invalidation, état de chargement React éprouvés.                                                         |
| Routage               | TanStack Router (typé)                                                              | Loaders, préchargement des illustrations, garde d'accès dans le routeur (corrige la réécriture d'URL manuelle). |
| Composants            | shadcn/ui (copie locale), Radix, Tailwind v4, CVA, Vaul (feuilles), Sonner (toasts) | Composants possédés dans le dépôt, accessibles, faciles à adapter aux HIG.                                      |
| Animations            | `motion` (ex-Framer Motion) + CSS                                                   | Ressorts, `AnimatePresence`, respect de `prefers-reduced-motion`.                                               |
| Stockage local        | IndexedDB via Dexie, schémas Effect                                                 | Continuité, migration des bases existantes (§4.6).                                                              |

### 2.4 Contrat entre Rust et TypeScript

1. `lt-api` déclare chaque requête et réponse en Rust (`#[derive(Serialize, Deserialize, JsonSchema)]`).
2. `cargo run -p lt-api --bin export-schema` produit `packages/api-contract/schema.json`.
3. `tools/codegen` produit `packages/api-contract/src/generated.ts` (Effect `Schema`) et un `HttpApi` Effect.
4. Les types du moteur (`Exercise`, `PracticeAnswer`, `AttemptEvent`, `LearningSnapshot`…) sont exportés par
   `tsify` depuis `lt-domain-wasm` et décodés côté client par les mêmes schémas Effect.
5. CI : `pnpm codegen && git diff --exit-code` ; tests de contrat qui lancent le serveur Rust et rejouent le client
   Effect contre lui.

---

## 3. Moteur pédagogique (`lt-domain`)

Le moteur est une **réécriture fidèle** des règles actuelles (`packages/domain`). Toute différence de comportement
est un bug, sauf mention contraire. Les règles exhaustives sont listées au board 11 du fichier Pencil ; ce chapitre fixe le
périmètre et les garanties.

### 3.1 Réglages de parcours (par profil)

- `LearningPathSettings { enabledSkills (≤ 11), focusSkill | null, mode: automatic | manual, subtractionMethod: compensation | decomposition }`.
- Par défaut : `{ [], null, automatic, compensation }`.
- `deriveOpenSkills` : une compétence cochée est toujours ouverte ; en mode automatique elle s'ouvre si les 55 faits de base
  sont familiers ou fluides **et** que son prérequis est rempli.
- Niveaux ouverts en séquence selon la porte de la compétence (`all`, `seen`, `familiar`).
- `subtractionMethod` n'affecte que l'affichage et les indices, jamais la correction.

### 3.2 Exercices

- 11 compétences, 3 parcours (additions, grands nombres, fractions) ; clés et générateurs identiques à l'existant
  (`add:a:b`, `sub:t:p`, `numeration:*`, `nearten:*`, `column:*`, `frac:*`).
- Types : `arithmetic`, `column`, `fraction-read` (lire / construire), `fraction-equal`, `fraction-pick`,
  `fraction-line` (lire / placer), `fraction-compare`, `fraction-operation` (dont histoire).
- Réponses : `integer`, `fraction` (avec entier 0..2), `comparison`, `tick`, `selection`.
- Réponses équivalentes acceptées pour les fractions (produit en croix).
- `isProductionExercise`, `isExerciseWellFormed`, `expectedAnswer`, `validateExerciseAttempt` : identiques.

### 3.3 Séance

- Questions × et ÷ : tuiles (4 choix, distracteurs `choicesFor`) tant que le fait n'est pas familier, puis pavé.
- Une erreur insère une copie de la question 3 places plus loin et retire la dernière (longueur constante).
- Latence mesurée (seuils : 3 s pour ×/÷, 4 s pour +/−, aucun pour les colonnes) ; jamais affichée.
- Astuces multiplication : rangées, commutativité, pont depuis un fait fluide (ancres 10, 5, 2, 1, 12, 11, 9, 8, 7, 6, 4, 3).
- Astuces des parcours : cadres de dix, sauts, blocs base 10, doubles/moitiés, colonne par colonne, plates-bandes, règle.

### 3.4 Composition des séances

- Arrosage du jour : budget `min(8, max(5, dus_ou_fragiles))` points ; max 2 opérations posées ; max 2 familles
  d'interaction ; focus école ≈ moitié des points.
- Séances alternatives : 5 rapides ; focus table (8) ; 11·12 (8) ; division (6) ; compétence (8, ou 9 pour une colonne).
- RNG : LCG `state = state * 1664525 + 1013904223 (mod 2³²)`, Fisher-Yates depuis la fin. **Bit-exact** avec
  l'implémentation actuelle (vecteurs dorés, §8.2).
- Correction prévue (board 12) : la limite « ≤ 2 nouveaux éléments par séance » de la spec CE2 sera tenue dans tous les cas.
  Ce changement est versionné (`algorithmVersion: "2"`) et documenté dans les notes de version.

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
pub fn reduce(snapshot: &LearningSnapshot, attempts: &[AttemptEvent], tz: Tz) -> LearningSnapshot;
pub fn create_session(input: &SessionInput, policy: &SessionPolicy) -> PracticeSession;
pub fn answer(session: &PracticeSession, response: PracticeAnswer, at: Instant, event_id: Uuid) -> AnswerOutcome;
pub fn derive_practice_rhythm(..) -> PracticeRhythm;
pub fn derive_learning_progress(..) -> LearningProgress;
pub fn derive_garden_progress(..) -> GardenProgress;
pub fn derive_rewards(..) -> Vec<Reward>;
pub fn validate_attempt(attempt: &AttemptEvent) -> Result<(), AttemptRejection>;
```

Contraintes : pas d'I/O, pas d'horloge ni d'aléa implicites (passés en paramètres), fuseaux via `chrono-tz`,
dates en millisecondes UTC à la frontière WASM.

---

## 4. Client : hors-ligne, stockage et sync (Effect v3)

### 4.1 Services Effect

| Service (`Context.Tag`)                   | Rôle                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DomainEngine`                            | Façade typée du WASM ; chargement paresseux, `Effect.cached`.                                       |
| `LocalStore`                              | Base IndexedDB par profil ; transactions ; erreurs taguées (`StoreDecodeError`, `QuotaExceeded`).   |
| `PracticeService`                         | Démarrer, répondre, reprendre, terminer une séance (transactionnel).                                |
| `SyncService`                             | Vider les outbox, bootstrap, fusion, renouvellement de session. `Schedule` exponentiel avec jitter. |
| `AuthService`                             | Statut, grant hors-ligne, connexion, déconnexion, choix du prénom.                                  |
| `ProfileService`                          | Profils, profil actif, réglages de parcours.                                                        |
| `ReminderService`                         | Permission, abonnement push, locale et fuseau.                                                      |
| `PwaService`                              | Enregistrement du SW, mises à jour, récupération après erreur.                                      |
| `I18n`, `Sound`, `Haptics`, `Preferences` | Préférences appareil.                                                                               |

Le runtime est un `ManagedRuntime` unique ; les tests remplacent les couches (Layer) par des doubles en mémoire.

### 4.2 Modèle de données local (IndexedDB)

Base `little-tables-v3:{profileId}` :

- `events` : `&eventId, sessionId, answeredAt` (événements de réponse immuables) ;
- `outbox` : `&eventId, createdAt` ;
- `state` : `&id` (séance active, snapshot, dernière complétion, ledger, collection, jours) ;
- `meta` : versions d'algorithme et de schéma.

Les écritures d'une réponse (event + outbox + état) sont **atomiques**.

### 4.3 Sync

- Déclencheurs : démarrage (+1,5 s), retour en ligne, retour au premier plan, fin de séance.
- Étapes : vider l'outbox de **tous** les profils (lots de 100), `GET /bootstrap` du profil actif, fusion, renouvellement.
- Fusion : snapshot serveur gagnant ; `completedSessions` = max ; ledger = max + union ; collection serveur gagnante ;
  jours = union ; séance active locale conservée.
- Acquittement : acceptés, doublons et rejetés sont retirés de l'outbox ; les rejets sont journalisés (télémétrie §7.3).
- 401 → re-verrouillage de l'app (grant invalidé).
- Indicateur de sync visible **uniquement dans l'espace parent** (l'enfant voit au plus « enregistré »).

### 4.4 Session hors-ligne

Grant local `{displayName, profileId, expiresAt, nameChoiceRequired}` décodé par schéma ; ouvre l'app sans réseau
jusqu'à expiration ; effacé à la déconnexion ou si le serveur répond « déconnecté ».

### 4.5 PWA

- Workbox `injectManifest` : précache des bundles et des illustrations critiques du personnage actif, images en
  CacheFirst, API jamais en cache.
- Mises à jour : vérification toutes les 60 s quand visible + focus/online ; invite non bloquante ; écran de
  récupération (mise à jour du SW + rechargement) branché sur l'error boundary du routeur.
- Manifestes localisés (fr, en, zh-Hans), `display: standalone`, portrait, icônes masquables, captures d'écran.
- Installation : instructions iOS (Partager → Sur l'écran d'accueil) + `beforeinstallprompt` ailleurs.
- Push : affichage localisé, clic → focus ou ouverture.

### 4.6 Migration des données appareil

Au premier lancement de la nouvelle version : lecture des bases `little-tables-v1` (profil historique « lou ») et
`little-tables-v2:{id}`, copie des événements et de l'outbox vers `v3`, conservation des clés `localStorage`
existantes (locale, son, profil actif, cartes vues) sous leurs nouveaux noms. Les anciennes bases sont supprimées
seulement après une sync réussie.

---

## 5. Serveur Rust

### 5.1 Configuration

Variables reprises à l'identique : `PORT`, `HOST`, `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_EMAILS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`WEB_DIST_PATH`, `APP_REVISION`. Nouvelles : `ADMIN_EMAILS` (remplace l'email codé en dur), `RUST_LOG`.
Démarrage refusé en production si une variable obligatoire manque (mode éphémère explicite pour les tests de fumée).

### 5.2 Authentification

- Connexion Google : vérification de l'ID token (JWKS Google mis en cache, audience = client ID, `email_verified`).
- Sign in with Apple : hors périmètre de la réécriture ; le modèle d'identité (sujet + fournisseur) le permettra plus tard.
- Allowlist : admins (`ADMIN_EMAILS`) → bloqués en base → env → base. Retirer un email incrémente `sessionVersion`.
- Session : cookie `little-tables-session` HttpOnly, Secure, SameSite=Lax, 30 jours, HMAC-SHA256, renouvelé à la sync.
  Format conservé pour ne pas déconnecter les utilisateurs au déploiement.
- **Nouveau** : `POST /api/v2/auth/logout` ; vérification `Origin`/`Sec-Fetch-Site` sur toutes les requêtes
  mutantes ; jeton CSRF double-submit.
- Choix du prénom au premier login (atomique sur `onboardingComplete`).

### 5.3 Endpoints (`/api/v2`)

| Méthode         | Chemin                                       | Rôle                                                     |
| --------------- | -------------------------------------------- | -------------------------------------------------------- |
| GET             | `/health/live`, `/health/ready`              | Santé (contrat identique : `revision`, `status`)         |
| GET             | `/auth/status`                               | Statut, `isAdmin`, `googleClientId`, expiration          |
| POST            | `/auth/google` · `/auth/logout`              | Connexion · déconnexion                                  |
| PUT             | `/profile/name`                              | Prénom initial                                           |
| GET/POST        | `/family/profiles`                           | Lister · créer un profil                                 |
| PATCH/DELETE    | `/family/profiles/{id}`                      | Modifier · retirer (dernier profil interdit)             |
| PUT             | `/family/profiles/{id}/learning-paths`       | Réglages scolaires                                       |
| POST            | `/family/parent-lock`                        | Définir / vérifier le code parent (§6.4)                 |
| GET             | `/profiles/{id}/bootstrap`                   | État complet du profil                                   |
| POST            | `/profiles/{id}/attempts:sync`               | Ingestion d'événements (≤ 100)                           |
| POST            | `/profiles/{id}/garden/introduction-seen`    | Carte d'intro vue                                        |
| GET             | `/notifications/config`                      | Clé publique VAPID, heure du rappel                      |
| POST/DELETE     | `/profiles/{id}/notifications/subscriptions` | Abonner · désabonner                                     |
| GET/POST/DELETE | `/admin/allowed-emails`                      | Liste d'accès (admins)                                   |
| GET             | `/*`                                         | PWA, redirections de navigation, `index.html` sans cache |

Le profil passe dans le chemin (et non plus dans un en-tête). `/api/v1` reste servi pendant la transition par une
couche d'adaptation, puis est retiré.

### 5.4 Ingestion et bootstrap

- Validation par `lt-domain::validate_attempt` (mêmes raisons : `duplicate_in_batch`, `invalid_answer`,
  `inconsistent_attempt`) ; upsert idempotent sur `_id = eventId`.
- **Nouveau** : projection incrémentale `learning_snapshots` (snapshot + dernier événement traité) mise à jour à
  l'ingestion ; le bootstrap ne rejoue plus tout l'historique. Recalcul complet possible (commande d'administration)
  et vérifié en CI sur des historiques synthétiques.
- Index ajoutés : unique `{profileId, attempt.sessionId, attempt.sequence, eventId}`, `{profileId, answeredAt}`.

### 5.5 Rappels Web Push

- Worker tokio toutes les 60 s, non réentrant ; envoi si heure locale ≥ 18 h, jour ≠ dernier envoi, et aucune
  réponse ce jour-là ; TTL 6 h ; 404/410 → suppression.
- Crate `web-push` (VAPID) ; textes localisés fr / en / zh-Hans.
- **Nouveau** : heure du rappel réglable **par enfant** dans l'espace parent (par défaut 18 h, pas de 15 min,
  plage 7 h – 21 h) ; stockée sur l'abonnement et sur le profil ; `GET /notifications/config` renvoie l'heure du profil.

### 5.5 bis Vue parent des difficultés

Endpoint `GET /profiles/{id}/insights?range=7d|30d` calculé par `lt-domain` à partir des événements :

- faits et compétences qui posent problème (taux d'erreur, rechutes `lapseCount`, faits lents), avec les erreurs
  typiques (réponse donnée vs attendue) ;
- régularité (jours pratiqués, semaines fleuries) et temps passé (somme des latences plafonnées par question) ;
- progression des états de maîtrise sur la période (nouveaux familiers / fluides).

Affichée uniquement dans l'espace parent ; jamais de score ni de comparaison entre enfants.

### 5.6 MongoDB

Collections conservées : `profiles` (familles v2), `attempt_events`, `garden_collections`, `allowed_emails`,
`push_subscriptions`. Ajoutées : `learning_snapshots`, `parent_locks`. Les migrations paresseuses existantes
(document historique → famille v2, avatars inconnus → `sprout`, profil « lou » réservé à l'admin) sont reprises.

### 5.7 Observabilité et sécurité

- `tracing` + JSON structuré, identifiant de requête, durée, statut ; pas d'emails ni de jetons dans les logs.
- Limites : taille de corps, débit par IP sur `/auth/*`, timeouts.
- En-têtes de sécurité conservés dans Caddy (CSP compatible Google Identity Services, HSTS, COOP).

---

## 6. Interface, design et système de composants

### 6.1 Principes (HIG)

- **Clarté** : une intention principale par écran ; texte court ; pas de jargon technique pour l'enfant.
- **Déférence** : l'illustration et le jardin servent le contenu, ils ne le recouvrent pas.
- **Profondeur** : navigation par onglets + piles ; feuilles modales pour les choix secondaires ; transitions qui
  expliquent la hiérarchie (push/pop, feuille qui monte).
- Zones tactiles ≥ 44 × 44 pt ; actions principales dans la moitié basse ; respect des safe areas
  (`env(safe-area-inset-*)`) ; barre d'onglets en bas.
- Typographie à base de rem pilotée par une échelle de type « Dynamic Type » (réglage de taille dans l'app + taille
  système) ; contraste AA minimum, AAA pour les nombres des exercices.
- Mode clair et sombre ; `prefers-reduced-motion` et `prefers-reduced-transparency` respectés.
- Retour multisensoriel : visuel + son (optionnel) + haptique quand disponible (limité sur iOS Safari, voir §6.5).

### 6.2 Architecture d'information proposée

Le redesign repart de zéro. Proposition de départ, à valider sur le canvas :

- **Espace enfant** (par défaut), barre d'onglets à 3 entrées :
  - **Aujourd'hui** : un seul bouton principal en bas (« Arroser mon jardin » / « Reprendre » / « Séance bonus »),
    semaine fleurie compacte, accès aux autres séances par feuille.
  - **Jardin** : jardin plein écran défilable, herbier en pile, règles en feuille d'aide.
  - **Progrès** : résumé + liste des tables et parcours, détail en pile.
  - Avatar en haut à gauche → feuille de changement de profil.
- **Séance** : présentation plein écran (modale), sortie confirmée, progression lisible, clavier unifié en bas.
- **Espace parent** (derrière un code parent) : famille et profils, ce que l'enfant apprend à l'école, rappels,
  heure du rappel par enfant, **vue des difficultés** (§5.5 bis), langue, son, apparence (clair / sombre / système),
  installation, état de la sync, liste d'accès (admins), déconnexion.

### 6.3 Écrans à concevoir (lot design)

Chaque écran est livré en clair et sombre, 320 / 390 / 430 pt de large, avec états vide, chargement, hors-ligne et erreur :
connexion, prénom, hors-ligne sans session ; Aujourd'hui (1re visite, retour, arrosage fait, séance en cours) ;
feuille « autres séances » ; séance (chaque type d'exercice, retour juste, retour encourageant, indice) ; célébration ;
jardin, herbier, aide ; progrès et détails ; changement de profil ; espace parent (famille, profil, parcours, rappels,
préférences, liste d'accès) ; mise à jour disponible ; écran de récupération.

### 6.4 Code parent

Code à 4 chiffres défini au premier accès à l'espace parent, vérifié côté serveur (haché Argon2id) et mis en cache
localement (durée limitée) pour fonctionner hors-ligne. Récupération par reconnexion Google.

### 6.5 Système de composants (`packages/ui`)

Base shadcn/ui copiée dans le dépôt, puis adaptée. Tokens CSS (variables) consommés par Tailwind v4 :
couleurs sémantiques (`--bg`, `--surface`, `--label`, `--secondary-label`, `--tint`, `--success`, `--warning`,
`--destructive`, palette jardin), rayons, ombres, échelle typographique, durées et courbes d'animation.

Composants :

| Catégorie   | Composants                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure   | `AppShell`, `TabBar`, `NavigationBar` (grand titre qui se réduit), `Sheet` (Vaul, détentes moyenne/grande), `Dialog`/`AlertDialog`, `Toast` (Sonner)                             |
| Actions     | `Button` (filled, tinted, gray, plain ; tailles small/medium/large), `IconButton`, `SegmentedControl`, `Toggle`/`Switch`, `Menu`                                                 |
| Données     | `List`/`ListRow` (style « inset grouped »), `Card` (avec parcimonie), `ProgressRing`, `ProgressBar`, `Badge`, `Avatar`, `EmptyState`                                             |
| Saisie      | `TextField`, `Picker`, `Checkbox`, `RadioGroup`, `Stepper`                                                                                                                       |
| Exercices   | `AnswerTiles`, `NumberPad` (unique : entier, fraction, colonne), `ColumnOperation`, `FractionText`, `FractionBed`, `FractionPot`, `NumberLine` + curseur coccinelle, `HintPanel` |
| Jardin      | `GardenScene`, `PlantIllustration`, `Caretaker` (sprites), `FlowerCurtain`                                                                                                       |
| Personnages | `CharacterIllustration` (9 scènes × 6 personnages, Miffy par défaut et en repli, préchargement ; usage familial privé)                                                           |

Règles : chaque composant documenté (Storybook ou Ladle) avec ses états, testé en accessibilité (axe), sans
dépendance à la logique métier. Haptique : `navigator.vibrate` quand disponible ; sur iOS Safari, pas d'API
publique fiable — on n'en dépend jamais pour transmettre une information.

### 6.6 Internationalisation et accessibilité

- Catalogues fr (défaut), en, zh-Hans typés par clés ; ICU pour pluriels ; retrait des ~40 clés mortes.
- Énoncés parlés pour chaque exercice (lecteurs d'écran), descriptions riches du jardin et des barres de progrès.
- Navigation clavier complète (iPad + clavier), focus visibles, rôles ARIA des tuiles, du curseur et du pavé.

---

## 7. Qualité, outillage et exploitation

### 7.1 Commandes

`pnpm check` exécute : `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, build WASM, codegen à jour,
Prettier, ESLint, typecheck, Vitest, Playwright (mobile WebKit + Chromium), build. `pnpm doctor` (React Doctor)
reste exigé pour chaque PR web.

### 7.2 Tests

- **Vecteurs dorés** : `tools/golden` rejoue l'ancien moteur TS sur des milliers de graines et d'historiques et
  produit des fixtures JSON ; `lt-domain` doit les reproduire bit à bit (sessions, distracteurs, snapshots, jardin).
- Propriétés (proptest) : invariants du board 11 (rejouer = no-op, réduction déterministe, une séance ne rend pas un
  fait fluide, une erreur n'augmente jamais la stabilité).
- Intégration Mongo (testcontainers-rs) ; tests HTTP axum ; tests de contrat client Effect ↔ serveur Rust.
- E2E Playwright sur viewport iPhone : connexion mockée, séance complète de chaque type d'exercice, hors-ligne puis
  sync, changement de profil, espace parent, mise à jour du SW.
- Régression visuelle des écrans clés (captures Playwright comparées).

### 7.3 Déploiement

- Image : build multi-étapes (Rust `cargo-chef`, wasm-pack, pnpm), runtime distroless/`debian-slim`, utilisateur non root,
  `HEALTHCHECK /health/ready`.
- Pipeline GitHub inchangé dans sa forme : `verify` → `publish` (GHCR, tag = SHA) → `deploy` (clé SSH restreinte,
  vérification santé + révision, rollback automatique).
- Smoke test conservé et étendu (`/` → `/sign-in`, 401 sur les API protégées, `no-store` sur `/sign-in`, `/api/v1` adapté).

---

## 8. Plan de livraison

| Lot | Contenu                                                                                                          | Sortie                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0   | Specs validées, inventaire Pencil, direction de design                                                           | Ce document + fichier Pencil           |
| 1   | `lt-domain` + vecteurs dorés + WASM ; design system (tokens, composants de base) ; maquettes HIG des écrans clés | Parité moteur prouvée                  |
| 2   | Serveur Rust (auth, profils, sync, bootstrap incrémental, push) derrière `/api/v1` compatible                    | Bascule serveur sans changer le client |
| 3   | Nouvelle PWA (espace enfant + séance + jardin + progrès)                                                         | Bêta famille                           |
| 4   | Espace parent, code parent, vue des difficultés, heure de rappel par enfant, migration IndexedDB, déconnexion    | Parité complète + nouveautés           |
| 5   | Retrait de `/api/v1`, de l'ancien code et des clés historiques                                                   | Fin de la réécriture                   |

### 8.1 Risques

- Divergence du moteur → vecteurs dorés obligatoires avant toute bascule.
- Perte d'événements en migration locale → copie puis suppression après sync confirmée.
- Taille du WASM → objectif < 300 Ko gzip, chargé en parallèle du bundle, mis en précache.
- Haptique iOS limitée → jamais porteuse d'information.

### 8.2 Décisions

| Sujet            | Décision (5 octobre 2026)                                                      |
| ---------------- | ------------------------------------------------------------------------------ |
| Espace parent    | Code à 4 chiffres (§6.4)                                                       |
| Personnages      | Miffy conservé par défaut ; l'app reste à usage familial privé (liste blanche) |
| Périmètre ajouté | Heure de rappel réglable par enfant, vue parent des difficultés, mode sombre   |
| Hors périmètre   | Sign in with Apple                                                             |

### 8.3 Questions ouvertes

1. Base de données et mode de déploiement : MongoDB en Quadlet (actuel), PostgreSQL ou SQLite (voir l'analyse en
   réponse à la revue des specs).
