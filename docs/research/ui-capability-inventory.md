# Capability inventory: everything the new admin UI must cover

Research for [#1075](https://github.com/PhyberApex/kuroshiro/issues/1075), part of the map [#1074](https://github.com/PhyberApex/kuroshiro/issues/1074).

- **Question:** What is the complete list of things an admin can do, see or configure through Kuroshiro, grouped by domain concept (`CONTEXT.md` vocabulary), not by today's pages?
- **Snapshot:** `origin/main` at `4406aef` (2026-10-01). GitHub issues read the same day.
- **Sources (all primary, all local or first-party):** `CONTEXT.md`, `docs/adr/`, `packages/ui/src` (router, views, components, stores), the controllers and DTOs in `packages/api/src`, `README.md`, and `gh issue list --state open`.

## How to read this

**Tiers**

| Mark | Meaning |
|---|---|
| **UI** | Shipped and reachable in today's UI (`packages/ui`). |
| **API** | Shipped in the API (or the data model) but with no working UI. An admin needs `curl` today. |
| **Decided** | Decided but unbuilt: an ADR and/or an open `ready-for-agent` issue. |
| **Untriaged** | Open `needs-triage` issue. |

**Frequency** (a judgement for a self-hoster with 1 to ~5 Devices, not measured): **glance** = daily glance, **setup** = occasional setup or content change, **rare** = rare maintenance or troubleshooting.

Paths are relative to the repo root. `ui/` means `packages/ui/src/`, `api/` means `packages/api/src/`.

## Headline findings

1. **The map's "decided but unbuilt" list is out of date.** Instance Settings (#1051), the Redacted Archive (#1055) and Firmware Auto-Update (#1056) are all shipped on `main`, UI included. The Render Signal is no longer untriaged: it has ADR-0031 and three `ready-for-agent` slices (#1069, #1070, #1071).
2. **The untriaged tier is empty.** There are zero open `needs-triage` issues (also zero `needs-info`, `ready-for-human`). The only open non-wayfinder feature issues are #1062, #1064, #1067, #1069, #1070, #1071.
3. **Webhook-kind Plugins have no UI at all.** The README advertises them, the API fully supports them, but the create form locks Plugin Kind to `Poll` and nothing shows a Webhook URL, Webhook Token, Merge Strategy, Stream Limit or Webhook Payload.
4. **Custom Palettes have no UI.** Create and delete exist only as API endpoints, though the README lists them as a feature.
5. **A Mashup cannot be inspected or edited after creation.** The API has update and read-configuration endpoints; the UI only creates, previews and deletes. An admin cannot even see which Plugins fill which slots.
6. **Several things the UI promises do not exist.** The assign dialog says "You can enable/disable per device later" (API-only). The Plugin editor's "Plugin Configuration" panel accepts field values that feed only the preview and are never saved.
7. **Health is scattered.** Alerts live on Maintenance, Fetch Failure Streaks are visible nowhere, the Overview shows raw battery voltage, and the UI's online dot uses a different rule from the offline Alert Rule.
8. **Destructive actions have no confirmation:** delete Device (two places), delete Screen, Reset device, Clear Logs. Only delete Plugin, Cleanup and the Retention run confirm.
9. **Maintenance is a catch-all.** Seven unrelated concerns share one long page: Configuration Archive, Device Models, Firmware, Alerts, Retention, Instance Settings, storage cleanup.

## Counts

| Tier | Count |
|---|---|
| UI (shipped, reachable) | 69 |
| API (shipped, no working UI) | 18 |
| Decided but unbuilt | 6 |
| Untriaged | 0 |
| **Total** | **93** |

Per group:

| Group | UI | API | Decided |
|---|---|---|---|
| Device | 12 | 2 | |
| Device Model and Palette | 4 | 2 | |
| Screen, Order, Rotation, Active Screen | 9 | 1 | |
| Schedule | 3 | | |
| Render Signal | | | 3 |
| Mashup | 3 | 2 | |
| Plugin and Data Source | 11 | 3 | |
| Webhook-kind Plugin | | 5 | |
| Plugin Assignment | 3 | 1 | |
| Recipe | 2 | | |
| Sleep Mode | 1 | | 1 |
| Firmware | 6 | | |
| Sensor | 1 | | 1 |
| Alert and Notification | 3 | | |
| Instance Settings | 1 | | 1 |
| Configuration Archive | 3 | | |
| Housekeeping (storage, Retention) | 3 | 1 | |
| Tools | 2 | | |
| App shell | 2 | | |
| Outside the admin UI | | 1 | |

---

## 1. Device

Today: the Overview page (`/`, `ui/views/OverviewView.vue`) and the Device details page (`/devices/:id`, `ui/views/DeviceDetailsView.vue`, mostly `ui/components/DeviceInformationCard.vue` and `ui/components/device/*`).

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 1 | Register a Device by hand (name + MAC, with a random-MAC generator) | UI | Overview, "Add Device" card. `POST /api/devices` | setup | The form is the first thing on the landing page, above the Device list, although it is used once per Device. |
| 2 | Auto-provisioning: a Device that calls `/api/setup` with an unknown MAC is created on its own (named after its friendly id) and shown the `welcome` fallback | API | `api/devices/setup.service.ts`. No UI | setup | The UI never tells a first-time admin what server URL to point the Device at, nor that a Device will appear by itself. First-run has no guidance. |
| 3 | See all Devices: name, MAC, battery voltage, RSSI, online dot | UI | Overview list; also the drawer's "Devices" group (`ui/components/NavigationDrawer.vue`) | glance | Shows raw voltage and raw RSSI, not the percentage and bars the details page computes. No Active Screen, no Alerts, no last-seen. Devices are absent from the desktop top tabs; only the drawer lists them. Manual refresh icon sits in the "Add Device" card title. |
| 4 | Delete a Device | UI | Overview list row; Device details header | rare | No confirmation in either place. |
| 5 | Rename a Device | UI | Device details header, pencil icon | setup | Inline edit does not save; the admin must then press the header's "Update" button, which saves the whole form. |
| 6 | See a Device's status: firmware version, RSSI, battery percent, resolved Device Model, reported model and size, mismatch warning, last seen, user agent, online dot | UI | Device details, `ui/components/device/DeviceStatusOverview.vue` | glance | The online dot (`ui/utils/isDeviceOnline.ts`) means "seen within one `refreshRate`"; the offline Alert Rule uses `refreshRate` times the offline multiplier. The two can disagree. Nothing shows that a Device is currently inside its Sleep Mode window. |
| 7 | See identity and credentials: friendly id, MAC (copy), API key (reveal) | UI | Device details, below the status row | rare | No way to regenerate an API key anywhere (UI or API). |
| 8 | Set the refresh rate (number + unit) | UI | Device details, "Advanced" expansion panel, `DeviceHardwareControlsSection.vue` | setup | Behind "Advanced", and only saved by the header's "Update". |
| 9 | Trigger a Special Function (`identify`, `sleep`, `add_wifi`, `rewind`; `restart_playlist` and `send_to_me` offered but marked unavailable) | UI | Device details, "Advanced", own "Trigger" button | rare | Behind "Advanced". No feedback on whether the Device has picked it up yet. |
| 10 | Reset a Device (`resetDevice`, sent as `reset_firmware` on the next poll) | UI | Device details, "Advanced", "Reset device" button | rare | Destructive, no confirmation, no explanation of what it does. Not a `CONTEXT.md` term. |
| 11 | Mirroring: enable, mirror MAC, mirror API key (same MAC as the Device means proxy mode) | UI | Device details, "Advanced", `DeviceMirroringSection.vue` | setup | Behind "Advanced". Mirroring disables Sleep Mode and Firmware for the Device (`CONTEXT.md`), but the UI does not say so. "Mirroring" has no glossary entry of its own. |
| 12 | Read Device Logs: severity, message, time, source file and line, expandable device status and extra fields | UI | Device details, "Logs" card at the bottom of the right column | rare | No filter, search or paging. README roadmap still lists "Device Logs Viewer" as not done. "Device Log" is not a glossary term. |
| 13 | Clear a Device's logs | UI | Same card, "Clear Logs" | rare | No confirmation. |
| 14 | Change a Device's MAC or friendly id | API | `PATCH /api/devices/:id` accepts `mac`, `friendlyId` (and telemetry fields) per `api/devices/dto/update-device.dto.ts` | rare | Possibly unintended API surface rather than a feature. Worth a decision. |

## 2. Device Model and Palette

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 15 | Override a Device's Device Model | UI | Device details, "Advanced", `DeviceModelPaletteSection.vue` | setup | Behind "Advanced". The mismatch warning in the status row says "Check the model in Advanced". |
| 16 | Choose a Device's Palette (default: richest available) | UI | Same section | setup | Same. |
| 17 | Sync Device Models and Palettes from TRMNL; see counts, deprecated count, last sync | UI | Maintenance, "Device Models" card. `POST /api/device-models/sync` | rare | There is no browsable list of Device Models or Palettes anywhere; they appear only as select options. |
| 18 | Preview content as another Device Model and Palette | UI | `ui/components/RenderTargetPicker.vue`, inside the Plugin preview dialog and the HTML Preview page | setup | Not available when previewing a Device's existing Screen. |
| 19 | Create a custom Palette (name, Palette Family, colours) | API | `POST /api/device-models/palettes` | setup | No UI. README lists custom Palettes as a feature. Assigning one looks API-only too: the UI's Palette select is built from the Device Model's curated `paletteIds` (`palettesFor` in `ui/stores/deviceModels.ts`), while a custom Palette's compatibility is derived by family (ADR-0014), so it would not be offered. Read from code, not run. |
| 20 | Delete a custom Palette | API | `DELETE /api/device-models/palettes/:id` | rare | No UI. No delete guard by design (ADR-0015): assigned Devices fall back silently. |

## 3. Screen, Order, Rotation, Active Screen, Current Screen

Today: Device details, "Add Screen" card (`ui/components/AddScreenCard.vue`, five tabs), "Screens" card (`ScreenListCard.vue`, `ScreenTable.vue`, `ScreenListItem.vue`) and "Current Screen" card (`ScreenPreviewCard.vue`).

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 21 | Add an external-link Screen, fetched on every poll or cached | UI | Add Screen, "External Link" tab | setup | A shared "Filename" field sits above the tabs but the Mashup and Plugin tabs ignore it and have their own submit. |
| 22 | Add a file Screen (PNG, JPEG, BMP upload) | UI | Add Screen, "Upload File" tab | setup | Disabled in demo mode. |
| 23 | Add a raw HTML Screen, with a preview before adding | UI | Add Screen, "Render HTML" tab | setup | Plain textarea. |
| 24 | See a Device's Screens in Order: type, name, Schedule summary, Active or Queued | UI | "Screens" card | glance | "Queued" is shown even for a Screen its Schedule currently excludes. No thumbnail. |
| 25 | Reorder Screens (drag, or up/down buttons) | UI | "Screens" card. `PATCH /api/screens/device/:id/reorder` | setup | |
| 26 | Preview one Screen (image, HTML, or a Plugin's or Mashup's cached output) | UI | Screen row, eye icon | setup | Plugin and Mashup previews show an info message until the first render. External-link rows get "open link" instead of a preview. |
| 27 | Refresh a cached external image | UI | Screen row, refresh icon (cached external Screens only). `POST /api/screens/:id` | setup | |
| 28 | Delete a Screen | UI | Screen row | setup | No confirmation. |
| 29 | See the Current Screen: the Active Screen's image and when it was generated | UI | "Current Screen" card, left column under the Device information | glance | Arguably the most-wanted glance, yet it sits below the settings card. No manual refresh. No way to advance Rotation or pick the Active Screen by hand. |
| 30 | List every Screen across all Devices | API | `GET /api/screens` | rare | Unused by the UI. |

Gaps that are not capabilities yet: a Screen cannot be edited after creation (no rename, no change of link, no HTML edit). There is no update endpoint in `api/screens/screens.controller.ts`, so this is absent from the API as well as the UI.

## 4. Schedule

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 31 | Create or edit a Screen's Schedule: enabled toggle, weekdays, daily window (may cross midnight), active date range | UI | Screen row, Schedule button, `ui/components/ScreenScheduleDialog.vue` | setup | The button label is the Schedule summary itself ("Always", "Mon, Tue · 08:00–17:00"), which does not read as a button. |
| 32 | Remove a Schedule | UI | Same dialog, "Remove schedule" | rare | |
| 33 | See each Screen's Schedule state at a glance (always, active rule, disabled) | UI | Screens table, Schedule column | glance | The server's timezone is mentioned in prose but its actual value is never shown. When no Screen is eligible, nothing explains why the Device shows the fallback. |

## 5. Render Signal

Nothing shipped. Decisions: ADR-0031 and the `CONTEXT.md` entry.

| # | Capability | Tier | Source | Notes |
|---|---|---|---|---|
| 34 | `skip`: a Screen's own content leaves it out of Rotation | Decided | #1069 (`ready-for-agent`) | API only. Adds a stored verdict to the Screen read response. |
| 35 | `hold`: a Screen keeps showing its previous image | Decided | #1070 (`ready-for-agent`, blocked by #1069) | API only. |
| 36 | Read-only chip on the Screen list: "Skipping" or "Holding image", with an explanation on hover and focus | Decided | #1071 (`ready-for-agent`, blocked by #1069) | No override, clear or re-evaluate action. The new Screen list needs a slot for it. |

## 6. Mashup

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 37 | Create a Mashup Screen: name, one of 7 layouts, a Plugin per slot | UI | Device details, Add Screen, "Mashup" tab (`ui/components/AddMashupCard.vue`) | setup | Layouts are a text select with no visual of the slot arrangement. Slot Plugins are chosen from every Plugin, not only assigned ones. |
| 38 | Preview a Mashup's cached output | UI | Screen row, eye icon | setup | |
| 39 | Delete a Mashup | UI | Screen row, delete | rare | |
| 40 | Edit a Mashup: rename, change layout, change slot Plugins | API | `PUT /api/mashup/:id` | setup | No UI. Today the admin must delete and recreate. |
| 41 | Read a Mashup's configuration (layout and which Plugin fills which slot) | API | `GET /api/mashup/:id/configuration` | glance | No UI. After creation nothing shows what a Mashup contains. `GET /api/mashup/layouts` also exists; the UI hardcodes the list in `ui/types/mashup.ts`. |

## 7. Plugin and Data Source

Today: `/plugins` (`ui/views/PluginsOverviewView.vue`, `PluginCard.vue`, `PluginCardActions.vue`), `/plugins/create` (three-step wizard) and `/plugins/:id/edit` (one long form).

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 42 | See all Plugins: name, description, number of Devices | UI | Plugins page, card grid | glance | Cards show no Plugin Kind, no refresh interval, no health, no Recipe origin. Each card carries six equal-weight buttons. |
| 43 | Create a `Poll`-kind Plugin: name, description, refresh interval, Data Sources, template | UI | `/plugins/create`, wizard | setup | Create is a wizard, edit is a single form: two different shapes for the same object. The "Plugin Type" select is disabled at `Poll`. |
| 44 | Edit a Plugin | UI | Plugin card, "Edit" | setup | Saving navigates away to the list, so save-and-keep-editing is impossible. No unsaved-changes guard. |
| 45 | Edit Data Sources: add, remove, name, Data Source Mode (`fetch` or `literal`), URL, method (GET or POST), headers, body, JS transform, literal JSON | UI | `ui/components/PluginDataSourcesEditor.vue`, in both create and edit | setup | Headers, body, transform and literal value are plain textareas holding JSON or JS. Data Sources cannot be reordered. |
| 46 | Edit the Liquid template, with a collapsible syntax help | UI | `ui/components/PluginTemplateEditor.vue` | setup | Plain textarea, no highlighting. The help does not mention the implicit `sensors` object or the Data Source variable names. |
| 47 | Preview a Plugin: rendered output for a chosen Device Model and Palette, plus the fetched data | UI | "Preview" button in create step 3 and in edit; `ui/components/PluginPreviewDialog.vue`. `POST /api/plugins/preview` | setup | A modal on top of the editor, so the template and its preview are never visible together. |
| 48 | Duplicate a Plugin | UI | Plugin card | rare | |
| 49 | Export a Plugin as `.trmnlp` | UI | Plugin card, "Export". `GET /api/plugins/:id/export` | rare | |
| 50 | Delete a Plugin (confirms, warns about its Plugin Assignments) | UI | Plugin card | rare | |
| 51 | Import a Plugin from a `.trmnlp.yml` or `.zip` file | UI | Plugins page, "Import Plugin", "Upload File" tab | setup | The dialog requires a target Device although the API's `deviceId` is optional. All copy says "Terminus plugin". |
| 52 | Import a Plugin from a GitHub repository URL | UI | Same dialog, "GitHub URL" tab | setup | Same. |
| 53 | See a Data Source's Fetch Failure Streak, last attempt and last error | API | Fields on `api/plugins/entities/plugin-data-source.entity.ts`, written by the scheduler | glance | Shown nowhere in the Plugin UI. The only trace is an Alert on the Maintenance page once the threshold is reached, and that Alert does not link to the Plugin. |
| 54 | Plugin field values and Plugin Variables (including secret ones) | API | Entities `PluginFieldValue`, `PluginVariable`; carried by the Configuration Archive | setup | The edit form's "Plugin Configuration" panel collects field values but uses them only for the preview; saving discards them. No admin endpoint writes field values or Variables; in the code read, only Configuration Import creates them. Needs a product decision, not just a screen. |
| 55 | Edit templates other than the first (other layouts of an imported Plugin) | API | `templates[]` on `PATCH /api/plugins/:id` | setup | The UI edits `templates[0]` only and shows "Layout options will be available when plugin mashups are supported", although Mashups exist. |

## 8. Webhook-kind Plugin (Webhook Token, Merge Strategy, Stream Limit, Webhook Payload)

Entirely API-only. Nothing in `packages/ui/src` references a Webhook beyond an explanatory sentence on the Configuration card.

| # | Capability | Tier | Where it lives today | Freq. | Notes |
|---|---|---|---|---|---|
| 56 | Create a `Webhook`-kind Plugin with its Merge Strategy and, for `stream`, its Stream Limit | API | `POST /api/plugins` (`api/plugins/dto/create-plugin.dto.ts`) | setup | Both are fixed at creation, so the create flow is the only place to ask. |
| 57 | See and copy a Plugin's Webhook URL | API | `webhookToken` on the Plugin read response | setup | The first thing an admin needs after creating one. |
| 58 | Regenerate the Webhook Token | API | `POST /api/plugins/:id/webhook-token` | rare | |
| 59 | Read the stored Webhook Payload | API | `GET /api/webhook/:token` | rare | Useful for debugging a template. |
| 60 | Clear the stored Webhook Payload | API | `DELETE /api/plugins/:id/webhook-payload` | rare | |

Also: opening a Webhook-kind Plugin in today's edit form would show the Data Sources editor and refresh interval, which do not apply to it.

## 9. Plugin Assignment

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 61 | Assign a Plugin to Devices, or unassign, from the Plugin | UI | Plugin card, "Assign to Devices" dialog (`ui/components/PluginAssignDialog.vue`) | setup | The dialog promises "You can enable/disable per device later", which no UI offers. |
| 62 | Assign a Plugin from the Device, with a "Create new plugin" shortcut that assigns on save | UI | Device details, Add Screen, "Plugin" tab (`ui/components/AddPluginCard.vue`) | setup | |
| 63 | Unassign from the Device's Screen list | UI | Screen row, delete on a Plugin Screen (tooltip "Unassign plugin from this device") | rare | Same icon as deleting a Screen, different consequence. |
| 64 | Change an assignment's `isActive` and `order` | API | `PATCH /api/plugins/device-assignment/:devicePluginId` | rare | No UI. Overlaps with Schedule's enabled toggle and Screen Order; may be vestigial. Also unused: `GET /api/plugins/device/:deviceId`. |

## 10. Recipe

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 65 | Import a Recipe by id or trmnl.com URL | UI | Plugins page, "Import Plugin" dialog, "Recipe" tab | setup | Third tab of a dialog whose button tooltip reads "Import from Terminus or GitHub (Beta)" and whose empty state says "Import from Terminus". The Recipe path is the README's headline import and the least visible one. Requires a target Device. |
| 66 | Run a Recipe Update Check: see Update Items grouped by Plugin details, templates, Data Sources and fields, with diffs and conflicts; apply all, some, or dismiss; save a baseline when there is no Recipe Snapshot | UI | Plugin card, "Check for Updates" (only on Plugins with a source Recipe); `ui/components/PluginRecipeUpdateDialog.vue` | rare | Nothing on the card says a Plugin came from a Recipe other than this button appearing. |

## 11. Sleep Mode

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 67 | Configure Sleep Mode: enable, window start and end, dedicated sleep screen or frozen image | UI | Device details, "Advanced", last section (`DeviceSleepModeSection.vue`) | setup | Last item inside a collapsed panel, saved by the header's "Update". Shares a name with the `sleep` Special Function two sections above it. Not disabled or explained for a mirrored Device. |
| 68 | Upload, preview and remove a custom sleep image per Device | Decided | #1064 (`ready-for-agent`); follow-up foreseen by ADR-0013 | setup | Lives in the Sleep Mode section; travels in the Configuration Archive. |

## 12. Firmware

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 69 | See available Firmware: version, Firmware Kind, label, compatible Device Models, deprecated count, last sync | UI | Maintenance, "Firmware" card | rare | |
| 70 | Sync official Firmware from TRMNL | UI | Same card, "Sync from TRMNL" | rare | |
| 71 | Upload custom Firmware: version, label, compatible Device Models, `.bin` | UI | Same card, upload form | rare | |
| 72 | Delete a custom Firmware | UI | Same card, list row | rare | No confirmation. |
| 73 | Assign a target Firmware to a Device and push it ("Update now"); see the reported version and "Update pending" | UI | Device details, "Advanced", `DeviceFirmwareSection.vue` | rare | Firmware is split across two pages. The README says to pick a Firmware "under Maintenance", which is wrong. No visible way to cancel a pending push. |
| 74 | Turn Firmware Auto-Update on or off, or reset it | UI | Maintenance, "Settings" card, "Firmware" subsection | rare | A third location for Firmware, separate from the Firmware card on the same page. |

## 13. Sensor

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 75 | See a Device's current Sensor readings (CO₂, humidity, pressure, temperature) | UI | Device details, "Sensors" card (`ui/components/DeviceSensorsCard.vue`); rendered only when readings exist | glance | No empty state, so an admin without the add-on never learns the feature exists. |
| 76 | Sensor readings and Fetch Failure Streaks on `GET /metrics` | Decided | #1067 (`ready-for-agent`) | | No admin UI. Listed so the new UI does not try to grow its own charts: ADR-0026 gives history to Prometheus. |

## 14. Alert, Alert Rule, Notification

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 77 | See active Alerts and those resolved in the last 7 days (capped at 50) | UI | Maintenance, "Alerts" card (`ui/components/maintenance/AlertsCard.vue`). `GET /api/alerts` | glance | A daily-glance item on the rare-maintenance page. No indicator in the navigation or on the Overview. A Data Source Alert names its Plugin and Data Source as plain text with no link. Read-only by decision (ADR-0024): no acknowledge, snooze or resolve. |
| 78 | See a Device's active Alerts as chips | UI | Device details, status row | glance | |
| 79 | Send a Test Notification | UI | Maintenance, Alerts card | rare | The UI does not show whether Apprise is configured at all (`KUROSHIRO_APPRISE_URL`); the admin finds out by pressing the button. |

Alert Rule thresholds are edited through Instance Settings (#80).

## 15. Instance Settings

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 80 | Override or reset the Alert Rule thresholds (low battery percent, offline multiplier, fetch failure threshold), each showing its fallback source | UI | Maintenance, "Settings" card (`ui/components/maintenance/SettingsCard.vue`). `GET` and `PATCH /api/settings` | rare | Sixth card on the Maintenance page. One Save button per field. The card is titled "Settings", the glossary term is Instance Settings. Firmware Auto-Update (#74) is the fourth Setting. |
| 81 | Retention ages (resolved Alerts, Device Logs) as two more Instance Settings | Decided | #1062 (`ready-for-agent`) | rare | The Retention card would then show effective values; the Settings card edits them. |

## 16. Configuration Archive

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 82 | Configuration Export, with the plaintext-secrets warning shown beforehand | UI | Maintenance, "Configuration" card. `GET /api/config/export` | rare | The card is titled "Configuration", a word the glossary reserves for the Configuration Archive, sitting next to a "Settings" card. |
| 83 | Export a Redacted Archive instead | UI | Same card, "Redact secrets" checkbox. `?redact=true` | rare | |
| 84 | Configuration Import, with a summary of created and updated records and warnings | UI | Same card, "Import configuration" dialog. `POST /api/config/import` | rare | Designed for a fresh instance (ADR-0021), so it belongs in first-run as much as in maintenance. Today a fresh instance offers no hint that restoring is possible. |

## 17. Housekeeping: storage cleanup and Retention

Neither "Retention" nor the storage scan has a `CONTEXT.md` entry.

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 85 | Scan storage for orphaned Screen files, orphaned Device directories, broken Screens, temporary files and old uploads; see a summary | UI | Maintenance; runs on page load and via "Scan System". `GET /api/maintenance/scan` | rare | The page is headed "Maintenance Dashboard" and its header describes only this scan, but the results render at the very bottom, under six unrelated cards. |
| 86 | Clean up selected findings, with dry run and confirmation | UI | Maintenance, "Cleanup Actions" card (appears once something is selected) | rare | Dry run is on by default, so the first click never deletes. |
| 87 | See Retention ages and the last run; preview and confirm a manual Retention run | UI | Maintenance, "Retention" card. `GET /api/maintenance/retention`, `POST /api/maintenance/retention/run` | rare | Ages are read-only until #1062. Last-run data is lost on restart. |
| 88 | Storage totals (file count, total size) | API | `GET /api/maintenance/stats`; fetched by `ui/stores/maintenance.ts` but rendered by no component | rare | Orphaned store method. |

## 18. Tools

Neither has a `CONTEXT.md` entry.

| # | Capability | Tier | Where it lives today | Freq. | Hard to find / notes |
|---|---|---|---|---|---|
| 89 | Virtual Device: call `/api/setup` for a MAC or an existing Device, then `/api/display` with editable headers; see the raw response and the image | UI | `/virtualDevice` (`ui/views/VirtualDeviceView.vue`), a top-level nav item | rare | Has real side effects the page does not mention: `/setup` creates a Device, `/display` advances Rotation and overwrites the Device's telemetry. A top-level slot for a troubleshooting tool. |
| 90 | HTML Preview: live-render HTML for a chosen Device Model and Palette | UI | `/htmlPreview` (`ui/views/HtmlPreviewView.vue`), a top-level nav item | setup | A scratchpad detached from the "Render HTML" Screen tab it exists to serve; the HTML has to be copied across by hand. |

## 19. App shell

| # | Capability | Tier | Where it lives today | Freq. | Notes |
|---|---|---|---|---|---|
| 91 | Switch light and dark theme | UI | App bar icon (`ui/App.vue`) | rare | Follows the system on load; the manual choice is not persisted. |
| 92 | See the running version and the demo-mode banner | UI | App bar title; banner under it | glance | The UI decides demo mode from the hostname (`ui/composeables/useDemoInfo.ts`), the API from `KUROSHIRO_DEMO_MODE`. Navigation is duplicated: top tabs on desktop plus a drawer, with different contents. |

## 20. Outside the admin UI, but the admin's concern

| # | Capability | Tier | Where it lives today | Notes |
|---|---|---|---|---|
| 93 | Prometheus metrics: battery, RSSI, last seen per Device; active Alerts per kind | API | `GET /metrics` (`api/metrics/metrics.controller.ts`), unauthenticated, outside `/api` | By design no UI (ADR-0026). The UI nowhere mentions the endpoint exists. |

Not counted, because the admin sets them outside Kuroshiro: `KUROSHIRO_APPRISE_URL`, `KUROSHIRO_APPRISE_KEY`, the two Retention ages (until #1062), `KUROSHIRO_API_URL`, `KUROSHIRO_PORT`, `KUROSHIRO_DEMO_MODE` and the database variables (`api/config/config.ts`). The new UI may want to *show* the effective values of the first group, since several UI states depend on them.

The four fallback screens (`welcome`, `noScreen`, `error`, `sleep`; `api/device-models/fallback-screens.service.ts`) are generated per Device Model and Palette and are not admin-configurable. They are in the map's brand scope, not this inventory.

---

## Hard to find or orphaned: the short list

Ordered by how much an admin loses today.

1. **Webhook-kind Plugins** (#56 to #60): a whole advertised feature with no UI.
2. **Custom Palettes** (#19, #20): advertised, API-only.
3. **Mashup contents and editing** (#40, #41): create-only in the UI.
4. **Plugin field values and Variables** (#54): the form accepts values and drops them.
5. **Fetch Failure Streak** (#53): the one health signal a Plugin has, visible nowhere near the Plugin.
6. **Alerts** (#77): daily-glance information on the rare-maintenance page, with no global indicator.
7. **Everything under "Advanced"** (#8 to #11, #15, #16, #67, #73): refresh rate, Device Model, Palette, Sleep Mode, Firmware push, Special Function, Reset and Mirroring share one collapsed panel and one "Update" button far away in the header. Refresh rate and Sleep Mode are ordinary setup, not advanced.
8. **Firmware in three places** (#69 to #74): the Firmware card, the Settings card, and each Device's "Advanced".
9. **Recipe import** (#65): the third tab of a dialog labelled for Terminus.
10. **First run** (#1, #2, #84): no guidance on pointing a Device at the server, no mention of auto-provisioning, no offer to restore a Configuration Archive.
11. **Assignment enable/disable** (#64): promised by UI copy, API-only.
12. **Current Screen** (#29): the main glance, below the settings card and with no refresh.
13. **Storage stats** (#88): fetched, never rendered.

## Explicitly cut or declined (no open issue)

Not a tier of this inventory, but the information architecture should neither reserve space for these nor make them impossible later.

| Idea | Source |
|---|---|
| Skip-if-stale TTL; per-Screen duration and Palette overrides; Device grouping; pause/resume API | ADR-0008, ADR-0015; ADR-0031 keeps the TTL cut |
| Recipe gallery; OAuth Recipes; automatic Recipe updates | ADR-0011, ADR-0030 |
| Per-Device timezone | ADR-0009, ADR-0013; #1064 records it as declined in #1030 |
| Alert acknowledge, dismiss, snooze, manual resolve; pagination of resolved Alerts; reminders; per-Device thresholds | ADR-0023, ADR-0024 |
| Sensor history; server-attached sensors | ADR-0019, ADR-0026 |
| Firmware binary validation; auto-assigning custom Firmware | ADR-0016, ADR-0029 |
| Configuration Archive migrations; importing onto a non-fresh instance | ADR-0021; #1062 records migrations as declined in #1061 |
| Manual override of a Render Signal; showing it in the Plugin editor preview | ADR-0031, #1071 |
| Multi-user accounts and login | README comparison table ("Single admin, no login") |

## Vocabulary gaps noticed

Concepts the UI, README or issues name that `CONTEXT.md` does not define. The map requires UI copy to use the glossary exactly, so these need a decision before copy is written (candidates for the `/domain-modeling` skill; nothing was edited here).

- **Mirroring** (and "proxy mode"): used inside the Special Function, Sleep Mode and Firmware entries, never defined.
- **Device Log**, **Retention**: used by the UI, README and #1062.
- **Reset** (the `resetDevice` action).
- **Virtual Device**, **HTML Preview**.
- **Plugin field**, **Plugin Variable**: "secret Plugin Variables" appears in the Configuration Archive entry without its own definition.
- **Fallback screen** and its four kinds.
- **Online / offline** as a Device state: the UI and the Alert Rule define it differently.

Today's UI also drifts from the glossary in places: "Plugin Type" for Plugin Kind, "Settings" for Instance Settings, "Configuration" as a card title, lowercase "plugin" and "screen" throughout.

## What could not be verified

- **Frequencies are judgements**, not usage data. Kuroshiro collects none.
- **Nothing was run.** Every "where it lives" entry comes from reading source at `4406aef`, not from clicking through a running instance. Behavioural notes (for example "no confirmation") are read from the click handlers.
- **Plugin field values and Variables (#54):** a search of `packages/api/src` found only Configuration Import creating `PluginFieldValue` and `PluginVariable` rows. Whether the file, GitHub or Recipe importers create them through a path that search missed was not traced.
- **Fetch Failure Streak (#53):** the fields are on the Data Source entity and nothing in the UI renders them; whether every Plugin read response actually serialises them was not confirmed against a live response.
- **Custom Palette assignment (#19):** that a custom Palette is missing from the Device's Palette select is inferred from `palettesFor` and `DeviceModelsService.findAll`; it was not tried against a running instance.
- **#1030 and #1061** are cited as "declined" on the word of #1062 and #1064; the issues themselves were not opened.
- **Closed issues were not surveyed.** Only open issues were read, so an idea closed as `wontfix` or parked without an ADR is absent from the "cut or declined" table.
