# Personalized Garden Rewards Plan

## Purpose

Make the garden feel like each learner's own collection: learners should discover flowers in a
personalized order, understand how daily practice grows the garden, and see what they are working
toward. The collection must remain consistent across devices.

This is a product-direction document, not an implementation specification. Open questions are
called out explicitly for later decisions.

## Current product context

- A learner can earn at most one garden bloom per learning day by completing daily watering. Extra
  practice does not earn another bloom.
- The garden currently has nine flowers in three chapters. Every learner receives them in the same
  fixed order.
- Each plant currently spans five daily blooms from its start through maturity (45 blooms for the
  full nine-flower collection).
- Bloom history is reconstructed from completed session attempts. Garden progress and rewards are
  then derived from bloom count and fluent-fact mastery.
- The garden and celebration screens already show some next-step and mastery-related copy, but the
  overall mechanic is not introduced as one simple, connected explanation.

## Product direction

### 1. Personalize flower order without duplicates

Each learner should receive a randomized order of flowers rather than the same global sequence.
Randomization happens per learner, not per browser or device.

Required behavior:

- A learner sees one stable flower order everywhere they sign in.
- Each flower appears at most once in that learner's collection cycle.
- Awarding the same bloom twice because of retries, sync, or concurrent devices must not award a
  second flower or advance progress twice.
- A learner's already-awarded flowers and current growing flower never change merely because the
  app, catalog, or randomization logic changes.
- The UI should treat the next flower as a discovery where appropriate; it does not need to reveal
  the learner's entire future order.

A practical product model is a per-user, ordered flower queue drawn without replacement from the
eligible catalog. The order may be generated all at once or extended as needed, but awarded entries
must be recorded durably rather than re-randomized on each request.

### 2. Persist the collection durably per user

The database should be the cross-device source of truth for personalized garden state. It must hold
enough information to reconstruct both the awarded collection and the available future pool.

The durable record should include, conceptually:

- user/profile identity;
- collection/catalog version;
- the learner's ordered flower assignments, or an equivalent stable ordering that survives
  algorithm changes;
- for each assigned flower: stable flower ID, position, state (`available`, `growing`, or
  `awarded/mature`), and the bloom/progress values needed to reconstruct its state;
- the bloom/session event that caused an award, or another idempotency key;
- timestamps useful for migration and support;
- any chapter, pot, or mastery-gate state that cannot be derived safely from the assignments and
  learning history.

Database constraints should enforce unique `(user, flower)` and `(user, position)` assignments.
Award/progress updates should be atomic and idempotent so two devices cannot create duplicates.
Bootstrap/sync responses should return the authoritative collection state needed to render the same
garden offline and on another device. Local Dexie state may cache and optimistically display it,
but reconciliation must preserve server-awarded flowers.

Attempt history can continue to support learning and bloom auditing, but a personalized assignment
must not depend solely on replaying attempts through the latest randomization algorithm.

### 3. Shorten plant pacing

Reduce the current five rewarded daily blooms per plant.

**Approved pacing:** three daily blooms per plant:

1. first bloom starts/reveals the plant;
2. second bloom visibly grows it;
3. third bloom matures and adds it to the collection.

At one bloom per rewarded learning day, this would reduce the current nine-flower path from 45 to
about 27 rewarded days, before considering mastery gates.

The product should retain versioned pacing data so this can change later without rewriting or
corrupting existing collection history.

### 4. Explain the garden at the moments it matters

Use one consistent explanation: completing daily watering earns one bloom; blooms grow the current
flower; a mature flower joins the learner's collection; some special flowers may also require
rooted/fluent facts.

#### First home visit

Show a concise, dismissible garden-introduction card on the learner's first home visit. Suggested
content:

> Finish today's watering to earn one bloom. Blooms grow a flower for your own collection—come back
> on another day to help it grow again.

The seen/dismissed state should follow the learner across devices so the introduction is not tied to
one browser.

#### Post-daily-session celebration

After a bloom-earning daily session, celebration copy should report both the immediate reward and
meaningful progress. For example:

> You earned 1 bloom. Your rose lotus is 2 of 3 blooms grown—one more daily watering will make it
> flower.

When a flower matures, say that it joined the collection and introduce the next discovery. Extra
practice celebrations should plainly say that today's garden bloom is already earned and must not
imply further garden progress.

#### Garden: “How it grows”

Add an easy-to-find “How it grows” explanation on the garden screen. It should state:

- daily watering can earn one bloom per learning day;
- extra practice helps learning but does not earn another bloom that day;
- blooms grow the current flower;
- mature flowers are kept permanently in the collection;
- special mastery requirements, when present, are shown before they block progress;
- days off never remove flowers or reset growth.

#### Visible next goal

Keep a persistent next-goal indicator near the garden's primary action. It should name the current
flower, show progress such as `2 of 3 blooms`, and state the next outcome (“1 more daily bloom to add
it to your collection”). If the next action cannot advance the garden today, show when it can and
what extra practice still helps.

### 5. Present mastery gates plainly

Do not rely on terms such as “mastery gate,” “fluent facts,” or “rooted facts” without explanation.
When a flower has both bloom and learning requirements, show the two requirements separately and
early:

> To unlock this flower:
>
> - earn 3 daily blooms;
> - know 5 multiplication facts without hints.

If blooms are complete first, say exactly what remains:

> This flower has enough blooms. Learn 2 more multiplication facts without hints to unlock it.

The UI should also explain what counts, how the learner can make progress, and that completed bloom
progress is safe while they work on the learning requirement. Celebration, garden, and collection
copy should use the same learner-facing term for this concept.

## Unresolved design decisions

These decisions should be made before implementation:

- **Reveal policy:** show the next flower immediately, use a mystery silhouette, or reveal it on the
  first bloom.
- **Collection lifecycle:** decide what happens after all current flowers are collected and whether
  duplicates are ever allowed in a future reset/new season. The initial direction is no duplicates.
- **Catalog changes:** decide how newly added or retired flowers enter an existing learner's
  available pool without reordering earned or in-progress flowers.
- **Mastery placement:** decide which flowers need mastery requirements, the thresholds, and whether
  mastery can unlock a flower before its bloom requirement is complete.
- **Existing learners:** preserve current flowers/order, migrate everyone into a personalized
  remaining queue, or offer a clean transition. No earned flower should be lost.
- **Household/profile model:** confirm that personalization belongs to the learner profile, not the
  login account, if multiple learner profiles are introduced.
- **Introduction state:** define “first home visit” for existing learners and whether “How it grows”
  can reopen the introductory content.
- **Language and tone:** choose a single plain-language term for durable fact mastery and validate
  both English and French copy.

## Implementation considerations

- Introduce a versioned server-side collection model and migration path rather than changing the
  current deterministic derivation in place.
- Make flower assignment and bloom application one transactional operation with a stable
  idempotency key.
- Define deterministic conflict resolution for offline progress and simultaneous devices; the
  server should never revoke a valid award because a client has stale state.
- Separate catalog identity from display name/art so renamed or redesigned flowers retain ownership
  history.
- Treat pacing as versioned data or persist per-assignment targets, so changing the default does not
  unexpectedly move existing flowers backward or forward.
- Decide whether mastery state is snapshotted at award time or always derived from learning events;
  audit/support tooling should be able to explain why a flower is locked or awarded.
- Include accessibility, reduced-motion, and localization requirements in all new cards,
  celebrations, progress indicators, and mystery/reveal states.
- Add observability for assignments, idempotent replays, conflicts, migrations, and impossible
  duplicate states.

## Acceptance outcomes

The direction is successfully delivered when:

- two new learners can receive different flower orders;
- one learner sees the same awarded, growing, and available collection on two devices;
- no flower is duplicated for a learner under retries, offline sync, or concurrent completion;
- an earned flower remains stable through catalog and pacing changes;
- the selected pacing is reflected consistently in garden and celebration progress;
- a first-time learner can explain how to earn a bloom, mature a flower, and satisfy a special
  learning requirement using only in-app guidance;
- the garden always shows the next achievable goal and clearly distinguishes today's earned bloom
  from extra practice.

## Implementation decisions

The first implementation materially resolved these points:

- Flower identities are shuffled across the full nine-flower catalog. Chapter-ending mastery
  requirements belong to collection positions 3, 6, and 9 rather than to a particular flower, so a
  random flower cannot unexpectedly bring a late gate into the learner's first reward.
- Three blooms per flower is the approved current pacing. The catalog and persisted collection are
  versioned for future pacing changes.
- MongoDB stores one `garden_collections` record per learner profile with the stable flower order,
  awarded flower IDs, bloom count, rewarded learner-local day keys, catalog/pacing version, and
  introduction-seen state. Set-based reconciliation makes repeated syncs idempotent.
- Existing learners are backfilled by keeping the fixed-order prefix they had already reached under
  five-bloom pacing, then shuffling the unseen remainder. Their complete distinct daily bloom
  history continues to count under the new three-bloom pacing, so nothing earned is removed.
- The plain daily rule used throughout the experience is: the garden grows once per day; completing
  daily watering earns today's one bloom; after that, the next bloom is ready tomorrow. Extra
  practice earns no extra bloom that day but continues to strengthen math skills.
