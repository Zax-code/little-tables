# Switching production to the Rust server

Lot 2 of the rewrite replaces the Node server and MongoDB with one Rust binary and one SQLite
file. The current web app keeps working unchanged: the Rust server serves the same `/api/v1`
contract. This runbook moves production once; it needs an approved maintenance window and must
not touch Caddy, other workloads or the Mongo volume.

Until it is done, CI keeps deploying the Node image. Every CI run also builds and smoke-tests the
Rust release (`little-tables-<commit>` artifact) without deploying it.

## What changes

| Before                                              | After                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Quadlets `little-tables.service` + `-mongo.service` | Native unit `little-tables.service` (`deploy/systemd/`)           |
| GHCR image per commit                               | Release archive per commit in `/opt/little-tables/releases/<sha>` |
| MongoDB volume `little-tables-mongo-data`           | `/var/lib/little-tables/little-tables.db` (SQLite, WAL)           |
| `deploy <image>` through the restricted key         | `deploy-release <sha> <sha256>` with the archive on stdin         |
| No database backups of its own                      | Pre-deploy backup + nightly timer, 14 days                        |

The app keeps `127.0.0.1:32140`, so Caddy is unchanged. Sessions keep their format: families
stay signed in.

## 0. Before the window

- The commit to deploy is merged on `main`, its CI is green and its Node image is deployed (that
  image contains the exporter, `dist/tools/export-for-rust.js`).
- Download its `little-tables-<sha>` artifact (archive and `.sha256`) from the CI run.
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

The exporter only reads MongoDB. Run it from the current image, against the running Mongo:

```sh
sudo sh -c "podman run --rm --network host --env-file /etc/little-tables/little-tables.env \
  --entrypoint node <current image> dist/tools/export-for-rust.js \
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
4. Add `ADMIN_EMAILS` and `PUBLIC_ORIGIN` to the environment file, then
   `sudo ln -sfn /opt/little-tables/releases/<sha> /opt/little-tables/current`.
5. `sudo systemd-analyze verify little-tables.service`, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now little-tables.service little-tables-backup.timer`.

## 6. Verify

- `curl -s http://127.0.0.1:32140/health/ready` reports `ready` and `<sha>`; public health too.
- `/` redirects to `/sign-in` when signed out; a family signs in and sees its garden, progress and
  children; a practice session syncs (outbox empties).
- `systemctl show little-tables.service -p NRestarts`, memory under `MemoryMax`, `journalctl` free
  of errors, `systemctl --failed` empty, Caddy and the other workloads unchanged.
- The next morning: a backup in `/var/lib/little-tables/backups`; in the evening, reminders sent
  (the journal logs how many).

Then merge the pipeline change that deploys releases (`deploy-release`) instead of images.

## Family beta of the new app (lot 3)

Each release carries both apps: `web-v1/` (the previous one, served after the switch) and `web/`
(the new one). Once the switch is stable, serve the new app by changing one line of the unit:

```sh
sudo systemctl edit little-tables.service   # Environment=WEB_DIST_PATH=/opt/little-tables/current/web
sudo systemctl restart little-tables.service
```

The new app runs its engine as WebAssembly: before switching, add `'wasm-unsafe-eval'` to
`script-src` in the `math.leaetzak.love` Caddy fragment (as in
`preprod/math-preprod.leaetzak.love.Caddyfile`), validate and reload Caddy.

On first opening, the new app copies each child's previous local data (events not yet sent
included) and deletes the old copy only after it reached the server. Going back is the same edit
with `web-v1`; both apps read the same server data.

## Rollback

Before the pipeline change, rolling back is: stop `little-tables.service`, disable the native
units, restore `little-tables.container` into `/etc/containers/systemd/`, `daemon-reload`, start
the Quadlet service. MongoDB was frozen at step 2, so answers synced to the Rust server since
then are not in MongoDB: devices keep only unsynced answers. Decide before rolling back after
real use.

After 30 days without rollback, and with the user's explicit approval, remove the Mongo
Quadlets, container and volume, the GHCR images and the image deployer.
