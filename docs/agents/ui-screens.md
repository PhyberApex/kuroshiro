# Building a screen of the admin UI

What every screen of `packages/ui-next` stands on: the shell, the router, the API client and the shared page patterns of [`docs/ui/README.md`](../ui/README.md#patterns-every-surface-shares). Copy from here; do not rebuild any of it in a page. How a screen is tested is in [`ui-testing.md`](./ui-testing.md).

## Where things live

| Folder of `packages/ui-next/src/` | Holds |
| --- | --- |
| `api/` | The client core (`client.ts`), the refusal wording (`refusalWording.ts`) and one file per resource group with one typed function per endpoint, named like the files of `packages/shared/src/api/` |
| `reads/` | `sharedReads.ts`: the reads made once for the whole app |
| `router/` | `routes.ts` (every route) and `index.ts` (`createAppRouter`, the scroll behaviour) |
| `shell/` | The bar, the phone's bottom tabs, the demo line, the page column |
| `patterns/` | The shared page patterns: `TitleLine`, `BackLink`, `LoadBody`, `LoadingLine`, `WashBar`, `MissingPage`, `RelativeTime`, `UnsavedChanges`, `PageSection`, `ReadRow`, `ChoiceBesideForm`, `AddFormFoot`, `useLoad`, `usePolling`, `useNow`, `usePageTitle`, `useNarrowWindow`, `time.ts` |
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
| `ScreensInOrder.vue` | The rows, reordering and its save, `?screen=`. The row's `#schedule` slot holds `RowSchedule`: `ScheduleSwitch` around `ScheduleSummary`, or the summary alone for a Screen without a Schedule |
| `OpenedScreen.vue` | The body of an opened row: the "why" sentences, the preview and the move actions. Its slots are where the other parts mount, filled where `ScreensInOrder.vue` renders it: `#schedule` (the Schedule editor), `#source` (what the Screen is made from), `#actionsBefore` ("Rename") and `#actionsAfter` (the destructive button). The Schedule stands beside the source and its actions, and above them where the two do not fit side by side |
| `ScheduleEditor.vue` | What fills `#schedule`: "Add a Schedule" for a Screen without one, otherwise the heading with `ScheduleSwitch`, `ScheduleControls` (the weekdays, `ScheduleHours`, `ScheduleDates`, the timezone line and the one save state they share) and `ScheduleRemoval` |
| `ScheduleSwitch.vue` | The Schedule's switch with its own save state, on the row and in the editor's heading. Each of the two follows what the other saved |
| `scheduleEditing.ts` | The pure rules of the editor: no stored weekday means every day, what a pair of times or dates sends (`changedOfPair`: only the ends that changed, and nothing while one is empty), today in the server's timezone (`dateInZone`), the timezone line |
| `screenNaming.ts` | `screenName(name)`: a Screen saved without a name reads "Unnamed Screen" everywhere. `screenNameProblem(name)` is "A Screen needs a name." `possessive(name)` for "{Device}'s" |
| `ScreenSource.vue` | What fills `#source`: the kind as a heading over one component per kind, `PluginScreenSource`, `MashupScreenSource`, `FileScreenSource`, `ExternalScreenSource` and `HtmlScreenSource`. It emits `rerendering` when a write leaves the Screen's image behind (a Slot Change), on which the preview shows the rendering plate until `renderedAt` moves |
| `ScreenRename.vue`, `ScreenRemoval.vue` | "Rename" as the `InlineEdit` in the row's `#rename` slot, and "Delete Screen" or "Unassign Plugin" with its confirmation, which emits `removed` |
| `mashupLayouts.ts` | `MASHUP_LAYOUT_CHOICES`: the seven layouts with the names and slot names of [devices.md](../ui/devices.md#by-kind), built from `MASHUP_LAYOUTS` and ready for `LayoutPicker`. `layoutChoice(id)`, `placedIn` for a Plugin put in a slot, and `carriedOver` and `withoutSlot` for a change of layout |
| `MashupSlots.vue`, `MashupLayoutChange.vue` | One select per slot, a Plugin in another slot disabled (`slotNames`, `pluginIds` with `null` for an empty slot, `plugins`; emits `change`), and the layout form built on it |
| `ReplaceFile.vue` | The drop zone, the preview beside the current image and "Replace image" |
| `InPlaceForm.vue` | The frame of a small form that opens in place of what it changes, named by its `title`, with the `#buttons` slot for its row of buttons, the primary one first |
| `screenSourceWording.ts` | The pure wording: a File's facts line, `rendersFor(device)` ("{Device Model}, {Palette}"), the Plugin sentence, what a removal loses and keeps by kind, `isWebAddress`, the line of a Plugin without a slot |
| `fetchChoices.ts`, `imageFiles.ts` | What an opened Screen and Add Screen both offer: the two fetch choices of an External link with their lines, and the endings and names of the six image formats for a `FileDrop` |

`ScreensInOrder` takes `reload`, which reads the Screens again: call it after any write to a Screen. A write that adds or removes a Screen also calls `useDeviceFrame().device.reload()`, because the Device counts its Screens. A form that opens in place gives the focus to its first control when it opens and back to the button that opened it when it closes. A new Screen is opened by navigating to `{path}?screen={id}`, which also scrolls to its row.

### Add Screen

`/devices/:deviceId/screens/new` is one page for every kind of Screen ([devices.md, "Add Screen"](../ui/devices.md#add-screen)), built like Add a Plugin: the kinds as a radio row and the chosen kind's form beside it. `?kind=plugin|mashup|link|file|html` names the kind; one the page does not know, or the File kind in demo mode, falls back to the first.

| File | Holds |
| --- | --- |
| `AddScreenPage.vue` | The route's component: the back link, the heading, the radio row and the chosen kind's form, which it hands the `device` once the frame has loaded it |
| `addScreenKinds.ts` | `ADD_SCREEN_KINDS`, the kinds in the radio row's order. **A kind is one entry here and one form component** |
| `addScreen.ts` | The page's pure parts, with a node spec: the kinds as they are offered, a Plugin as a choice, the search, which Plugin is checked, a File Screen's name from its file |
| `addScreenForm.ts` | `useAddScreen(fields?, notAdded?)`: `create(request, found?, refusedAt?)` sends nothing while `found` holds a problem at one of `fields`, runs the request and, once the Screen exists, opens the Screens view at `?screen={id}` and reads the Device again. `problems` goes to the fields (the browser's, then the server's by `fieldErrorsOf`, then what `refusedAt(error)` words for one field); `running`, `added` and `failure` go to the foot |
| `AddScreenFoot.vue` | How every kind's form ends: the primary button (`button`, `running`, `disabled`), "Cancel", the failure, the "Joins the end of the Order" line and "Leave without saving?" while `changed` |
| `AddPluginScreen.vue`, `NoPluginToAssign.vue`, `AddMashupScreen.vue`, `AddExternalScreen.vue`, `AddFileScreen.vue`, `AddHtmlScreen.vue` | One form per kind |
| `ScreenNameField.vue` | "Name", as every kind but Plugin has it |
| `HtmlPreview.vue`, `htmlPreview.ts` | The live preview of an HTML Screen, which Edit HTML shows too: `device`, `html` and `name` in, and it reads the Device Models and Palettes itself, wraps the markup in the screen shell the server renders with (`htmlScreenDocument`) and draws it in a `PreviewPlate` 200 ms after the typing pauses |

- `src/api/screens.ts` has `createScreen` (External link and HTML), `createFileScreen` (multipart), `createMashup` and `assignPlugin`. Each answers the new `ScreenRead`, which is last in the Order and never the Active Screen.
- The forms are kept alive, so what was entered for one kind is still there after a look at another. Only the form in view asks "Leave without saving?".
- Which Plugins are already on the Device is read off `PluginSummary.devices`, so the page does not read the Screens.
- The shortcut to a new Plugin is `addPluginPath(way, deviceId)`, which carries the Device to Add a Plugin.
- The preview's frame loads TRMNL's framework from `usetrmnl.com`, so a spec asserts the frame's `srcdoc` and no shot holds the HTML kind.
- The page's two columns are `ChoiceBesideForm` (`#choice` and the default slot) and a form's foot is `AddFormFoot`, both in `@/patterns/` and shared with Add a Plugin. `BackLink` is the link back of a `TitleLine`, for a page under a frame that has the title line.

### The Logs page

`DeviceLogsPage.vue` is the Logs tab, in parts: the page holds the address (`?level=problems&q=…`) and the confirmation, `deviceLog.ts` the Device Log itself, `deviceLogWording.ts` every word of it, and `DeviceLogBar`, `DeviceLogEntries`, `DeviceLogEntryRow`, `DeviceLogFoot` and `DeviceLogLoading` draw.

- **It is the one list that is not whole and not `fresh`.** `useDeviceLog(deviceId, filter)` loads the first 50 with `useLoad`, keyed by the Device, the filter and the search, appends older pages by `nextCursor`, and counts what arrived since with `listDeviceLogs(id, { after: newestCursor, limit: 0 })` every 30 seconds and on focus (`usePolling`). New entries join the list only when asked for, except into an empty Device Log.
- An answer that lands after the filter, the search or the first page has changed is dropped: copy the `firstPages` counter for any read made beside a `useLoad`.
- The search field holds what is typed; the address holds what is searched for, 300 ms after typing stops and from `DEVICE_LOG_SEARCH_MIN_LENGTH` characters on.
- `RETENTION_PATH` (`pages/instance/instancePaths.ts`) is where the Retention ages are set; the age itself is `getInstanceSettings()`'s `deviceLogRetentionDays.value`, where 0 is Retention not pruning.

### The Settings page

`DeviceSettingsPage.vue` is the Settings tab: the Device from the frame joined with one read of its own (the Device Models, the Palettes, the Firmware library and whether Firmware Auto-Update is on), and one component per section, each a `PageSection` with `rows` or a `TuckedSection`. `SETTINGS_SECTIONS` (`deviceSettings.ts`) holds the fragment each answers to: `#display`, `#sleep-mode`, `#firmware`, `#mirroring`, `#identity`, `#special-functions`, `#reset`.

- **A row that saves as changed** is `useDeviceSetting(saved, toInput)` (`useDeviceSetting.ts`): `entered` is what the control holds and follows `saved`, the value on the Device, except while its own save is under way or has failed; `commit()` sends what `toInput(entered)` answers and nothing when that is `undefined` (unchanged, or not valid); `choose(value)` holds a value and commits it, for a control that saves on change. Its `status`, `reason` and `retry` go to the `SettingRow`.
- **A write without a value** ("Update now", "Trigger") is `useDeviceWrite()`: `send(input)` with the same state. Both send only the fields they are given, read the Device again once the server has them, and the Devices too after a rename.
- `deviceSettings.ts` holds the pure rules, with a node spec: the refresh rate in a number and a unit, Sleep Mode's hours as seconds of day (`secondsOfDay`, the one place), which Device Models, Palettes and Firmware a select offers, and what the three Mirroring rows send (`mirroringInput`).
- `__test__/deviceSettingsHarness.ts` fakes it all for a spec: `fakeKitchenSettings({ device, models, palettes, firmware, settings })` answers the reads and changes the Device on every write as the server would, keeping each body in `writes`; `mountSettings(fragment?)`, `rowOf`, `noteOf`, `sideOf`, `stateOf`, `choose` and `offeredBy` read and drive the rows.
- `src/api/device-models.ts` has `listDeviceModels` and `listPalettes`, `src/api/firmware.ts` has `listFirmware`; their fixture builders are `buildDeviceModel`, `buildPalette` and `buildFirmware`.

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
| `ReadRow` (`@/patterns/`) | A row that is read and not edited, or that holds the button of an action: `label`, the default slot, `#side` at the right and `#note` under it. It shares the Setting row's grid, and Device Settings uses it too |
| `InstanceSettingRow` | One numeric Instance Setting (see below) |
| `instancePaths.ts` | `instancePagePath('firmware')` and the paths other pages link to |
| `@/shell/appearance.ts` | Not in this folder, because it holds for the whole app: `useAppearance()` and `applyStoredAppearance()`, which `main.ts` calls before the app mounts. The choice is `data-theme` on the root and `kuroshiro:appearance` in `localStorage`; "system" removes the attribute |

- The frame sets `--setting-label-width` to 11 rem, which `SettingRow` and `ReadRow` read: the page beside the list is narrower than a whole column.
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
- A firing Alert in a row is the only red: the label with its square, as `FactRows` draws it. `devicesListRow.ts` words the two Device Alerts ("Alert: offline", "Alert: battery low") from `FIRING_ALERT_LABELS`.
- What a Device shows comes from `currentScreenStory`, which takes a `DeviceSummary` (pass `screens: []` when the Screens are not loaded): its `heading` names the plate (`On {Device}: {heading}`) and `whatItShows(story)` words the line.

## Waiting for something to happen

Connect a Device asks for the Devices every 3 seconds: `usePolling(ask, everyMs)` takes the interval, asks only while the tab is visible, and stops with the page. `devicesCallingIn.ts` shows the two things to copy: it does not ask again while an answer is still out (a later `reload()` drops an earlier one's answer), and it remembers what was there when the page opened to tell what is new.

A write that adds a record and then leaves the page navigates first and reloads the shared read afterwards (`RegisterByHand.vue`), so the page it leaves does not see the new record.

## The Plugins surface

`pages/plugins/` holds the Plugins list and what the other Plugin pages build on:

| File | Holds |
| --- | --- |
| `pluginPaths.ts` | `PLUGINS_PATH`, `pluginPath(id)` and `addPluginPath(way, deviceId?)` (`/plugins/new?way=poll`, with `&device=` for a Plugin that is assigned once it exists) |
| `pluginArrival.ts` | `PluginArrival`, what just happened to a Plugin (`created`, `duplicated`, `imported`, `applied`, `skipped`, each with an optional `device` it was assigned to). A page that opens a Plugin's page after an action calls `openPluginPage(router, pluginId, arrival)`; the Plugin page calls `takePluginArrival(pluginId)` once and words it as a line shown once. It is held in memory, so a reload shows no line |
| `pluginActions.ts` | `useDuplicatePlugin()` (`duplicate(plugin)`, `duplicating`, `failure`; opens the copy's page carrying `duplicated`) and `useExportPlugin()` (`download(plugin)`, and `exported`, the Plugin whose control reads "Exported" for 2 seconds) |
| `PluginDeletion.vue` | "Delete Plugin": mount it with a `DeletablePlugin` (`v-if`), and it is open. It asks, or says why a Plugin in a Mashup cannot be deleted yet, also when the server refuses with `plugin-in-mashup`. It emits `deleted`, then `closed`, on which the caller unmounts it |
| `pluginWording.ts` | `listed(names)` ("Kitchen, Hallway and Study") and the sentences of the two dialogs |
| `pluginRows.ts` | A row's kind, where it shows and its state with their precedence; the search, the filter and the count line |
| `PluginsListPage.vue`, `PluginsFilterBar.vue`, `PluginRows.vue`, `PluginRowStateCell.vue`, `NoPluginsYet.vue` | The list in parts: the page holds the load, the address and the actions; the others draw |
| `PluginPage.vue`, `PluginFrame.vue`, `PluginOpened.vue`, `pluginForm.ts`, `pluginPage.ts` | The Plugin page, its frame and its one form: see "The Plugin page" below |
| `AddPluginPage.vue`, `addPluginWays.ts`, `AddPluginFoot.vue` | Add a Plugin and its ways: see "Add a Plugin" below |

- `GET /api/plugins` comes ordered by name; the list does not sort again.
- A row's fetch Alert is `PluginSummary.fetchAlertFiring`; the list does not read the Alerts.
- The shell's shared reads hold no Plugin, so after a write only the page's own load needs `reload()`.
- A view's search and filter live in the address: read them from `route.query` and write them with `router.replace`, which keeps the scroll position.

### The Plugin page

`/plugins/:pluginId` is one page with one form ([plugins.md, "What is saved together"](../ui/plugins.md#what-is-saved-together)). The frame is built; each section is one component that a later slice adds.

| File | Holds |
| --- | --- |
| `PluginPage.vue` | The route's component, and nothing but the list of sections in the spec's order, inside `PluginFrame`. A comment marks the place of each section that has not landed |
| `PluginFrame.vue` | The load (kept fresh), "No Plugin here", the title line, loading (`PluginLoading.vue`) and failed. It is keyed by the Plugin's id, so another Plugin starts a new page |
| `PluginOpened.vue` | The page once the Plugin is there: the facts line, the lines shown once, the problem lines, the sections, the save bar and "Leave without saving?". It creates the form and provides `usePluginPage()` |
| `pluginForm.ts` | The one form, as a plain module with a node spec: `createPluginForm`, `PluginFormPart`, and the save bar's wording |
| `pluginPage.ts` | `usePluginPage()`, `usePluginFormPart(part, reveal?)` and `fieldId(path)` |
| `pluginPageWording.ts` | The facts line, the four problem lines, the arrival lines, "Saved at {hh:mm}", the paragraph over duplicate, export and delete |
| `@/patterns/PageSection.vue` | A section's frame, shared with Device Settings: `<PageSection id="data" title="Data Sources">` is the `h2` on the 2 px rule with the `#actions` slot at its right, answering to `#data`. `rows` is for a section of Setting rows, which start at the heading's rule and end on one of their own, with `#under` for what is said about the whole section |
| `pluginNaming.ts`, `PluginNaming.vue` | "Name and description": the worked example of a section that joins the form |
| `PluginActions.vue` | "Duplicate, export or delete {Plugin}": the worked example of a section that acts at once |

**Adding a section** is one component and one line. Write `Plugin<Name>.vue` in `pages/plugins/`, and put it in `PluginPage.vue` where the comment names its fragment: in `#default` for a section, in `#tucked` for a tucked one. Both slots hand over `plugin`, for a section only some Plugins have:

```vue
<PluginFrame :key="pluginId" :plugin-id="pluginId">
  <template #default="{ plugin }">
    <PluginDataSources v-if="plugin.kind === 'Poll'" />
    <PluginWebhook v-else />
  </template>
  <template #tucked>
    <PluginNaming />
    <PluginActions />
  </template>
</PluginFrame>
```

A section's root is a `PageSection` (or a `TuckedSection` in `#tucked`) with the `id` its fragment names. It renders only its body: no title line, no loading state, no save button.

**What a section is handed**: `const { plugin, form, reload, leaveFor } = usePluginPage()`.

| Member | Is |
| --- | --- |
| `plugin` | A computed `PluginDetail`, never `undefined`: the Plugin as the server last answered it, re-read every 30 seconds and after a save. Read the facts the form does not hold from here (a Fetch Failure Streak, the Webhook Payload, the assignments). Never fetch the Plugin again |
| `form` | The one form. `form.unsaved` is everything every part would send, changed or not: the unsaved state the Template section's preview draws (`PreviewDataInput`'s `dataSources` and `fieldValues` are its keys). `form.changed`, `form.changedKeys` and `form.saving` say where it stands |
| `reload()` | Reads the Plugin again. Call it after a write that acts at once (assigning, unassigning, clearing the Webhook Payload, regenerating the Webhook Token) |
| `leaveFor(action)` | Asks "Leave without saving?" while the form holds unsaved changes and runs `action` unless the admin keeps editing: for an action that counts as leaving without being a route change (Duplicate, Export). A route change, the Recipe Update Check's link included, is asked about by the page's guard and needs nothing |

**Joining the form.** A section that edits the Plugin declares one `PluginFormPart<Draft>` in a `.ts` file of its own (so it can have a node spec) and registers it:

```ts
// pluginNaming.ts
export const pluginNaming: PluginFormPart<{ name: string, description: string }> = {
  keys: ['name', 'description'],
  read: plugin => ({ name: plugin.name, description: plugin.description ?? '' }),
  toInput: draft => ({ name: draft.name.trim(), description: draft.description.trim() || null }),
  validate: (draft) => {
    const message = pluginNameProblem(draft.name) // 'A Plugin needs a name.', which Add a Plugin says too
    return message ? [{ path: 'name', message }] : []
  },
}
```

```vue
<!-- PluginNaming.vue -->
<script setup lang="ts">
const open = ref(false)
const naming = usePluginFormPart(pluginNaming, () => (open.value = true))
</script>

<template>
  <TuckedSection id="name" v-model:open="open" title="Name and description">
    <Field :id="fieldId('name')" v-slot="{ control }" label="Name" :error="naming.errors.name">
      <TextInput v-model="naming.draft.name" v-bind="control" prose wide />
    </Field>
  </TuckedSection>
</template>
```

| Of the part | Is |
| --- | --- |
| `keys` | The keys of `UpdatePluginInput` the part saves. A key belongs to one part; registering a second part for it throws. They are also the part's error paths: a path that starts with one of them is this part's |
| `read(plugin)` | The draft of a Plugin as it is saved: what the controls are bound to. Plain data (it is compared and copied as JSON), and the same Plugin must read as the same draft, so a row's client-side key is derived from its `id`, never random. Keep only what is edited in it; a fact like a streak is read from `plugin` |
| `toInput(draft)` | What a save sends for `keys`, each key whole and input-shaped: `DataSourceInput` with its `id`, not a `DataSourceRead`. A key it leaves out is never sent (`refreshInterval` of a Webhook-kind Plugin; a password Field Value that was not replaced) |
| `validate(draft, { plugin, unsaved })` | What stops a save, as `{ path, message }` with the path `toInput` would send the field at (`dataSources.2.url`), which is the path the server names it by. `unsaved` is the whole form, for a rule across sections (a Data Source's name against the Plugin Fields' keynames) |

`usePluginFormPart(part, reveal?)` registers the part while the component is mounted and returns a reactive handle. Do not destructure it.

| Of the handle | Is |
| --- | --- |
| `draft` | What the controls edit: `v-model="part.draft.name"`, or `part.draft.rows.push(…)`. Editing it is all it takes to mark the form changed |
| `saved` | The draft as it is saved, for what a section says about the difference ("Removed when you save") |
| `errors` | `{ [path]: message }` for the part's paths: hand each `Field` its `:error="part.errors['dataSources.2.url']"`. It holds the part's own problems once a save was tried, and the server's field errors of a refused save until the part is edited |

The form does the rest, and a section never does any of it itself:

- **What differs** is decided per key by comparing `toInput(draft)` with `toInput(read(saved))`. So a change that maps to the same input (a space after the name) is no change, a collection is sent whole when any of it changed, and the bar names the keys in the page's order: "Unsaved changes to the template, Data Sources and Field Values." The sentence "The preview already shows them." is added once a part saves `templates`.
- **A save** sends only the changed keys in one `PATCH`, and the answer becomes what is saved in every part. A part edited while the save was under way keeps what was typed.
- **The 30-second refresh and a `reload()`** reach a part that has no unsaved changes; a part with unsaved changes is left alone entirely. `plugin` is fresh either way.
- **"Show the first"** calls the `reveal(path)` of the part that owns the first problem, waits a tick and focuses the element whose id is `fieldId(path)`. So `reveal` only opens what holds the field (a tucked section, a row), and the control carries `:id="fieldId(path)"` through its `Field`. Problems are counted in the order the parts were registered, which is the order of the page.
- **Discard changes** puts every draft back to what the server said last; a part that holds state beside its draft (which row is open) keeps it.

A section with a part that lives in a `TuckedSection` or a row registers in the component that holds it, not inside the content that is unmounted while it is closed.

**Testing a section.** The part gets a node spec of its own (`read`, `toInput`, `validate` are pure). The section is tested through the page, in a spec of its own beside `PluginPage.spec.ts`, with what `__test__/pluginPageHarness.ts` exports:

| Helper | Does |
| --- | --- |
| `fakePlugin(plugin?, answer?)` | Fakes the shell's reads, `GET /api/plugins/:id` and `PATCH /api/plugins/:id`. It returns `{ plugin, saves }`: assign `plugin` to change what the next read answers, and assert `saves`, every `PATCH` body in order. A save answers the Plugin with the sent name, description and refresh interval laid over it; pass `answer(plugin, input)` when a collection must come back as a read model |
| `mountPlugin()` | Freezes the time at `NOW`, holds the tab visible, mounts the app at `/plugins/weather` and waits for the title |
| `saveBar(screen)` | The save bar's region: `saveBar(screen).getByRole('button', { name: 'Save Plugin' })`, `saveBar(screen).getByText('Unsaved changes to the name.')` (the whole sentence) |
| `refresh()` | The 30-second re-read, now. Blur the control first: a re-read is held back while a typed-in control has the focus |
| `clock(iso)` | The `{hh:mm}` of a sentence, in the browser's timezone |
| `catchDownloads()` | Holds every download the page starts and returns their addresses |

So a section's test is "edit, press Save Plugin, assert `faked.saves`". `__test__/examples/StandInSection.vue` is a section in forty lines, and `StandInPluginPage.vue` shows a frame mounted with sections of a test's choosing (`mountPage`).

- The arrival line is taken once per page (`takePluginArrival` in `PluginFrame`), so a spec reaches it by mounting the app elsewhere and calling `openPluginPage(screen.router, id, arrival)`.

### Add a Plugin

`/plugins/new` is one page for every way of adding a Plugin ([plugins.md, "Add a Plugin"](../ui/plugins.md#add-a-plugin)): the ways as a radio row, and the chosen way's form beside it. `?way=` names the way; one the page does not know falls back to the first.

| File | Holds |
| --- | --- |
| `AddPluginPage.vue` | The route's component: the title line, the line about the carried Device, the radio row and the chosen way's form |
| `addPluginWays.ts` | `ADD_PLUGIN_WAYS`, the ways in the radio row's order. **Adding a way is one entry here and one form component** |
| `addPluginPage.ts` | `useAddPluginPage()`, what the page hands a way's form: `device`, the Device the address carries (`?device=`, an id of no Device carries nothing), and `cancelTo` |
| `AddPluginFoot.vue` | How every way's form ends: the primary button (`button`, `running`), "Cancel", the failure (`failure`, a whole sentence: "Not created. …"), the one line in `ink-soft` as its slot, and "Leave without saving?" while `changed`. It is `AddFormFoot` of `@/patterns/` with the page's "Cancel" |
| `addPluginOrigin.ts` | Where the admin came from, kept by the route's `beforeEnter` for "Cancel" |
| `addPlugin.ts` | The page's pure parts, and those of the two ways of building: the draft, its problems and what is sent |
| `BuildPluginForm.vue`, `BuildWebhookMerge.vue` | "Build a Poll Plugin" and "Build a Webhook Plugin": one form, told its `kind`, so a name typed for one way stays for the other |
| `ImportRecipeForm.vue`, `ImportFileForm.vue`, `ImportGithubForm.vue` | The three ways of importing, one form each. `ImportedBefore.vue` is the line "You already have {Plugin} from this Recipe" |
| `importPlugin.ts` | What the three share: `useImportPlugin(wording)`, and the pure parts under it (`importTrouble`, `importArrival`, `enteredRecipe`, `importedBefore`) |

A way's form is a `form` whose submit adds the Plugin, with an `AddPluginFoot` as its last child:

```vue
<form novalidate @submit.prevent="add">
  …the way's fields…
  <AddPluginFoot button="Import Recipe" :running="importing" :changed="changed" :failure="failure">
    Imports as a Poll Plugin you can edit. Nothing updates by itself afterwards.
  </AddPluginFoot>
</form>
```

- It sends `device.value?.id` with the request and, once the Plugin exists, sets what makes `changed` false, awaits `nextTick()` and calls `openPluginPage(router, plugin.id, { how: …, device: device.value })`.
- A refusal of one field goes under that field (`fieldErrorsOf`); any other becomes `failure`. What was entered stays.
- `createPlugin(input)` (`src/api/plugins.ts`) is `POST /api/plugins`: a name and a Plugin Kind in, the `PluginDetail` out.

**A way that imports** answers `PluginImportResult` (`plugin`, `origin`, `hasTransform`) from `importRecipe(input)`, `importPluginFile(file, deviceId?)` or `importGithubPlugin(input)`, and stands on `useImportPlugin(wording)`:

```ts
const importing = useImportPlugin({
  upstream: 'trmnl.com',                                    // named in the notice when it does not answer; a file import has none
  aboutEntry: { 'recipe-oauth': true, 'import-no-plugin': 'This Recipe holds no template, so there is nothing to import.' },
})
watch(entered, importing.clear)

function add() {
  if (problem) return importing.refuse(problem)             // refused in the browser: nothing is sent
  return importing.run(deviceId => importRecipe({ recipe, deviceId }))
}
```

- `run` sends, and on success opens the Plugin's page with the arrival `imported`, carrying the origin, `hasTransform` and the carried Device.
- `importing.trouble` says why nothing was imported, by where the form shows it: `entered` under the field (a code listed in `aboutEntry`, worded by the form or, with `true`, by `refusalWording.ts`), `unanswered` as a `Notice` with "Try again" (`upstream-unreachable`), `failure` for the foot (anything else, as "Not imported. …").
- `recipeIdOf(text)` and `githubRepositoryOf(text)` of `kuroshiro-shared` read a Recipe's id and a repository's `owner/repository` exactly as the server does, so the browser refuses what the server would.

## The Alerts page and an Alert's words

`pages/alerts/` holds the Alerts page (`/alerts`) and the words every surface uses for an Alert:

| File | Holds |
| --- | --- |
| `alertLabels.ts` | `FIRING_ALERT_LABELS` ("Alert: battery low") and `RESOLVED_ALERT_LABELS` ("Battery low"), by Alert kind. A Device's facts and a Plugin's row state read the firing ones from here |
| `alertWording.ts` | `alertWhy(alert, { now, lowBatteryPercent })`, the sentence that says why an Alert fires or, once it has `resolvedAt`, why it fired, from the `details` the server keeps; `alertSubject(alert)`, the name and the link of its Device or of its Plugin's Data Source; `sinceWhen`, `firedFor` and `duration` |
| `AlertRow.vue` | One Alert as a row of four cells, red only while it fires |

- The page reads the shared `useAlerts()`, which already holds the firing Alerts and those resolved in the last 7 days, capped at 50. It fetches nothing of its own but the Instance Settings, for the thresholds.
- An Alert's `details` are the cause as of the last Alert Sweep while it fired. An Alert that resolved before the server kept the cause may hold details of its recovery, or none: `alertWhy` answers an empty sentence for those.
- `ALERT_RULES_PATH` and `NOTIFICATIONS_PATH` (`pages/instance/instancePaths.ts`) are the two sections of Instance Settings other pages link to.

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

`src/api/devices.ts` has `listDevices`, `getDevice`, `createDevice` (refused with `device-mac-taken`), `updateDevice`, `deleteDevice`, `listDeviceLogs` and `clearDeviceLogs`. `src/api/instance.ts` has `getInstanceFacts`, `getInstanceSettings` and `updateInstanceSettings`; `src/api/alerts.ts` has `listAlerts` and `sendTestNotification` (refused with `notifications-off` or `notification-failed`). `src/api/screens.ts` has `listScreens`, `reorderScreens`, `createScreen`, `createFileScreen`, `createMashup`, `assignPlugin`, `updateScreen`, `previewScreenImage`, `replaceScreenImage`, `refreshScreen`, `deleteScreen`, `updateMashup` (by the Screen's id), `unassignPlugin`, and `createSchedule`, `updateSchedule` and `removeSchedule`, which answer the owning Screen.

- `apiGet<T>(path, query?)` and `apiSend<T>(method, path, body?)` from `@/api/client`. The path has no leading slash and no `api/`. `body` is a shared `…Input` type, sent as JSON, or a `FormData` for an upload. A 204 answers `undefined`.
- Types come from `kuroshiro-shared`. Send only what the `…Input` type declares: the server refuses undeclared keys, so a read model sent back as a write is refused.
- A page calls these functions and never `fetch`.
- **An image the server answers to an upload** (a preview that stores nothing) is `apiSendForImage(method, path, formData)`, which answers a `Blob`; show it through `URL.createObjectURL` and revoke the address when it is replaced or the component goes (`ReplaceFile.vue`).
- **A file the server answers** (an export) is downloaded by the browser itself: `apiDownload(path)` from `@/api/client`, wrapped in the group's file (`exportPlugin(id)`). The file's name is the server's.

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
- `image-fetch-failed` is the one refusal that carries the server's own sentence after its wording, because only the server knows why an address gave no image.
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
- A Schedule's and Sleep Mode's hours are the server's wall clock and are shown as the server sent them, with `useServerTimezone()` naming the zone. "Today" beside such a date is the server's day too: `dateInZone(now, timezone)` in `pages/devices/scheduleEditing.ts`.

## A form with unsaved changes

A view with a primary button and "Cancel" renders the guard once, anywhere in its template:

```vue
<UnsavedChanges :when="changed">
  <template #lost>Your changes to {{ plugin.name }}'s template.</template>
</UnsavedChanges>
```

While `when` is true, a route change opens "Leave without saving?" with "Keep editing" (focused) and "Leave", and the browser asks before the page is unloaded. After a save, let `when` turn false and `await nextTick()` before navigating away, so the guard has seen it.

A change of the path within the same route (another Plugin's page) asks too; a change of the query or the fragment does not. For an action that counts as leaving without being a route change, take a template ref of the guard and call `leaveFor(action)`: it asks first, runs `action` unless the admin keeps editing, and does not ask again about a navigation `action` makes.

## Tests of a page

See [`ui-testing.md`](./ui-testing.md): `mountApp({ at })` with `fakeShellReads()`, `freezeTime()`, the fixture builders and `expectPageScreenshots`.
