#!/usr/bin/env bash
set -euo pipefail

readonly repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly runtime=${CONTAINER_RUNTIME:-docker}
readonly generator_image='quay.io/podman/stable:v5.8.2@sha256:663e0dbf407987b7db3f20d3588c283a8228db17b282d2029a482d4d47e36964'

command -v "$runtime" >/dev/null 2>&1 || {
  echo "Quadlet validation requires the $runtime container runtime" >&2
  exit 1
}

"$runtime" run --rm --entrypoint sh \
  --volume "$repository_root:/repo:ro" \
  "$generator_image" -lc '
    set -eu
    mkdir -p /tmp/quadlets
    sed "s|@LITTLE_TABLES_IMAGE@|ghcr.io/zax-code/little-tables:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|" \
      /repo/deploy/little-tables.container.in >/tmp/quadlets/little-tables.container
    cp /repo/deploy/little-tables-mongo.container \
      /repo/deploy/little-tables-mongo-data.volume \
      /tmp/quadlets/

    QUADLET_UNIT_DIRS=/tmp/quadlets \
      /usr/lib/systemd/system-generators/podman-system-generator --dryrun \
      >/tmp/generated 2>/tmp/generator-errors
    ! grep -Eiq "error|failed|unknown key" /tmp/generator-errors

    grep -Fq "SourcePath=/tmp/quadlets/little-tables.container" /tmp/generated
    grep -Fq "Requires=little-tables-mongo.service" /tmp/generated
    grep -Fq -- "--network host" /tmp/generated
    grep -Fq -- "--env-file /etc/little-tables/little-tables.env" /tmp/generated
    grep -Fq "ghcr.io/zax-code/little-tables:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" /tmp/generated
    grep -Fq "SourcePath=/tmp/quadlets/little-tables-mongo.container" /tmp/generated
    grep -Fq -- "--publish 127.0.0.1:27018:27017" /tmp/generated
    grep -Fq -- "-v little-tables-mongo-data:/data/db" /tmp/generated

    # Exercise a failed release and prove that the deployer restores the
    # previous literal image in both the Quadlet and the running-image model.
    install -d /etc/little-tables /etc/containers/systemd \
      /usr/local/share/little-tables /usr/local/libexec /usr/local/sbin /tmp/fakebin
    touch /etc/little-tables/ghcr-auth.json
    cp /repo/deploy/little-tables.container.in \
      /usr/local/share/little-tables/little-tables.container.in
    cp /repo/deploy/render-little-tables-quadlet.sh \
      /usr/local/libexec/render-little-tables-quadlet
    cp /repo/deploy/deploy-little-tables.sh /usr/local/sbin/deploy-little-tables
    chmod 0755 /usr/local/libexec/render-little-tables-quadlet \
      /usr/local/sbin/deploy-little-tables

    previous=ghcr.io/zax-code/little-tables:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    candidate=ghcr.io/zax-code/little-tables:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    /usr/local/libexec/render-little-tables-quadlet "$previous" \
      /usr/local/share/little-tables/little-tables.container.in \
      /etc/containers/systemd/little-tables.container
    printf "%s\n" "$previous" >/tmp/running-image

    cat >/tmp/fakebin/podman <<"EOF"
#!/bin/sh
if [ "$1" = pull ]; then
  exit 0
fi
if [ "$1" = inspect ]; then
  cat /tmp/running-image
  exit 0
fi
if [ "$1" = image ] && [ "$2" = exists ]; then
  exit 0
fi
exit 1
EOF
    cat >/tmp/fakebin/systemctl <<"EOF"
#!/bin/sh
if [ "$1" = daemon-reload ]; then
  echo daemon-reload >>/tmp/actions
  exit 0
fi
if [ "$1" = show ]; then
  echo /etc/containers/systemd/little-tables.container
  exit 0
fi
if [ "$1" = restart ] && [ "$2" = little-tables.service ]; then
  image=$(sed -n "s/^Image=//p" /etc/containers/systemd/little-tables.container)
  printf "%s\n" "$image" >/tmp/running-image
  echo "restart $image" >>/tmp/actions
  exit 0
fi
exit 1
EOF
    cat >/tmp/fakebin/curl <<"EOF"
#!/bin/sh
test "$(cat /tmp/running-image)" = \
  ghcr.io/zax-code/little-tables:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
EOF
    cat >/tmp/fakebin/sleep <<"EOF"
#!/bin/sh
exit 0
EOF
    cat >/tmp/fakebin/journalctl <<"EOF"
#!/bin/sh
exit 0
EOF
    chmod 0755 /tmp/fakebin/*

    set +e
    PATH=/tmp/fakebin:/usr/bin:/bin /usr/local/sbin/deploy-little-tables "$candidate" \
      >/tmp/deploy-output 2>&1
    deploy_status=$?
    set -e
    test "$deploy_status" -eq 4
    grep -Fq "Rollback to $previous succeeded" /tmp/deploy-output
    grep -Fxq "Image=$previous" /etc/containers/systemd/little-tables.container
    test "$(cat /tmp/running-image)" = "$previous"
    grep -Fxq "restart $candidate" /tmp/actions
    grep -Fxq "restart $previous" /tmp/actions

    # A malformed template must fail before replacing a valid active Quadlet.
    sed "/@LITTLE_TABLES_IMAGE@/d" \
      /usr/local/share/little-tables/little-tables.container.in >/tmp/broken.container.in
    cp /etc/containers/systemd/little-tables.container /tmp/before.container
    set +e
    /usr/local/libexec/render-little-tables-quadlet "$candidate" \
      /tmp/broken.container.in /etc/containers/systemd/little-tables.container \
      >/dev/null 2>&1
    render_status=$?
    set -e
    test "$render_status" -eq 2
    cmp -s /tmp/before.container /etc/containers/systemd/little-tables.container
  '
