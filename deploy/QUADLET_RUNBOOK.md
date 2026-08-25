# Little Tables Quadlet operations

Little Tables runs as two rootful Podman Quadlets generated into the existing
systemd service names:

| Source                            | Generated unit                            | Container/data                                              |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `little-tables.container`         | `little-tables.service`                   | `little-tables-app`, host network, app on `127.0.0.1:32140` |
| `little-tables-mongo.container`   | `little-tables-mongo.service`             | `little-tables-mongo`, Mongo on `127.0.0.1:27018`           |
| `little-tables-mongo-data.volume` | `little-tables-mongo-data-volume.service` | existing `little-tables-mongo-data` Podman volume           |

The application Quadlet is rendered from `little-tables.container.in` with an
exact GHCR commit tag. The deployer pulls that immutable image, atomically
renders the active Quadlet, reloads systemd, restarts only the application, and
checks both `/health/ready` and the running container's image name. A failed
deployment renders and starts the previous image again. MongoDB is not restarted
by ordinary application deployments.

Production secrets remain only in `/etc/little-tables/little-tables.env` and the
registry auth file remains only in `/etc/little-tables/ghcr-auth.json`. Do not
print either file. Caddy is unchanged by this migration.

## One-time migration from wrapper units

Perform this during an approved Little Tables maintenance window. The migration
briefly interrupts the app and MongoDB; it must not touch Caddy, Podman networks,
Adventure Time, or any other service.

1. Record the current app image without printing environment files, the two
   service restart counters, the active listener, host memory/swap pressure, and
   `systemctl --failed`.
2. Create a verified logical MongoDB backup outside the live volume. The current
   Mongo image includes both tools:

   ```sh
   timestamp=$(date -u +%Y%m%dT%H%M%SZ)
   sudo install -d -m 0700 /var/backups/little-tables
   sudo sh -c "podman exec little-tables-mongo mongodump --archive --gzip >'/var/backups/little-tables/pre-quadlet-$timestamp.archive.gz'"
   sudo sh -c "podman exec -i little-tables-mongo mongorestore --archive --gzip --dryRun <'/var/backups/little-tables/pre-quadlet-$timestamp.archive.gz' >/dev/null"
   ```

3. Create a root-only rollback directory. Copy the effective legacy units,
   `/usr/local/sbin/deploy-little-tables`, and `/etc/little-tables/image.env`
   into it. Record the directory and backup archive in the change log.
4. Stage the rendered app Quadlet, Mongo Quadlet, and volume Quadlet together in
   a temporary directory. Validate only that set with the installed generator:

   ```sh
   sudo env QUADLET_UNIT_DIRS=/path/to/staging \
     /usr/lib/systemd/system-generators/podman-system-generator --dryrun
   ```

   The generated app must use the current immutable image, host networking, the
   production environment file, and a dependency on Mongo. The generated Mongo
   service must bind only `127.0.0.1:27018` and resolve the volume name to
   `little-tables-mongo-data`.

5. Install the template at
   `/usr/local/share/little-tables/little-tables.container.in`, the renderer at
   `/usr/local/libexec/render-little-tables-quadlet`, and the new deployer at
   `/usr/local/sbin/deploy-little-tables`. Install the three rendered/complete
   Quadlet sources in `/etc/containers/systemd/`, root-owned and mode `0644`.
6. Stop `little-tables.service` first, then `little-tables-mongo.service`. Move
   the two legacy files out of `/etc/systemd/system/` into the rollback directory.
   Do not remove the named Podman volume.
7. Run `systemctl daemon-reload`, then verify:

   ```sh
   sudo systemd-analyze --generators=true verify little-tables-mongo.service little-tables.service
   sudo systemctl show little-tables-mongo.service little-tables.service \
     -p SourcePath -p FragmentPath -p UnitFileState
   ```

   Both `SourcePath` values must point under `/etc/containers/systemd/`.

8. Start Mongo first and wait for its log to report that it accepts connections.
   Start the app and require a successful direct readiness response. Verify the
   public endpoint with a non-default user agent, the exact running image,
   loopback-only listeners, both restart counters, recent target logs,
   `systemctl --failed`, memory/swap pressure, and the unrelated-service gates
   required by the VPS runbook.

Do not remove the rollback directory, database backup, legacy image, or legacy
`image.env` until a separate retention review after the Quadlets have remained
stable.

## Rollback

Stop the application and Mongo generated units. Remove only the three Little
Tables Quadlet source files, restore the two wrapper units and old deployer from
the recorded rollback directory, restore `image.env`, and run
`systemctl daemon-reload`. Start Mongo first, then the app. The existing named
volume is used by both control-plane versions and must never be deleted. Repeat
the direct/public health, exact-image, listener, log, restart-counter, failed-unit,
and host-capacity checks. Restore the logical backup only if an independent
database-integrity check shows that the volume itself is unusable.
