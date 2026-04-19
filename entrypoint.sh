#!/bin/sh
set -e

echo "🎀 starting kuroshiro..."

# run migrations
echo "✨ running migrations..."
npx typeorm migration:run -d /app/dist/src/config/typeorm.config.js

echo "🌸 starting app..."
# start the app
exec node /app/dist/main.js
