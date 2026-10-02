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
- **Serves:** Connect a Device, "Register a Device by hand" (`devices.md change 5`: "a conflict the UI can word").
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

### 1.2 Screens, Schedules, Mashups and Plugin Assignments

```ts
// shared/api/screens.ts
type ScreenKind = 'plugin' | 'mashup' | 'external' | 'file' | 'html'   // the stored values, screens.entity.ts:14
type ScreenState = 'active' | 'upNext' | 'scheduleOff' | 'notToday' | 'notThisHour' | 'skipping'
type RenderSignal = 'skip' | 'hold'
type MashupLayout = '1Lx1R' | '1Tx1B' | '1Lx2R' | '2Lx1R' | '2Tx1B' | '1Tx2B' | '2x2'
type TemplateSize = 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant'

interface ScheduleRead {
  id: string
  enabled: boolean
  weekdays: number[] | null      // 0 = Sunday, as stored
  startTime: string | null       // 'HH:MM'
  endTime: string | null
  startDate: string | null       // 'YYYY-MM-DD'
  endDate: string | null
}

interface ScreenRead {
  id: string
  deviceId: string
  kind: ScreenKind
  name: string                   // the stored name; a Plugin Screen's is its Plugin's name
  order: number
  state: ScreenState | null      // null on a mirrored Device, and for a Screen waiting its turn
  stateCause: 'weekday' | 'dateRange' | null   // only with state 'notToday'
  renderSignal: RenderSignal | null
  imagePath: string | null       // null: not rendered yet
  renderedAt: string | null
  schedule: ScheduleRead | null
  plugin: { id: string, name: string, kind: PluginKind, requiredFieldEmpty: boolean, fetchAlertFiring: boolean } | null
  mashup: { layout: MashupLayout, slots: Array<{ position: string, size: TemplateSize, pluginId: string, pluginName: string }> } | null
  external: { url: string, fetchManual: boolean } | null
  file: { originalName: string | null, width: number | null, height: number | null, bytes: number | null, uploadedAt: string | null } | null
  html: string | null
}
```

Derivation rules that are part of the contract:

- **Screen State** is computed on the server, never stored (`CONTEXT.md`, Screen State), with the precedence `devices.md` settles: `active`, `scheduleOff`, `notToday`, `notThisHour`, `skipping`, `upNext`, none. It has to be the server's work: Schedules are evaluated in the server's timezone (`api/schedule/schedule-eligibility.ts:40-43`, ADR-0009), which the browser does not share. The function sits beside `isScheduleEligible` and Rotation's `nextEligibleScreen` (`display.service.ts:288-297`) so the read and the poll cannot disagree.
- **`upNext`** is the Screen `nextEligibleScreen` would pick at `nextPollAt` (now, if that has passed or is unknown; `sleep.endsAt` while asleep), passing over a remembered `skip`. When that is the Active Screen itself, no Screen is `upNext` ("No other Screen can be shown right now, so it stays on").
- **`active`** is the stored `isActive`, even when the Schedule has since closed: the Device shows it until its next poll.
- **`renderSignal`** is the Render Signal column #1069 adds (open call 4.3 fixes the name). While #1069 is unbuilt it is always `null`.
- **`imagePath`** is `/screens/devices/{deviceId}/{screenId}.png?v={generatedAt in ms}` when that file exists and `null` otherwise. `generatedAt` alone cannot say "not rendered yet": every creation path sets it to the creation time (`api/screens/screens.service.ts:77`, `api/plugins/plugins.service.ts:147`, `api/mashup/mashup.service.ts:56`). `renderedAt` is `generatedAt` when the file exists, else `null`.
- **`file`** needs three facts nothing stores today: the uploaded file's name, its pixel size and its byte size. **Recommendation:** store them at upload (S1, S4); a File Screen uploaded before that reads `null` for each.

#### S1 · `POST /api/screens` · change

- **Today:** `ScreensController.add` (`api/screens/screens.controller.ts:31-38`) takes `{ filename, externalLink?, deviceId, fetchManual?, html? }` (`api/screens/dto/create-screen.dto.ts:3-21`) plus an optional multipart `file`; the kind is inferred (`screens.service.ts:69`). It then makes the new Screen the Active Screen (`screens.service.ts:48`, `:123-129`). A failed fetch or an unreadable file removes the Screen and answers 500 "Error processing image" (`screens.service.ts:96-101`, `:116-120`). A file is refused in demo mode with 405 (`screens.controller.ts:35-36`). No upload size limit is set.
- **Serves:** Add Screen, kinds External link, File and HTML (`devices.md`, "Add Screen"); `devices.md change 1`, `change 6`.
- **Request:** JSON or `multipart/form-data`:

```ts
type CreateScreenInput =
  | { deviceId: string, kind: 'external', name: string, url: string /* http or https */, fetchManual: boolean }
  | { deviceId: string, kind: 'file', name: string }        // plus the multipart part `file`
  | { deviceId: string, kind: 'html', name: string, html: string }
```

- **Response:** 201 `ScreenRead`.
- **Rules:**
  - **Adding a Screen never changes the Active Screen** (`devices.md`, Add Screen; `devices.md change 1`). The new Screen joins the end of the Order with `isActive: false`.
  - `name` is required and non-empty after trim (`devices.md`: "A Screen needs a name."; today `@IsString()` accepts `""`).
  - A URL that is not `http(s)` answers 400 with `fields`. A kept image (`fetchManual: true`) is fetched before answering; a failed fetch answers 422 `image-fetch-failed` with the reason in `message`, and nothing is created.
  - A file that is not an image the server can convert answers 400 `image-unreadable`; one over the limit answers 413 `upload-too-large` with `details.limitBytes` (section 2).
  - Demo mode refuses a file with 403 `demo-mode` (today 405; 403 says "not allowed here", 405 says "wrong verb").

#### S2 · `PATCH /api/screens/:id` · add

- **Today:** no endpoint edits a Screen (`screens.controller.ts` has none; the capability inventory lists it as a gap). Only a Mashup's name can be changed, through `PUT /api/mashup/:id` (`api/mashup/mashup.controller.ts:18-22`).
- **Serves:** `devices.md add 5`: Rename (every kind but Plugin), an External link's URL and fetch choice, Edit HTML. Primary journeys (#1078) named it.
- **Request:**

```ts
interface UpdateScreenInput {
  name?: string            // not on a Plugin Screen
  url?: string             // external only
  fetchManual?: boolean    // external only
  html?: string            // html only
}
```

- **Response:** 200 `ScreenRead`.
- **Rules:**
  - A field that does not belong to the Screen's kind answers 400 `screen-field-not-for-kind`. `name` on a Plugin Screen is that field: a Plugin Screen is named by its Plugin.
  - Setting `url`, or switching `fetchManual` to `true`, fetches and converts before saving. On failure the earlier URL and image stay and the answer is 422 `image-fetch-failed` with the reason ("The earlier image stays", `devices.md`, External link).
  - Changing `html` clears the Screen's Render Signal, as #1069 requires.
  - Never changes the Order or the Active Screen.

#### S3 · `POST /api/screens/:id/image-preview` · add (see 4.7: borderline new capability)

- **Today:** none.
- **Serves:** `devices.md add 6`, "Replace file" showing "Now" and "New" side by side before "Replace image".
- **Request:** `multipart/form-data` with `file`.
- **Response:** 200 `image/png`: the file converted for the Screen's Device Model and Palette. Nothing is stored.
- **Rules:** same refusals as S1 for a file (400, 413, 403 in demo mode); only for a `file` Screen (400 `screen-field-not-for-kind`).

#### S4 · `PUT /api/screens/:id/image` · add

- **Today:** none; replacing an image means deleting the Screen and adding a new one, which loses its Order and Schedule.
- **Serves:** `devices.md add 5` ("replacing a File Screen's image").
- **Request:** `multipart/form-data` with `file`. **Response:** 200 `ScreenRead`.
- **Rules:** converts first and swaps the stored original and PNG only when the conversion succeeded, so a refused file leaves the current image. Keeps name, Order and Schedule. Same refusals as S3.

#### S5 · `POST /api/screens/:id/refresh` · change (renamed from `POST /api/screens/:id`)

- **Today:** `screens.controller.ts:56-59` re-fetches a kept external image; a failure answers 500 "Error processing image" (`screens.service.ts:223-227`). The earlier PNG survives because conversion fails before it is overwritten (`screens.service.ts:216-217`).
- **Serves:** "Refresh image" (`devices.md`, External link).
- **Response:** 200 `ScreenRead`. **Rules:** a failed fetch answers 422 `image-fetch-failed` with the reason; the earlier image stays. A bare `POST` on a resource id reads as "create"; the verb-like sub-path says what it does.

#### S6 · `DELETE /api/screens/:id` · change

- **Today:** `screens.service.ts:140-154` deletes the Screen's files, the row and its Plugin Assignment, and closes the gap in the Order. Because `MashupConfiguration.screen` cascades on delete (`api/mashup/entities/mashup-configuration.entity.ts:279`), it already deletes a Mashup with its slots correctly.
- **Serves:** "Delete Screen" for every kind (`devices.md`); `devices.md change 2` (closing the gap after deleting a Mashup), by routing the Mashup's delete here (M4).
- **Response:** 204; 404 `screen-not-found`. **Rules:** closes the gap in the Order for every kind. Deleting the Active Screen leaves no Active Screen; the next poll picks from the start (`display.service.ts:289-290`), which is what `devices.md` describes ("leaves the plate as it is until the Device's next poll").

#### S7 · `GET /api/devices/:id/screens` · change (moved from `GET /api/screens/device/:deviceId`)

- **Today:** `screens.controller.ts:40-43` returns the Screen entities with `plugin` and `schedule` joined (`screens.service.ts:131-138`), the whole Plugin entity included; nothing derived.
- **Serves:** the Screens view: "Screens in Order", the opened Screen, the plate's sentences ("Order {n} of {N}", "Up next: {Screen}"); `devices.md add 4`.
- **Response:** `ScreenRead[]` in Order. 404 `device-not-found`.

#### S8 · `PUT /api/devices/:id/screens/order` · change (moved from `PATCH /api/screens/device/:deviceId/reorder`)

- **Today:** `screens.controller.ts:45-49`, `screens.service.ts:156-185`: takes `{ screenIds }`, refuses anything but an exact permutation with 400, reorders in a transaction and returns the list.
- **Serves:** drag, keyboard and the move actions (`devices.md`, "Reordering").
- **Request:** `{ screenIds: string[] }`. **Response:** `ScreenRead[]`. **Rules:** unchanged, plus the 400 carries code `order-not-a-permutation`. Reordering never changes the Active Screen (it does not today either).

#### S9 · `GET /api/screens` · remove

`screens.controller.ts:26-29` lists every Screen across all Devices. No screen reads it (`devices.md remove`, Primary journeys); the old UI does not call it either.

#### S10 · `POST`, `PATCH` and `DELETE /api/screens/:screenId/schedule` · change; `GET` · remove

- **Today:** `api/schedule/schedule.controller.ts:11-31`. `POST` and `PATCH` answer the Schedule entity; `startTime` and `endTime` are Postgres `time` columns (`api/schedule/schedule.entity.ts:16-20`), so they come back as `HH:MM:SS`.
- **Serves:** the Schedule editor and the row's switch (`devices.md`, "The Schedule editor").
- **Response:** `POST` 201 and `PATCH` 200 answer the owning `ScreenRead`, since a Schedule change moves the Screen State the row shows; `DELETE` answers the `ScreenRead` too. Times are `HH:MM`.
- **Rules:** unchanged (`schedule.service.ts:88-95`), with codes on the 400s. `GET` goes: `ScreenRead.schedule` carries it.

#### M1 · `POST /api/mashup` · change

- **Today:** `mashup.controller.ts:12-16`, `mashup.service.ts:31-78`: validates the layout and the Plugin count, creates the Screen, configuration and slots without a transaction, then **makes the Mashup the Active Screen** (`mashup.service.ts:71-74`).
- **Serves:** Add Screen, Mashup (`devices.md`); `devices.md change 1`.
- **Request:** `{ deviceId: string, name: string, layout: MashupLayout, pluginIds: string[] /* in slot order */ }`. **Response:** 201 `ScreenRead`.
- **Rules:** never changes the Active Screen; joins the end of the Order; one transaction; `name` non-empty. A wrong Plugin count or a repeated Plugin answers 400 (`mashup.service.ts:189-198`), an unknown Plugin 404 `plugin-not-found`.

#### M2 · `PATCH /api/mashup/:id` · change (from `PUT`)

- **Today:** `PUT /api/mashup/:id` (`mashup.controller.ts:18-22`, `mashup.service.ts:80-138`) takes `{ filename?, layout?, pluginIds? }`. Sent alone, a new `layout` is saved while the old slots stay, so a two-slot Mashup can end up with a four-slot layout (`mashup.service.ts:109-127`: slots are rebuilt only when `pluginIds` is present). No transaction.
- **Serves:** the slot selects (each saves as changed) and "Change layout" (`devices.md`, Mashup); `devices.md change 8` ("Changing a Mashup's layout and its slots is one change").
- **Request:** `{ layout?: MashupLayout, pluginIds: string[] }`: `pluginIds` is always the whole slot list, in slot order; `layout` defaults to the current one. A single slot change sends the current layout's list with one id swapped.
- **Response:** 200 `ScreenRead`.
- **Rules:** one transaction; the count must match the (new) layout; clears the Mashup's cached output (`mashup.service.ts:130`). Renaming goes through S2, so `filename` leaves this endpoint.

#### M3 · `GET /api/mashup/:id/configuration` and `GET /api/mashup/layouts` · remove

`mashup.controller.ts:29-37`. `ScreenRead.mashup` carries the configuration. The layouts are a constant (`api/mashup/constants/layouts.ts:11`) identical on both sides, so they move to `packages/shared` (ADR-0020's rule) as `MASHUP_LAYOUTS`, the spec's slot names staying in the UI.

#### M4 · `DELETE /api/mashup/:id` · remove

`mashup.controller.ts:24-27`, `mashup.service.ts:140-161`: deletes without closing the gap in the Order. S6 already deletes a Mashup and closes the gap; the UI deletes every kind through S6 (`devices.md change 2`).

#### A1 · `POST /api/plugins/:id/assign` · change

- **Today:** `api/plugins/plugins.controller.ts:168-171` has **no validation pipe**, so `AssignPluginToDeviceDto` (`api/plugins/dto/assign-plugin-to-device.dto.ts:3-14`) is never checked. `plugins.service.ts:122-153` does not check that the Plugin or Device exists, and creates the Screen with `isActive: assignData.isActive ?? true` without deactivating the others, so a Device can have two Active Screens. It answers the `DevicePlugin` row. The old import path assigns with `isActive: true` too (`plugins.controller.ts:143-145`).
- **Serves:** Add Screen, Plugin ("Assign Plugin"); the Plugin page's "Assign to {Device}"; `devices.md change 1`, `plugins.md change 12`.
- **Request:** `{ deviceId: string }`. **Response:** 201 `ScreenRead` (the Plugin Screen).
- **Rules:** never changes the Active Screen; joins the end of the Order; unknown Plugin or Device answers 404; a Plugin already on the Device answers 409 `plugin-already-assigned` (today it silently returns the existing row, `plugins.service.ts:123-128`; the UI disables that choice, so the 409 only guards a race).

#### A2 · `DELETE /api/plugins/:id/assignments/:deviceId` · change (renamed from `DELETE /api/plugins/:id/unassign/:deviceId`)

- **Today:** `plugins.controller.ts:173-177`, `plugins.service.ts:155-167`: deletes the Screen and the assignment without closing the gap in the Order; answers `{ success: false }` with 200 when there is none.
- **Serves:** "Unassign Plugin" on the Device and on the Plugin page; `devices.md change 2`.
- **Response:** 204; 404 `assignment-not-found`. **Rules:** closes the gap in the Order (the same reindex S6 uses).

#### A3 · `PATCH /api/plugins/device-assignment/:devicePluginId` · remove; `GET /api/plugins/device/:deviceId` · remove

`plugins.controller.ts:179-183` and `:41-44`. A Plugin Assignment's own enable flag and order, and the per-Device list, which no screen reads (`devices.md remove`, `plugins.md remove`). With them the `isActive` and `order` columns of `DevicePlugin` (`api/plugins/entities/device-plugin.entity.ts:10-14`) become dead. Dropping them is a follow-up, not part of this reshaping: the Configuration Archive writes both (`api/configuration/services/configuration-export.service.ts:268-269`, `api/configuration/types.ts:133`), so dropping them changes the archive's schema and its `schemaVersion`. Neither endpoint is called by the old UI.

### 1.3 Plugins

[#1101](https://github.com/PhyberApex/kuroshiro/issues/1101) (`ready-for-agent`) already decides how Field Values are saved and read: on the Plugin, in the same save, keyed by keyname; Plugin Fields matched by keyname; a password Field Value write-only; select options kept by the importers and exporter; a "needs values" flag on reads; duplicate copies Field Values. The shapes below include those fields so the read is complete, but the behaviour is #1101's and is not repeated as a separate item.

```ts
// shared/api/plugins.ts
type PluginKind = 'Poll' | 'Webhook'
type MergeStrategy = 'standard' | 'deep_merge' | 'stream'
type DataSourceMode = 'fetch' | 'literal'          // already shared/data-source.ts:1-2

interface PluginPlace { screenId: string, name: string, deviceId: string, deviceName: string }   // a Mashup holding the Plugin

interface PluginSummary {
  id: string
  name: string
  kind: PluginKind
  sourceRecipeId: string | null
  devices: Array<{ id: string, name: string }>      // assigned, by name
  mashups: PluginPlace[]
  worstFetchFailureStreak: number                   // 0 for a Webhook-kind Plugin
  fetchAlertFiring: boolean
  needsValues: boolean                              // #1101
  webhookPayloadStored: boolean | null              // null for a Poll-kind Plugin
}

interface DataSourceRead {
  id: string
  name: string
  mode: DataSourceMode
  method: 'GET' | 'POST' | null                     // null for literal
  url: string | null
  headers: Record<string, string> | null
  body: Record<string, unknown> | null
  transformJs: string | null
  literalValue: DataSourceLiteralValue | null       // shared/data-source.ts:7
  fetchFailureStreak: number
  lastFetchAttemptAt: string | null
  lastFetchSucceededAt: string | null
  lastFetchError: string | null
  alertFiring: boolean
}

interface PluginFieldRead {
  id: string
  keyname: string
  label: string                                     // the stored `name`
  type: string                                      // `fieldType`; unknown types pass through (#1101)
  helpText: string | null                           // the stored `description`
  default: string | null
  required: boolean
  order: number
  options: string[] | null                          // #1101
}

type FieldValueRead = { secret: false, value: string | null } | { secret: true, set: boolean }

interface PluginDetail {
  id: string
  name: string
  description: string | null
  kind: PluginKind
  createdAt: string
  updatedAt: string
  refreshInterval: number | null                    // null for Webhook
  templates: Array<{ size: TemplateSize, liquidMarkup: string }>   // always one `full`
  dataSources: DataSourceRead[]                     // [] for Webhook
  fields: PluginFieldRead[]
  fieldValues: Record<string, FieldValueRead>       // by keyname, #1101
  needsValues: boolean
  webhook: { token: string, url: string, mergeStrategy: MergeStrategy, streamLimit: number | null,
             payload: unknown, payloadReceivedAt: string | null } | null
  recipe: { id: string, name: string | null, importedAt: string, snapshotTakenAt: string | null } | null
  assignments: Array<{ deviceId: string, deviceName: string, screenId: string, order: number,
                       screenCount: number, state: ScreenState | null }>
  mashups: PluginPlace[]
  lastScheduledRender: { at: string, error: { message: string, line: number | null, size: TemplateSize } | null } | null
}
```

New stored facts these reads need, none of which exists today:

| Field | Stored as | Written by |
|---|---|---|
| `DataSourceRead.lastFetchSucceededAt` | column on `PluginDataSource` beside the streak columns (`api/plugins/entities/plugin-data-source.entity.ts:41-48`) | the success branch of `DataSourceFetchOutcomeService.recordOutcomes` (`api/plugins/services/data-source-fetch-outcome.service.ts:330-331`) |
| `webhook.payloadReceivedAt` | column on `Plugin` | `WebhookIngestService.ingest` (`api/plugins/services/webhook-ingest.service.ts:73`); cleared by P11 |
| `lastScheduledRender` | three columns on `Plugin`: time, message, line (and size) | the scheduler tick (`api/plugins/services/plugin-scheduler.service.ts:33-51`), which today only logs a failure (`:48-50`) |
| `recipe.snapshotTakenAt` | column on `Plugin` | Recipe import and Recipe Update apply |

`webhook.url` is `{KUROSHIRO_API_URL}/api/webhook/{token}`, the address a sender outside uses (`api/plugins/webhook-ingest.controller.ts:6`, global prefix `api/main.ts:27`). `recipe.name` is the snapshot's `name`, `null` for a Plugin imported before snapshots existed (`api/plugins/entities/plugin.entity.ts:60-64`).

#### P1 · `GET /api/plugins` · change

- **Today:** `plugins.controller.ts:31-34`, `plugins.service.ts:93-98`: every Plugin entity with Data Sources, Templates, Fields and `deviceAssignments.device`, so every template, the Webhook Payload, the Recipe Snapshot and each assigned Device whole, `apikey` and `mirrorApikey` included.
- **Serves:** `plugins.md add 1`, the Plugins list (row, state, filter "With a problem", search); Add Screen's Plugin radio row ("Already on {Device}", "a required Plugin Field is empty"); Add a Plugin's "You already have {Plugin} from this Recipe" (by `sourceRecipeId`); the Mashup slot selects.
- **Response:** `PluginSummary[]`, by name case-insensitively.
- **Rules:** no template, Data Source, payload, snapshot or Device secret.

#### P2 · `GET /api/plugins/:id` · change

- **Today:** `plugins.controller.ts:36-39`, `plugins.service.ts:100-105`: the same raw entity; an unknown id answers `null` with 200.
- **Serves:** `plugins.md add 2`, `add 3`, `add 6` (help text and options), `change 10`; `template-editor.md add 3` (the last scheduled render's time, message and line); the Plugin page in full; the 30-second refresh of streaks, payload, assignments and Alerts.
- **Response:** `PluginDetail`; 404 `plugin-not-found`.
- **Rules:** password Field Values report only `set` (#1101). The Webhook Token is returned, because the page reveals and copies the Webhook URL (`plugins.md`, Webhook).

#### P3 · `POST /api/plugins` · change

- **Today:** `plugins.controller.ts:46-50` accepts the whole Plugin (`api/plugins/dto/create-plugin.dto.ts:44-106`, including the dead `isActive` and `order`); `name` may be empty (`@IsString()` only, `:45-46`); nothing writes a starter template, so a Plugin built with a name only has no Template and is never scheduled (`plugins.service.ts:382-384`).
- **Serves:** Build a Poll Plugin, Build a Webhook Plugin (`plugins.md`, Add a Plugin); `plugins.md add 5`; `template-editor.md add 4`; "Carrying a Device".
- **Request:**

```ts
type CreatePluginInput =
  | { kind: 'Poll', name: string, deviceId?: string }
  | { kind: 'Webhook', name: string, mergeStrategy: MergeStrategy, streamLimit?: number, deviceId?: string }
```

- **Response:** 201 `PluginDetail`.
- **Rules:** `name` non-empty after trim; `streamLimit` an integer ≥ 1, required with `stream` and refused otherwise (`api/plugins/plugin-kind-fields.ts:196-227`, unchanged). The Plugin gets one `full` Template, the starter of `template-editor.md` ("The starter template"), and `refreshInterval` 15. With `deviceId` it is assigned in the same transaction under A1's rules. The full creation shape stays reachable inside the server for duplicate and import; the public endpoint takes only this.

#### P4 · `PATCH /api/plugins/:id` · change

- **Today:** `plugins.service.ts:393-434`, no transaction:
  - deletes and recreates every Data Source on any save that carries them (`:474-481`), which resets each Fetch Failure Streak and cascade-deletes a firing fetch Alert (the Alert's `dataSource` is `onDelete: 'CASCADE'`, `api/alerts/entities/alert.entity.ts:102-104`);
  - writes only the first Template and ignores the rest (`:496-511`);
  - deletes and recreates every Plugin Field (`:513-524`);
  - accepts `mergeStrategy` and `streamLimit`, fixed at creation by `CONTEXT.md` (`api/plugins/dto/update-plugin.dto.ts:12` only omits `kind` and the Recipe fields);
  - answers the entity it saved, without assignments and with the Plugin Fields as they were before the save (`:425`, `:433`); an unknown id answers `null` with 200 (`:398-399`);
  - reschedules only when Data Sources or Templates were sent (`:429-431`), so a change of `refreshInterval` alone keeps the old timer.
- **Serves:** "Save Plugin" (`plugins.md`, "What is saved together"); `plugins.md change 1`, `2`, `3`, `4`, `9`, `10`; `template-editor.md change 1`, `2`, `6`; `instance.md change 15`; #1101's Field Values.
- **Request:**

```ts
interface UpdatePluginInput {
  name?: string
  description?: string | null
  refreshInterval?: number                          // Poll only; integer, 1 to 1440
  templates?: Array<{ size: TemplateSize, liquidMarkup: string }>   // the whole set
  dataSources?: Array<{ id?: string } & DataSourceInput>            // the whole set
  fields?: PluginFieldInput[]                       // the whole set, matched by keyname (#1101)
  fieldValues?: Record<string, string | null>       // #1101; an omitted password keeps its value
}
interface DataSourceInput {
  name: string
  mode: DataSourceMode
  method?: 'GET' | 'POST'
  url?: string                                      // http or https
  headers?: Record<string, string>
  body?: Record<string, unknown>
  transformJs?: string | null
  literalValue?: DataSourceLiteralValue
}
```

- **Response:** 200 `PluginDetail`, read again after the commit.
- **Rules:**
  - **One transaction.** Either everything is saved or nothing is.
  - **Data Sources are matched by `id`.** One with an `id` of this Plugin is updated in place and keeps its Fetch Failure Streak, its last fetch facts and its firing Alert; one without an `id` is created; one left out is deleted, its Alert with it (ADR-0025). An `id` of another Plugin answers 400.
  - **Templates by size.** Sizes are unique and `full` is present, else 400 `template-full-missing`. Each Template must be non-empty and parse with the shared Liquid engine (`template-editor.md add 2`), else 400 `template-invalid` with `details: { size, line, message }`. Sizes left out are deleted.
  - **Validation:** `name` non-empty; `method` `GET` or `POST` (today any string, `api/plugins/dto/plugin-data-source.dto.ts:51-53`); the existing name rules (`plugins.service.ts:577-599`); `refreshInterval` an integer from 1 to 1440 (today any integer, `create-plugin.dto.ts:56-58`). `kind`, `mergeStrategy`, `streamLimit` and `webhookToken` are not in the DTO, so the global pipe answers 400.
  - **After the commit:** invalidate the cached output (`plugins.service.ts:530-533`, as today) and with it the remembered Render Signals (#1069); reschedule whenever `refreshInterval`, Data Sources or Templates changed; then run one scheduler tick at once, in the background. #1101 already requires that for a Field Value change; `plugins.md` ("the server then fetches and renders the Plugin again for every Device it is on") asks it for every save. It is the scheduler's own tick, so it moves the Fetch Failure Streak like any other (ADR-0025). The answer does not wait for it.
  - **The refresh interval is kept as entered** (`plugins.md change 4`): the scheduler runs a Plugin every `refreshInterval` minutes from when it was scheduled, instead of the cron expression that floors 60 minutes and more to whole hours and runs `*/N` unevenly when N does not divide the hour (`plugin-scheduler.service.ts:68-74`).
  - **A Poll-kind Plugin without Data Sources is scheduled and rendered** (`plugins.md change 5`): with `trmnl` and its Field Values only. Today it is never scheduled (`plugins.service.ts:86`, `plugin-scheduler.service.ts:27-29`) and never rendered on demand (`display.service.ts:534`).

#### P5 · `DELETE /api/plugins/:id` · change

- **Today:** `plugins.controller.ts:84-88`, `plugins.service.ts:656-677`: answers `{ success: false }` with 200 for an unknown id; a Plugin in a Mashup slot answers 400 with the Mashups' names in a sentence.
- **Serves:** "Delete Plugin" and "{Plugin} cannot be deleted yet" (`plugins.md`, "Duplicate, export, delete"); `plugins.md change 10`, `change 11`.
- **Response:** 204; 404 `plugin-not-found`; 409 `plugin-in-mashup` with `details: { mashups: PluginPlace[] }`.
- **Rules:** deleting the Plugin's Screens closes the gaps in each Device's Order (today the Screens cascade away with no reindex: `api/screens/screens.entity.ts:43-44`).

#### P6 · `POST /api/plugins/:id/duplicate` · change

- **Today:** `plugins.service.ts:217-238`: copies Data Sources, Templates, Fields and the Recipe id and Snapshot, clones Plugin Variables, not Field Values.
- **Serves:** "Duplicate" (`plugins.md`); `plugins.md change 13` (that part is #1101's).
- **Response:** 201 `PluginDetail`. **Rules:** named "{Plugin} (copy)"; no assignments; an empty Webhook Payload and its own Webhook Token; stays tied to the Recipe (`plugins.md`: "A copy of a Recipe's Plugin stays tied to that Recipe").

#### P7 · `GET /api/plugins/:id/export` · change

- **Today:** `plugins.controller.ts:154-166`, `api/plugins/services/plugin-exporter.service.ts:115-164`: `.trmnlp.yml` and `src/settings.yml` without the Plugin Kind, Merge Strategy or Stream Limit; `src/settings.yml` is written only when there are Data Sources (`:133`), so a Webhook-kind Plugin comes back as a Poll-kind one. The file name is the raw Plugin name inside `filename="…"` (`plugins.controller.ts:164`), which a `"` in the name breaks.
- **Serves:** "Export" (`plugins.md`); `plugins.md add 7`.
- **Response:** 200 `application/zip`; 404 in the error envelope.
- **Rules:** `src/settings.yml` is always written and carries `strategy: polling | webhook` (the key TRMNL's own Recipes use, which the importer already reads for Recipes, `api/plugins/services/plugin-importer.service.ts:347`), plus `merge_strategy` and `stream_limit` for a Webhook-kind Plugin. Every Template is written by size (as today). The file name is sanitised and also sent as RFC 6266 `filename*`. The importer (P8) reads the three keys back, so the round trip keeps the kind.

#### P8 · `POST /api/plugins/import` · change

- **Today:** `plugins.controller.ts:90-109`: multer writes the upload to `./uploads` with no size limit; a missing file throws a plain `Error`; `.yml`/`.yaml` is accepted (`plugin-importer.service.ts:140-147`) and looks for `src/settings.yml` beside it. Almost every refusal is a plain `Error` (`plugin-importer.service.ts:146`, `:178`, `:235`, `:240`, `:308`, `:319`, `:332`, `:339`, `:347`, `:370`, `:421`, `:475`, `:479`, `:564`, `:583`) and reaches the UI as a 500 with no reason. With `deviceId` the new Plugin is assigned **as the Active Screen** (`plugins.controller.ts:143-145`). The answer is the Plugin plus `_hasTransform` (`:148-151`).
- **Serves:** Add a Plugin, File (`plugins.md`); `plugins.md add 8`, `change 16`; the "Lines shown once" after an import.
- **Request:** `multipart/form-data` with `file` (a `.zip`) and optional `deviceId`.
- **Response:**

```ts
interface PluginImportResult {
  plugin: PluginDetail
  origin: { type: 'recipe', id: string, name: string } | { type: 'file', fileName: string } | { type: 'github', repository: string }
  hasTransform: boolean
}
```

- **Rules:** a file that is not a `.zip` answers 400 `import-not-zip`; a `.zip` without a `.trmnlp.yml` or a `.liquid` Template answers 422 `import-no-plugin`; the legacy single-source format answers 422 `import-legacy-format`. The upload is held in memory, so nothing is left in `./uploads`. With `deviceId` the Plugin is assigned under A1's rules (never the Active Screen; 404 for an unknown Device). An import without a `full` Template makes its first Template `full` (`template-editor.md change 2`).

#### P9 · `POST /api/plugins/import-github` · change

- **Today:** `plugins.controller.ts:111-119`: the body is an inline type, not validated; a missing URL throws a plain `Error`; GitHub failures are plain `Error`s (`plugin-importer.service.ts:178`, `:203`).
- **Serves:** Add a Plugin, GitHub; its three refusals.
- **Request:** `{ githubUrl: string, deviceId?: string }`. **Response:** `PluginImportResult`.
- **Rules:** a URL that is not `https://github.com/{owner}/{repo}` answers 400 `github-url-invalid`; a repository GitHub does not have, or not publicly, 422 `github-repo-not-found`; one without a Plugin at the root of `main`, 422 `import-no-plugin`; GitHub not answering, 502 `upstream-unreachable`.

#### P10 · `POST /api/plugins/import-recipe` · change

- **Today:** `plugins.controller.ts:121-129`: unvalidated inline body, plain `Error`s for every refusal (`plugin-importer.service.ts:308`, `:319`, `:332`, `:339`, `:347`, `:370`).
- **Serves:** Add a Plugin, Recipe, with its refusal table (`plugins.md`).
- **Request:** `{ recipe: string /* id or trmnl.com address */, deviceId?: string }`. **Response:** `PluginImportResult`.
- **Rules (one code per row of the spec's table):** `recipe-id-invalid` 400; `recipe-not-found` 422 (TRMNL answers 404); `recipe-oauth` 422; `recipe-strategy-unsupported` 422 (webhook or any strategy but polling and static); `recipe-static-transform` 422 (`:370`); `upstream-unreachable` 502 (TRMNL not answering or answering 5xx). Sets `recipe.snapshotTakenAt`.

#### P11 · `DELETE /api/plugins/:id/webhook-payload` · change

- **Today:** `plugins.controller.ts:74-77`, `plugins.service.ts:601-608`: clears the column and answers the stale Plugin entity with `webhookPayload: null`; the cached output on its Screens stays (`plugins.md change 8`).
- **Serves:** "Clear Webhook Payload" ("The Plugin is rendered again at once").
- **Response:** 200 `PluginDetail`. **Rules:** clears `payloadReceivedAt` too, then renders the Plugin with no payload (R3) and writes the cached output, as a POST would. 400 `plugin-not-webhook` for a Poll-kind Plugin (exists, `plugins.service.ts:625-627`).

#### P12 · `POST /api/plugins/:id/webhook-token` · change

`plugins.controller.ts:79-82`, `plugins.service.ts:610-618`. Answers 200 `PluginDetail` instead of the stale entity with the new token. Serves "Regenerate the Webhook Token" ("Afterwards the new URL is shown revealed").

#### P13 · `GET /api/plugins/:id/recipe-update` · change

- **Today:** `plugins.controller.ts:63-66`, `api/plugins/services/recipe-update.service.ts:35-45`, `:107-116`: `{ contentHash, mode, items, assignmentsMissingRequiredField }`, the last per Plugin Assignment. A failed download answers 502 whatever the cause, any other importer error 400 (`recipe-update.service.ts:227-234`).
- **Serves:** the Recipe Update Check page; `plugins.md change 17`.
- **Response:**

```ts
interface RecipeUpdatePreview {
  contentHash: string
  mode: 'two-way' | 'three-way'                     // two-way: no Recipe Snapshot
  recipe: { id: string, name: string }
  snapshotTakenAt: string | null
  items: UpdateItem[]                               // as today, recipe-update-diff.ts:78-86
  requiredFieldsLeftEmpty: Array<{ keyname: string, label: string }>   // per Plugin, ADR-0032
}
```

- **Rules:** `recipe-not-found` 422 ("TRMNL no longer has the Recipe {id}") told apart from `upstream-unreachable` 502 ("trmnl.com did not answer"); 404 `plugin-not-from-recipe` (exists, `:215`).

#### P14 · `POST /api/plugins/:id/recipe-update/apply` · change

`plugins.controller.ts:68-72`. Request unchanged (`{ contentHash, apply: [{ itemType, key }] }`, `api/plugins/dto/apply-recipe-update.dto.ts:14-22`; `apply: []` is "Skip all" and "Apply nothing and save the Recipe Snapshot"). Answers `PluginDetail`, sets `recipe.snapshotTakenAt`, keeps the 409 `recipe-changed` when the hash moved (`recipe-update.service.ts:121-123`), and runs the same post-commit steps as P4.

#### P15 · `POST /api/plugins/:id/preview-data` · add (replaces `POST /api/plugins/preview`)

- **Today:** `POST /api/plugins/preview` (`plugins.controller.ts:25-29`, `plugins.service.ts:679-709`) takes `{ sources, template?, fieldValues? }`, fetches, renders with the server's Liquid and answers `{ html, data }`. It takes no Device (so no Sensors), uses `instance_name: 'Preview'`, does nothing for a Webhook-kind Plugin, and a Liquid error escapes as a 500.
- **Serves:** `template-editor.md add 1`: the preview's data and "Data", fetched once and held; "Fetch again".
- **Request:**

```ts
interface PreviewDataInput {
  deviceId: string | null                           // null: no Device, so no Sensors
  name?: string                                     // the unsaved name, for trmnl.plugin_settings.instance_name
  dataSources?: Array<{ id?: string } & DataSourceInput>   // the unsaved set; Poll only
  fieldValues?: Record<string, string | null>       // the unsaved values; an omitted password uses the stored one
}
```

- **Response:**

```ts
type PreviewOrigin = 'fieldValue' | 'dataSource' | 'webhookPayload' | 'sensors' | 'trmnl'
interface PreviewData {
  context: Record<string, unknown>                  // exactly what the server's render would pass to Liquid
  names: Array<{ name: string, origin: PreviewOrigin, error: string | null }>   // the "Data" rows, in the spec's order
  fetchedAt: string
  webhookPayloadReceivedAt: string | null
}
```

- **Rules:**
  - Builds the context with the same function every render uses (R2), so the preview and the Device read the same names. A Data Source that fails carries its error marker `{ error: true, message }` (as `api/plugins/services/plugin-data-resolver.service.ts:384-388`) and its `names` row the message.
  - A password Field Value is `"••••••••"` in `context`; the stored secret is still substituted where a Data Source's URL, headers or body name it.
  - Renders nothing. Moves no Fetch Failure Streak and fires no Alert (ADR-0025: only the scheduler tick records outcomes, `data-source-fetch-outcome.service.ts:294-301`).
  - Demo mode keeps the public-address rule for fetches (`api/plugins/services/plugin-data-fetcher.service.ts:52`).
  - 404 `plugin-not-found`, 404 `device-not-found`.

### 1.4 Rendering behaviour the Plugin and editor screens depend on (no endpoint)

These change what the server renders, not what an endpoint answers. They are listed because a screen's copy states them as facts.

- **R1 · A render picks a Template by size, never by position** (`template-editor.md change 3`, `change 4`). Today the scheduler and a Webhook render use `templates[0]` (`api/plugins/services/plugin-render-cache.service.ts:111`), the on-demand render looks for `full` (`display.service.ts:582`), and a Mashup slot prefers `full` (`api/mashup/services/mashup-renderer.service.ts:62`). After: a Screen on its own, the scheduler and a Webhook render use `full`; a Mashup slot uses its own size and falls back to `full`. The slot's size is stored as `view--half_vertical` and so on (`api/mashup/constants/layouts.ts:13`); the Template's as `half_vertical`.
- **R2 · Every render sees the same context** (`template-editor.md change 5`): `trmnl`, the Field Values (#1101), the Device's `sensors` where there is a Device, and the data. Today a Webhook render passes only the merged payload (`webhook-ingest.service.ts:74`), with no `trmnl`.
- **R3 · A Webhook-kind Plugin renders without a payload** (`plugins.md change 7`, `change 8`): before the first POST and after a clear, its Template renders with `trmnl` and its Field Values. Today nothing is rendered until the first POST, and clearing leaves the old output on its Screens.
- **R4 · A Webhook-kind Plugin renders in a Mashup slot** (`plugins.md change 6`). Today every slot throws "Plugin missing data sources or templates" for it (`mashup-renderer.service.ts:54-55`).
- **R5 · A scheduled render that fails is stored**, with Liquid's message and line (`template-editor.md add 3`); it fills `lastScheduledRender` (P2).
- **R6 · A transform that throws is a failed fetch** (`plugins.md change 15`): today the raw data passes through silently (`api/plugins/services/plugin-transform.service.ts:442-447`).
- **R7 · A failed Mashup slot is drawn as `plugins.md` specs** (`plugins.md change 14`), in place of `error.png` (`mashup-renderer.service.ts:78-81`).
- **R8 · The Liquid engine and Kuroshiro's filters move to `packages/shared`** (`template-editor.md add 2`). Today they live in `api/plugins/services/plugin-renderer.service.ts:197-284`, a `new Liquid()` with fourteen filters. It is the one runtime dependency this adds to `packages/shared` (`liquidjs`, which the API already depends on); see section 3.
