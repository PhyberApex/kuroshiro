# Get started

Kuroshiro ships as a single Docker image that bundles the NestJS API and the Vue admin UI. Bring your own Postgres and you are set.

::: warning Alpha
Kuroshiro is still in alpha. Breaking changes may happen, and until 1.0.0 an update might require you to wipe your data and start fresh.
:::

## Images

The image is published to the GitHub Container Registry as `ghcr.io/phyberapex/kuroshiro`.

| Tag | Content |
|---|---|
| `next` | Built from the latest changes on `main` |
| `latest` | The newest release |
| `x.x.x` | A specific [release](https://github.com/PhyberApex/kuroshiro/releases) |

## docker compose

The repository's [`docker-compose.yml`](https://github.com/PhyberApex/kuroshiro/blob/main/docker-compose.yml) spins up Kuroshiro and Postgres together. A minimal version using the published image:

```yaml
services:
  db:
    image: postgres:18-alpine
    restart: always
    environment:
      POSTGRES_USER: ${KUROSHIRO_DB_USER}
      POSTGRES_PASSWORD: ${KUROSHIRO_DB_PASSWORD}
      POSTGRES_DB: ${KUROSHIRO_DB_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
  app:
    image: ghcr.io/phyberapex/kuroshiro:latest
    restart: always
    depends_on:
      - db
    ports:
      - '80:${KUROSHIRO_PORT}'
    environment:
      KUROSHIRO_PORT: ${KUROSHIRO_PORT}
      KUROSHIRO_API_URL: ${KUROSHIRO_API_URL}
      KUROSHIRO_DB_HOST: db
      KUROSHIRO_DB_PORT: 5432
      KUROSHIRO_DB_USER: ${KUROSHIRO_DB_USER}
      KUROSHIRO_DB_PASSWORD: ${KUROSHIRO_DB_PASSWORD}
      KUROSHIRO_DB_DB: ${KUROSHIRO_DB_DB}
    volumes:
      - kuroshiro_data:/app/public/screens/devices
      - kuroshiro_firmware:/app/public/firmware
volumes:
  postgres_data:
  kuroshiro_data:
  kuroshiro_firmware:
```

With a `.env` next to it, based on [`.env.example`](https://github.com/PhyberApex/kuroshiro/blob/main/.env.example):

```sh
KUROSHIRO_DB_USER=kuroshiro
KUROSHIRO_DB_PASSWORD=change-me
KUROSHIRO_DB_DB=kuroshiro
KUROSHIRO_PORT=3000
KUROSHIRO_API_URL=http://192.168.1.10
```

`KUROSHIRO_API_URL` must be this machine's address on your network, since that is the URL your Devices call. The container listens on `KUROSHIRO_PORT` (`3000` when unset), runs pending migrations on every start, and logs a warning for any `KUROSHIRO_*` variable it does not know.

## Persisting data

Besides Postgres, Kuroshiro keeps files on the container's filesystem. Mount both paths, or recreating the container loses them:

| Path in the container | What lives there |
|---|---|
| `/app/public/screens/devices` | Every Device's Screen images, their originals, and rendered Plugin and Mashup Screens |
| `/app/public/firmware` | Firmware binaries, uploaded and synced |

## Connect your first Device

1. Open the admin UI and go to **Connect a Device**. It shows the server URL to use.
2. Put the Device into Wi-Fi setup. A new Device starts there; otherwise hold its button for five seconds.
3. Join its `TRMNL` Wi-Fi network from your phone or laptop. The setup page opens by itself.
4. Enter your Wi-Fi and the server URL in the custom server field. The Device restarts, calls in, and shows up right away.

## Optional: Alert notifications

To have [Alerts](/tour/alerts) delivered, run an [apprise-api](https://github.com/caronc/apprise-api) sidecar (it is commented out in the repository's `docker-compose.yml`) and set `KUROSHIRO_APPRISE_URL`, for example to `http://apprise-api:8000`.

## Hacking on Kuroshiro

1. Clone the [repository](https://github.com/PhyberApex/kuroshiro) and run `pnpm install`.
2. Copy `.env.example` to `.env` and replace `{YOUR_IP}`.
3. Run `docker-compose up` for the full local stack, or start Postgres yourself and run `pnpm run dev`.

`pnpm run dev` starts the API on `KUROSHIRO_PORT` and the admin UI's Vite dev server on `http://localhost:5173`.
