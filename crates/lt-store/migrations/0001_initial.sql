-- little tables: initial schema. Instants are Unix milliseconds; day keys are 'YYYY-MM-DD'.

CREATE TABLE families (
  google_subject TEXT PRIMARY KEY NOT NULL,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL,
  family_subject TEXT NOT NULL REFERENCES families (google_subject) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  learning_paths TEXT,
  -- Minutes after local midnight for the daily reminder; NULL when it is off.
  reminder_minute INTEGER DEFAULT 1080,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX profiles_family ON profiles (family_subject, position);

CREATE TABLE attempt_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  session_kind TEXT,
  answered_at INTEGER NOT NULL,
  -- The event's learning day, or its UTC date for events written without one.
  day_key TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  correct INTEGER NOT NULL,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
) STRICT;
CREATE INDEX attempt_events_profile_order ON attempt_events (profile_id, answered_at, sequence);

CREATE TABLE learning_snapshots (
  profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  algorithm_version TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  -- The last event folded in, by (answered_at, sequence, rowid).
  last_answered_at INTEGER,
  last_sequence INTEGER,
  last_rowid INTEGER,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE garden_collections (
  profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  awarded_flower_ids TEXT NOT NULL,
  flower_order TEXT NOT NULL,
  bloom_count INTEGER NOT NULL DEFAULT 0,
  rewarded_day_keys TEXT NOT NULL,
  introduction_seen INTEGER NOT NULL DEFAULT 0,
  catalog_version TEXT NOT NULL DEFAULT '1',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked')),
  session_version INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER,
  added_by TEXT,
  removed_at INTEGER,
  removed_by TEXT
) STRICT;

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  keys_auth TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  expiration_time REAL,
  locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  last_sent_day_key TEXT,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX push_subscriptions_profile ON push_subscriptions (profile_id);

CREATE TABLE parent_locks (
  family_subject TEXT PRIMARY KEY NOT NULL REFERENCES families (google_subject) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
) STRICT;
