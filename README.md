![GitHub License](https://img.shields.io/github/license/phyberapex/kuroshiro)
[![Build and Push Next Docker Image](https://github.com/PhyberApex/kuroshiro/actions/workflows/docker-next.yml/badge.svg)](https://github.com/PhyberApex/kuroshiro/actions/workflows/docker-next.yml)
[![GitHub Release](https://img.shields.io/github/v/release/phyberapex/kuroshiro)](https://github.com/PhyberApex/kuroshiro/releases)
[![codecov](https://codecov.io/gh/PhyberApex/kuroshiro/graph/badge.svg?token=3J6TECLYB6)](https://codecov.io/gh/PhyberApex/kuroshiro)
[![GitHub Repo stars](https://img.shields.io/github/stars/phyberapex/kuroshiro?style=social)](https://github.com/PhyberApex/kuroshiro/stargazers)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="graphics/logo-dark.svg" />
    <img src="graphics/logo-light.svg" alt="Kuroshiro" width="200" />
  </picture>
</p>

# KUROSHIRO: Unleash Your TRMNL!

**Kuroshiro** is an open-source BYOS (Bring Your Own Server) solution for the [TRMNL](https://usetrmnl.com/) ecosystem. Our goal is to give you more flexibility and control over your TRMNL experience, whether you're self-hosting for fun, learning, or customization. Kuroshiro bundles a [NestJS](https://nestjs.com/) API and a [Vue.js](https://vuejs.org/) UI into a single Docker image, ready to run alongside your own Postgres database.

---

## ⚠️ Alpha Notice

> **Heads up!** Kuroshiro is still in **alpha** and not feature complete. Things are moving fast, and breaking changes may happen. Updates might require you to wipe your data and start fresh. Until we reach version 1.0.0, backward compatibility is not guaranteed. Please keep this in mind if you decide to try it out!

---

## 🤖 AI Disclaimer

> **Heads up!** Kuroshiro is developed with substantial help from AI coding agents. Issues and pull requests may be triaged, commented on, or authored by an AI agent, with a human maintainer reviewing before anything is merged.

---

## 🌟 Why Kuroshiro?

Kuroshiro is for anyone who wants to experiment, self-host, and shape their own TRMNL experience:
- **Self-hosted**: Your data, your rules, your server.
- **All-in-one**: API (NestJS) + admin UI (Vue 3 + Reka UI) bundled together.
- **Plug & Play**: Just add Postgres and go!
- **Fun to use**: Modern, intuitive, and built for tinkerers and pros alike.

---

## ✨ Features at a Glance

- **Auto Provisioning**: Devices set up themselves—like magic!
- **Device Management**: Rename, reset, tweak refresh rates, and trigger one-shot Special Functions (identify, sleep, add Wi-Fi, rewind).
- **Multi-Size Device Support**: Every panel size and colour depth TRMNL sells, synced daily from the official model list, plus admin-created custom colour palettes.
- **Live Device Insights**: WiFi, battery, firmware version, Qwiic sensor readings (CO₂, humidity, pressure, temperature), and real-time previews.
- **Mirroring**: See what's on your official TRMNL server, right here.
- **Screens Galore**: Add screens via link or upload, cache them, or fetch fresh every time—then gate any of them to a day/time Schedule.
- **Plugins**: Poll external APIs (with multiple named Data Sources per plugin) or accept pushed Webhooks, render them with Liquid, or import a Recipe straight from trmnl.com.
- **Firmware Management**: Official releases sync automatically, or push a custom OTA build, with per-Device-Model compatibility checks so you can't flash the wrong binary.
- **Alerts**: A periodic sweep watches for low battery Devices, offline Devices, and failing Data Source fetches, and notifies you via an [Apprise](https://github.com/caronc/apprise-api) sidecar—supporting dozens of notification channels.
- **Device Simulator**: Poll as any Device without hardware—because why not?

---

## ⚖️ Kuroshiro vs. the rest of the TRMNL ecosystem

Kuroshiro isn't the only way to run a TRMNL: the device also works with the official [trmnl.com](https://trmnl.com/) cloud, and with [Terminus](https://github.com/usetrmnl/terminus)—the other open-source, self-hosted BYOS. Here's how they line up today:

| | **Kuroshiro** | [**Terminus**](https://github.com/usetrmnl/terminus) | **Official TRMNL Cloud** |
|---|---|---|---|
| Hosting | Self-hosted, one Docker image (NestJS + Vue) + your own Postgres | Self-hosted (Docker/K8s/Raspberry Pi), Ruby/Hanami + Postgres + Redis/Sidekiq | Managed SaaS, closed source |
| Cost | Free, MIT-licensed | Free, MIT-licensed | Free tier + paid "Developer Edition" for custom plugins; device sold separately |
| Accounts | Single admin, no login | Multi-user accounts with email verification | Cloud account required |
| Device models & palettes | Full official catalog synced daily, plus admin-created custom colour Palettes | Device models & palettes supported | Defines the catalog—sells the hardware |
| Plugins | `Poll` (multiple named Data Sources, each fetched or a literal value) & `Webhook` (3 merge strategies) | "Extensions"/Exchanges, single- or multi-source polling | 1,000+ native, community & private plugins |
| Recipe import | Imports any trmnl.com Recipe, including serverless-transform ones Terminus's importer rejects | Imports via its Extension Gallery | Native—it's the source catalog |
| Screen scheduling | Per-Screen day/time Schedule gates rotation eligibility | Playlist model: weekday/date windows, skip-if-stale TTL, device-grouped playlists | Playlist Scheduler, group scheduling by time of day |
| Mashups | 7 layouts | Supported | 8 layouts |
| Firmware | Official sync + custom OTA upload, hard-blocked unless the Firmware is compatible with the Device's model | Official sync + custom upload, no model-compatibility link | Manages its own hardware directly |
| Sensors | Device-attached Qwiic sensors (CO₂/humidity/pressure/temperature), exposed to Plugin templates | Device-attached *and* server-attached (Raspberry Pi) sensors | — |
| Sleep Mode | Per-Device night window that parks the Device until the window ends, with an optional dedicated sleep Screen | Supported | Supported |

The short version: Kuroshiro trades Terminus's multi-user accounts and device-grouped playlists for a simpler single-admin, single-container deployment, while going further than either self-hosted option on per-Device-Model firmware safety and mixed fetch/literal Data Sources within one Plugin. See [`docs/adr`](./docs/adr) for the design decisions (and prior-art comparisons) behind each of these.

---

## 🌐 Live Demo

Want to see Kuroshiro in action before diving in? We've got you covered! Check out our live demo at [kuroshiro-demo.phyberapex.de](https://kuroshiro-demo.phyberapex.de/) where you can:

- **Explore the interface** - Navigate through device management, screen creation, and all the core features
- **Try the Device Simulator** - Poll as a Device to see how screens render
- **Try screen creation** - ~~Upload images~~ (This is not supported in the demo), add external links, or craft custom HTML screens
- **See real-time updates** - Watch how the system handles device communication and screen management

> **Note:** The demo will reset once a day, so you can explore freely without worrying about breaking anything. It's the perfect playground to get a feel for Kuroshiro before setting up your own instance!

---

## 🛠️ Technology used

Kuroshiro is built on a modern, robust tech stack designed for performance, developer experience, and maintainability. Here's what powers the magic under the hood:

### General

[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=fff)](https://pnpm.io/)
![Postgres](https://img.shields.io/badge/Postgres-%23316192.svg?logo=postgresql&logoColor=white)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff)](https://www.docker.com/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=fff)](https://vitest.dev/)

**Why this foundation?** We chose **pnpm** for lightning-fast package management and efficient monorepo handling. **PostgreSQL** gives us rock-solid data reliability with advanced features for complex queries. **Docker** ensures consistent deployments across any environment, and **Vitest** provides blazing-fast testing with excellent TypeScript support.

### API

[![Nest](https://img.shields.io/badge/Nest.js-%23E0234E.svg?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?logo=typeorm&logoColor=fff)](https://typeorm.io/)

**The backend powerhouse:** **NestJS** brings enterprise-grade architecture with decorators, dependency injection, and built-in TypeScript support—perfect for building scalable APIs. **TypeORM** handles our database operations with elegant Active Record patterns and automatic migrations, making data management a breeze.

### UI

[![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?logo=vuedotjs&logoColor=fff)](https://vuejs.org/)
[![Reka UI](https://img.shields.io/badge/Reka_UI-10B981?logoColor=fff)](https://reka-ui.com/)
[![CodeMirror](https://img.shields.io/badge/CodeMirror-D30707?logo=codemirror&logoColor=fff)](https://codemirror.net/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)

**Frontend excellence:** **Vue 3** delivers reactive, component-based UI development with incredible performance and developer ergonomics. **Reka UI** supplies headless, accessible primitives that Kuroshiro styles with its own design tokens, and **CodeMirror** is the editor for Liquid templates, HTML, JSON and JavaScript. **Vite** powers our build process with instant hot module replacement and optimized production builds.

---

## 🗺️ Roadmap & Planned Features

We're constantly working to make Kuroshiro even better! Here's what's on our roadmap, organized by priority:

### 🔥 High Priority
- [x] **Device Logs Viewer** - View logs directly from your TRMNL devices for better debugging and monitoring
- [x] **Refresh Rate UI Controls** - Adjust device refresh rates directly from the web interface
- [x] **Screen Reordering** - Drag-and-drop screens into the order you want them to play
- [x] **Sleep Mode** - Per-Device night window that pauses rotation and lets the Device sleep through it instead of polling on its usual cadence

### 🎯 Medium Priority  
- [x] **Liquid Template Syntax** - Plugins render with Liquid, including Data Sources and Mashups; HTML Screens are still raw HTML
- [x] **Housekeeping** - Clean up unused images and stored files, and prune old Alerts and Device Logs; Firmware has a page of its own
- [x] **Recipes Support** - Import any TRMNL Recipe from trmnl.com straight into a Poll Plugin
- [x] **Screen Mashups** - Combine multiple plugin screens into custom layouts (7 layouts supported!)
- [x] **Screen Playlists** - Gate any Screen to a recurring day/time Schedule so rotation skips it outside that window

### 🔮 Future Enhancements
- [x] **System Logs Viewer** - Internal system logging and monitoring capabilities  
- [ ] **Smart Image Caching** - Intelligent caching algorithms to optimize storage and performance
- [ ] **Device Grouping** - Share one Schedule/rotation across multiple Devices
- [ ] **Server-Attached Sensors** - Sensor data from a self-hosted Raspberry Pi, independent of what a Device itself reports

> **Want to contribute?** Pick a feature from the roadmap and help us build it! Check out our [contribution guidelines](#-contribute--make-kuroshiro-even-better) below.

---

## Screenshots

These are pages of the admin UI with sample data, taken from its screenshot tests.

The Devices list
<p align="center">
  <img src="packages/ui/src/pages/devices/__screenshots__/DevicesListPage.shots.ts/devices-list-desktop-light-chromium-linux.png" />
</p>

A Device's Screens
<p align="center">
  <img src="packages/ui/src/pages/devices/__screenshots__/DeviceScreensPage.shots.ts/device-screens-desktop-light-chromium-linux.png" />
</p>

A Plugin
<p align="center">
  <img src="packages/ui/src/pages/plugins/__screenshots__/PluginPage.shots.ts/plugin-page-desktop-light-chromium-linux.png" />
</p>

---

## 🐳 Dockerized & Ready to Roll

Kuroshiro is built for Docker. Just bring your own Postgres database and you're set!

We build these tags automatically:

| Tag    | Content                                                                  |
|--------|--------------------------------------------------------------------------|
| next   | Always build from the latest code changes in `main`                      |
| latest | The newest released version                                              |
| x.x.x  | Specific version that has been built and can be found in GitHub releases |

For local hacking or deployment inspiration, check out [`docker-compose.yml`](./docker-compose.yml). It spins up everything you need—API, UI, and Postgres—so you can get started in seconds.

The container listens on `KUROSHIRO_PORT` (`3000` when unset). [`.env.example`](./.env.example) lists every `KUROSHIRO_*` variable Kuroshiro reads; at startup it logs a warning for any other `KUROSHIRO_*` variable it finds, naming the replacement of an outdated one (such as `KUROSHIRO_DB_USER` for `KUROSHIRO_POSTGRES_USER`), since an ignored variable otherwise falls back to its default without a word. The image's entrypoint logs it before running migrations, so it shows even when the database settings are the ones that are wrong.

### Persisting data

Besides the Postgres database, Kuroshiro keeps files the database points at on the container's filesystem. Mount both paths, or recreating the container loses them:

| Path in the container | What lives there |
|---|---|
| `/app/public/screens/devices` | Every Device's Screen images: uploaded and fetched images, their originals, rendered Plugin and Mashup Screens, the mirrored image of a mirrored Device |
| `/app/public/firmware` | Firmware binaries, both uploaded custom builds and the synced official one. The daily sync does not download a version it has already recorded again, so a lost binary stays lost until the next official release |

Everything else under `/app/public` ships with the image or is a cache Kuroshiro redraws on demand (Fallback Screens, palette colour maps). Uploads are held in memory, so nothing needs mounting for them; an `/app/uploads` folder only exists on instances that ran an older version, and Housekeeping offers to clear it.

---

## 📦 Packages

- [`packages/api`](./packages/api) — The NestJS backend
- [`packages/ui`](./packages/ui) — The Vue 3 + Reka UI admin UI the image serves
- [`packages/shared`](./packages/shared) — The admin API's request and response types, and code that is identical in the API and UI

---

## 🚀 Quick Start (Dev Mode)

1. **Clone** this repo
2. **Install** dependencies: `pnpm install`
3. **Create** a `.env` file (copy `.env.example` and replace `{YOUR_IP}`)
4. **Run Kuroshiro**:
   - With Docker: `docker-compose up` (full local stack)
   - Or, start Postgres manually and run: `pnpm run dev`

`pnpm run dev` starts the API on `KUROSHIRO_PORT` (`3000` when unset) and, once that port answers, the admin UI's Vite dev server on [http://localhost:5173](http://localhost:5173), which proxies `/api` and `/screens` to the same port. The API runs pending migrations every time it starts, in dev as in the image.

To start postgres in docker you can run
```
export $(cat .env | xargs) && \
docker run \
--env-file .env \
-e POSTGRES_USER=${KUROSHIRO_DB_USER} \
-e POSTGRES_PASSWORD=${KUROSHIRO_DB_PASSWORD} \
-e POSTGRES_DB=${KUROSHIRO_DB_DB} \
-p 5432:5432 \
postgres:18-alpine
```

---

## 🖥️ How Screens Work

### Mirroring from Official Server
If you enable mirroring and provide the MAC and apikey, Kuroshiro fetches the current screen (`api/current_screen`) from the official server—mirroring always takes priority. If the given MAC to mirror matches with the one of the device itself we are entering "proxy-mode" where we get the current display from the actual endpoint (`display`) and forward all the headers back and forth.

### Screens Managed by Kuroshiro
Images are generated for the device's **Device Model** (panel size, colour depth, rotation), which Kuroshiro resolves from what the firmware reports (`Model` header, then reported width×height) and which you can override in the Device's Settings. The model list is synced from the official TRMNL server (`/api/models`) on startup and daily, with a bundled snapshot as offline fallback — see *Instance → Device Models and Palettes*. Devices without a resolved model render as a TRMNL OG (800×480).

#### Uploaded Screens
Upload a file and Kuroshiro uses ImageMagick to fit it onto the device's panel (letterboxed, rotated if the model needs it) and dither it to the device's palette — 1-bit, 4 or 16 grays, or the colours of a colour panel. The original is kept, so switching a device's model or palette re-generates the image from the source.

#### External Link Screens
Provide a URL and Kuroshiro fetches, converts, and serves it. Cache it for speed, or fetch fresh every time—your choice!

#### HTML Screens
Provide HTML you can make use of the [TRMNL framework](https://usetrmnl.com/framework). The HTML editor previews it for the Device as you type.

#### Mashup Screens
Combine multiple plugin outputs into a single screen using one of 7 available layouts:
- **1L×1R** - One left panel, one right panel (50/50 split)
- **1T×1B** - One top panel, one bottom panel (50/50 split)
- **1L×2R** - One large left panel, two stacked right panels
- **2L×1R** - Two stacked left panels, one large right panel
- **2T×1B** - Two side-by-side top panels, one bottom panel
- **1T×2B** - One top panel, two side-by-side bottom panels
- **2×2** - Four equal panels in a 2×2 grid

Mashups use the official TRMNL CSS framework for consistent styling. If a plugin fails to render, an error placeholder is shown instead—allowing the rest of the mashup to display successfully (partial rendering).

#### Screen Schedules
Attach a Schedule to any Screen (including a Mashup) to gate when it's eligible to become the active one: a weekday selection, a daily time-of-day window (which can cross midnight), an optional active date range, and its own enabled/disabled toggle. Rotation simply skips Screens that aren't currently eligible—no gaps, no reordering. A Screen with no Schedule is always eligible.

---

## 🔌 Plugins

Plugins pull outside data into a [Liquid](https://shopify.github.io/liquid/)-rendered template, in one of two ways:

- **Poll**: Kuroshiro fetches on a shared `refreshInterval`. A Poll Plugin can hold multiple named **Data Sources**—each its own HTTP request (method, URL, headers, body, optional JS transform) or a literal, hand-entered JSON value—fetched in parallel and exposed to the template under its own name. If one source fails, the rest still render.
- **Webhook**: an external system `POST`s JSON to the Plugin's own token-secured URL, and Kuroshiro renders on arrival. Choose how each POST combines with what's already stored—replace outright (`standard`), recursively merge objects (`deep_merge`), or append to an array up to a configurable limit (`stream`).

Don't want to build a Plugin from scratch? Paste a Recipe's id or [trmnl.com/recipes](https://trmnl.com/recipes) URL and Kuroshiro imports it as a ready-to-use Poll Plugin. For OG devices with a Qwiic sensor add-on attached, CO₂, humidity, pressure and temperature readings are parsed straight off the device's poll and exposed to every template as `sensors.*`—no extra setup required.

---

## 🔧 Firmware & Device Models

Kuroshiro tracks the official TRMNL model list and the latest official firmware automatically (synced daily, with a bundled snapshot as offline fallback), or you can upload a custom `.bin` build of your own. Every Firmware carries a SHA-256 checksum and an optional set of compatible Device Models, so assigning one to a Device is blocked outright if it doesn't match that Device's hardware—no accidental bricking. Pushes are always explicit: pick a Firmware in the Device's Settings, and it's served on that Device's next poll. Custom colour Palettes (admin-created, within one of TRMNL's fixed colour families) sit alongside the official ones synced from TRMNL, so you're not limited to whatever's officially curated for a given Device Model. To refresh the bundled fallback snapshot from the live TRMNL API, run `pnpm --filter kuroshiro-api snapshot:device-models`.

---

## 🔔 Alerts

A background sweep runs every 5 minutes (and once on startup) and checks three conditions: **low battery** and **offline** for every Device (offline is skipped entirely while the Device is asleep under Sleep Mode, and for a grace period after it wakes), and **Data Source fetch failing** for every `fetch`-mode Data Source of a Poll Plugin — opens once its consecutive scheduled-render failures (its Fetch Failure Streak) reach a threshold, resolves on the next successful scheduled fetch. Each condition opens an Alert the first time it's seen and resolves it the first time it clears; low battery has a 5-point hysteresis so it won't flap right at the threshold, and the fetch-failing Rule stays active until the streak drops back to zero. See [ADR-0025](docs/adr/0025-fetch-failure-alerts-scoped-to-data-source-with-streak-on-entity.md) for why the Alert is scoped to the Data Source rather than its Plugin.

Delivery goes through the [`apprise-api`](https://github.com/caronc/apprise-api) sidecar rather than bundling Apprise into the Kuroshiro image — see [ADR-0022](docs/adr/0022-alerts-decided-by-sweep-delivered-via-apprise-sidecar.md). Alerts are persisted (and retried) whether or not delivery is configured; only the notification step is skipped without an Apprise URL. Configure it with these environment variables:

| Variable | Default | Description |
|---|---|---|
| `KUROSHIRO_APPRISE_URL` | *(unset)* | Base URL of an `apprise-api` instance. Leave unset to disable notifications entirely — Alerts still open/resolve, they just aren't delivered anywhere. |
| `KUROSHIRO_APPRISE_KEY` | `kuroshiro` | The Apprise config key notifications are POSTed to (`{url}/notify/{key}`). |
| `KUROSHIRO_ALERT_LOW_BATTERY_PERCENT` | `20` | Derived battery percentage below which a Device is considered low. |
| `KUROSHIRO_ALERT_OFFLINE_MULTIPLIER` | `3` | A Device is offline once it hasn't polled for longer than its `refreshRate` times this multiplier. |
| `KUROSHIRO_ALERT_FETCH_FAILURES` | `3` | Consecutive scheduled-render failures a `fetch`-mode Data Source needs before its Alert opens. |
| `KUROSHIRO_ALERT_RETENTION_DAYS` | `90` | Age (in days) after which a resolved Alert is pruned by the daily Retention job. `0` disables Alert pruning. |
| `KUROSHIRO_DEVICE_LOG_RETENTION_DAYS` | `30` | Age (in days) after which a Device Log entry is pruned by the daily Retention job. `0` disables Device Log pruning. |

The three threshold variables and the two Retention variables above are only fallbacks: each is an Instance Setting an admin can override (`PATCH /api/settings`, or the admin UI's Instance Settings page), and an override wins over the environment variable until it is cleared. A Retention age of `0` disables pruning for that age whether it comes from an override or from the environment. See [ADR-0027](docs/adr/0027-instance-settings-typed-single-row-persisted-over-env-in-the-archive.md).

To run the sidecar alongside Kuroshiro, uncomment the `apprise-api` service in [`docker-compose.yml`](./docker-compose.yml) and point `KUROSHIRO_APPRISE_URL` at it (e.g. `http://apprise-api:8000`), then configure your notification channels in its own persisted config under the `kuroshiro` key (or whatever `KUROSHIRO_APPRISE_KEY` is set to).

The Alerts page shows every active Alert plus anything resolved in the last 7 days, and Instance Settings has a **Send a Test Notification** button that exercises the real delivery path (a synthetic success Notification, not a real Alert) so you can confirm Apprise is wired up correctly without waiting for a real condition to fire.

A daily Retention job (same 4am schedule as the Device Model and Firmware syncs) prunes resolved Alerts and Device Log entries older than their Retention age (the Instance Setting, else `KUROSHIRO_ALERT_RETENTION_DAYS`/`KUROSHIRO_DEVICE_LOG_RETENTION_DAYS`, else the default); active Alerts are never touched regardless of age. Every run, scheduled, manual or dry, reads the ages afresh, so a saved override applies without a restart, and saving one never triggers a run. The Housekeeping page shows the effective ages and the last run's time and counts (lost on restart — it isn't persisted), and lets you trigger a run on demand, counting what is old enough before you confirm.

---

## 📈 Prometheus Metrics

`GET /metrics` answers in the Prometheus text exposition format, read from the database at scrape time — Kuroshiro keeps no history of its own, so point an external Prometheus at it for charts and long-term retention (see [ADR-0026](docs/adr/0026-metrics-are-scrape-time-reads-with-no-history-of-their-own.md)).

| Metric | Type | Labels | Description |
|---|---|---|---|
| `kuroshiro_device_battery_volts` | gauge | `device`, `friendly_id` | Last reported battery voltage. Omitted for a Device with no or non-numeric reading. |
| `kuroshiro_device_rssi_dbm` | gauge | `device`, `friendly_id` | Last reported Wi-Fi signal strength. Omitted for a Device with no or non-numeric reading. |
| `kuroshiro_device_last_seen_timestamp_seconds` | gauge | `device`, `friendly_id` | The Device's `lastSeen` as a Unix timestamp (compute `time() - x` for staleness). No sample for a Device that never polled. |
| `kuroshiro_alerts_active` | gauge | `kind` | Count of currently active Alerts per `AlertKind` — every known kind is emitted, 0 included, so a series never vanishes. |
| `kuroshiro_device_sensor_carbon_dioxide_ppm` | gauge | `device`, `friendly_id` | Device's last reported carbon dioxide Sensor reading, in ppm. Omitted for a Device with no such reading, or one reported in a different unit. |
| `kuroshiro_device_sensor_humidity_percent` | gauge | `device`, `friendly_id` | Device's last reported humidity Sensor reading, in %. Omitted for a Device with no such reading, or one reported in a different unit. |
| `kuroshiro_device_sensor_pressure_hpa` | gauge | `device`, `friendly_id` | Device's last reported pressure Sensor reading, in hPa. Omitted for a Device with no such reading, or one reported in a different unit. |
| `kuroshiro_device_sensor_temperature_celsius` | gauge | `device`, `friendly_id` | Device's last reported temperature Sensor reading, in °C. Omitted for a Device with no such reading, or one reported in a different unit. |
| `kuroshiro_data_source_fetch_failure_streak` | gauge | `plugin`, `plugin_id`, `data_source` | Consecutive failed scheduled fetches for a `fetch`-mode Data Source (0 included). `literal`-mode Data Sources emit no sample. |

`device` is the Device's `name` and `friendly_id` its `friendlyId`; the MAC address is never used as a label. Each Sensor gauge is named after the unit official firmware reports for that kind (fixed in code, not device-configurable) — a reading sent in any other unit is omitted rather than converted. `plugin`/`data_source` are the Plugin's and Data Source's `name`; `plugin_id` disambiguates two Plugins that happen to share a name. Like the Device-facing routes (`/display`, `/current_screen`), `/metrics` sits outside the `/api` prefix and has no authentication of its own — if you want it private, keep it off your reverse proxy.

---

## 🤝 Contribute & Make Kuroshiro Even Better!

We love contributions! Jump in:
- Open issues or join discussions for bugs, ideas, or questions
- Fork, branch, and submit pull requests (PRs)—all PRs welcome!
- Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) and code style
- Run all tests before submitting a PR
- `pnpm fallow:ci` runs in CI and fails on new dead code, duplication, or complexity hotspots; see [docs/agents/fallow.md](docs/agents/fallow.md) for how the baselines work
- **We use [release-please](https://github.com/googleapis/release-please)!** Use [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages to enable automatic versioning and changelogs.

### Contributors

<a href="https://github.com/phyberapex/kuroshiro/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=phyberapex/kuroshiro" />
</a>
