# Pre-production beside production

`math-preprod.leaetzak.love` runs the Rust server and the new app on a copy of production data,
while `math.leaetzak.love` keeps running unchanged (Node image and MongoDB). It lets the family try
the rewrite before the switch described in `../RUST_CUTOVER_RUNBOOK.md`.

| Production                         | Pre-production                                       |
| ---------------------------------- | ---------------------------------------------------- |
| Quadlets on `127.0.0.1:32140`      | `little-tables-preprod.service` on `127.0.0.1:32141` |
| MongoDB volume                     | `/var/lib/little-tables-preprod/little-tables.db`    |
| `/etc/little-tables/`              | `/etc/little-tables-preprod/little-tables.env`       |
| Daily reminders with the prod keys | Its own VAPID keys; no subscription copied from prod |

The two never share state: answers given on pre-production stay there. Refreshing the copy repeats
steps 2 to 4 on an empty database.

## 0. Prerequisites

- The `*.leaetzak.love` DNS record already covers the host (Cloudflare proxied).
- In Google Cloud Console, the OAuth client used by production lists
  `https://math-preprod.leaetzak.love` among its authorized JavaScript origins. Without it, Google
  sign-in fails on pre-production.
- The `little-tables-<sha>` release artifact of the commit to run (CI, any branch).
- The exporter image built from commit `9881ecc7aa9263d4e63ab90cc77db6d1dcf3dd86` (the previous
  Node server, removed from `main` since), loaded on the VPS as
  `localhost/little-tables-exporter:9881ecc7aa9263d4e63ab90cc77db6d1dcf3dd86`; see
  `../RUST_CUTOVER_RUNBOOK.md` §0 to rebuild it.

## 1. Install (once)

```sh
sudo useradd --system --home-dir /var/lib/little-tables-preprod --no-create-home \
  --shell /usr/sbin/nologin little-tables-preprod
sudo install -d -o little-tables-preprod -g little-tables-preprod -m 0750 /var/lib/little-tables-preprod
sudo install -d -m 0755 /opt/little-tables-preprod/releases
sudo install -d -m 0750 -o root -g little-tables-preprod /etc/little-tables-preprod
sudo install -d -m 0700 /var/backups/little-tables-preprod
```

The environment file (`0640 root:little-tables-preprod`) holds, without ever being printed:
`SESSION_SECRET` (new, random), `GOOGLE_CLIENT_ID` and `GOOGLE_ALLOWED_EMAILS` (copied from the
production file), `ADMIN_EMAILS`, `PUBLIC_ORIGIN=https://math-preprod.leaetzak.love`, and new
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` generated on the host.

## 2. Export production data (read-only)

```sh
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo sh -c "podman run --rm --network host --env-file /etc/little-tables/little-tables.env \
  --entrypoint node localhost/little-tables-exporter:9881ecc7aa9263d4e63ab90cc77db6d1dcf3dd86 dist/tools/export-for-rust.js \
  >/var/backups/little-tables-preprod/export-$timestamp.json"
```

The exporter only reads MongoDB; production keeps serving.

## 3. Release and import

Unpack the checked archive into `/opt/little-tables-preprod/releases/<sha>` (root-owned), point
`/opt/little-tables-preprod/current` at it, then import into the empty database and drop the
copied push subscriptions (they belong to production's keys):

```sh
sudo install -m 0640 -o root -g little-tables-preprod \
  /var/backups/little-tables-preprod/export-$timestamp.json /var/lib/little-tables-preprod/import.json
sudo runuser -u little-tables-preprod -- env DATABASE_PATH=/var/lib/little-tables-preprod/little-tables.db \
  /opt/little-tables-preprod/current/little-tables admin import /var/lib/little-tables-preprod/import.json
sudo runuser -u little-tables-preprod -- sqlite3 /var/lib/little-tables-preprod/little-tables.db \
  'DELETE FROM push_subscriptions;'
sudo rm /var/lib/little-tables-preprod/import.json
```

The import verifies every child's bootstrap against the previous server's and refuses any
difference.

## 4. Start and route

Install `little-tables-preprod.service` in `/etc/systemd/system/` and
`math-preprod.leaetzak.love.Caddyfile` in `/etc/caddy/conf.d/`, then:

```sh
sudo systemd-analyze verify /etc/systemd/system/little-tables-preprod.service
sudo systemctl daemon-reload && sudo systemctl enable --now little-tables-preprod.service
curl -fsS http://127.0.0.1:32141/health/ready
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

## 5. Update or remove

- **New release:** unpack it beside the others, switch `current`, restart only
  `little-tables-preprod.service`, check `/health/ready`.
- **Removal:** stop and disable the unit, then remove its fragment and reload Caddy. Delete its
  directories only with an explicit decision.
