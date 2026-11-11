#!/bin/sh
set -e

APP_USER=node
# Everything Kuroshiro writes lives under public/; uploads/ is only left over from older versions.
# The two volume paths come first: an image built on this one may have linked them elsewhere
# (the Home Assistant add-on links them into /data), and the walk of public/ hands those links
# themselves to the app user.
DATA_PATHS="/app/public/screens/devices /app/public/firmware /app/public /app/uploads"

# Hands one data path to the app user. The walk is physical and chown -h changes a link rather
# than what it points at, so a link the app user planted cannot make root chown anything outside.
# A data path that is itself a link is followed only when root made it.
hand_over() {
  data_path=$1
  if [ -L "$data_path" ]; then
    [ "$(stat -c %u "$data_path")" = "0" ] || return 0
    data_path=$(readlink -f "$data_path")
  fi
  [ -d "$data_path" ] || return 0
  find "$data_path" ! -user "$APP_USER" -exec chown -h "$APP_USER:$APP_USER" {} + \
    || echo "kuroshiro could not hand everything under $data_path to $APP_USER; writing there may fail."
}

if [ "$(id -u)" = "0" ]; then
  # Started as root: hand the data paths to the app user, then run as that user. Only what isn't
  # its already is touched, so a restart over handed-over volumes costs a scan, not a rewrite.
  for data_path in $DATA_PATHS; do
    hand_over "$data_path"
  done
  exec su-exec "$APP_USER" "$0" "$@"
fi

echo "🎀 starting kuroshiro..."

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
  echo "the 'node' user and drops to it, or change the owner yourself, for example:"
  echo "  docker run --rm -v <your volume>:/data alpine chown -R 1000:1000 /data"
  exit 1
fi

# migrations run inside main.js, before any module touches the database (migrationsRun: true)
exec node /app/dist/main.js
