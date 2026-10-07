# Switching production to the Rust server

The rewrite replaces the Node server, MongoDB and the previous web app with one Rust binary, one
SQLite file and the new app. This runbook moves production once; it needs an approved maintenance
window and must not touch other workloads or the Mongo volume. Pre-production
(`preprod/PREPROD_RUNBOOK.md`) rehearses the same export and import beside production.

Until it is done, deploying on merge stays paused (repository variable `DEPLOY_ON_MERGE`). Every
CI run builds and smoke-tests the release; runs on `main` keep it as the `little-tables-<commit>`
artifact.

## What changes

| Before                                              | After                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Quadlets `little-tables.service` + `-mongo.service` | Native unit `little-tables.service` (`deploy/systemd/`)           |
| GHCR image per commit                               | Release archive per commit in `/opt/little-tables/releases/<sha>` |
| MongoDB volume `little-tables-mongo-data`           | `/var/lib/little-tables/little-tables.db` (SQLite, WAL)           |
| `deploy <image>` through the restricted key         | `deploy-release <sha> <sha256>` with the archive on stdin         |
| No database backups of its own                      | Pre-deploy backup + nightly timer, 14 days                        |
| Previous web app on `/api/v1`                       | New app on `/api/v2` (`/api/v1` answers 404)                      |

The app keeps `127.0.0.1:32140`. Sessions keep their format: families stay signed in. Installed
copies of the previous app check for a new service worker whenever they open and offer their
update banner (its recovery screen does the same when `/api/v1` refuses them); tapping it opens
the new app, which copies each child's local data, unsent answers included, and deletes the old
copy only after they reached the server.

## 0. Before the window

- The commit to deploy is merged on `main` and its CI is green. Download its
  `little-tables-<sha>` artifact (archive and `.sha256`) from the CI run.
- The exporter (`dist/tools/export-for-rust.js`) belongs to the previous Node server, removed from
  `main` with lot 5. Use the image built from commit `9881ecc7aa9263d4e63ab90cc77db6d1dcf3dd86`,
  already loaded on the VPS as `localhost/little-tables-exporter:9881ecc7…` for pre-production; if
  it is gone, rebuild it from that commit
  (`docker buildx build --platform linux/amd64 -t localhost/little-tables-exporter:<commit> --load .`)
  and `docker save | ssh leaetzak 'sudo podman load'`.
- Prepare the new variables for `/etc/little-tables/little-tables.env` (without printing the
  file): `ADMIN_EMAILS` (the owner's Google email) and `PUBLIC_ORIGIN=https://math.leaetzak.love`.
  `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_EMAILS` and the VAPID keys stay as they
  are; the Mongo and Node variables are ignored by the new server.

## 1. Record the starting point

Host health (memory, swap, pressure, disk), `systemctl --failed`, the restart counters of
`little-tables.service` and `little-tables-mongo.service`, the deployed image, and the listener
on `127.0.0.1:32140`.

## 2. Freeze and back up MongoDB

Stop the app only (devices queue their answers in their outbox meanwhile), then take and check a
logical backup outside the volume:

```sh
sudo systemctl stop little-tables.service
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo install -d -m 0700 /var/backups/little-tables
sudo sh -c "podman exec little-tables-mongo mongodump --archive --gzip >'/var/backups/little-tables/pre-rust-$timestamp.archive.gz'"
sudo sh -c "podman exec -i little-tables-mongo mongorestore --archive --gzip --dryRun <'/var/backups/little-tables/pre-rust-$timestamp.archive.gz' >/dev/null"
```

## 3. Export

The exporter only reads MongoDB. Run it against the running Mongo:

```sh
sudo sh -c "podman run --rm --network host --env-file /etc/little-tables/little-tables.env \
  --entrypoint node localhost/little-tables-exporter:9881ecc7aa9263d4e63ab90cc77db6d1dcf3dd86 dist/tools/export-for-rust.js \
  >/var/backups/little-tables/export-$timestamp.json"
```

Podman reads the environment file literally: if a value there is quoted, pass `MONGODB_URI`
with `--env` instead. The exporter stops with an error when a profile document still has the format from before family profiles
or when a bootstrap cannot be computed; fix the cause on the old server and export again.

## 4. Install the release and import

```sh
sudo useradd --system --home-dir /var/lib/little-tables --no-create-home --shell /usr/sbin/nologin little-tables
sudo install -d -o little-tables -g little-tables -m 0750 /var/lib/little-tables /var/lib/little-tables/backups
sudo install -d -m 0755 /opt/little-tables/releases
# Unpack little-tables-<sha>.tar.gz after checking it against its .sha256, into
# /opt/little-tables/releases/<sha>, owned by root.
sudo install -m 0640 -o root -g little-tables /var/backups/little-tables/export-$timestamp.json /var/lib/little-tables/import.json
sudo runuser -u little-tables -- env DATABASE_PATH=/var/lib/little-tables/little-tables.db \
  /opt/little-tables/releases/<sha>/little-tables admin import /var/lib/little-tables/import.json
```

The import refuses a non-empty database, records of removed children unless `--allow-orphans`
is given (review them first: the previous server kept them after a removal), and **any bootstrap
that differs from the previous server's**. Any refusal means no switch: restart the Node
service (`sudo systemctl start little-tables.service`) and investigate.

## 5. Switch

1. Copy the Quadlet sources (`/etc/containers/systemd/little-tables*.container`,
   `little-tables-mongo-data.volume`) and `/usr/local/sbin/deploy-little-tables` into a root-only
   rollback directory.
2. Move `little-tables.container` out of `/etc/containers/systemd/` (keep the Mongo Quadlets for
   the 30-day retention), then `sudo systemctl daemon-reload`.
3. Install `deploy/systemd/little-tables.service`, `little-tables-backup.service` and
   `little-tables-backup.timer` in `/etc/systemd/system/`, `deploy/little-tables-backup.sh` as
   `/usr/local/libexec/little-tables-backup`, `deploy/deploy-little-tables-release.sh` as
   `/usr/local/sbin/deploy-little-tables-release` and the updated
   `deploy/little-tables-deploy-ssh` forced command, all root-owned. Allow the deploy user to run
   `/usr/local/sbin/deploy-little-tables-release` through sudo, exactly like the image deployer.
4. Install `deploy/math.leaetzak.love.Caddyfile` in `/etc/caddy/conf.d/` (its CSP lets the new
   app run its WebAssembly engine) with the owner and mode of the file it replaces,
   `0640 root:caddy`: Caddy reads it as the `caddy` user, and a root-only file passes a root
   `caddy validate` but fails the reload. Validate as Caddy does,
   `sudo runuser -u caddy -- caddy validate --config /etc/caddy/Caddyfile`, and keep the reload
   for step 6.
5. Copy the environment file into the rollback directory, then edit it: add `ADMIN_EMAILS` and
   `PUBLIC_ORIGIN`, and **remove `WEB_DIST_PATH`**. The Node image needed it (`/app/web-dist`,
   a path inside its container), and systemd lets `EnvironmentFile=` override the unit's
   `Environment=WEB_DIST_PATH`, so the new server would serve nothing. `HOST` and `PORT` already
   match the unit; the Mongo and Node variables are ignored. Make it `0640 root:little-tables`,
   then `sudo ln -sfn /opt/little-tables/releases/<sha> /opt/little-tables/current`.
6. `sudo systemd-analyze verify little-tables.service`, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now little-tables.service little-tables-backup.timer`
   and `sudo systemctl reload caddy`.

## 6. Verify

- `curl -s http://127.0.0.1:32140/health/ready` reports `ready` and `<sha>`; public health too.
- `/` redirects to `/sign-in` when signed out; a family signs in and sees its garden, progress and
  children; a practice session syncs (outbox empties).
- `systemctl show little-tables.service -p NRestarts`, memory under `MemoryMax`, `journalctl` free
  of errors, `systemctl --failed` empty, Caddy and the other workloads unchanged.
- The next morning: a backup in `/var/lib/little-tables/backups`; in the evening, reminders sent
  (the journal logs how many).

Then set the repository variable `DEPLOY_ON_MERGE` to `true`: merges deploy releases again
(`deploy-release`).

## Rollback

Before deploying on merge resumes, rolling back is: stop `little-tables.service`, disable the
native units, restore `little-tables.container` into `/etc/containers/systemd/`, the previous
environment file and the previous Caddy fragment, `daemon-reload`, start the Quadlet service and
reload Caddy. MongoDB was frozen at step 2, so answers synced to the Rust server since
then are not in MongoDB: devices keep only unsynced answers. Decide before rolling back after
real use.

After 30 days without rollback, and with the user's explicit approval, remove the Mongo
Quadlets, container and volume, the GHCR images and the image deployer.
