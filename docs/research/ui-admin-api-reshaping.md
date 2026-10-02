# Admin API reshaping for the new screens

Research for [#1096](https://github.com/PhyberApex/kuroshiro/issues/1096), part of the map [#1074](https://github.com/PhyberApex/kuroshiro/issues/1074).

- **Question:** Which admin API endpoints do the specced screens need added, changed or removed, and what is each one's new shape? Plus: where the admin API's response types live and how `packages/ui-next` imports them, and the open calls the specs left to this ticket.
- **Snapshot:** `origin/main` at `85868a1` (2026-10-02). The four specs read from the branch `docs/1095-ui-spec-template-editor` (`docs/ui/devices.md`, `plugins.md`, `instance.md`, `template-editor.md`, `README.md`). Issues read the same day.
- **Sources (all primary):** the controllers, DTOs, entities, services and migrations in `packages/api/src`; `packages/shared/src`; the old UI's API calls in `packages/ui/src` (only to say what breaks); `CONTEXT.md` and `docs/adr/`; issues #1096 (with its five comments), #1069, #1070, #1071, #1062, #1064, #1101, #1074.
- **Not run.** Nothing here was run against a database or a Device. Every "today" statement is read from code and cites `path:line`; every shape, name and rule is a recommendation unless it says otherwise. Section 6 lists what was inferred.

Paths are relative to the repo root. `api/` means `packages/api/src/`, `shared/` means `packages/shared/src/`, `ui/` means `packages/ui/src/`. A spec request is cited as `devices.md add 4` (the spec's "What this asks of the admin API" list, "To add", item 4), `plugins.md change 12`, `instance.md remove`, and so on.

## Summary

PLACEHOLDER-SUMMARY

## How to read the endpoint list

Each endpoint has an id (`D3`, `S2`, `P7`, …) that section 5 refers to, its verb and path, a verdict, what exists today, the spec requests it serves, the shapes as TypeScript sketches and the rules that are part of its contract. Verdicts:

| Verdict | Meaning |
|---|---|
| **add** | No endpoint does this today. |
| **change** | The endpoint exists; its path, request, response or behaviour changes. A moved path is a change, not a remove plus an add. |
| **remove** | The endpoint goes. |
| **keep** | Listed because a screen calls it; nothing changes beyond the cross-cutting conventions of section 2 (error envelope, shared response type). |

The type sketches follow section 2's conventions: every time is an ISO 8601 string, every absent value is `null` (never a missing key), derived fields sit beside stored ones without prefixes, and image addresses are root-relative paths the UI prefixes with its base path. The named types (`DeviceSummary`, `ScreenRead`, `ApiError`, …) are the ones section 3 puts in `packages/shared`.

The Device-facing endpoints are fixed by the map and are not in the list except where a change is internal bookkeeping that leaves their responses byte-for-byte as they are: `GET /api/setup`, `GET /api/display`, `GET /api/current_screen`, `POST /api/log`, `GET`/`POST /api/webhook/:token` (called by Webhook senders) and `GET /metrics`.

## 1. The consolidated endpoint list

### 1.1 Devices

Two facts shape every Device read and are not endpoints of their own:

- **What `/display` last served is not stored.** The poll answers with a Screen's image, a Fallback Screen or the mirrored image (`api/devices/display.service.ts:158-204`, `:211-259`, `:305-321`), but nothing records which, why, or when. The only trace is `isActive` on a Screen and `lastSeen` on the Device. The spec's plate needs the kind, the Fallback Screen's reason ("a failed render", "a failed mirror fetch") and the time (`devices.md add 3`), and the error Fallback Screen is served from four places with no record of which (`display.service.ts:223`, `:491`, `:529`, `:542`, `:563`). **Recommendation:** `/display` writes a small "last served" record on the Device in the save it already makes (`display.service.ts:147-148`): `lastServedAt`, `lastServedKind` (`screen | fallback | mirror`), `lastServedScreenId`, `lastServedFallback` (`noScreen | error | sleep`), `lastServedReason` (`noScreens | noneEligible | renderFailed | mirrorFailed | asleep`) and `lastServedRefreshRate`. The response the Device gets does not change. The Device reads below derive the Current Screen from it, never from `/current_screen`, which can fetch from TRMNL as a side effect (`display.service.ts:385-395`).
- **`lastSeen` cannot say "never polled".** The column is `NOT NULL` (`api/devices/devices.entity.ts:92-93`) and its database default is a fixed literal, `'2026-04-18T22:36:39.653Z'` (`api/migrations/1776551799197-AddPluginSystem.ts:27`), so a Device registered by hand or through `/api/setup` (`api/devices/setup.service.ts:737-740`) carries that date until its first `/display`. **Recommendation:** a migration makes it nullable with no default and sets it to `NULL` where it equals that literal; `/display` keeps writing it (`display.service.ts:147`). The offline Alert Rule skips a Device with `lastSeen = NULL` (`api/alerts/rules/offline.rule.ts:426-434` reads it unconditionally today).

```ts
// shared/api/devices.ts
type SpecialFunction = 'identify' | 'sleep' | 'add_wifi' | 'restart_playlist' | 'rewind' | 'send_to_me'
type FallbackKind = 'welcome' | 'noScreen' | 'error' | 'sleep'
type FallbackReason = 'neverPolled' | 'noScreens' | 'noneEligible' | 'renderFailed' | 'mirrorFailed' | 'asleep'

type CurrentScreen =
  | { kind: 'screen', screenId: string, name: string, imagePath: string, renderedAt: string | null,
      servedAt: string, paused: boolean /* Sleep Mode keeping the image */, holding: boolean /* hold Render Signal */ }
  | { kind: 'fallback', fallback: FallbackKind, reason: FallbackReason,
      screenId: string | null /* the Screen that failed, for renderFailed */, imagePath: string, servedAt: string | null }
  | { kind: 'mirror', proxied: boolean, mirrorMac: string, imagePath: string, fetchedAt: string }

interface SleepState {
  enabled: boolean
  start: string | null        // 'HH:MM', server timezone
  end: string | null
  whileAsleep: 'fallback' | 'keep'   // sleepScreenEnabled
  inWindow: boolean           // false on a mirrored Device
  endsAt: string | null       // when inWindow
}

interface DeviceSummary {
  id: string
  name: string
  friendlyId: string
  firmwareVersion: string | null
  deviceModel: { name: string, label: string, width: number, height: number, deprecated: boolean } | null
  lastSeenAt: string | null
  nextPollAt: string | null   // lastServedAt + lastServedRefreshRate; null before the first poll
  batteryPercent: number | null   // batteryPercentFromVoltage (shared/battery.ts:6)
  rssi: number | null
  isMirrored: boolean
  isProxied: boolean          // mirrorEnabled && mirrorMac === mac, the rule of display.service.ts:214
  sleep: SleepState
  currentScreen: CurrentScreen
}

interface DeviceDetail extends DeviceSummary {
  mac: string
  apikey: string
  refreshRate: number
  reported: { batteryVoltage: string | null, rssi: string | null, firmwareVersion: string | null,
              model: string | null, width: number | null, height: number | null }
  palette: { id: string, name: string, kind: 'official' | 'custom' } | null
  mirror: { enabled: boolean, mac: string | null, apikeySet: boolean }
  targetFirmware: { id: string, version: string, kind: 'official-synced' | 'custom', label: string | null, deprecated: boolean } | null
  pending: { specialFunction: SpecialFunction | null, deviceReset: boolean, firmwarePush: boolean }
  sleepImagePath: string | null   // #1064
  sensors: SensorReading[]        // shared/sensor.ts:4
  screenCount: number
}
```

Derivation rules that are part of the contract:

- `currentScreen`: `lastSeenAt === null` gives `{ kind: 'fallback', fallback: 'welcome', reason: 'neverPolled' }` (welcome is only ever served by setup, `setup.service.ts:728`). Otherwise it is the last-served record. The image path is the file that poll pointed the Device to, root-relative.
- `nextPollAt` uses the refresh rate **served**, not the configured one. While asleep the served value is the seconds until the window ends (`display.service.ts:306`), and on a Proxied Device it is TRMNL's (`display.service.ts:233`), which Kuroshiro does not otherwise know. This departs from `devices.md`'s "last seen time plus its refresh rate" only where that rule is wrong.
- `isProxied` and `isMirrored` are derived on every read and never stored, as `CONTEXT.md` defines a Proxied Device.
- No `offline` field. The spec reads offline from the firing Alert (`devices.md`, "The facts": "An Alert is known from the Alert list filtered to this Device"); a second rule on the read would bring back the drift the capability inventory found between the old UI's online dot and the Alert Rule.

#### D1 · `GET /api/devices` · change

- **Today:** `DevicesController.getAll` (`api/devices/devices.controller.ts:35-38`) returns the whole entity ordered by `friendlyId` (`api/devices/devices.service.ts:26-28`), with `apikey` and `mirrorApikey` (`devices.entity.ts:23-24`, `:64-65`) and the eagerly joined `deviceModel`, `palette` and `targetFirmware` (`devices.entity.ts:50-56`, `:88-90`).
- **Serves:** the bar and the Devices list (`devices.md`, "The bar and the Devices", "The Devices list"); Connect a Device's "A Device called in" block, which needs friendly id, Firmware version and Device Model; `devices.md add 2`; `instance.md` Firmware page ("Running on {Devices}") and Device Models page ("the Devices that use it"), which can read it from here.
- **Response:** `DeviceSummary[]`, ordered by `name` case-insensitively (`devices.md`: "Devices are listed by name, case-insensitive, everywhere").
- **Rules:** no secret on a list read: no `apikey`, no `mirrorApikey`.

#### D2 · `GET /api/devices/:id` · add

- **Today:** none. The old UI finds a Device in the list (`ui/stores/device.ts`) and reads the Current Screen by calling the Device-facing `/api/current_screen` with the Device's MAC and API key (`ui/stores/screens.ts:15-23`).
- **Serves:** `devices.md add 1`, `add 2`, `add 3`, the Settings page (every row), "Identity and credentials" (API key with Reveal and Copy), the pending facts on the Screens view; `instance.md` Device Simulator ("Filled with what {Device} last reported", and the API key it polls with).
- **Response:** `DeviceDetail`. 404 `device-not-found` for an unknown id.
- **Rules:** `apikey` is returned here and only here, because Settings shows it behind "Reveal" and the Device Simulator polls with it. `mirrorApikey` is never returned; `mirror.apikeySet` says whether one is stored. `sensors` folds in what `GET /api/devices/:id/sensors` returns today (`devices.controller.ts:69-78`), so that endpoint goes (D7).

#### D3 · `POST /api/devices` · change

- **Today:** validates `mac` and `name` as strings (`api/devices/dto/create-device.dto.ts:3-9`), checks the MAC pattern in the controller (`devices.controller.ts:22-24`, `:43-45`) and returns the saved entity. A MAC already registered hits the unique index (`devices.entity.ts:20`) and surfaces as a 500.
- **Serves:** Connect a Device, "Register a Device by hand" (`devices.md add`-list "To change" 5: "a conflict the UI can word").
- **Request:** `{ name: string /* non-empty after trim */, mac: string /* /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i */ }`. The MAC is stored upper-case.
- **Response:** 201 `DeviceDetail`, with `lastSeenAt: null`.
- **Rules:** a MAC already registered, compared case-insensitively, answers 409 `device-mac-taken`. Creating a Device does not set `lastSeen`.

#### D4 · `PATCH /api/devices/:id` · change

- **Today:** returns nothing (`devices.controller.ts:58-67`). `refreshRate` is `@IsNumber()` only (`api/devices/dto/update-device.dto.ts:52-54`). The DTO also accepts `mac`, `friendlyId`, `batteryVoltage`, `fwVersion`, `host` (no such column), `rssi` and `userAgent` (`update-device.dto.ts:28-62`). Model, Palette and target Firmware are checked (`devices.service.ts:66-110`); a model or Palette change re-converts stored images (`devices.service.ts:53-54`).
- **Serves:** every "save as changed" row of Settings (`devices.md change 3`); the Special Function and Device Reset triggers; "Update now" (`devices.md`, Settings, Firmware); Connect a Device's "Name" input; `instance.md change 2` (a push with no target, or to a mirrored Device, is refused); the removal of "changing a Device's MAC or friendly id" (`devices.md remove`).
- **Request:**

```ts
interface UpdateDeviceInput {
  name?: string                       // non-empty after trim
  refreshRate?: number                // integer, 60 to 86400
  deviceModelName?: string
  paletteId?: string
  sleepModeEnabled?: boolean
  sleepStartTime?: number | null      // seconds of day, 0 to 86399, as today
  sleepEndTime?: number | null
  sleepScreenEnabled?: boolean
  mirrorEnabled?: boolean
  mirrorMac?: string                  // MAC pattern
  mirrorApikey?: string               // write-only
  specialFunction?: SpecialFunction | 'none'
  resetDevice?: boolean
  targetFirmwareId?: string | null
  updateFirmware?: boolean
}
```

- **Response:** 200 `DeviceDetail` as saved.
- **Rules:**
  - Telemetry the Device reports (`batteryVoltage`, `fwVersion`, `rssi`, `userAgent`), `mac`, `friendlyId` and `host` leave the DTO; with the global `forbidNonWhitelisted` pipe (section 2) sending one answers 400.
  - `updateFirmware: true` is refused with 409 `firmware-push-without-target` when the Device has no target after this request, and 409 `firmware-push-mirrored` when the Device is mirrored (`instance.md change 2`; today both are stored and never served, `display.service.ts:271`).
  - `targetFirmwareId: null` clears the target and any pending push. Today a target cannot be cleared through the API (`devices.service.ts:101-110` only sets one).
  - A Palette must be supported by the Device Model, custom Palettes by family, as today (`devices.service.ts:94-99`).
  - `restart_playlist` and `send_to_me` stay accepted (`update-device.dto.ts:86`); the spec does not offer them, and dropping them would make something possible today impossible.

#### D5 · `DELETE /api/devices/:id` · keep

`devices.controller.ts:49-56`. Answers 204, and 404 `device-not-found`. Serves "Delete {Device}".

#### D6 · `GET /api/devices/:id/palettes` · not added

`devices.md change 4` asks that "the Palettes offered for a Device include compatible custom Palettes". This needs no Device endpoint: the Device Model read (I14) carries each model's compatible Palette ids, custom ones included, computed with the rule the PATCH already enforces (`devices.service.ts:94-99`, `api/device-models/device-models.service.ts:89`).

#### D7 · `GET /api/devices/:id/sensors` · remove

`devices.controller.ts:69-78`. Folded into `DeviceDetail.sensors` (D2). The old UI calls it (`ui/stores/deviceSensors.ts`).

#### D8 · `GET /api/devices/:id/logs` · change (moved from `GET /api/log/device/:deviceId`)

- **Today:** `LogsController.getLogsByDevice` (`api/logs/logs.controller.ts:19-23`) returns every entry, oldest first (`api/logs/logs.service.ts:91-94`). Each entry is the firmware's JSON as one `text` column (`api/logs/logs.entity.ts:10-11`, written by `logs.service.ts:81-86`); the old UI parses it, guessing the level from keywords for the legacy format (`ui/utils/parseLogEntry.ts`).
- **Serves:** `devices.md add 7`, the Logs page (filter, search, paging, "{n} new entries", the opened entry).
- **Request:** query `limit` (1 to 200, default 50), `before` (cursor: entries older than it), `after` (cursor: entries newer than it), `level` (`all | problems`, default `all`; `problems` is `error` and `warning`), `q` (at least 2 characters, matched case-insensitively against the message).
- **Response:**

```ts
type LogLevel = 'error' | 'warning' | 'info' | 'debug'
interface DeviceLogEntry {
  id: string
  at: string
  level: LogLevel
  message: string
  source: { file: string, line: number | null } | null
  status: { wifiRssi: number | null, wifiStatus: string | null, batteryVoltage: number | null,
            freeHeapSize: number | null, wakeReason: string | null } | null
  firmwareVersion: string | null
  extras: Record<string, unknown>     // further fields, by the firmware's own names
}
interface DeviceLogPage {
  entries: DeviceLogEntry[]           // newest first
  total: number                       // every entry of the Device Log
  matching: number                    // entries matching level and q
  nextCursor: string | null           // pass as `before` for the next 50; null at the end
  newestCursor: string | null         // pass as `after` to count or load newer entries
}
```

- **Rules:**
  - Ordered by `(date DESC, id DESC)`; the cursor is opaque (the pair, encoded), so entries with equal times page stably.
  - The level and message are parsed **at ingest**, not at read: `POST /api/log` (fixed for the Device) stores two new columns, `level` and `message`, beside `entry`, with the old UI's parsing rules (`fatal` counts as `error`; the legacy format, which carries no level, gets one from keywords and `info` when none matches). A migration backfills existing rows. Search and the level filter then run in SQL over the whole Device Log, as the spec asks, instead of over a parsed page.
  - `?after=…&limit=0` answers only the counts, for "{n} new entries".
  - An unknown Device answers 404 `device-not-found` (today an empty list).

#### D9 · `DELETE /api/devices/:id/logs` · change (moved from `DELETE /api/log/device/:deviceId`)

`logs.controller.ts:25-28`. Moves beside D8; answers 204, 404 for an unknown Device. Serves "Clear Logs".

#### D10 · `PUT` and `DELETE /api/devices/:id/sleep-image` · add (decided in #1064)

- **Today:** none; #1064 is `ready-for-agent`.
- **Serves:** `devices.md add 9`, Settings, "Sleep image".
- **Shape only** (the behaviour is #1064's): `PUT` takes `multipart/form-data` with `file`, converts it for the Device's Device Model and Palette like a File Screen, answers `DeviceDetail` with `sleepImagePath` set; `DELETE` answers `DeviceDetail` with it `null`. Refused in demo mode with 403 `demo-mode` and over the upload limit with 413 (section 2).
