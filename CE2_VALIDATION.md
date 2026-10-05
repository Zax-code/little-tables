# Vérification de l’extension CE2

La référence fonctionnelle est [CE2_MATH_EXPANSION_SPEC.md](./CE2_MATH_EXPANSION_SPEC.md).
Les activités couvrent N1, A1–A5, S1–S5, P1–P2 et F1–F9, sur quatre paliers.

## Vérifications automatisées

`corepack pnpm check` passe : formatage, lint, typage, 368 tests TypeScript,
2 tests du pipeline d’images et compilation de production. Les tests Mongo tournent
dans un conteneur. `corepack pnpm smoke:docker` passe également, y compris le contrôle
d’authentification de l’image de production.

`corepack pnpm doctor` ne signale aucun nouveau problème : les deux avertissements
antérieurs concernent le renderer du jardin et la dépendance de test `happy-dom`.
Le score était de 91/100 lors des premiers passages ; le dernier passage ne pouvait
pas joindre l’API de score, avec les mêmes deux avertissements.

| Comportement                                                                                    | Vérification                                                                           |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bornes des entiers et fractions, calcul rationnel exact, partitions équivalentes, zéro et unité | `packages/domain/src/ce2-engine.test.ts`                                               |
| Toutes les compétences, ordre des fractions et résultats intermédiaires des problèmes           | Tests du moteur CE2 et du renderer                                                     |
| QCM sans position de réponse fixe, diversité suffisante pour atteindre la maîtrise              | Tests du moteur CE2                                                                    |
| Retenues, échanges, alignement et absence de fausses preuves de procédure                       | Tests du moteur et de `ce2-column-steps`                                               |
| Maîtrise autonome, assistance, rappels, progression des paliers et plafonds de séance           | Tests du moteur CE2                                                                    |
| Migration, isolation des profils, reprise du brouillon et fin de séance idempotente             | `packages/local-store/src/practice-store.test.ts`                                      |
| Récompense quotidienne commune aux matières, abandon sans récompense                            | Tests du stockage et de l’API CE2                                                      |
| Synchronisation concurrente avec une réponse ou un brouillon                                    | Tests du stockage local                                                                |
| Ancien client réécrivant son état sans champs CE2                                               | Test de restauration depuis le record CE2 et l’historique de séance                    |
| Ancien serveur ne lisant que les essais classiques                                              | Test Mongo : collection CE2 distincte, ledgers communs                                 |
| Validation serveur des questions et évaluations, rejeu, authentification                        | `apps/server/src/application/ce2-attempt-ingestion.test.ts` et `http/ce2-http.test.ts` |
| Endpoint absent après rollback ou authentification expirée                                      | `apps/web/src/sync-ce2.test.ts` et `bootstrap-client.test.ts`                          |
| Temps de réflexion excluant l’arrière-plan                                                      | `apps/web/src/practice-active-clock.test.ts`                                           |

## Contrôle visuel et interactions

Les contrôles ont été exercés dans le navigateur local, avec un profil de test séparé :
découverte F1, sélection et validation manuelles, erreur et correction, reprise après
rechargement, progression sans saut de question, célébration sans arrosage supplémentaire,
calcul posé accompagné et résultat libre, changement d’activité après abandon.
Le parcours conserve les couleurs, la typographie, le personnage et le jardin existants.

Le problème en deux étapes a été répondu et validé, puis repris à la question suivante.
Les trois langues ont été contrôlées sur ce parcours. Aucun débordement horizontal n’a
été constaté aux largeurs 320, 390 et 1 280 pixels. Captures :
[fraction sur 320 pixels](./docs/ce2-qa/fraction-320.jpg) et
[problème sur 320 pixels](./docs/ce2-qa/problem-320.jpg).

La reprise hors ligne a été vérifiée sur le build de production avec une session
fictive signée par le mécanisme d’authentification réel. Après arrêt du serveur web,
du proxy de test et de l’API, le rechargement de `/practice` a restauré la question
et son brouillon exact ; la réponse a été validée localement. Le service worker
sert l’application pour les navigations, sans intercepter les endpoints `/api`.
[Capture de la réponse hors ligne](./docs/ce2-qa/offline-320.jpg).

Les écrans conceptuels défilent sans superposer le personnage à l’explication. Une nouvelle
question revient en haut et reçoit le focus ; le retour de validation place le focus sur
« suivant ». Les supports sont rendus localement, sans images ou service distant nécessaires.

## Compatibilité

L’API v1 et les schémas des tables restent lisibles. L’API v2 annonce la capacité CE2 ;
une connexion initiale l’active sur l’appareil. Les nouvelles tentatives non synchronisées
restent conservées quand un serveur plus ancien ne reconnaît pas v2. Les brouillons ne
promettent pas de reprise sur un autre appareil.

Le record IndexedDB `state/ce2` et l’historique des séances survivent aux écritures d’un
ancien client sur `state/current`. Au retour du nouveau client, la séance CE2 conservée
reste prioritaire. Les essais classiques restent dans `attempt_events`, les essais CE2
dans `ce2_attempt_events`, avec la même logique de jardin et de rappels.

## Limites de vérification

La vérification sur un iPhone physique et une PWA installée sur iOS reste à effectuer.
Le navigateur permet de contrôler les petits écrans et le clavier, mais ne reproduit pas
tous les comportements de fermeture et de mémoire d’iOS. Les règles de portes du jardin
fondées sur la maîtrise des tables restent celles du produit existant.
