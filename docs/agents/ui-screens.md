# Building a screen of the admin UI

What every screen of `packages/ui-next` stands on: the shell, the router, the API client and the shared page patterns of [`docs/ui/README.md`](../ui/README.md#patterns-every-surface-shares). Copy from here; do not rebuild any of it in a page. How a screen is tested is in [`ui-testing.md`](./ui-testing.md).

## Where things live

| Folder of `packages/ui-next/src/` | Holds |
| --- | --- |
| `api/` | The client core (`client.ts`), the refusal wording (`refusalWording.ts`) and one file per resource group with one typed function per endpoint, named like the files of `packages/shared/src/api/` |
| `reads/` | `sharedReads.ts`: the reads made once for the whole app |
| `router/` | `routes.ts` (every route) and `index.ts` (`createAppRouter`, the scroll behaviour) |
| `shell/` | The bar, the phone's bottom tabs, the demo line, the page column |
| `patterns/` | The shared page patterns: `TitleLine`, `BackLink`, `LoadBody`, `LoadingLine`, `WashBar`, `MissingPage`, `RelativeTime`, `UnsavedChanges`, `PageSection`, `ReadRow`, `ChoiceBesideForm`, `AddFormFoot`, `useLoad`, `joinLoads`, `usePolling`, `useNow`, `usePageTitle`, `useNarrowWindow`, `time.ts`, `listed` |
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
- **`SaveBar`** must be a direct child of the column, so put it at the page's root, not inside a wrapper. The one exception is the Template section's full window, which stands over the column: `PluginOpened.vue` teleports the bar to the window's foot meanwhile ("The Template section" below).
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

Every Instance page is a child route of `/instance`, whose component is `pages/instance/InstanceFrame.vue`. The frame renders the title line "Instance", the page list at the left (a row of tabs that scrolls sideways on a phone, running from one edge of the window to the other), the chosen page beside it, and under the list Appearance and "Kuroshiro {version}", which move to the foot of the page on a phone. `/instance` redirects to `/instance/settings`. It loads nothing: an Instance page reads what it shows itself. A page that shows Instance facts beside a load of its own joins the two into one `Load` for `LoadBody` with `joinLoads({ settings, facts: useInstanceFacts() })` (`@/patterns/`), so that either one's failure is the page's notice (`InstanceSettingsPage.vue`).

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
| `InstancePageHeading` | The page's heading line: its name as an `h2` at `title-sm` on the 2 px ink rule, the `#actions` slot at its right, and `back` (`{ label: 'Firmware', to: FIRMWARE_PATH }`) for the link above the name of a page that is not in the page list. It does not rename the browser tab, which reads "Instance" |
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

A boolean Setting (Firmware Auto-Update) is a `SettingRow` with a `Switch` and `useSaveAsChanged`, sending `{ firmwareAutoUpdate: true }` through the same `updateInstanceSettings` (`FirmwareAutoUpdateRow.vue`).

### A library and its sync with TRMNL

The Firmware page (`FirmwarePage.vue`) is the worked example of an Instance page that lists what was synced from TRMNL; Device Models and Palettes (`DeviceModelsPage.vue`) is built the same way.

| Part | Is |
| --- | --- |
| `LibraryRow` (`@/components/`) | One row of a library, an `li` for a `ul`: `name` (with `mono` for a version), the default slot for what it is (one `p` per line), `problem` for the line with the problem icon, `#end` for the date and the actions, `#form` for a form open under it. The rows carry their own rule below; the first one stands on the section heading's. `--library-name-width` on the list sets the name column (9.5 rem unless set) |
| `useTrmnlSync(run, reread)` (`trmnlSync.ts`) | A sync an admin starts: `sync()`, `running`, `result` (what `run` answered, kept until the page is left), `failed` and `reason` (`details.reason` of `upstream-unreachable`, otherwise the failure's own sentence). `reread` is called after a sync, working or failing, because the server records both as `lastSync`: hand it the page's `reload`. The Firmware page's `run` answers the sentence itself, worded by the switch as it stood when the sync was asked for |
| `TrmnlSyncOutcome` | The line under the lede: `running` with `asking` ("Asking TRMNL for …"), `outcome` (the sentence of a sync that worked), and the notice "Could not sync from TRMNL." with `reason` and "Try again" (`@retry`). Its `ResultLine` is in the page before it says anything; a spec reads it at `.sync-line` |
| `DeviceNames` | Devices in a sentence ("Kitchen, Hallway and Study"), each a link to the `section` of its Settings that the sentence is about (`firmware`, `display`: a key of `SETTINGS_SECTIONS`) |
| `LibraryLoading` | The skeleton of a library: three rows in `LibraryRow`'s columns |
| `Swatches` (`@/components/`) | A Palette's colours as a row of 14 px squares, `aria-hidden`: say what they are in words beside it. `swatchColours(palette)` (`deviceModelsWording.ts`) gives a Palette's colours, or its greys from black to white for one without |
| `paletteFamilies.ts` | `PALETTE_FAMILIES`, the five colour Palette Families in a select's order (`frameworkClass`, the short `id`, the `name` in words), and `paletteFamilyName(frameworkClass)` |
| `firmwareWording.ts`, `uploadFirmware.ts` | The pure wording of the Firmware page and the rules of Upload Firmware, each with a node spec |

- The page reads the library, the Device Models and the Instance Settings in one `useLoad` (`Promise.all`), and reads them again after a sync and after a delete.
- "Checked TRMNL {when}" is `lastSync.ranAt` in a `RelativeTime`, in the section's `#aside`; no `lastSync`, no aside.
- `src/api/firmware.ts` has `listFirmware`, `syncFirmware`, `uploadFirmware(file, input)` (multipart; the Device Models go as a JSON string) and `deleteFirmware`.
- Device Models and Palettes reads `listDeviceModels()` and `listPalettes()` in one `useLoad` and syncs with `syncDeviceModels()` (`src/api/device-models.ts`). Its parts: `CustomPalettes` (the section an admin makes things in; comments mark where "Add a custom Palette", its form and a row's "Edit" and "Delete" go), `DeviceModelLibrary` (the Device Models in use, then `OtherDeviceModels` and `TrmnlPalettes`, both tucked), `DeviceModelRow`, `PaletteRow` and the pure `deviceModelsWording.ts`. `__test__/deviceModelsHarness.ts` has `fakeDeviceModels({ models, palettes, lastSync, devices })`, `mountLoadedDeviceModels(at?)` and the fixtures `DEVICE_MODELS`, `TRMNL_PALETTES`, `KOBO_AURA` (a deprecated Device Model) and `UNUSED` (an Instance without a Device).
- A sync that failed keeps what was loaded, so its notice says where that is from: `whyNotSynced(reason, models, now)` reads the newest `syncedAt`, because `lastSync` is the failed run by then.
- Upload Firmware (`UploadFirmwarePage.vue`, `UploadFirmwareForm.vue`, `FirmwareFits.vue`) is a form that ends in `AddFormFoot`. `FileDrop` takes `wording` for a place whose spec words the prompt and the two refusals itself, `Field` takes `optional`, and `RadioRow` has the `#under` slot (handed `choice`) for what a choice holds between its row and the next.
- `__test__/firmwareHarness.ts` fakes it all for a spec: `fakeFirmware({ firmware, lastSync, settings, models })` answers the reads and takes the Settings change, the sync (`syncAnswer`, `holding`), the upload and the delete as the server would; `mountFirmware()`, `mountUpload()` and `rowsOf(list)`, which reads the rows cell by cell.

### The Configuration Archive

`ConfigurationArchivePage.vue` is two sections. `ConfigurationExport` is two `ArchiveExportRow`s, each a browser download (`exportConfiguration({ redacted })`), which cannot report a failure: the button reads "Download started" for 2 seconds whatever the server answers. `ConfigurationImport` waits for the Devices and the Instance facts and renders `ImportSteps`.

| Part | Is |
| --- | --- |
| `useImportSteps(version)` (`importSteps.ts`) | The four steps as one `step` (`choose`, `reading`, `read`, `imported`, `refused`): `read(file)` calls `checkConfigurationImport`, which changes nothing; `confirm()` calls `importConfiguration` with the file that was read and then reloads the shared reads; `startOver()` goes back to choosing |
| `ImportSteps`, `ImportSummary`, `ImportOutcome` | The drop zone, "Reading {file}", the summary with its buttons, "Imported." with "To do now", and the notice of a refusal. Each step takes the place of the one before, so the focus is moved to the step, or back to the file input |
| `configurationArchiveWording.ts` | Every sentence, with a node spec: the summary's lines from an `ImportCheck`, `wordWarning(warning)` for each kind of `ImportWarning`, and `refusalNotice(error, version, notDone?)` for the notice |
| `SummaryList`, `SummaryRow` (`@/components/`) | A `dl` of label and value on rules: one `SummaryRow` per `label`, its value in the default slot and `problems`, lines drawn with the problem icon. The Device Simulator is to show its answer in it |
| `__test__/configurationArchiveHarness.ts` | `fakeArchive({ devices, check, summary, archiveUploadBytes })` answers the check and the import (`checkAnswer`, `importAnswer`, `holding`, and `sent`, every archive the server was sent), `mountArchive()`, `archiveFile()` |

- A summary counts six kinds (Devices, Plugins, Screens, Mashups, custom Palettes, custom Firmware). The rows under a Plugin or a Screen that the server also counts (`dataSources`, `templates`, `schedules`, …) are not counted as records.
- A warning kind added to `ImportWarning` fails type-check in `wordWarning` until it is worded.

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
| `pluginWording.ts` | The sentences of the two dialogs. `listed(names)` ("Kitchen, Hallway and Study") is in `@/patterns/listed` |
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
| `pluginDataSources.ts`, `PluginDataSources.vue` | "Data Sources": the worked example of a section whose part holds a list of rows and code inputs. See "A list of rows in the form" below |
| `pluginDataSourceWording.ts` | A Data Source's line, how its fetches stand (`fetchStanding`) and the words of its health and its story |
| `PluginRefreshInterval.vue`, `PluginDataSourceRow.vue`, `DataSourceForm.vue`, `DataSourceFetchFields.vue`, `DataSourceCode.vue`, `DataSourceStory.vue`, `DataSourceFailing.vue`, `DataSourceHealth.vue` | The section in parts: the interval's row, one row, its form, the fields of Fetch mode, one code input as a field, the story, the story of a streak and the row's health |
| `pluginTemplates.ts`, `PluginTemplate.vue`, `TemplateLine.vue`, `TemplatePreviewFor.vue`, `pluginTemplateWording.ts` | "Template": the part, the section, the Template line, what sits under the plate and the section's words. See "The Template section" below |
| `templatePreview.ts`, `useTemplatePreview.ts`, `previewTarget.ts` | The preview: the browser's render of a Template (the one module that holds the Liquid engine), when it is drawn, and which Device or Device Model it is for |
| `usePreviewData.ts`, `templateContext.ts`, `templateData.ts`, `TemplatePlate.vue`, `TemplateData.vue`, `DataList.vue`, `TemplateDataFoot.vue`, `ScheduledRenderFailure.vue` | The data the preview draws against: when it is fetched and held, the form laid over it (`heldWithForm`), the rows and words of "Data", the plate or why there is none, the notices and "Data" under the plate, the list itself, what stands under its rows, and the line of a failed scheduled render |
| `templateWindow.ts` | The section's full window: `useTemplateWindow()` (`offered`, `open`, `enter()`, `leave()`), `useWindowTaken`, and `TEMPLATE_WINDOW_FOOT`, where the save bar stands meanwhile |
| `formRows.ts` | What the lists of rows in the form share: `FormRow` (`key`, `removed`), `keptRows`, `sentPathsOf(collection, rows)`, `nextAddedKey` and `freeName` |
| `pluginFieldValues.ts`, `PluginFieldValues.vue`, `FieldValueRow.vue`, `FieldValueControl.vue` | "Field Values": the part, the control of each Plugin Field type (`fieldControl`), the note at a row's right (`fieldValueNote`), one row and its control. See "Two parts that read each other" below |
| `pluginFields.ts`, `PluginFields.vue`, `PluginFieldRow.vue`, `PluginFieldForm.vue` | The tucked "Plugin Fields": the part with every rule of a keyname, the rows in a sortable `ScreenRows`, one row and its form |

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
| `save()` | "Save Plugin", as the save bar's button does it. The Template editor's Ctrl or Cmd S calls it |
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
| `refused(error, draft)` | Optional. What a refused save says about the part's fields when the server names none: a refusal with a code of its own (`template-invalid`, whose `details` name a size and a line). It answers problems as `validate` does |

`usePluginFormPart(part, reveal?)` registers the part while the component is mounted and returns a reactive handle. Do not destructure it.

| Of the handle | Is |
| --- | --- |
| `draft` | What the controls edit: `v-model="part.draft.name"`, or `part.draft.rows.push(…)`. Editing it is all it takes to mark the form changed |
| `saved` | The draft as it is saved, for what a section says about the difference ("Removed when you save") |
| `errors` | `{ [path]: message }` for the part's paths: hand each `Field` its `:error="part.errors['dataSources.2.url']"`. It holds the part's own problems once a save was tried, and the server's field errors of a refused save until the part is edited |
| `problems` | The same problems whole (`{ path, message, line? }`), for a field that is code and shows the line |

The form does the rest, and a section never does any of it itself:

- **What differs** is decided per key by comparing `toInput(draft)` with `toInput(read(saved))`. So a change that maps to the same input (a space after the name) is no change, a collection is sent whole when any of it changed, and the bar names the keys in the page's order: "Unsaved changes to the template, Data Sources and Field Values." The sentence "The preview already shows them." is added once a part saves `templates`.
- **A save** sends only the changed keys in one `PATCH`, and the answer becomes what is saved in every part. A part edited while the save was under way keeps what was typed.
- **The 30-second refresh and a `reload()`** reach a part that has no unsaved changes, when the server says something new about what the part reads; a part with unsaved changes is left alone entirely, and so is a draft the server has nothing new for (it may hold what it does not send: the other mode's entries of a Data Source). `plugin` is fresh either way.
- **"Show the first"** calls the `reveal(path)` of the part that owns the first problem, waits a tick and focuses the element whose id is `fieldId(path)`. So `reveal` only opens what holds the field (a tucked section, a row), and the control carries `:id="fieldId(path)"` through its `Field`. Problems are counted in the order the parts were registered, which is the order of the page.
- **Discard changes** puts every draft back to what the server said last; a part that holds state beside its draft (which row is open) keeps it.

A section with a part that lives in a `TuckedSection` or a row registers in the component that holds it, not inside the content that is unmounted while it is closed.

**A list of rows in the form** (`pluginDataSources.ts` and `PluginDataSources.vue` are the example to copy):

- **The draft is the rows as their controls hold them**, not as they are sent: code is kept as the text that was typed (`headers: string`), both of two modes' entries are kept so that switching back loses nothing, and a row carries `key` (the `id` of a saved row, `added-{n}` counted from the draft for a new one) and `removed`. `toInput` turns that into the input: it leaves the removed rows out, parses the code and sends only what the chosen mode holds. Code that does not parse is left out of the input, which makes the row differ from anything saved, so the bar shows and `validate` stops the save.
- **A row's error path counts the rows that are sent**, because that is how the server counts them: `sentPaths(rows)` gives each row its `dataSources.N`, and none to a removed one. A row component is handed its `path` and the part's `errors`, and builds `fieldId(`${path}.url`)` and `errors[`${path}.url`]` from them.
- **A row is handed to its component as a model** (`v-model:source="part.draft.sources[index]!"`, `defineModel` in the row), so the row's fields bind to `source.name` without mutating a prop.
- **Removing asks nothing.** A saved row is marked `removed` and stays, struck through, with "Put back"; a row that was added and never saved is taken out of the draft. Either way the form sees the change by itself.
- **Which row is open is the section's own state**, beside the draft, by the row's `key`. A save gives an added row the key of its new id, so the section finds the open row again by its name.
- **`reveal(path)` may be `async`.** It opens the row and awaits `fieldArrived(path)` (`pluginPage.ts`), which resolves once the control with `fieldId(path)` is in the page: an opened row renders a tick later and a code editor is fetched first. "Add" uses the same to focus the new row's first field.
- **A problem shown on leaving a field**, before any save, is the section's: `part.errors` holds a part's own problems only once a save was tried. Export the rule as a pure function (`codeProblems(row)`), which `validate` uses too, and show `errors[path] ?? (left ? problem : undefined)` (`DataSourceCode.vue`).
- **A code input in a `Field`** is `<CodeEditor v-model="code" v-bind="control" :aria-label="label" mode="json" size="code-input" @blur="left = true" />`. The part checks the text itself with `JSON.parse`, whose message is the one the editor underlines by, so the rule has a node spec and needs no `@validity`.
- **A part whose rule needs more than the Plugin and the form** is made by a function the section calls: `usePluginFormPart(dataSourcesPart(() => instance.data?.demoMode ?? false), reveal)`.
- **A fact of a row** (its Fetch Failure Streak) is read from `plugin` by the row's `id`, never kept in the draft, so the 30-second refresh reaches it while the row has unsaved changes.
- `SettingRow` takes `id` for its control, as `Field` does, for a Setting row that is a field of the form (`fieldId('refreshInterval')`).

**Two parts that read each other** (`pluginFields.ts` and `pluginFieldValues.ts` are the example):

- **A section draws another part's unsaved state from `form.unsaved`**, never from the other section. The Field Values rows are `form.unsaved.fields`, so a Plugin Field that is added, renamed, retyped, moved or removed changes them at once; a removed one is not in `unsaved` and has no row.
- **A section that some Plugins lack by their unsaved state is always mounted** and decides inside whether it renders: `<PluginFieldValues />` stands in `PluginPage.vue` without a `v-if`, because a Plugin gets the section with the first Plugin Field that is added.
- **A draft keyed by something another part can rename is kept in step by its section.** `toInput` sees only its own draft, and the server refuses a Field Value under a keyname that no Plugin Field has. So `PluginFieldValues.vue` watches the keynames and puts `valuesAmong(keynames, entered, saved, cleared)` in the draft: the value of a keyname that is gone goes with it, one that is back has its saved value again. Entering a value goes through the same function, so the draft only ever holds what it yields.
- **A record sent by key is sent in a fixed order of its keys** (`toInput` sorts them), because what differs is decided by comparing JSON.
- **What is left out is not in the draft.** A password's stored value never reaches the browser, so `read` gives it no entry and a save leaves its keyname out, which keeps it. An entry appears once one is typed. An empty entry is held only where a save has something to clear: a saved value, or a stored password whose Plugin Field the form retypes to something a read would show, which is sent as `null` so that the secret is never read back.
- **A list that is reordered** stands in a sortable `ScreenRows` with `place="place"` (what a row's place is called when it is announced; "Order" is a Screen's). A row of its own draws the grip and the two buttons on phone from `useScreenRows()`, as `PluginFieldRow.vue` does. The draft is put in the order `reorder` names (`inOrderOf`), and `toInput` sends `order` by the row's place.

**The Template section** (`PluginTemplate.vue`) is the form's `templates` and the preview:

- **The draft is one row per Template** (`TemplateRow`: `size`, `liquidMarkup`, `removed`), in the order of the sizes. A removed row always stays, with "Put back", also one that was added and never saved. A row's error path is `templates.N.liquidMarkup`, counted among the rows that are sent (`templatePaths`), and the editor carries `fieldId` of the chosen row's path, so "Show the first" finds it once `reveal` has chosen the Template.
- **The Liquid engine is fetched apart from the page.** `templatePreview.ts` is the only module that imports `renderLiquid`, `checkTemplate` or `KUROSHIRO_FILTERS` from `kuroshiro-shared`, and the section loads it with `import()`. Importing any of the three anywhere else puts `liquidjs` in a first load, which fails the build (`scripts/firstLoad.ts`). `templatesPart(check)` is therefore handed Liquid's check by the section, and stops only an empty Template until the engine is there.
- **The preview is a pure function and a composable.** `previewOf({ markup, size, context, target })` answers `{ document }` or `{ problem, stopsSave }`: a Template that does not parse stops a save, one that fails against the data does not. `useTemplatePreview(source)` draws 300 ms after the last keystroke and at once when the size, the context or the target changes, shows a problem 700 ms after the last keystroke and keeps the last document that worked.
- **The preview draws against the data the server fetched**, `POST /api/plugins/:id/preview-data` (`previewPluginData`), which runs the Plugin's Data Sources for real. `usePreviewData(input, fetch)` holds the answer and fetches when the section is mounted and the Devices are known, at once for another Device, 800 ms after the last change to `form.unsaved.dataSources` or `form.unsaved.fieldValues`, and on `fetchAgain`; never for a Template or the name. What is held stays while a fetch runs and after one fails.
- **The form is laid over what is held.** `heldWithForm(held, plugin, form.unsaved)` writes the unsaved name and Field Values into the context, bare and under `trmnl.plugin_settings.custom_fields_values`, and lists the Plugin Fields as the form has them, so a changed Field Value is drawn at once and a renamed or new keyname, which the server does not know until the save, reads as it will after it. A name the data holds stays the data's. The section hands that one value to the preview, to the editor's completion and to "Data".
- **The plate is in its rendering state until there is data**, with `rendering-note` "Fetching the data" while the first fetch runs. A later fetch never touches `rendering`, which would drop the drawing.
- **"Data" does not wait for the Device Models**: it needs the Devices only, so it is there under a plate that is still loading (which is how a `*.shots.ts` file shows it). Its `TuckedSection` answers to `#template-data`.
- **The full window is the same component in another place**, not a second mount: `?view=template` puts the section `position: fixed` under the bar, hands the bench and the editor their full-window size (the editor's `size` moves between `bench` and `full-window` without a `key`, so the undo history stays), makes every sibling of the section `inert` and stops the window from scrolling. `PluginOpened.vue` teleports the save bar into the section's foot meanwhile, and "Show the first" leaves the window first when the field is in another section. Below 820 px `open` is false whatever the address says.
- **What the preview is for** is the section's own state, not the form's: `PreviewChoice` (`previewTarget.ts`), which starts at the first Device the Plugin is assigned to. A Device's Palette is the one whose `usedBy` names it; the list read of the Devices does not carry it. With no Device, a Device Model starts at its richest Palette, as the server gives a Device its Palette.
- **Everything under the plate** stands in `EditorBench`'s default slot, after `TemplatePreviewFor`.

**Testing a section.** The part gets a node spec of its own (`read`, `toInput`, `validate` are pure). The section is tested through the page, in a spec of its own beside `PluginPage.spec.ts`, with what `__test__/pluginPageHarness.ts` exports:

| Helper | Does |
| --- | --- |
| `fakePlugin(plugin?, answer?)` | Fakes the shell's reads, `GET /api/plugins/:id`, `PATCH /api/plugins/:id`, `POST /api/plugins/:id/preview-data` and `GET /api/settings`. It returns `{ plugin, saves, previews, fetched, sensors }`: assign `plugin` to change what the next read answers, and assert `saves`, every `PATCH` body in order. The preview's data is answered as the server would for the faked Plugin and the form that was sent: `previews` holds every request, `fetched` is what a fetch-mode Data Source answers by its name (an error marker for one that fails) and `sensors` a Device's Sensors by its id. A save answers the Plugin with the sent name, description and refresh interval laid over it; pass `answer(plugin, input)` when a collection must come back as a read model |
| `fakePreviewLibrary(models?, palettes?)` | The Device Models and Palettes the Template section draws for. `fakePlugin` calls it with TRMNL OG and the one Palette Kitchen is set to; call it again after `fakePlugin` for others |
| `holdPreviewLibrary()` | Leaves that read unanswered, so the plate stays in its rendering state. Every `*.shots.ts` file of the Plugin page calls it: a drawn preview loads TRMNL's framework from the network |
| `fakePreviewData(data?)` | Answers every fetch of the preview's data with one `PreviewData` (`buildPreviewData`), for a page that is not faked with `fakePlugin`. Every `*.shots.ts` file of the Plugin page calls it too: unanswered, the section shows "The data could not be fetched." |
| `mountPlugin()` | Freezes the time at `NOW`, holds the tab visible, mounts the app at `/plugins/weather` and waits for the title |
| `saveBar(screen)` | The save bar's region: `saveBar(screen).getByRole('button', { name: 'Save Plugin' })`, `saveBar(screen).getByText('Unsaved changes to the name.')` (the whole sentence) |
| `refresh()` | The 30-second re-read, now. Blur the control first: a re-read is held back while a typed-in control has the focus |
| `clock(iso)` | The `{hh:mm}` of a sentence, in the browser's timezone |
| `catchDownloads()` | Holds every download the page starts and returns their addresses |

So a section's test is "edit, press Save Plugin, assert `faked.saves`". `__test__/examples/StandInSection.vue` is a section in forty lines, and `StandInPluginPage.vue` shows a frame mounted with sections of a test's choosing (`mountPage`).

- A code input is typed in, not filled: wait for its `textbox`, click it and send keys (`typeCode` in `PluginDataSources.spec.ts`). The editor closes brackets and quotes itself, so type `[[1, 2` for `[1, 2]`. `withSourcesSaved` in the same spec is an `answer` that gives a saved collection back as read models.
- A spec that holds or fails the preview's data adds its own handler for `plugins/weather/preview-data` after `fakePlugin`; a handler that returns `undefined` hands the request on to `fakePlugin`'s (`PluginTemplateData.spec.ts`).
- Behind the full window the page is `inert`: read it from the DOM, not by role.
- What the plate drew is read from the last frame's `srcdoc` (`drawn` in `PluginTemplate.spec.ts`), and the Template editor is typed in at its end (`type`). The editor closes an HTML tag as well as a bracket, so a test types plain words or one Liquid tag.
- The save bar says "The preview already shows them." after every change the preview draws from, the name included.
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

`src/api/configuration.ts` has `exportConfiguration`, `checkConfigurationImport` and `importConfiguration`. `src/api/devices.ts` has `listDevices`, `getDevice`, `createDevice` (refused with `device-mac-taken`), `updateDevice`, `deleteDevice`, `listDeviceLogs` and `clearDeviceLogs`. `src/api/instance.ts` has `getInstanceFacts`, `getInstanceSettings` and `updateInstanceSettings`; `src/api/alerts.ts` has `listAlerts` and `sendTestNotification` (refused with `notifications-off` or `notification-failed`). `src/api/screens.ts` has `listScreens`, `reorderScreens`, `createScreen`, `createFileScreen`, `createMashup`, `assignPlugin`, `updateScreen`, `previewScreenImage`, `replaceScreenImage`, `refreshScreen`, `deleteScreen`, `updateMashup` (by the Screen's id), `unassignPlugin`, and `createSchedule`, `updateSchedule` and `removeSchedule`, which answer the owning Screen.

- `apiGet<T>(path, query?)` and `apiSend<T>(method, path, body?)` from `@/api/client`. The path has no leading slash and no `api/`. `body` is a shared `…Input` type, sent as JSON, or a `FormData` for an upload. A 204 answers `undefined`.
- Types come from `kuroshiro-shared`. Send only what the `…Input` type declares: the server refuses undeclared keys, so a read model sent back as a write is refused.
- A page calls these functions and never `fetch`.
- **An image the server answers to an upload** (a preview that stores nothing) is `apiSendForImage(method, path, formData)`, which answers a `Blob`; show it through `URL.createObjectURL` and revoke the address when it is replaced or the component goes (`ReplaceFile.vue`).
- **A file the server answers** (an export) is downloaded by the browser itself: `apiDownload(path, query?)` from `@/api/client`, wrapped in the group's file (`exportPlugin(id)`). The file's name is the server's.

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
