# Building a screen of the admin UI

What every screen of `packages/ui-next` stands on: the shell, the router, the API client and the shared page patterns of [`docs/ui/README.md`](../ui/README.md#patterns-every-surface-shares). Copy from here; do not rebuild any of it in a page. How a screen is tested is in [`ui-testing.md`](./ui-testing.md).

## Where things live

| Folder of `packages/ui-next/src/` | Holds |
| --- | --- |
| `api/` | The client core (`client.ts`), the refusal wording (`refusalWording.ts`) and one file per resource group with one typed function per endpoint, named like the files of `packages/shared/src/api/` |
| `reads/` | `sharedReads.ts`: the reads made once for the whole app |
| `router/` | `routes.ts` (every route) and `index.ts` (`createAppRouter`, the scroll behaviour) |
| `shell/` | The bar, the phone's bottom tabs, the demo line, the page column |
| `patterns/` | The shared page patterns: `TitleLine`, `LoadBody`, `LoadingLine`, `WashBar`, `MissingPage`, `RelativeTime`, `UnsavedChanges`, `useLoad`, `usePolling`, `useNow`, `usePageTitle`, `useNarrowWindow`, `time.ts` |
| `pages/` | One component per route, `<Name>Page.vue`, in a folder per surface (`pages/devices/`, `pages/plugins/`, `pages/instance/`). The three pages at its top are the shell's own: the landing route, the unknown route and "not built yet" |
| `components/` | The primitives |

## A route and its page

Every route of the four route tables is already in `router/routes.ts`, pointing at the "not built yet" page. To build one, swap its line:

```ts
// before
notBuiltYet('/plugins', 'Plugins'),
// after
{ path: '/plugins', component: () => import('@/pages/plugins/PluginsListPage.vue') },
```

- Routes are lazily loaded and addressed by path (`to="/devices/42/settings"`), not by name. They are flat, except under a frame several pages share: the pages of one Device are the children of `/devices/:deviceId` (see "The Device frame") and the Instance pages the children of `/instance` (see "The Instance frame").
- **The bar needs no entry.** Its entries are the Devices, "Plugins" and "Instance"; which one is current is read off the path, so any route under `/devices/:deviceId`, `/plugins` or `/instance` is already marked. `/alerts` marks the Alert indicator.
- Never write a leading-slash URL by hand outside the router. The router knows the base path the UI is served under; `fetch` and `<img>` do not (see "Images" and "The API client").
- **A redirect that depends on data** is the page's, not the router's: `/` lands by the number of Devices (`pages/LandingPage.vue`), and the Devices list replaces itself with `/connect` when there are none, each in a `watchEffect` on the shared read.
- The router scrolls to the top on a new path, keeps the position when only the query changes (`?screen=`, `?q=`), and scrolls to the element a fragment names, below the bar, waiting up to 3 seconds for it to render.

## What a page renders

The shell gives every page the bar, the demo line, the bottom tabs and one centred column (`--column` wide). What a page renders at its root becomes a direct child of that column, so a page is a list of roots with no wrapper of its own:

```vue
<template>
  <TitleLine title="Devices">
    <template #actions>
      <Button as-child><RouterLink to="/connect">Connect a Device</RouterLink></Button>
    </template>
  </TitleLine>
  <LoadBody v-slot="{ data }" :load="devices" loading="Loading Devices" failed="Could not load the Devices.">
    …the body, from data…
  </LoadBody>
</template>
```

- **`TitleLine`**: `title` (the `h1`, and the browser tab's title as "{title} · Kuroshiro"), the `#actions` slot at its right (the primary button last), and `back` (`{ label: 'All Plugins', to: '/plugins' }`) for the link above the title. It renders at once; only the body waits.
- **`SaveBar`** must be a direct child of the column, so put it at the page's root, not inside a wrapper.
- A page sets its own vertical rhythm below the title line with the space tokens.

## The Device frame

Every page of one Device is a child route of `/devices/:deviceId`, whose component is `pages/devices/DeviceFrame.vue`. The frame loads the Device once (`GET /api/devices/:id`, kept fresh), and renders the title line with the Device's name, the "Devices" back link from five Devices on, the tabs Screens, Settings and Logs, and "No Device here" in place of all of it for a Device that does not exist. A page under it renders only its body.

To build a page under it, swap its `notBuiltYetUnderDevice('settings')` line in `router/routes.ts` for `{ path: 'settings', component: () => import('@/pages/devices/DeviceSettingsPage.vue') }`. A page under the Screens tab (`screens/new`, `screens/:screenId/html`) keeps "Screens" current by its path alone.

```ts
const { device, listed, name, path } = useDeviceFrame() // from '@/pages/devices/deviceFrame'
```

| Member | Is |
| --- | --- |
| `device` | The `useLoad` result of the `DeviceDetail`. Never fetch the Device again in a page. After a write that changes it (a setting, a Screen added or deleted, which moves `screenCount`), call `device.reload()`; after one that renames or deletes it, `useDevices().reload()` too |
| `listed` | The Device's `DeviceSummary` from the Devices list, there before the Device has loaded: the Device Model for a skeleton's plates |
| `name` | The Device's name, known from the Devices list before the Device has loaded: use it in a loading line and a notice |
| `path` | `/devices/{id}`, the Screens view, which the paths of the other pages start with. `devicePaths.ts` builds the paths of a Device's pages from its id |

- The page does not render a `TitleLine` or `MissingPage` of its own, and reads `device.data`, `device.waiting` and `device.failure` for its own loading and failed states (`LoadBody :load="device"` when the Device is all it shows). `DeviceScreensPage.vue` shows how a page with a second load joins the two.
- The frame's one title-line action is "Add Screen", on the Screens view while the Device has Screens. A page with an action of its own puts it in its body.
- A page's first root sets its own space under the tabs: `margin-top: var(--space-8)`, and `var(--space-6)` on phone.

### The Screens view's parts

`pages/devices/` holds the Screens view in parts later slices add to:

| File | Holds |
| --- | --- |
| `currentScreenStory.ts` | The pure function from the Device, its Screens and its firing Alerts to the plate's state, heading and sentences |
| `deviceFacts.ts`, `screenWording.ts`, `scheduleSummary.ts` | The fact rows; a row's Screen State words and the "why" sentences of an opened row; the Schedule summary |
| `sentence.ts`, `SentenceLine.vue` | A sentence with a name in bold, a value in mono or a link in it: `sentence('Up next: ', strong(name), '.')` |
| `ScreensInOrder.vue` | The rows, reordering and its save, `?screen=`. The Schedule switch joins `ScheduleSummary` in the row's `#schedule` slot |
| `OpenedScreen.vue` | The body of an opened row: the "why" sentences, the preview and the move actions. Its slots are where the other parts mount, filled where `ScreensInOrder.vue` renders it: `#schedule` (the Schedule editor), `#source` (what the Screen is made from), `#actionsBefore` ("Rename") and `#actionsAfter` (the destructive button) |
| `screenNaming.ts` | `screenName(name)`: a Screen saved without a name reads "Unnamed Screen" everywhere. `possessive(name)` for "{Device}'s" |

`ScreensInOrder` takes `reload`, which reads the Screens again: call it after any write to a Screen. A new Screen is opened by navigating to `{path}?screen={id}`, which also scrolls to its row.

## The Instance frame

Every Instance page is a child route of `/instance`, whose component is `pages/instance/InstanceFrame.vue`. The frame renders the title line "Instance", the page list at the left (a row of tabs that scrolls sideways on a phone, running from one edge of the window to the other), the chosen page beside it, and under the list Appearance and "Kuroshiro {version}", which move to the foot of the page on a phone. `/instance` redirects to `/instance/settings`. It loads nothing: an Instance page reads what it shows itself. A page that shows Instance facts beside a load of its own joins the two into one `Load` for `LoadBody`, so that either one's failure is the page's notice (`InstanceSettingsPage.vue`).

To build a page under it, swap its `notBuiltYetUnderInstance('firmware', 'Firmware')` line in `router/routes.ts` for

```ts
instancePage('firmware', 'Firmware', () => import('@/pages/instance/FirmwarePage.vue')),
```

That is the registration: the page list holds the `instancePage` routes, under their labels and in the order they stand in `routes.ts`, which is the spec's order. A page that is not in the list (Upload Firmware) is a plain child, `{ path: 'firmware/upload', component: … }`, and keeps "Firmware" current by its path alone.

A page under the frame renders only its body, as a list of roots:

```vue
<template>
  <InstancePageHeading title="Firmware">
    <template #actions>…buttons, the primary one last…</template>
  </InstancePageHeading>
  <div class="body">
    <LoadBody v-slot="{ data }" :load="firmware" loading="Loading the Firmware" failed="Could not load the Firmware.">
      <p class="lede">…</p>
      <InstanceSection id="available" title="Available Firmware">
        <template #aside>Checked TRMNL …</template>
        …rows…
      </InstanceSection>
    </LoadBody>
  </div>
</template>
```

| Part of `pages/instance/` | Is |
| --- | --- |
| `InstancePageHeading` | The page's heading line: its name as an `h2` at `title-sm` on the 2 px ink rule, the `#actions` slot at its right. It does not rename the browser tab, which reads "Instance" |
| `InstanceSection` | A section of a page: `title` as an `h3` at `text-lg`, weight 600, on a 1 px rule, the `#aside` slot at its right (a link, a button, a fact), and `id`, which is what a fragment names (`/instance/settings#retention`). It sets `--space-10` above itself; the first one under a lede takes `--space-8` |
| `InstanceReadRow` | A row that is read and not edited, or that holds the button of an action: `label`, the default slot, `#side` at the right and `#note` under it. It shares the Setting row's grid |
| `InstanceSettingRow` | One numeric Instance Setting (see below) |
| `instancePaths.ts` | `instancePagePath('firmware')` and the paths other pages link to |
| `@/shell/appearance.ts` | Not in this folder, because it holds for the whole app: `useAppearance()` and `applyStoredAppearance()`, which `main.ts` calls before the app mounts. The choice is `data-theme` on the root and `kuroshiro:appearance` in `localStorage`; "system" removes the attribute |

- The frame sets `--setting-label-width` to 11 rem, which `SettingRow` and `InstanceReadRow` read: the page beside the list is narrower than a whole column.
- `useNarrowWindow()` (`@/patterns/`) says whether the window is below 820 px. It is for what CSS cannot do: the frame uses it to render Appearance and the version at one place in the page's order, not two.
- A spec of an Instance page clears `localStorage`'s `kuroshiro:appearance` if it chooses a side (`InstanceFrame.spec.ts`).

### An Instance Setting

`GET` and `PATCH /api/settings` are `getInstanceSettings()` and `updateInstanceSettings(input)` in `src/api/instance.ts`. The Instance Settings page loads them with its own `useLoad`; a page that only reads a Setting (Housekeeping reads the Retention ages) does the same.

`InstanceSettingRow` is a numeric Setting as a row: `setting-key`, `setting` (the `InstanceSettingValue` as loaded), `label`, and `before` and `after`, the words of the sentence its field stands in. Its `#note` slot is handed `{ value }`, the value in force, for the sentence under the row. It does the rest:

- The field holds the value in force. A number in range is sent alone (`{ lowBatteryPercent: 15 }`) on blur or Enter; the value already in force is not sent again.
- At its side, in `SettingRow`'s `#source` slot: "Built-in default", "From `{VARIABLE}`" or "Set here · Reset to {fallback}". "Reset" sends `null`, shows the fallback at once and gives the field the focus. "Saving" and "Saved" take the source's place while they show; a failed save goes under the field and the source stays.
- A value outside `SETTING_BOUNDS`, or no whole number, is not sent: the range message of `instanceSettingWording.ts` takes the note's place until the value is in range again.
- It follows its own saves from the answer's one key, so two rows that save at once do not overwrite each other.

A boolean Setting (Firmware Auto-Update) is a `SettingRow` with a `Switch` and `useSaveAsChanged`, sending `{ firmwareAutoUpdate: true }` through the same `updateInstanceSettings`.

## A list page

`pages/devices/DevicesListPage.vue` with `DevicesListRow.vue` is the worked example of a list.

- The title line carries the list's one action as a plain button that is a link (`<Button as-child><RouterLink …>`).
- The rows are a `ul` under `LoadBody`, each row an `li` with a `--rule` under it and the list a `--rule` above. The `#skeleton` slot holds three rows of the same grid with a `rendering` `Plate` and two `WashBar`s, and is `aria-hidden`.
- **A row that is one link**: the name is the link (in a heading, so the list can be walked by headings) and its `::after` covers the row, which makes the whole row the hit area while the link's accessible name stays the name alone. Anything in the row that must answer the pointer itself (a `RelativeTime`'s tooltip) is `position: relative`, which puts it above that cover.
- The mark that says "this leads on" is an inline `svg` drawn pointing right. Do not turn the chevron icon with `rotate`: a rotated mark makes the baselines flaky.
- A list has no empty state of its own when its spec sends "none" elsewhere (the Devices list redirects); otherwise the `EmptyState` goes in the default slot.
- A line of facts joined by " · " writes the separators into the template (`v-for` with `index > 0`), not into CSS `content`, so a spec and a screen reader read them.
- A firing Alert in a row is the only red: the label with its square, as `FactRows` draws it. `devicesListRow.ts` words the two Device Alerts ("Alert: offline", "Alert: battery low").
- What a Device shows comes from `currentScreenStory`, which takes a `DeviceSummary` (pass `screens: []` when the Screens are not loaded): its `heading` names the plate (`On {Device}: {heading}`) and `whatItShows(story)` words the line.

## Waiting for something to happen

Connect a Device asks for the Devices every 3 seconds: `usePolling(ask, everyMs)` takes the interval, asks only while the tab is visible, and stops with the page. `devicesCallingIn.ts` shows the two things to copy: it does not ask again while an answer is still out (a later `reload()` drops an earlier one's answer), and it remembers what was there when the page opened to tell what is new.

A write that adds a record and then leaves the page navigates first and reloads the shared read afterwards (`RegisterByHand.vue`), so the page it leaves does not see the new record.

## Loading what a page shows

```ts
const route = useRoute()
const device = useLoad(() => getDevice(String(route.params.deviceId)), {
  key: () => route.params.deviceId, // loads anew when it changes
  fresh: true,                      // only for a view that shows what a Device is doing
})
```

`useLoad(fetcher, options?)` returns a reactive object. Do not destructure it.

| Member | Is |
| --- | --- |
| `data` | What the last load that worked answered, or `undefined`. It stays through a refresh and under a later failure |
| `waiting` | `true` once there is no data and the answer has taken over 300 ms |
| `failure` | `{ reason, unreachable }` or `undefined`. `reason` is the sentence to show |
| `missing` | The server answered 404: the record does not exist |
| `reload()` | "Try again", and what to call after a write that changes what was loaded |

It does by itself: nothing for 300 ms; a retry every 10 seconds while the server cannot be reached; with `fresh`, a silent reload every 30 seconds while the tab is visible and at once when the window regains the focus. An answer identical to the one held keeps the same object, so nothing renders again. A silent reload that arrives while a typed-in control (an input, a textarea, a select, a combobox) has the focus is held back and swapped in when the focus leaves such controls.

**`LoadBody`** turns that into the three states. Props: `load`, `loading` (the loading line, "Loading Devices"), `failed` (what could not be loaded, as a sentence). Slots: the default one gets `{ data }` and renders the body; `#skeleton` is the body's real structure with nothing in it (`Plate` with `rendering`, `WashBar` with a `width` where text will be), shown under the loading line. A failure is the `Notice` above the body with the reason and "Try again"; earlier data stays under it.

- **Empty** is the page's own: inside the default slot, `<EmptyState v-if="data.length === 0" …>`.
- **A record that does not exist** replaces the whole page, title line included:

```vue
<MissingPage v-if="device.missing" title="No Device here" :back="{ label: 'All Devices', to: '/devices' }">
  It may have been deleted.
</MissingPage>
<template v-else>…the title line and the body…</template>
```

- A page that needs something other than `LoadBody`'s layout reads `waiting`, `failure` and `data` itself and uses `LoadingLine` (one per view) and `Notice`. `LoadingLine` is a live region: mount it before it has anything to say and give it `:shown="load.waiting"`.
- A key that becomes `undefined` (the route has left the page) loads nothing.

### The shared reads

Already loaded for every page; never fetch these again. Each is a `useLoad` result.

| Call | Gives |
| --- | --- |
| `useInstanceFacts()` | `InstanceFacts`: version, server address, timezone, demo mode, Notifications, upload limits. Loaded once |
| `useDevices()` | Every `DeviceSummary`, by name whatever its case. Kept fresh |
| `useAlerts()` | The Instance's `AlertsList`; `data.active` are the firing ones. Kept fresh |
| `useServerTimezone()` | The name of the server's timezone ("Europe/Berlin"), or `undefined` until the facts are loaded |

After a write that renames, adds or deletes a Device, call `useDevices().reload()` so the bar follows. Demo mode is `useInstanceFacts().data?.demoMode`, never guessed from the address.

## The API client

One typed function per endpoint, in `src/api/<group>.ts`, added by the slice that first calls it:

```ts
// src/api/devices.ts
export function getDevice(deviceId: string) {
  return apiGet<DeviceDetail>(`devices/${deviceId}`)
}
export function updateDevice(deviceId: string, input: UpdateDeviceInput) {
  return apiSend<DeviceDetail>('PATCH', `devices/${deviceId}`, input)
}
```

`src/api/devices.ts` has `listDevices`, `getDevice`, `createDevice` (refused with `device-mac-taken`) and `updateDevice`. `src/api/instance.ts` has `getInstanceFacts`, `getInstanceSettings` and `updateInstanceSettings`; `src/api/alerts.ts` has `listAlerts` and `sendTestNotification` (refused with `notifications-off` or `notification-failed`).

- `apiGet<T>(path, query?)` and `apiSend<T>(method, path, body?)` from `@/api/client`. The path has no leading slash and no `api/`. `body` is a shared `…Input` type, sent as JSON, or a `FormData` for an upload. A 204 answers `undefined`.
- Types come from `kuroshiro-shared`. Send only what the `…Input` type declares: the server refuses undeclared keys, so a read model sent back as a write is refused.
- A page calls these functions and never `fetch`.

### Failures and their wording

A call rejects with one of two `Error`s, and the `message` of either is the sentence the admin reads:

| Error | When | `message` |
| --- | --- | --- |
| `ApiRefusal` | The server answered with its error envelope | Worded from the refusal's `code` by the table in `src/api/refusalWording.ts` |
| `ServerUnreachable` | The network failed, or something else answered in the server's place | "Kuroshiro's server is not answering." |

So a save handed to `useSaveAsChanged`, a `Confirmation`'s `action`, a `SettingRow` or an `InlineEdit` is just the API function: what it rejects with is already worded.

```ts
const nameSave = useSaveAsChanged(name => updateDevice(deviceId, { name }).then(device => device.name), name)
```

- `REFUSAL_WORDING` is typed `Record<ApiErrorCode, …>`: a code added to `API_ERROR_CODES` fails type-check until it is worded there. The slice that adds a code adds its general wording.
- **A refusal that `docs/ui/` words more exactly for one place** is caught there: `isRefusal(error, 'firmware-version-taken')` narrows to `ApiRefusal`, which carries `code`, `statusCode`, `details` and `fields`.
- **Validation**: `fieldErrorsOf(error)` gives `{ [path]: message }` for a `validation` refusal (and `{}` for anything else), to hand each `Field` its `error`. The browser checks first; the server's messages are a fallback.
- `isUnreachable(error)` tells the second kind.

## Images

A read model gives an image as a root-relative path with its version (`/screens/devices/…png?v=…`). `Plate` takes `src` as given, so resolve it first:

```vue
<Plate :src="imageUrl(device.currentScreen.imagePath)" :name="…" />
```

`imageUrl` is in `@/api/client` and prefixes the base path the UI is served under.

## Time

- **`<RelativeTime :at="device.lastSeenAt" />`** for an instant of a read model (an ISO string): "4 min ago" with the exact time as its tooltip within the last day, "1 Oct 2026, 07:31" when older, in the browser's timezone. It moves on by itself. Guard a `null` yourself ("Has not called in yet").
- `clockTime(date)` gives the `{hh:mm}` of a sentence ("the 07:31 poll"); `exactTime(date)` and `relativeTime(date, now)` are the two wordings as functions; `useNow()` is the clock they follow. All in `@/patterns/`.
- A Schedule's and Sleep Mode's hours are the server's wall clock and are shown as the server sent them, with `useServerTimezone()` naming the zone.

## A form with unsaved changes

A view with a primary button and "Cancel" renders the guard once, anywhere in its template:

```vue
<UnsavedChanges :when="changed">
  <template #lost>Your changes to {{ plugin.name }}'s template.</template>
</UnsavedChanges>
```

While `when` is true, a route change opens "Leave without saving?" with "Keep editing" (focused) and "Leave", and the browser asks before the page is unloaded. After a save, let `when` turn false and `await nextTick()` before navigating away, so the guard has seen it.

## Tests of a page

See [`ui-testing.md`](./ui-testing.md): `mountApp({ at })` with `fakeShellReads()`, `freezeTime()`, the fixture builders and `expectPageScreenshots`.
