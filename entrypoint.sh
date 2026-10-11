#!/bin/sh
set -e

echo "🎀 starting kuroshiro..."

# migrations run inside main.js, before any module touches the database (migrationsRun: true)
exec node /app/dist/main.js
