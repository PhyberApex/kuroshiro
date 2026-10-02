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
- **`lastSeen` cannot say "never polled".** The column is `NOT NULL` (`api/devices/devices.entity.ts:92-93`) and its database default is a fixed literal, `'2026-04-18T22:36:39.653Z'` (`api/migrations/1776551799197-AddPluginSystem.ts:27`), so a Device registered by hand or through `/api/setup` (`api/devices/setup.service.ts:56-58`) carries that date until its first `/display`. **Recommendation:** a migration makes it nullable with no default and sets it to `NULL` where it equals that literal; `/display` keeps writing it (`display.service.ts:147`). The offline Alert Rule skips a Device with `lastSeen = NULL` (`api/alerts/rules/offline.rule.ts:41-49` reads it unconditionally today).

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

- `currentScreen`: `lastSeenAt === null` gives `{ kind: 'fallback', fallback: 'welcome', reason: 'neverPolled' }` (welcome is only ever served by setup, `setup.service.ts:47`). Otherwise it is the last-served record. The image path is the file that poll pointed the Device to, root-relative.
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
  - `targetFirmwareId: null` clears the target, for the Target Firmware select's "None". Today a target cannot be cleared (`devices.service.ts:101-110` only sets one, and the old UI only ever assigns and pushes in one step, `ui/components/DeviceInformationCard.vue:83`). While a push is pending, `null` answers 409 `firmware-push-pending`: clearing the target then would cancel the push, which is [Cancel a pending Firmware push](https://github.com/PhyberApex/kuroshiro/issues/1086), an untriaged new capability.
  - A Palette must be supported by the Device Model, custom Palettes by family, as today (`devices.service.ts:94-99`).
  - `restart_playlist` and `send_to_me` stay accepted (`update-device.dto.ts:86`); the spec does not offer them, and dropping them would make something possible today impossible.

#### D5 · `DELETE /api/devices/:id` · keep

`devices.controller.ts:49-56`. Answers 204, and 404 `device-not-found`. Serves "Delete {Device}".

#### D6 · `GET /api/devices/:id/palettes` · not added

`devices.md change 4` asks that "the Palettes offered for a Device include compatible custom Palettes". This needs no Device endpoint: the Device Model read (DM1) carries each model's compatible Palette ids, custom ones included, computed with the rule the PATCH already enforces (`devices.service.ts:94-99`, `api/device-models/device-models.service.ts:89`).

#### D7 · `GET /api/devices/:id/sensors` · remove

`devices.controller.ts:69-78`. Folded into `DeviceDetail.sensors` (D2). The old UI calls it (`ui/stores/deviceSensors.ts`).

#### D8 · `GET /api/devices/:id/logs` · change (moved from `GET /api/log/device/:deviceId`)

- **Today:** `LogsController.getLogsByDevice` (`api/logs/logs.controller.ts:19-23`) returns every entry, oldest first (`api/logs/logs.service.ts:70-73`). Each entry is the firmware's JSON as one `text` column (`api/logs/logs.entity.ts:10-11`, written by `api/logs/logs.service.ts:60-65`); the old UI parses it, guessing the level from keywords for the legacy format (`ui/utils/parseLogEntry.ts`).
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

- **Screen State** is computed on the server, never stored (`CONTEXT.md`, Screen State), with the precedence `devices.md` settles: `active`, `scheduleOff`, `notToday`, `notThisHour`, `skipping`, `upNext`, none. It has to be the server's work: Schedules are evaluated in the server's timezone (`api/schedule/schedule-eligibility.ts:3-7`, ADR-0009), which the browser does not share. The function sits beside `isScheduleEligible` and Rotation's `nextEligibleScreen` (`display.service.ts:288-297`) so the read and the poll cannot disagree.
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

- **Today:** `screens.service.ts:140-154` deletes the Screen's files, the row and its Plugin Assignment, and closes the gap in the Order. Because `MashupConfiguration.screen` cascades on delete (`api/mashup/entities/mashup-configuration.entity.ts:14`), it already deletes a Mashup with its slots correctly.
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
| `DataSourceRead.lastFetchSucceededAt` | column on `PluginDataSource` beside the streak columns (`api/plugins/entities/plugin-data-source.entity.ts:41-48`) | the success branch of `DataSourceFetchOutcomeService.recordOutcomes` (`api/plugins/services/data-source-fetch-outcome.service.ts:46-47`) |
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
- **Rules:** `name` non-empty after trim; `streamLimit` an integer ≥ 1, required with `stream` and refused otherwise (`api/plugins/plugin-kind-fields.ts:23-54`, unchanged). The Plugin gets one `full` Template, the starter of `template-editor.md` ("The starter template"), and `refreshInterval` 15. With `deviceId` it is assigned in the same transaction under A1's rules. The full creation shape stays reachable inside the server for duplicate and import; the public endpoint takes only this.

#### P4 · `PATCH /api/plugins/:id` · change

- **Today:** `plugins.service.ts:393-434`, no transaction:
  - deletes and recreates every Data Source on any save that carries them (`:474-481`), which resets each Fetch Failure Streak and cascade-deletes a firing fetch Alert (the Alert's `dataSource` is `onDelete: 'CASCADE'`, `api/alerts/entities/alert.entity.ts:19-21`);
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

- **Today:** `plugins.controller.ts:154-166`, `api/plugins/services/plugin-exporter.service.ts:17-66`: `.trmnlp.yml` and `src/settings.yml` without the Plugin Kind, Merge Strategy or Stream Limit; `src/settings.yml` is written only when there are Data Sources (`:35`), so a Webhook-kind Plugin comes back as a Poll-kind one. The file name is the raw Plugin name inside `filename="…"` (`plugins.controller.ts:164`), which a `"` in the name breaks.
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
  - Builds the context with the same function every render uses (R2), so the preview and the Device read the same names. A Data Source that fails carries its error marker `{ error: true, message }` (as `api/plugins/services/plugin-data-resolver.service.ts:52`) and its `names` row the message.
  - A password Field Value is `"••••••••"` in `context`; the stored secret is still substituted where a Data Source's URL, headers or body name it.
  - Renders nothing. Moves no Fetch Failure Streak and fires no Alert (ADR-0025: only the scheduler tick records outcomes, `data-source-fetch-outcome.service.ts:11-16`).
  - Demo mode keeps the public-address rule for fetches (`api/plugins/services/plugin-data-fetcher.service.ts:52`).
  - 404 `plugin-not-found`, 404 `device-not-found`.

### 1.4 Rendering behaviour the Plugin and editor screens depend on (no endpoint)

These change what the server renders, not what an endpoint answers. They are listed because a screen's copy states them as facts.

- **R1 · A render picks a Template by size, never by position** (`template-editor.md change 3`, `change 4`). Today the scheduler and a Webhook render use `templates[0]` (`api/plugins/services/plugin-render-cache.service.ts:36`), the on-demand render looks for `full` (`display.service.ts:582`), and a Mashup slot prefers `full` (`api/mashup/services/mashup-renderer.service.ts:62`). After: a Screen on its own, the scheduler and a Webhook render use `full`; a Mashup slot uses its own size and falls back to `full`. The slot's size is stored as `view--half_vertical` and so on (`api/mashup/constants/layouts.ts:13`); the Template's as `half_vertical`.
- **R2 · Every render sees the same context** (`template-editor.md change 5`): `trmnl`, the Field Values (#1101), the Device's `sensors` where there is a Device, and the data. Today a Webhook render passes only the merged payload (`webhook-ingest.service.ts:74`), with no `trmnl`.
- **R3 · A Webhook-kind Plugin renders without a payload** (`plugins.md change 7`, `change 8`): before the first POST and after a clear, its Template renders with `trmnl` and its Field Values. Today nothing is rendered until the first POST, and clearing leaves the old output on its Screens.
- **R4 · A Webhook-kind Plugin renders in a Mashup slot** (`plugins.md change 6`). Today every slot throws "Plugin missing data sources or templates" for it (`mashup-renderer.service.ts:54-55`).
- **R5 · A scheduled render that fails is stored**, with Liquid's message and line (`template-editor.md add 3`); it fills `lastScheduledRender` (P2).
- **R6 · A transform that throws is a failed fetch** (`plugins.md change 15`): today the raw data passes through silently (`api/plugins/services/plugin-transform.service.ts:49-53`).
- **R7 · A failed Mashup slot is drawn as `plugins.md` specs** (`plugins.md change 14`), in place of `error.png` (`mashup-renderer.service.ts:78-81`).
- **R8 · The Liquid engine and Kuroshiro's filters move to `packages/shared`** (`template-editor.md add 2`). Today they live in `api/plugins/services/plugin-renderer.service.ts:1-91`, a `new Liquid()` (`:9`) with thirteen filters. It is the one runtime dependency this adds to `packages/shared` (`liquidjs`, which the API already depends on); see section 3.

### 1.5 Alerts

#### AL1 · `GET /api/alerts` · change

- **Today:** `api/alerts/alerts.controller.ts:12-16`, `api/alerts/alerts.service.ts:44-65`: active Alerts uncapped and resolved ones since `resolvedSince` (default 7 days, at most 50), newest first, as `AlertsList` (`shared/alerts.ts:12-28`). The only filter is `resolvedSince` (`api/alerts/dto/list-alerts-query.dto.ts`). A fetch Alert carries `pluginName` and no Plugin id (`alerts.service.ts:17`). `details` is overwritten on every Alert Sweep while the Alert fires (`api/alerts/alert-sweep.service.ts:121`) and again at resolve (`:132`), so a resolved fetch Alert reads a streak of 0 and no error (`api/alerts/rules/data-source-fetch-failing.rule.ts`: a recovered source evaluates to `{ streak: 0, lastError: null }`).
- **Serves:** the Alerts page (firing and "Resolved in the last 7 days"); the bar's indicator; the Devices list rows and a Device's facts ("Alert: battery low", "Alert: offline"); the Plugins list and Plugin page ("Alert: a Data Source keeps failing"); `devices.md change 7`, `plugins.md add 4`, `instance.md add 7`, `change 14`.
- **Request:** query `deviceId?`, `pluginId?`, `resolvedSince?` (as today).
- **Response:** `AlertsList`, with `AlertSummary` extended, not reshaped:

```ts
interface AlertSummary {                            // shared/alerts.ts:12, today's fields kept
  id: string
  kind: AlertKind
  deviceId?: string
  deviceName?: string
  dataSourceId?: string
  dataSourceName?: string
  pluginId?: string                                 // new, beside pluginName
  pluginName?: string
  openedAt: string
  resolvedAt: string | null
  details: AlertDetails
}
type AlertDetails =                                 // typed per kind; today Record<string, unknown> | null
  | { percent: number }                             // device-low-battery
  | { lastSeen: string }                            // device-offline
  | { streak: number, lastError: string | null }    // data-source-fetch-failing
```

- **Rules:** `details` is the cause **while the Alert fired**: the Sweep updates it while the Alert is active and leaves it alone at resolve. The resolved row's "why" (`instance.md`: "Battery at 17 %", "No poll for 1 h 5 min", "3 fetches failed in a row: {error}") is then the last firing value, with the duration from `resolvedAt`. `pluginId` filters fetch Alerts by the Data Source's Plugin; `deviceId` filters Device Alerts. The fields stay optional rather than `null` because the old UI reads this shared type as it is (section 3).

#### AL2 · `POST /api/alerts/test-notification` · keep

`alerts.controller.ts:18-23`, `alerts.service.ts:68-82`: 200 `{ message }`, 400 when Apprise is not configured, 503 when it does not accept. Gains codes `notifications-off` and `notification-failed`. Serves "Send a Test Notification" under Instance Settings.

### 1.6 Instance

#### I1 · `GET /api/instance` · add

- **Today:** none. `KUROSHIRO_API_URL` and demo mode are read in `api/config/config.ts:36-37` and never exposed; the old UI guesses demo mode from its own address (`ui/composeables/useDemoInfo.ts:4`). The timezone is the process's (`schedule-eligibility.ts:3-5`). The API reads its own version for the archive (`api/configuration/get-api-version.ts`). Apprise is `alerts.appriseUrl` and `alerts.appriseKey` (`config.ts:46-47`), posted to as `{url}/notify/{key}` (`api/alerts/notification-sender.service.ts`).
- **Serves:** `devices.md add 8` (server URL, timezone, demo mode; the Retention ages go to I2, see below); `instance.md add 1` (Notifications set up, the Apprise address, the server's version); the demo line on every page; "Server timezone, {Europe/Berlin}" beside every Schedule and Sleep Mode time; Connect a Device's server URL and its `localhost` warning; "Set where Kuroshiro is started".
- **Response:**

```ts
interface InstanceFacts {
  version: string                                   // the API package's version
  serverUrl: string                                 // KUROSHIRO_API_URL as configured
  serverUrlIsLoopback: boolean                      // localhost, 127.0.0.0/8 or ::1
  timezone: string                                  // IANA name the process runs in
  demoMode: boolean
  notifications: { configured: boolean, appriseUrl: string | null }   // user and password stripped from the URL
  limits: { imageUploadBytes: number, firmwareUploadBytes: number, archiveUploadBytes: number,
            pluginImportBytes: number, webhookBodyBytes: number }
}
```

- **Rules:** read once per page load; nothing here changes without a restart. `appriseKey` is never returned. `timezone` is `Intl.DateTimeFormat().resolvedOptions().timeZone`, which names the zone the Schedules and Sleep Mode are evaluated in; what it reads with `TZ` unset (`instance.md` left this open) is listed in section 6.

#### I2 · `GET` and `PATCH /api/settings` · keep (+ #1062)

`api/settings/settings.controller.ts:10-19`; already shared types (`shared/instance-settings.ts:33-42`), already answers the whole resolved set on every `PATCH`, which is the "save as changed" answer section 2 asks for everywhere. #1062 adds the two Retention ages as Settings; that is where they live (`instance.md add 10`), so `devices.md add 8`'s "and the Retention ages" is served here rather than by I1. Gains error codes only.

#### F1 · `GET /api/firmware` · change

- **Today:** `api/firmware/firmware.controller.ts:18-21`: the entities, newest first (`api/firmware/firmware.service.ts` `findAll`). The time of the last check is read off the newest official row's `syncedAt`, which only moves when a new Firmware is inserted (`api/firmware/firmware-sync.service.ts:60-63`).
- **Serves:** the Firmware page; `instance.md add 5`, `add 9`; the Target Firmware select in a Device's Settings.
- **Response:**

```ts
interface SyncRun { ranAt: string, ok: boolean, error: string | null }
interface FirmwareRead {
  id: string
  version: string
  kind: 'official-synced' | 'custom'
  label: string | null
  compatibleModels: string[]                        // empty: every Device Model
  deprecated: boolean
  syncedAt: string | null
  uploadedAt: string | null
  filePresent: boolean
  targetOf: Array<{ id: string, name: string, pushPending: boolean }>
  runningOn: Array<{ id: string, name: string }>    // Devices reporting this version
}
interface FirmwareList { lastSync: SyncRun | null, firmware: FirmwareRead[] }
```

- **Rules:** `lastSync` is a stored record of every sync run, successful or not, by the daily job and by F2 alike, kept per kind (Firmware, Device Models) in a small table of its own. `filePresent` checks the binary on disk (`firmware.service.ts` `verifyChecksum` already does, at serve time).

#### F2 · `POST /api/firmware/sync` · change

- **Today:** `firmware.controller.ts:23-33` answers `FirmwareSyncResult` (`shared/sync.ts:9-15`) with `assignedCount` only, and no `syncedAt` when nothing was new; a failure is 503 with the reason.
- **Serves:** "Sync from TRMNL" on the Firmware page and its four outcomes; `instance.md add 6`.
- **Response:** `{ ranAt: string, inserted: boolean, version: string, assigned: Array<{ id: string, name: string }> }`; 502 `upstream-unreachable` with the reason (503 says Kuroshiro is unavailable, but here TRMNL is).

#### F3 · `POST /api/firmware/upload` · change

- **Today:** `firmware.controller.ts:35-50`, `firmware.service.ts:50-76`: requires a version and a `.bin`, enforces 8 MB through multer (`firmware.controller.ts:36`) and again in the service (`firmware.service.ts:53-54`); stores any version, duplicates included, and any `compatibleModels` strings.
- **Serves:** Upload Firmware; `instance.md change 3`.
- **Response:** 201 `FirmwareRead`. **Rules:** a version that exists answers 409 `firmware-version-taken`; a Device Model name the Instance does not know answers 400 `device-model-unknown`; a file over the limit answers 413 `upload-too-large` with `details.limitBytes`; a non-`.bin` answers 400 (as today).

#### F4 · `DELETE /api/firmware/:id` · change

- **Today:** `firmware.service.ts:78-87` removes the row and file. The Device's `targetFirmware` foreign key is `ON DELETE SET NULL` (`devices.entity.ts:88-90`) while `updateFirmware` stays `true`, so the Device reads "update pending" for good, `/display` never serves anything (`display.service.ts:271`), and Firmware Auto-Update skips the Device from then on because it only considers `updateFirmware: false` (`api/firmware/firmware-auto-update.service.ts:29`).
- **Serves:** "Delete Firmware {version}?" ("Deleting cancels that push"); `instance.md change 1`.
- **Response:** 204; 404; 400 `firmware-not-custom`. **Rules:** in one transaction, every Device targeting it loses the target and any pending push.

#### DM1 · `GET /api/device-models` · change

- **Today:** `api/device-models/device-models.controller.ts:21-24`: the entities. Which Palettes a model supports is its curated `paletteIds`; custom Palettes are compatible by family, a rule only the Device PATCH applies (`devices.service.ts:94-99`), so the old UI never offers them (capability inventory #19).
- **Serves:** Device Models and Palettes; the Device Model and Palette selects in a Device's Settings (`devices.md change 4`); "Another Device Model" in the template preview, which needs `cssClasses` and `cssVariables` for the shared screen shell (`shared/screen-shell.ts:1-4`); `instance.md add 9`.
- **Response:** `{ lastSync: SyncRun | null, models: DeviceModelRead[] }`, where `DeviceModelRead` is the entity's fields (`api/device-models/entities/device-model.entity.ts`) with `syncedAt` as a string, `paletteIds` widened to every compatible Palette (custom ones by family, through `DeviceModelsService.compatibleFamiliesFor`, `api/device-models/device-models.service.ts:89`) and `usedBy: Array<{ id, name }>`.

#### DM2 · `GET /api/device-models/palettes` · change

`device-models.controller.ts:26-29`. Answers `PaletteRead[]`: the entity's fields (`api/device-models/entities/palette.entity.ts`) plus `usedBy: Array<{ id, name }>`. Serves the custom Palettes section ("the Devices that use it", "cannot be changed while a Device uses it") and TRMNL's Palettes.

#### DM3 · `POST /api/device-models/palettes` · change

- **Today:** `device-models.controller.ts:31-35`, `api/device-models/custom-palettes.service.ts:20-34`: validates name, family and colours; does not check the name; the pipe has no `whitelist`.
- **Serves:** "Add a custom Palette"; `instance.md change 5`.
- **Response:** 201 `PaletteRead`. **Rules:** a name already used by a custom Palette, compared case-insensitively, answers 409 `palette-name-taken`.

#### DM4 · `PATCH /api/device-models/palettes/:id` · add (see 4.7: a new capability by the map's rule)

- **Today:** none; only create and delete (`device-models.controller.ts`). ADR-0014 (custom Palettes) calls custom Palettes freely editable.
- **Serves:** the custom Palette form's "Save Palette"; `instance.md add 4`, `change 4`.
- **Request:** `{ name?: string, frameworkClass?: CustomPaletteFrameworkClass, colors?: string[] }`. **Response:** 200 `PaletteRead`.
- **Rules:** official Palettes answer 400 `palette-not-custom`; a family change while a Device uses the Palette answers 409 `palette-in-use`; after the commit, the stored images of every Device using it are converted again (`api/screens/screens.service.ts:235-262`, `reconvertImageScreens`).

#### DM5 · `DELETE /api/device-models/palettes/:id` · change

- **Today:** `custom-palettes.service.ts:36-43` removes the row; Devices using it fall to `palette = NULL` through the foreign key (`devices.entity.ts:54-56`) and render with the model's default from then on (`device-models.service.ts:139-143`), but their stored File and kept External link images stay converted for the deleted Palette.
- **Serves:** "Delete the Palette {name}?" ("goes back to its Device Model's richest Palette … Its stored images are converted again"); `instance.md change 4`.
- **Response:** 204. **Rules:** each Device using it is given its Device Model's default Palette (`defaultPaletteFor`, `device-models.service.ts:78`) and its images are converted again.

#### DM6 · `POST /api/device-models/sync` · change

`device-models.controller.ts:42-52`. Answers `DeviceModelSyncResult` (`shared/sync.ts:1-7`) with `syncedAt` renamed `ranAt`, records a `SyncRun` either way, and fails with 502 `upstream-unreachable`. Serves "Sync from TRMNL" on Device Models and Palettes.

#### C1 · `GET /api/config/export` · keep

`api/configuration/configuration.controller.ts:14-29`. Field Values move to the Plugin entry and password Field Values are redacted in a Redacted Archive: #1101 (`instance.md change 8`). Errors in the envelope.

#### C2 · `POST /api/config/import/check` · add (see 4.7)

- **Today:** none. `instance.md` builds its import page on reading the archive first, and falls back to a plain confirmation if this ticket declines it.
- **Serves:** `instance.md add 2`, `add 3`; Configuration Import step 3, "What it would do".
- **Request:** `multipart/form-data` with `file`.
- **Response:**

```ts
interface Ref { id: string, name: string }
type ImportWarning =
  | { kind: 'device-apikey-redacted', device: Ref }
  | { kind: 'webhook-token-redacted', plugin: Ref }
  | { kind: 'header-redacted', plugin: Ref, dataSource: string, header: string }
  | { kind: 'mirror-apikey-redacted', device: Ref }
  | { kind: 'field-value-redacted', plugin: Ref, keyname: string, label: string }
  | { kind: 'firmware-file-missing', firmware: { id: string, version: string } }
  | { kind: 'device-model-unknown', device: Ref, deviceModel: string }
  | { kind: 'palette-unknown', device: Ref, paletteId: string }
  | { kind: 'firmware-unknown', device: Ref, firmwareId: string }
  | { kind: 'previous-version-values-dropped', plugin: Ref }          // #1101's previous-version warning
interface ImportCheck {
  archive: { kuroshiroVersion: string, exportedAt: string, schemaVersion: number, redacted: boolean }
  adds: Record<string, number>                      // by kind, the importer's own count keys
  overwrites: Record<string, number>
  devices: { added: Ref[], overwritten: Ref[] }
  settings: { overridden: number }
  warnings: ImportWarning[]
}
```

- **Rules:** runs **the same import** as C3 inside its transaction and rolls it back at the end, so the check and the import cannot disagree. The import is already one transaction (`api/configuration/services/configuration-import.service.ts:99`), with one exception the check must skip: it writes File Screen images to disk inside that transaction (`configuration-import.service.ts:650-651`), which a rollback does not undo. Refusals as C3.

#### C3 · `POST /api/config/import` · change

- **Today:** `configuration.controller.ts:31-38` answers `ConfigurationImportSummary` (`shared/configuration.ts:1-5`) whose `warnings` are sentences (`configuration-import.service.ts:253`, `:264`, `:275`, `:330`, `:479`). `new AdmZip(buffer)` (`:83`) throws a plain error for a file that is not a zip, so the UI gets a 500. The import never hands the Poll Plugins it brought to the scheduler (nothing in `configuration-import.service.ts` calls it), so they do not fetch until a restart or a save. No size limit.
- **Serves:** Configuration Import step 4 and "Refused"; `instance.md add 3`, `change 6`, `change 7`.
- **Response:** `{ created: Record<string, number>, updated: Record<string, number>, warnings: ImportWarning[] }`.
- **Rules:** not a zip, or unreadable entries: 400 `archive-not-zip`; no manifest: 400 `archive-not-configuration`; another `schemaVersion`: 400 `archive-schema-version` with `details: { archive, expected }`; a record the database refuses: 422 `archive-record-refused` with the entity named (`configuration-import.service.ts:171-181` already labels it); over the limit: 413. After the commit, every imported Poll-kind Plugin is scheduled.

#### H1 · `GET /api/maintenance/scan` · change

- **Today:** `api/maintenance/maintenance.controller.ts:17-21`, `api/maintenance/maintenance.service.ts:37-69`: `MaintenanceIssues` (`shared/maintenance.ts:1-36`) with **absolute** paths (`maintenance.service.ts:110`, `:123`, `:140`, `:159`, `:168`) and Screens by id. An HTML Screen that has not been rendered yet is listed as a Screen whose image is missing (`maintenance.service.ts:185` excludes `plugin`, `mashup` and external links, not `html`).
- **Serves:** Housekeeping, "Stored files"; `instance.md add 8`, `change 10`, `remove` (`GET /api/maintenance/stats` goes once the check carries the totals).
- **Response:**

```ts
type StorageFinding =
  | { id: string, group: 'unusedImage' | 'tempFile' | 'oldUpload', path: string /* below the storage folder */, bytes: number }
  | { id: string, group: 'deletedDeviceFolder', path: string, bytes: number, files: number }
  | { id: string, group: 'missingImage', screen: { id: string, name: string, kind: ScreenKind, deviceId: string, deviceName: string, order: number } }
interface StorageCheck {
  checkedAt: string
  screenImages: { files: number, bytes: number }
  findings: StorageFinding[]
}
```

- **Rules:** a finding's `id` is stable across scans (derived from its group and its relative path, or its Screen's id), so the cleanup (H2) can name findings instead of paths. `html` Screens are not `missingImage`: they render on demand.

#### H2 · `POST /api/maintenance/cleanup` · change

- **Today:** `maintenance.controller.ts:23-35` takes paths and Screen ids plus `dryRun`; `maintenance.service.ts:227-266` deletes whatever it is sent, guarded only by `isPathSafe` (`:389-393`: no `..`, and the path contains `public/screens/devices` or `uploads` anywhere). A Screen is deleted with a bare `screenRepository.delete` (`:249-253`): no file cleanup, no Plugin Assignment, no gap closed.
- **Serves:** "Clean up {n} groups"; `instance.md change 9`, `remove` (`dryRun`).
- **Request:** `{ findingIds: string[] }`. **Response:** `{ removed: { files: number, folders: number, screens: number, bytes: number }, failed: Array<{ findingId: string, reason: string }> }`.
- **Rules:** the server scans again and acts only on ids present in that scan; a stale id is reported in `failed` as no longer found. A Screen goes through S6's delete. `dryRun` leaves.

#### H3 · `GET /api/maintenance/stats` · remove

`maintenance.controller.ts:37-41`. `StorageCheck.screenImages` carries the totals (`instance.md remove`). The old UI fetches it and renders it nowhere (capability inventory #88).

#### H4 · `GET /api/maintenance/retention` · keep; H5 · `POST /api/maintenance/retention/run` · keep

`maintenance.controller.ts:43-54`. H5's `dryRun` stays: "Run Retention now" first asks what a run would remove ("Counting what is old enough"). The one change is that the last Retention Run survives a restart (`instance.md change 11`); today it is a field of the service (`api/maintenance/retention.service.ts:29`). After #1062, H4's `ages` are the resolved Settings.

### 1.7 Tallies and reconciliations

| Group | add | change | remove | keep |
|---|---|---|---|---|
| Devices (D1–D10) | 2 (D2, D10) | 5 (D1, D3, D4, D8, D9) | 1 (D7) | 1 (D5) |
| Screens, Schedules (S1–S10) | 3 (S2, S3, S4) | 6 (S1, S5, S6, S7, S8, S10) | 2 (S9, S10's `GET`) | 0 |
| Mashups (M1–M4) | 0 | 2 (M1, M2) | 3 (M3's two, M4) | 0 |
| Plugin Assignments (A1–A3) | 0 | 2 (A1, A2) | 2 (A3's two) | 0 |
| Plugins (P1–P15) | 1 (P15) | 14 (P1–P14) | 1 (`POST /api/plugins/preview`) | 0 |
| Alerts (AL1–AL2) | 0 | 1 | 0 | 1 |
| Instance (I1–I2, F1–F4, DM1–DM6, C1–C3, H1–H5) | 3 (I1, DM4, C2) | 12 (F1–F4, DM1–DM3, DM5, DM6, C3, H1, H2) | 1 (H3) | 4 (I2, C1, H4, H5) |
| **Total** | **9** | **42** | **10** | **6** |

D6 is a request served without an endpoint and is not counted; R1–R8 are rendering changes, not endpoints.

Where the four request lists ask for the same thing, one entry serves them all:

- **"Adding never changes the Active Screen"** is asked by `devices.md change 1` for Screens, Mashups and assignments and again by `plugins.md change 12` for assignments. S1, M1 and A1 share one rule; `plugins.md`'s "must check that the Device exists" is folded into A1.
- **The Alert list filtered** is asked for one Device (`devices.md change 7`) and for one Plugin (`instance.md change 14`, from `plugins.md`): AL1 takes both parameters.
- **The Plugin's id on a fetch Alert** (`plugins.md add 4`) and **the cause kept after it resolves** (`instance.md add 7`) are both AL1.
- **The last scheduled render**: `plugins.md add 2` asks for its time and error, `template-editor.md add 3` adds Liquid's line. The editor's version wins because it is the superset.
- **The starter template**: `plugins.md add 5` asks for "a starter template that shows the name"; `template-editor.md` fixes the markup. The editor's markup wins: it is the binding text and it reads the name from `trmnl`, so a rename reaches the Device without editing the Template.
- **Saving keeps the firing fetch Alert** (`instance.md change 15`) is the same change as matching Data Sources by id (`plugins.md change 2`): P4.
- **The Retention ages**: `devices.md add 8` puts them among the Instance facts, `instance.md add 10` makes them Instance Settings (#1062). They live in I2 only. A value that can be changed belongs with the other Settings and their fallback sources; the facts in I1 are fixed until a restart.
- **The version**: `instance.md` puts "Kuroshiro {version}" under the Instance list as "the UI's own build version", while `instance.md add 1` asks for the server's version, which the archive page needs ("Export it again from an Instance running Kuroshiro {version}"). Both are needed; I1 carries the server's. While UI and API ship from one release they are the same number.

## 2. Cross-cutting conventions

Each is a recommendation; the reason follows it.

### 2.1 One error envelope, and status codes that mean one thing each

**Today.** `main.ts` registers no global pipe and no exception filter (`api/main.ts:27-28`), so every route brings its own `ValidationPipe` with its own options: `whitelist` and `forbidNonWhitelisted` on some (`devices.controller.ts:41`), `transform` without `whitelist` on others (`plugins.controller.ts:26`, `device-models.controller.ts:32`), `transform` and `whitelist` without `forbidNonWhitelisted` on `PATCH /api/plugins/:id` (`plugins.controller.ts:53`), and none at all on `POST /api/plugins/:id/assign` (`plugins.controller.ts:168-171`). Nest's default body is `{ statusCode, message, error }`, with `message` a string or, from `class-validator`, an array. Several endpoints answer a failure as success: `null` with 200 for an unknown Plugin (`plugins.service.ts:100-105`, `:398-399`), `{ success: false }` with 200 for a delete or unassign that found nothing (`plugins.controller.ts:84-88`, `:173-177`). The importers throw plain `Error`s, which Nest turns into 500 "Internal server error" with the reason dropped (P8–P10). The export builds its own 404 body (`plugins.controller.ts:157-159`).

**Recommendation.** Every non-2xx answer of the admin API has this body:

```ts
// shared/api/errors.ts
interface ApiError {
  statusCode: number
  code: ApiErrorCode                                // stable, kebab-case; the UI words the refusal from it
  message: string                                   // one English sentence; for logs and as a fallback
  fields?: Array<{ path: string, message: string }> // validation failures only, e.g. path 'dataSources.2.url'
  details?: Record<string, unknown>                 // structured data the UI needs, e.g. { mashups: [...] }, { limitBytes }
}
type ApiErrorCode = 'validation' | 'device-not-found' | 'device-mac-taken' | 'plugin-in-mashup' | /* … every code in section 1 */ 'internal'
```

- A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts`, whose exception factory produces `code: 'validation'` with `fields`. The per-route pipes go. `forbidNonWhitelisted` everywhere is what turns "fixed at creation" (Merge Strategy, Stream Limit, Plugin Kind, a Device's MAC) into a refusal instead of a silent drop.
- A global exception filter maps an `HttpException` to the envelope (a service throws it with its `code`), a Postgres unique violation that slipped through to 409 `conflict`, and anything else to 500 `internal` with a generic message, logged with its stack. A 500 then always means a bug.
- `ApiErrorCode` is a union in `packages/shared`, so the UI's wording table is checked for completeness at compile time.

| Status | Means | Examples |
|---|---|---|
| 400 | The request is malformed or a value is invalid | `validation`, `import-not-zip`, `template-invalid`, `order-not-a-permutation` |
| 403 | Not allowed on this Instance | `demo-mode` |
| 404 | The record in the path, or one the body names, does not exist | `device-not-found`, `plugin-not-found` |
| 409 | The request conflicts with the current state | `device-mac-taken`, `plugin-in-mashup`, `firmware-version-taken`, `recipe-changed`, `firmware-push-mirrored` |
| 413 | The upload is over its limit; `details.limitBytes` says the limit | `upload-too-large` |
| 422 | Well-formed, but what it points at cannot be used | `image-fetch-failed`, `import-no-plugin`, `recipe-oauth`, `recipe-not-found` |
| 502 | A service Kuroshiro depends on did not answer usefully | `upstream-unreachable` (TRMNL, GitHub) |
| 503 | Kuroshiro's own sidecar did not accept | `notification-failed` (Apprise) |

**Why.** The UI's shared patterns promise "the server's reason when it gave one" on every failed load and "Not saved. {reason}" on every refused save (`README.md`, "A failed load", "Saving"); the specs word dozens of refusals individually (the Recipe import table, the archive's "Refused" table, "{Plugin} cannot be deleted yet" naming Mashups). Parsing English sentences for that is the drift this rebuild is trying to end. Keeping a `message` key means the old UI's `apiRequest`, which reads `body.message` (`ui/utils/apiRequest.ts`), keeps showing something.

Success statuses: 201 with the read for a create, 204 with no body for a delete, 200 with the read otherwise.

### 2.2 Read models, not entities; derived fields beside stored ones

- An admin endpoint answers a read model from `packages/shared` (section 3), built by one mapping function per resource in the API, never a TypeORM entity. Today every Device, Screen and Plugin read is the entity (D1, S7, P1), which is how API keys reach the Plugins list.
- **Names.** `camelCase`. Times end in `At` and are ISO 8601 strings (`lastSeenAt`, `renderedAt`, `payloadReceivedAt`). Booleans read as statements (`isMirrored`, `filePresent`, `needsValues`, `fetchAlertFiring`). Derived fields sit beside stored ones with no marker: no `_` prefix, as today's `_hasTransform` (`plugins.controller.ts:150`) and `_devicePluginId` (`api/plugins/entities/plugin.entity.ts:88-92`) have. A stored column that the glossary names differently is renamed on the read (`filename` → `name`, `description` → `helpText` on a Plugin Field, `fwVersion` → `firmwareVersion`), so the UI speaks `CONTEXT.md`.
- **Absent is `null`.** Every key is always present; "nothing" is `null`, never a missing key, so a fixture builder has to decide every field. The one exception is `AlertSummary`, which is already shared and read by the old UI (AL1).
- **Related records are references.** A related record appears as `{ id, name }` (plus what the screen needs, like `pushPending`), never whole.

### 2.3 Secrets

| Secret | Where it may appear | Everywhere else |
|---|---|---|
| Device `apikey` | `DeviceDetail` only (D2): Settings reveals and copies it; the Device Simulator polls with it | absent |
| `mirrorApikey` | never | `mirror.apikeySet: boolean` |
| Webhook Token | `PluginDetail.webhook` (P2, P12): the page reveals and copies the URL | absent from `PluginSummary` |
| Password Field Value | never (#1101) | `{ secret: true, set: boolean }`; dots in preview data (P15) |
| `KUROSHIRO_APPRISE_KEY`, user and password in the Apprise URL | never | stripped (I1) |

Data Source headers are returned on `PluginDetail` as written, because the page edits them; the spec steers secrets into password Field Values instead (`plugins.md`, Data Sources, Headers hint).

### 2.4 Lists are whole; Device Logs page by cursor

Every list endpoint answers the whole list, as the specs ask ("The list is whole at any length" for Devices and Plugins; the Plugins list's search filters by name in the browser). The one paged read is D8: keyset pagination by `(date, id)` with an opaque cursor, `limit` 50 by default and at most 200, the level filter and the search applied in SQL, and the counts `total` and `matching` on every page. Keyset rather than offset because new entries arrive at the top while the admin pages down, which would shift an offset page by the number that arrived.

### 2.5 "Save as changed": partial PATCH, full answer

- A `PATCH` body carries only the fields that changed. A key that is absent leaves its field alone; `null` clears a nullable field. Today `class-transformer` gives every declared DTO field an own `undefined` property, which `plugins.service.ts:436-444` has to strip by hand; the global pipe should set `transformOptions: { exposeUnsetFields: false }` so no service needs to.
- Every `PATCH` answers 200 with the **whole** read model as saved (`DeviceDetail`, `ScreenRead`, `PluginDetail`, `PaletteRead`, `InstanceSettingsResponse`). `PATCH /api/settings` already does (`api/settings/instance-settings.service.ts:89-101`). The UI replaces its copy with the answer, so a value the server normalised (an upper-cased MAC, a Palette reset by a model change, `devices.service.ts:72-73`, `:85-86`) shows at once, and "Saved" means what it says.
- Collections inside the Plugin form are whole sets, matched by `id` (Data Sources), keyname (Plugin Fields, #1101) or size (Templates). Concurrent edits are last-write-wins; one admin per Instance does not justify ETags.

### 2.6 Instance facts, demo mode and time

- The Instance address, the server's timezone, demo mode, the version, whether Notifications are set up and the upload limits come from one read, I1, loaded with the app shell. The UI never infers any of them, retiring the hostname guess (`ui/composeables/useDemoInfo.ts:4`).
- Demo mode is enforced by the server (403 `demo-mode`) and told to the UI; the UI's disabled controls are a courtesy.
- **Time.** Instants are ISO strings the browser shows in its own timezone, as `README.md` ("Time") asks. A Schedule's and Sleep Mode's hours are server-timezone wall-clock values and stay `HH:MM` (and dates `YYYY-MM-DD`), shown with I1's `timezone`. Anything the server works out in its own timezone (Screen State, `upNext`, `sleep.inWindow`, `sleep.endsAt`, `nextPollAt`) is computed on the server and sent as a state or an instant, so the browser never evaluates a Schedule.

### 2.7 Image addresses are root-relative

Admin reads give an image as a root-relative path with a cache-busting version (`/screens/devices/{deviceId}/{screenId}.png?v={ms}`), which the UI prefixes with its base path (`ui/utils/basePath.ts`). Today the Device-facing answers build absolute URLs from `KUROSHIRO_API_URL` (`display.service.ts:612-614`, `api/device-models/fallback-screens.service.ts:33`), which is right for a Device and wrong for a browser that reaches the admin UI under another address or a Home Assistant ingress prefix (`api/middleware/ingress-base-path.middleware.ts`). The Device-facing answers keep their absolute URLs.

### 2.8 Upload limits are set and stated

Only Firmware uploads have a limit today (`firmware.controller.ts:36`, 8 MB). Image uploads (`screens.controller.ts:33`), Plugin imports (`plugins.controller.ts:91-101`) and archives (`configuration.controller.ts:32`) have none, and a Webhook POST falls under the JSON body parser's default, which nothing configures. **Recommendation:** an explicit limit on each, answered with 413 `upload-too-large` and `details.limitBytes`, and listed in I1 so the UI can state it before the upload ("Drop a .bin here, up to 8 MB.").

## 3. Response types: where they live and how `packages/ui-next` imports them

### What there is today

- **The API's DTOs are `class-validator` classes** for request bodies only (`api/devices/dto/update-device.dto.ts`, `api/plugins/dto/create-plugin.dto.ts`, …). Responses are mostly TypeORM entities returned as they are (`devices.controller.ts:36`, `screens.controller.ts:27`, `plugins.controller.ts:32-38`, `firmware.controller.ts:19`, `device-models.controller.ts:22`).
- **There is no OpenAPI.** `packages/api/package.json` has no `@nestjs/swagger`; nothing generates a schema.
- **`packages/shared` already holds some response types**, contrary to the test-strategy ticket's premise: `AlertsList` and `AlertSummary` (`shared/alerts.ts:12-28`), `InstanceSettingsResponse` (`shared/instance-settings.ts:40`), `ConfigurationImportSummary` (`shared/configuration.ts:1-5`), `MaintenanceIssues`, `CleanupResult`, `RetentionStatus` (`shared/maintenance.ts`), `DeviceModelSyncResult` and `FirmwareSyncResult` (`shared/sync.ts`), `SensorReading` (`shared/sensor.ts:4-8`). For those, the controllers are already typed against the shared type (`alerts.controller.ts:14`, `settings.controller.ts:11`, `maintenance.controller.ts:18`), and the services build plain objects with ISO strings. ADR-0020 allowed exactly these because they were byte-identical on both sides; it kept `Device`, `Screen`, `DeviceModel` and `Palette` out because the entity (with `Date`s) and the wire shape (with strings) differ, and it named the alternative this ticket now needs: "Make `packages/shared` the full wire contract, with a serialize layer translating entities to it … Worth revisiting if the wire-type surface grows enough to be worth the machinery."
- **The plumbing exists.** `kuroshiro-shared` is a source-only package with one barrel (`packages/shared/package.json:6-9`), a `devDependency` of both API and UI (`packages/api/package.json:61`, `packages/ui/package.json:43`), inlined into the API's bundle (`packages/api/tsup.config.ts`, `noExternal`) and bundled by Vite into the UI. Entities and migrations may only `import type` from it, enforced by lint (`packages/api/eslint.config.mjs:28-34`).

### The options

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **A. Hand-written wire types in `packages/shared`, the API typed against them** | Every read model and request input of section 1 is a plain TypeScript interface in `packages/shared`. The API builds each read with one mapping function per resource (entity in, read model out) and types its controller methods with it. Request DTO classes `implements` the shared input interface. | A mapping layer of about fifteen functions with tests, and `Date` → ISO string by hand. Two descriptions of each request shape (the shared interface and the decorated DTO class), kept in step by `implements`, which catches a missing or mistyped property but not a decorator that disagrees with the type. The guarantee is compile-time only: an `as` cast in a controller defeats it. | **Chosen** |
| B. Generate types from an OpenAPI document | Add `@nestjs/swagger`, describe every response as a decorated class (Nest cannot see interface return types), emit the document, generate TypeScript with `openapi-typescript` into the UI. | A new dependency and its CLI plugin; response classes in the API anyway; a generation step whose output must be committed or built before the UI type-checks; generated names (`components['schemas']['DeviceDetail']`) wrapped by hand to be usable. Buys a published API description nobody has asked for. | Rejected: more machinery than A for the same compile-time guarantee. |
| C. The UI imports types from `packages/api/src` | Point `packages/ui-next` at the API's DTO and entity files. | The UI's compiler would load TypeORM and `class-validator` types; entities carry `Date` where the wire carries strings, the exact divergence ADR-0020 refused to paper over. | Rejected. |
| D. Runtime schemas (for example zod) in `packages/shared` | One schema per shape gives the type and the validation. | Replaces `class-validator` across every DTO, a rewrite far beyond this ticket; a new runtime dependency inside `packages/shared`. Its advantage, runtime validation of answers, only matters for test fixtures, where A's types already reach. | Rejected for now. |

### The decision (recommendation)

**Option A.** Concretely:

- **Files.** `packages/shared/src/api/` gets one file per resource group (`devices.ts`, `screens.ts`, `plugins.ts`, `alerts.ts`, `instance.ts`, `firmware.ts`, `device-models.ts`, `configuration.ts`, `maintenance.ts`, `errors.ts`), re-exported from the existing barrel `src/index.ts`; no subpath exports, as ADR-0020 set. The types already in `shared/alerts.ts`, `shared/maintenance.ts` and `shared/sync.ts` are reshaped or replaced there as section 1 says. Constants both sides validate against join them, as `SETTING_BOUNDS` already does (`shared/instance-settings.ts:25-29`): the refresh rate bounds (60 to 86400), the refresh interval bounds (1 to 1440), the MAC pattern, `MASHUP_LAYOUTS` (M3), the error codes.
- **The API.** Each module gets a mapper (`toDeviceDetail(device, facts)`, `toScreenRead(…)`, …), and every admin controller method declares its shared return type explicitly. The mappers are where Screen State, `currentScreen`, `nextPollAt` and the like are derived, so each derivation has one home and one unit test. Request DTOs stay `class-validator` classes and `implements` their shared input type (`class UpdateDeviceDto implements UpdateDeviceInput`).
- **`packages/ui-next`.** Declares `"kuroshiro-shared": "workspace:*"` as a `devDependency`, like the old UI, and imports with `import type { DeviceDetail } from 'kuroshiro-shared'` in its API client and in its fixture builders (`buildDeviceDetail(overrides?: Partial<DeviceDetail>): DeviceDetail`). Because every key is required and absence is `null` (section 2.2), a field added to a read type fails to compile in the builder until the builder decides it: the test strategy's fixtures cannot silently fall behind the API.
- **An ADR.** This supersedes ADR-0020's rejection of "the full wire contract": the shared package becomes the admin API's wire contract, which still satisfies its rule (one definition, used as-is by both sides) because the API no longer keeps a copy of its own. It needs a new ADR, numbered at merge (the repo has collided on ADR numbers before, #1066).
- **What it costs, said once:** the mapping layer; a second description of each request shape; discipline that controllers never return an entity (a lint rule against returning a value typed as an `@Entity` class from a controller would make that mechanical, if one is cheap to write); and one runtime dependency added to `packages/shared` by the Liquid engine move (R8, `liquidjs`). That dependency is safe for the production image only because the API itself keeps `liquidjs` as a dependency (`packages/api/package.json:39`): the bundle inlines `kuroshiro-shared` but leaves `node_modules` imports external (`packages/api/tsup.config.ts`), and `pnpm install --prod` reads only the API's manifest (ADR-0020). Both packages should take it from the workspace catalog so the browser and the server run one version.
- **The old UI** keeps its own hand-written types (`ui/types.ts`) and is not migrated.

## 4. The open calls

Each is a recommendation, not a fact.

### 4.1 Should a new Device's default `specialFunction` become `none`?

**Recommendation: no; keep `identify`.** ADR-0017 decided this on purpose: "a freshly registered Device … performs one `identify` on its next poll — a Device announcing itself once, which is harmless and arguably useful on first contact. Normalising the default to `none` would cost a migration and an `UPDATE` over existing rows to avoid a cosmetic one-time event" (`docs/adr/0017-special-function-is-one-shot-acknowledged-via-action.md:22`). The Screens view showing "identify at the next poll" for a new Device is therefore true, not a stale fact: the Device really will identify itself at its first `/display` (`display.service.ts:143-145`). Nothing in the new screens is wrong because of it, so nothing justifies overturning an ADR. If the maintainer still wants `none`, the cost is ADR-0017's: change the column default (`devices.entity.ts:67-68`) and the baseline's, and amend the ADR; existing rows can stay.

### 4.2 `targetFirmware` is not cleared after a push, though `CONTEXT.md` says it is. Which side gives?

**Recommendation: `CONTEXT.md` gives.** The code keeps the target and clears only `updateFirmware` once the binary is served (`display.service.ts:270-280`), and ADR-0014 says the same ("serves that Firmware's binary URL once and clears the flag", `docs/adr/0014-firmware-push-is-manual-and-admin-assigned.md:3`); ADR-0029's eligibility test reads only the flag. The glossary's "a Device references at most one Firmware as its target for the next push, cleared once served" is the outlier. The spec relies on the code's behaviour: a Device's Settings show the chosen target and offer "Update now" separately ("Choosing saves the target and pushes nothing"), which only makes sense if the target stays after a push. Reword the `CONTEXT.md` Firmware entry: the target stays until an admin changes it; a push of it is pending from "Update now" (or Firmware Auto-Update) until a poll serves it.

### 4.3 The Render Signal field name on the Screen read

**Recommendation: `renderSignal: 'skip' | 'hold' | null`** on `ScreenRead`, with the column of the same name that #1069 adds, and the union exported from `packages/shared` as `RenderSignal`. `null` is "no verdict". The glossary term camel-cased is what the UI already says, and #1069's brief calls it "a nullable Render Signal value". Two booleans (`skip`, `hold`) would allow both at once, which the glossary rules out ("`skip` wins when both are set"). It must not be folded into `state`: Screen State is derived and has a precedence in which a Schedule reason hides `skipping` (`devices.md`, "Which Screen State a Screen carries"), while the opened row still says "It is also skipping", so the raw verdict has to reach the UI on its own.

### 4.4 TRMNL's framework CSS and JS at "latest", by server and browser: pin, self-host or leave?

**Recommendation: leave it for the rebuild, and file a separate issue to pin it.** The URLs are one constant pair in `packages/shared` (`shared/screen-shell.ts:6-7`), used by the server's screen shell and, through R8 and the shared shell, by the browser's preview, so the preview and the Device can never load different versions of each other; the risk is only that both change together under every Screen when TRMNL publishes. That risk exists today and no endpoint in section 1 depends on it, so it is not API reshaping. Pinning means changing the constant to a versioned URL, which depends on TRMNL publishing versioned paths, not checked here (section 6). Self-hosting means shipping and syncing TRMNL's files with Kuroshiro, a new job with its own licensing question, so it is the larger change and belongs in its own triage. An Instance without the internet draws an unstyled preview, and its server-rendered images are equally unstyled today, so the preview tells the truth either way.

### 4.5 A scheduled render has no Sensors while a Device preview does: align or accept?

**Recommendation: accept for the rebuild; file the inconsistency it exposes as a separate bug.** The scheduler renders a Plugin once for every Device with `sensors` empty (`plugin-scheduler.service.ts:35-38`, by design: the cached output is shared across Screens). But the on-demand render that `/display` falls back to on a cache miss includes the polling Device's Sensors (`display.service.ts:578-579`). So today the same Screen shows Sensors after a save invalidates its cache and loses them at the next tick. Aligning the preview with the scheduler (no Sensors) would make the preview wrong for the renders that do have them; aligning the server with the preview means rendering per Screen instead of per Plugin, a change to the render cache that no screen needs. The preview's "Data" list already labels the row "{Device}'s Sensors" and `template-editor.md` says the gap in its open points. The bug to file is the server's inconsistency, decided either way: always per Device, or never.

### 4.6 `{% render %}` of anything but `"main"` fails: in scope or not?

**Recommendation: out of scope.** Making it work means giving a Plugin shared markup of its own: a new stored part of a Plugin, an editor for it, and export and archive support. That is a new capability, which the map rules out. Nothing in section 1 depends on it. The importer's inlining of `shared.liquid` for `{% render "main" %}` stays as it is. Whether such a Template is refused at save depends on whether Liquid reports it when parsing or only when rendering (section 6); P4 refuses only what fails to parse, so a Template that fails only at render is saved and its failure reaches the Plugin page through R5, which is what the editor spec draws ("The editor shows such a Template with its problem").

### 4.7 Spec requests that would be a new capability

The map rules new capabilities out of the rebuild. These requests are, strictly, something an admin cannot do today; each needs the maintainer's yes or no.

| Request | Entry | Why it is new | Recommendation |
|---|---|---|---|
| Update a custom Palette (`instance.md add 4`) | DM4 | Only create and delete exist; delete and re-create loses every Device's assignment. | **Allow.** ADR-0014 (custom Palettes) intended them to be freely editable; the cost is one endpoint and a re-conversion the PATCH of a Device already does. If declined, the form shows only "Add" and "Delete". |
| Read a Configuration Archive without importing it (`instance.md add 2`) | C2 | Today an import cannot be previewed. | **Allow.** It changes nothing and reuses the import inside its own transaction; the spec has a fallback if declined. |
| Convert an image for a preview without saving it (`devices.md add 6`) | S3 | Nothing converts without storing. | **Allow**, as part of "Edit a Screen after creation", which Primary journeys (#1078) brought into the rebuild. If declined, "Replace file" swaps at once without the side-by-side. |
| Clear a Device's target Firmware ("None" in the Target Firmware select) | D4 | A target cannot be cleared today. | **Allow only with no push pending**; clearing a pending push is #1086's cancel, untriaged. |

Not new, though they may look it: editing a Screen (sanctioned by #1078); select options on a Plugin Field and saved Field Values (#1101, `ready-for-agent`); the custom sleep image (#1064); Retention ages as Settings (#1062); building a Plugin with a name only (the API accepts it today; only the starter template is new); everything in sections 1.4 and the stored facts of 1.3 (they show what exists, they add nothing an admin can do). Not requested by any spec and so not in section 1: cancelling a pending Device Reset or Firmware push (#1086), advancing Rotation by hand (#1084), a dithered preview image (#1111).

### 4.8 Other calls the specs left to this ticket

- **A Recipe whose refresh interval is longer than 24 hours** (`plugins.md`, open points). **Recommendation:** keep the 1 to 1440 bound on P4 and send `refreshInterval` only when the admin changed it; an imported value above the bound is kept and shown as it is, and saving the rest of the Plugin does not trip over it. The scheduler of P4 runs any interval, so nothing breaks. Raising the bound is a product call no screen needs.
- **What the server reports as its timezone when `TZ` is unset** (`instance.md`). **Recommendation:** whatever the process resolves (`Intl.DateTimeFormat().resolvedOptions().timeZone`), because that is the clock the Schedules actually run on (`schedule-eligibility.ts:3-5`). Showing anything else would describe a clock nothing uses.
- **The number of colours a custom Palette's family expects** (`instance.md`). **Recommendation:** no new validation. The server accepts any non-empty list today (`custom-palettes.service.ts:50-51`); a stricter rule is a separate decision about dithering, not about these screens.
- **Size limits** for uploads, archives and Webhook POSTs (`devices.md`, `plugins.md`, `instance.md`): section 2.8.
- **When "no Screen can be shown" ends** (`devices.md`): not computed. It would mean searching every Schedule's next opening; the spec already words the state without it.
- **The error Fallback Screen's second wording** (`devices.md`, decided in #1105): the last-served record (1.1) carries `renderFailed` apart from `mirrorFailed`, which is what a second wording on the Device needs as well.
