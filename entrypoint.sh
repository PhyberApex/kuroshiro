#!/bin/sh
set -e

echo "🎀 starting kuroshiro..."

APP_USER=node
# Everything Kuroshiro writes lives under public/; uploads/ is only left over from older versions.
DATA_PATHS="/app/public /app/uploads"

if [ "$(id -u)" = "0" ]; then
  # Started as root: hand the data paths, and whatever volumes are mounted on or linked into
  # them (-L), to the app user, then run as that user. Only what isn't its already is touched,
  # so a restart over an already-handed-over volume costs a scan, not a rewrite.
  for data_path in $DATA_PATHS; do
    [ -e "$data_path" ] || continue
    find -L "$data_path" ! -user "$APP_USER" -exec chown -h "$APP_USER:$APP_USER" {} +
  done
  # migrations run inside main.js, before any module touches the database (migrationsRun: true)
  exec su-exec "$APP_USER" node /app/dist/main.js
fi

# Started unprivileged: a volume written by an image that ran as root is still root's, and
# Kuroshiro would fail every render, upload and sync into it. Refuse to start and say why.
# (BusyBox find has no -writable, hence the test -w loop.)
unwritable=$(find -L /app/public -type d 2>/dev/null | while read -r dir; do
  [ -w "$dir" ] || { echo "$dir"; break; }
done)
if [ -n "$unwritable" ]; then
  echo "kuroshiro runs as $(id -un 2>/dev/null || id -u) (uid $(id -u)) and cannot write to $unwritable."
  echo "A volume created by an older, root-running Kuroshiro image is owned by root. Either start"
  echo "the container once with '--user 0' (compose: 'user: \"0\"'), and Kuroshiro hands its files to"
  echo "the 'node' user and drops to it, or change the owner on the host, for example:"
  echo "  docker run --rm --user 0 -v <your volume>:/data alpine chown -R 1000:1000 /data"
  exit 1
fi

# migrations run inside main.js, before any module touches the database (migrationsRun: true)
exec node /app/dist/main.js
