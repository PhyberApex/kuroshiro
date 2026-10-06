# Spec: the Instance surfaces and the Alerts page

Everything under **Instance** in the rebuilt admin UI (Instance Settings, Firmware, Device Models and Palettes, Configuration Archive, Housekeeping, Device Simulator) and the Alerts page behind the bar's indicator. Read [README.md](./README.md) first; its shared patterns (loading, a failed load, saving, destructive actions, fresh data, time, phone) apply here and are not repeated.

- **Reference.** [App shell and navigation](https://github.com/PhyberApex/kuroshiro/issues/1080) approved the Instance template: the pages as a list at the left of the column, the chosen page beside it. [Primary journeys and the story each screen tells](https://github.com/PhyberApex/kuroshiro/issues/1078) set that Alerts show in place and behind one indicator. The page patterns are those of [devices.md](./devices.md) and [plugins.md](./plugins.md).
- **Drawings.** [`packages/ui/prototypes/instance-surfaces`][proto] on the throwaway branch `prototype/instance-surfaces`, at commit `f3eb076`. Open `index.html` in a browser; `t` switches the theme, `d` the number of Devices (1, 3, none), `a` the firing Alert, `l` loaded, loading or failed, `n` whether Notifications are set up, `s` the outcome of the storage check, `m` demo mode. Each section below links the renders it describes.
- **Facts.** How the server behaves today was read from `main` at `a90b42e`. Nothing was run.

## Routes

| Route | Shows |
|---|---|
| `/instance` | Redirects to `/instance/settings`. |
| `/instance/settings` | Instance Settings. The sections answer to `#alert-rules`, `#notifications`, `#retention` and `#fixed`. |
| `/instance/firmware` | The Firmware library and Firmware Auto-Update. |
| `/instance/firmware/upload` | Upload Firmware. |
| `/instance/models` | Device Models and Palettes. `?palette=new` opens the form for a new custom Palette, `?palette=:paletteId` the form of that one. |
| `/instance/archive` | Configuration Archive: Configuration Export and Configuration Import. |
| `/instance/housekeeping` | Stored files and Retention. The Retention section answers to `#retention`. |
| `/instance/simulator` | The Device Simulator. `?device=:deviceId` preselects the Device. |
| `/alerts` | The Alerts page. |

In the bar, "Instance" is current on every `/instance` route. On `/alerts` no section is current; the indicator, when shown, is.

## The Instance frame

[render][settings-light] · [phone][phone-settings]

- Title "Instance". Under it the frame approved in the app shell: the six pages as a list at the left, 13.5 rem wide, the chosen one solid ink; the chosen page beside it. The list stays in view while the page scrolls.
- The pages, in this order: "Instance Settings", "Firmware", "Device Models and Palettes", "Configuration Archive", "Housekeeping", "Device Simulator".
- **A page's heading line** is its name in the title face at `title-sm` on a 2 px ink rule, with the page's actions at its right. Sections inside a page are headed at `text-lg`, weight 600, on a 1 px rule, so a page reads as one page and not as a second list of pages.
- **Under the list**, below a rule, two things that belong to the app and not to a page:
  - **Appearance.** A segmented control, "System", "Light", "Dark". "System" follows the system preference and is the default. The choice is kept in this browser and saved nowhere else.
  - **The version.** "Kuroshiro {version}", the version in mono. It is the server's version, read with the Instance facts; the UI ships in the same release.
- **Phone.** The list becomes a row of tabs that scrolls sideways, the current one underlined. Appearance and the version move to the foot of the page.
- **Demo mode** ([render][demo]). While demo mode is on, one line sits under the bar on every page of the app, on `wash`: "This is the Kuroshiro demo. Image uploads are off, and anyone can change what you see here." The UI learns it from the server, not from the address.

## Instance Settings

`/instance/settings` · [one Device][settings-light] · [three Devices, dark][settings-dark] · [a value out of range][settings-invalid] · [Notifications off][settings-notify-off] · [a Test Notification sent][settings-test] · [loading][settings-loading] · [phone][phone-settings]

**For:** the values that hold for the whole Instance. Opens with "Values for this whole Instance. Changes save as you make them." Every control saves as changed; there is no page-level save.

### How a Setting shows where its value comes from

Each Setting is a row: the label, the control inside a sentence, and at the right where the value comes from.

| State | At the right |
|---|---|
| Not overridden, falling back to the built-in default | "Built-in default" |
| Not overridden, falling back to an environment variable | "From `{VARIABLE}`" |
| Overridden | "Set here · Reset to {fallback}". "Reset to {fallback}" clears the override at once and asks nothing; the field then shows the fallback. |

- The field always holds the value in force. Entering a number overrides; there is no separate "override" switch.
- A value outside its range is not sent. The field gets the doubled ink border and the range replaces the explanation under the row. A fallback from the environment is shown as it is, even when it lies outside the range the field accepts.
- Under each row, one or two sentences say what the value does, using the value itself.

### Alert Rules

Section heading "Alert Rules", with the link "Alerts" at its right.

| Row | Control | Under the row | Range message |
|---|---|---|---|
| Battery low | "below {n} %" | "Fires when a Device's battery is below {n} %, and resolves once it is back at {n + 5} %." | "Enter a whole number from 1 to 100." |
| Offline | "after {n} missed polls" | "Fires when a Device has not polled for {n} times its refresh rate. {Device} polls every {m} minutes, so that is {n × m} minutes without a poll. Sleep Mode's window does not count." With no Device or several, the middle sentence is "For a Device polling every 15 minutes that is {n × 15} minutes without a poll." | "Enter a whole number, 2 or more." |
| Fetch Failure Streak | "of {n} failed fetches" | "An Alert fires when the streak reaches {n}. A Plugin that fetches every 15 minutes gets there after {n × 15} minutes." The first sentence is the Plugin page's, word for word. | "Enter a whole number, 1 or more." |

Under the section: "A change applies at the next Alert Sweep, within 5 minutes."

### Notifications

- **Set up** ([render][settings-light]). Two rows.
  - "Apprise": the address in mono, "From `KUROSHIRO_APPRISE_URL`" at the right. Under it: "Each Alert is announced there when it fires and again when it resolves. Which channels it reaches is set in Apprise."
  - "Test Notification": the button "Send a Test Notification". Under it: "Travels the same way as a real Notification and belongs to no Alert." Pressing it disables the button and shows "Sending, up to 15 seconds" with the loading mark at the right, then "Sent. Look for it in your channels." for as long as the page stays open, or "Not sent" with, under the row, "Apprise did not accept it. Check that the Apprise sidecar is running, and its logs."
- **Not set up** ([render][settings-notify-off]). No rows. "**Notifications are off.** Alerts still fire and show here; nothing is sent anywhere." Then: "To turn them on, run an Apprise sidecar, set `KUROSHIRO_APPRISE_URL` to its address and restart Kuroshiro. Alerts that fired while Notifications were off are announced then."

### Retention

Section heading "Retention", with the link "Housekeeping" at its right. The two ages of [#1062](https://github.com/PhyberApex/kuroshiro/issues/1062); until that is built the rows show the ages without a field.

| Row | Control | Under the row | Range message |
|---|---|---|---|
| Resolved Alerts | "kept for {n} days" | "A firing Alert is never removed." At 0: "Resolved Alerts are kept for good." | "Enter a whole number of days, or 0 to keep them for good." |
| Device Log entries | "kept for {n} days" | "0 keeps them until you clear a Device's Logs." At 0: "Device Log entries are kept until you clear a Device's Logs." | the same |

Under the section: "Retention runs every day at 04:00, server time. A change applies at the next run."

### Set where Kuroshiro is started

Read-only. "Read from the environment at start. To change one, change the variable and restart Kuroshiro." Then four rows, each a label, the value and one line under it:

| Row | Value | Line under it |
|---|---|---|
| Server URL | the address in mono | "The address every Device is given for its images and Firmware. `KUROSHIRO_API_URL`" |
| Timezone | the timezone's name, "Europe/Berlin" | "Schedules, Sleep Mode and the 04:00 jobs run on this clock. `TZ`" |
| Metrics | "{server URL}/metrics" in mono | "For Prometheus: battery, signal and last seen per Device, firing Alerts per kind. Anyone who can reach this server can read it." |
| Demo mode | "On" or "Off" | Off: "While on, image uploads are refused. `KUROSHIRO_DEMO_MODE`" On: "Image uploads are refused and Kuroshiro only fetches public addresses. `KUROSHIRO_DEMO_MODE`" |

Last line of the page: "Firmware Auto-Update is an Instance Setting too. It is switched on the Firmware page." (a link). It has one home, beside the Firmware it acts on.

**Loading:** the page's heading, "Loading the Instance Settings" and `wash` bars for the rows. **Failed:** the notice "Could not load the Instance Settings."

## Firmware

`/instance/firmware` · [three Devices, earlier Firmware open][firmware-light] · [Firmware Auto-Update on, dark][firmware-auto] · [a new official Firmware synced][firmware-synced] · [sync failed][firmware-sync-failed] · [no Firmware yet][firmware-empty] · [load failed][firmware-failed] · [phone][phone-firmware]

**For:** seeing which Firmware this Instance can push, and where each one is headed.

- Actions on the heading line: "Upload Firmware" (plain) and "Sync from TRMNL" (primary).
- Lede: "Every Firmware a Device can be pushed to. Which one a Device gets is chosen in that Device's Settings."

### Firmware Auto-Update

One row above the library: a switch, "On" or "Off", saving as changed.

- Off: "A Device only updates when you press “Update now” in its Settings. While on, each new official Firmware is pushed to every Device it fits."
- On: "Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. It starts with the next official Firmware; Devices are not caught up to {newest version} now."

### Available Firmware

Section heading "Available Firmware", with "Checked TRMNL {when}" at its right. One row per Firmware that is not deprecated, newest first:

- **The version**, in mono at weight 600.
- **What it is**, in `ink-soft`: "Official" or "Custom · {label}", then "Fits {Device Models, by label}" or "Fits every Device Model".
- **Where it is headed**, on the next line, each part only when it applies: "Goes out to {Devices} at the next poll" in ink at weight 500, for Devices with a push of it pending; "Running on {Devices}", for Devices that report this version.
- **A missing file**, with the problem icon: "Its file is missing, so it cannot be pushed. Delete it and upload it again." This is a custom Firmware that came in with a Configuration Import.
- **At the right:** "Synced {date}" or "Uploaded {date}", and on a custom row "Delete".

Under the rows, tucked and closed: "Earlier official Firmware ({n})". "Replaced by {newest version} and no longer offered as a target. A Device that already targets one keeps it." Then the deprecated rows, without actions.

Last line: "Kuroshiro asks TRMNL for the newest official Firmware when it starts and every day at 04:00, server time. TRMNL's update feed only carries Firmware for the TRMNL OG; any other Device Model needs an upload."

### Sync from TRMNL

Pressing it disables the button and shows one line under the lede, which stays until the page is left:

| Outcome | Line |
|---|---|
| Running | the loading mark and "Asking TRMNL for the newest official Firmware" |
| Nothing new | "Nothing new. {version} is still TRMNL's newest official Firmware." |
| A new one, Firmware Auto-Update off | "Synced {version}. No Device is given it until you choose it as that Device's target." |
| A new one, Firmware Auto-Update on | "Synced {version}. Firmware Auto-Update made it the target of {Devices}; it goes out at their next poll." With no eligible Device: "Synced {version}. No Device it fits is free to take it." |
| Failed | the notice "**Could not sync from TRMNL.** {the server's reason}" with "Try again" |

### Delete a custom Firmware

[render][confirm-firmware]

"Delete Firmware {version}?" · when a Device has a push of it pending: "{Device} has it as its target Firmware, with a push pending. Deleting cancels that push." · Lost: "Firmware {version} ({label}) and its file." and, when it applies, "The pending push to {Device}." · Stays: "Every Device goes on running the Firmware it has. No Device has this one as its target.", or "{Device} goes on running the Firmware it has, with no target." · "Delete Firmware". An official Firmware cannot be deleted and has no button.

### Empty, loading, failed

- **Empty** ([render][firmware-empty]): "No Firmware yet" · "Kuroshiro fetches the official Firmware from TRMNL when it starts and every day at 04:00. This Instance has not reached TRMNL yet." · "Sync from TRMNL" (primary) and "Upload Firmware". Firmware Auto-Update stays above it.
- **Loading:** "Loading the Firmware" and three rows of `wash` bars. **Failed:** the notice "Could not load the Firmware."

## Upload Firmware

`/instance/firmware/upload` · [render][firmware-upload]

**For:** adding a Firmware TRMNL does not publish. A page inside the Instance frame, with the back link "Firmware" above its heading. A form, in the shared pattern.

| Field | Control | Notes |
|---|---|---|
| Firmware file | a drop zone, "Drop a .bin here, up to 8 MB." with "Choose file" | Required. Another type: "A Firmware file ends in .bin." Larger: "This file is {size}. A Firmware can be up to 8 MB." |
| Version | text input, mono | Required: "A Firmware needs a version." Hint: "As the Firmware reports it. A Device shows this as its version once it runs it." A version that exists: "There is already a Firmware {version}. Give this one a version that tells them apart." |
| Label | text input, marked "optional" | Hint: "Told apart by this in a Device's Settings. Without one the file's name is used." |
| Fits | two picks | "Only these Device Models": "It is offered to, and can be pushed to, Devices of these Device Models only.", with one checkbox per Device Model that is not deprecated, at least one required. "Every Device Model": "Nothing stops it from being pushed to a Device it was not built for." "Only these Device Models" is preselected, with nothing ticked. |

- Above the buttons, with the problem icon: "Kuroshiro cannot tell whether a file is working Firmware. A Device pushed a wrong one may not start again."
- "Upload Firmware" (primary), "Cancel", and beside them: "Version, label and Device Models cannot be changed afterwards."
- After a successful upload the Firmware page opens with the new row first.

## Device Models and Palettes

`/instance/models` · [three Devices][models-light] · [everything opened, dark][models-all] · [adding a custom Palette][models-add] · [editing one][models-edit] · [phone][phone-models]

**For:** custom Palettes, and looking up what Kuroshiro knows about a panel.

- Action on the heading line: "Sync from TRMNL" (plain).
- Lede: "What Kuroshiro knows about panels. A Device Model sets an image's size, a Palette the greys or colours it is reduced to. Which ones a Device uses is chosen in that Device's Settings."

### Custom Palettes

Section heading "Custom Palettes", with "Add a custom Palette" at its right. This section comes first: it is the only thing on the page an admin makes.

- One row per custom Palette, by name: the name at weight 600; its colours as swatches and its Palette Family in words; at the right the Devices that use it by name, "Edit" and "Delete".
- **Empty:** "None yet. A colour panel rarely shows the exact red or yellow TRMNL's Palette assumes. A custom Palette holds the colours your panel really shows, so images are reduced to those."
- **The form** opens in place, under the section heading for a new one and under its row for an existing one. One form is open at a time.

  | Field | Control | Notes |
  |---|---|---|
  | Name | text input | Required: "A Palette needs a name." |
  | Palette Family | select of the five colour families, "{name in words} · {id}" | Hint: "The inks the panel has. It decides which Device Models can use this Palette." While a Device uses the Palette the select is disabled and the hint ends ", and cannot be changed while a Device uses it." |
  | Colours | one row per colour: a swatch, a mono input, a remove button; "Add a colour" under them | Hint: "One per ink, as `#RRGGBB`: the colour the panel really shows, not the ideal one. An image is reduced to exactly these." An invalid one: "Enter a colour like #B53A30." At least one. |

  Buttons: "Add Palette" or "Save Palette" (primary) and "Cancel". When Devices use the Palette, beside the buttons: "Saving converts {Devices}'s stored images again."

  The five families, in words: "Black, white and red" (`3bwr`), "Black, white and yellow" (`3bwy`), "Black, white, red and yellow" (`4bwry`), "Six colours" (`6a`), "Seven colours" (`7a`).
- **Delete** ([render][confirm-palette]). "Delete the Palette {name}?" · Lost: "The custom Palette and its {n} colours." · Stays: "{Device}, which goes back to its Device Model's richest Palette, {Palette}. Its stored images are converted again.", or "Everything else. No Device uses it." · "Delete Palette".
- A swatch shows the Palette's own colour. It is the one place outside a Screen's image where the admin UI shows a colour that is not ink, paper or the seal's red, because the colour is the data.

### Device Models

Section heading "Device Models", with "{N} from TRMNL, checked {when}" at its right.

- **The Device Models in use,** one row each: the label at weight 600; its size in mono and the names of the Palettes it supports; at the right the Devices that use it, by name. A deprecated one adds, with the problem icon: "TRMNL no longer lists this Device Model."
- With no Device: "No Device uses one yet. A Device is given its Device Model from what it reports at its first poll."
- Tucked, closed: "The other {n} Device Models" ("All {N} Device Models" when none is in use). A search field, "Find a Device Model", filtering by label as it is typed, and the same rows. Nothing here can be edited.
- Tucked, closed: "TRMNL's Palettes ({n})". "Synced from TRMNL and not editable. Each Device Model lists the ones it supports." One row each: the name, its swatches and its id in mono, and the Devices that use it.

Last line: "Kuroshiro syncs both from TRMNL when it starts and every day at 04:00, server time. Without a connection it uses the list it was shipped with."

### Sync from TRMNL

As on the Firmware page, one line under the lede: "Asking TRMNL for its Device Models and Palettes", then "Synced: {n} Device Models and {m} Palettes." followed, when there are any, by "{k} Device Models are no longer listed by TRMNL and stay usable." A failure is the notice "**Could not sync from TRMNL.** {reason} What you see is from {when}."

**Loading:** "Loading the Device Models and Palettes". **Failed:** the notice "Could not load the Device Models and Palettes."

## Configuration Archive

`/instance/archive` · [one Device][archive-light] · [a fresh Instance, dark][archive-fresh] · [an archive read, before confirming][archive-checked] · [imported][archive-imported] · [refused][archive-refused] · [phone][phone-archive]

**For:** taking everything built on this Instance out as one file, and bringing it back in.

Lede: "One .zip holding what you built on this Instance: Devices, Screens with their Schedules, Mashups, Plugins with their Field Values, custom Palettes and the Instance Settings you set."

### Configuration Export

Two rows, each a name, what it is for and its own button. Either button starts the download at once and reads "Download started" for 2 seconds.

- **"With its secrets"**, button "Export" (primary). "The archive to restore from. Devices keep their API keys, so they go on polling a restored Instance without being set up again." Then, with the problem icon and in ink, before the button is pressed and not after: "Holds every Device API key, mirror API key, Webhook Token, Data Source header and password Field Value as written. Keep it like a password."
- **"Redacted Archive"**, button "Export redacted". "The same with every secret replaced by a placeholder. Safe to share or to keep in a repository. Restored onto a fresh Instance, each Device and Webhook sender has to be set up again."

Under the rows: "Not in either: rendered images, Webhook Payloads, Sensor readings, Device Logs, Alerts, the files of custom Firmware and anything synced from TRMNL. A File Screen's image is included."

### Configuration Import

An import never happens on the first step. The server reads the archive and says what importing it would do; only "Import Configuration Archive" changes anything.

1. **Choose.** "Made for a fresh Instance, like this one. Kuroshiro reads the archive first and changes nothing until you confirm." On an Instance with Devices the first sentence is "Made for a fresh Instance. This one already has {n} Devices, so read what an import would change before you confirm it." Then a drop zone: "Drop a Configuration Archive here: the .zip a Configuration Export made." with "Choose file".
2. **Reading.** The loading mark and "Reading {file name}".
3. **What it would do** ([render][archive-checked]). A list of label and value, then the buttons.

   | Label | Value |
   |---|---|
   | Archive | The file's name in mono. "A Configuration Archive from Kuroshiro {version}, exported {date and time}.", or "A Redacted Archive from …". |
   | Adds | Counts by kind in the glossary's words, naming Devices: "1 Device (Hallway), 4 Plugins, 9 Screens with their Schedules, 1 Mashup, 1 custom Palette, 1 custom Firmware". "Nothing" when it adds nothing. |
   | Overwrites | "1 Device (Kitchen), 6 Plugins and 5 Screens that are already here under the same id. What you changed on them since the export is lost." Left out on a fresh Instance. |
   | Replaces | "The Instance Settings, with the {n} the archive holds. The others go back to their fallback." |
   | Leaves | "Everything here that is not in the archive. An import deletes nothing." Left out on a fresh Instance. |
   | Mind | The server's warnings, one line each with the problem icon. Left out when there are none. |

   "Import Configuration Archive" (primary), "Cancel", and "Nothing has changed yet."
4. **Imported** ([render][archive-imported]). "**Imported.** Added {n} records and overwrote {m}. The Instance Settings were replaced." Then the same warnings under "To do now", and "Devices", "Plugins" and "Import another". On an Instance that had no Device, the bar gains the imported Devices at once.

**The warnings,** worded by kind:

| Cause | Line |
|---|---|
| A Device API key was redacted and the Device is new here | "{Device}'s API key was redacted. {Device} gets a new one and has to be set up again." |
| A Webhook Token was redacted and the Plugin is new here | "The Webhook Token of {Plugin} was redacted. It gets a new Webhook URL; whatever posts to it needs the new one." |
| A Data Source header was redacted and there is none here | "A header of {Plugin} · {Data Source} was redacted and is left out. Enter it on the Plugin's page." |
| A mirror API key was redacted and there is none here | "{Device}'s mirror API key was redacted. Mirroring is off for {Device} until you enter it." |
| A password Field Value was redacted and there is none here | "{Plugin}'s Field Value “{label}” was redacted and is empty." |
| A custom Firmware | "Firmware {version} comes without its file. Upload it again before pushing it." |
| A Device Model, Palette or Firmware the archive names is not known here | "{Device} names a Device Model this Instance does not know. It is resolved again at its next poll.", and the same shape for a Palette ("… and uses its Device Model's richest Palette.") and a target Firmware ("… and has no target Firmware."). |

**Refused** ([render][archive-refused]). A notice in place of step 3, with "Choose another file":

| Cause | Notice |
|---|---|
| Another archive version | "**This archive cannot be imported.** It was made with archive version {n}, and this Kuroshiro reads version {m}. Export it again from an Instance running Kuroshiro {version}." |
| Not a Configuration Archive | "**This is not a Configuration Archive.** It has to be the .zip a Configuration Export made." |
| A record the database refuses | "**This archive cannot be imported.** {the server's reason} Nothing was changed." |

## Housekeeping

`/instance/housekeeping` · [findings, one group open][housekeeping-light] · [a Screen ticked, dark][housekeeping-screens] · [nothing to clean up][housekeeping-clean] · [checking][housekeeping-scanning] · [phone][phone-housekeeping]

**For:** what Kuroshiro keeps that nothing needs any more, and what removes it. Lede: "What Kuroshiro keeps that nothing needs any more, and what removes it."

### Stored files

Section heading "Stored files", with "Check again" at its right. The check runs when the page opens.

- **Checking:** the loading mark and "Checking stored files".
- **Nothing found** ([render][housekeeping-clean]): "Nothing to clean up. Screen images take {size} in {n} files."
- **Findings** ([render][housekeeping-light]). "Screen images take {size} in {n} files. Checked {when}." Then one row per group that has findings, in this order:

  | Group | Counted as | When opened |
  |---|---|---|
  | "Images no Screen uses" | files | "{N} image files left behind by Screens that were deleted or replaced." |
  | "Folders of deleted Devices" | folders | "The image folder of a Device that is no longer registered." |
  | "Temporary files older than a day" | files | "{N} leftovers of renders that did not finish." |
  | "Uploads older than a day" | files | "{N} uploaded files that were never turned into a Screen." |
  | "Screens whose image is missing" | Screens | "The Screen “{name}” on {Device} and its Schedule. Its image is already gone, so {Device} shows the error Fallback Screen at its turn today." |

  A row is a checkbox, the group's name, its count, its size, and a chevron. It opens in place and lists what it holds: paths below the storage folder in mono with their sizes, or for Screens "{name}, a {kind} Screen on {Device}" and its Order.
- **What is ticked.** The four groups of files are ticked. "Screens whose image is missing" is not: cleaning it up deletes Screens. Under the rows, at the left: "A Screen whose image is missing is left alone unless you tick it.", or once ticked "Cleaning up deletes {n} Screens."
- **"Clean up {n} groups"** (primary), disabled with nothing ticked. It confirms ([render][confirm-cleanup]): "Clean up {n} groups?" · Lost: each ticked group as "{Group}: {count}, {size}.", and for Screens "The Screen “{name}” on {Device} and its Schedule." · Stays: "Every Screen that has its image, and every Device." and, while the Screens group is not ticked, "The Screen “{name}”, at whose turn {Device} shows the error Fallback Screen." · "Clean up".
- **Afterwards:** "**Cleaned up.** Removed {n} files and {m} folders, {size}. Nothing to clean up. Screen images take {size} in {n} files." Anything the server could not remove is a notice above it: "**{n} could not be removed.**" with the server's reasons, and those findings stay listed.
- There is no dry run. The list is what would be removed, and the confirmation says it again.

### Retention

Section heading "Retention", with the link "Change the ages" at its right, which opens Instance Settings at `#retention`.

- "Every day at 04:00, server time, Retention deletes resolved Alerts older than {n} days and Device Log entries older than {m} days." An age of 0 drops its half and adds "{Resolved Alerts / Device Log entries} are kept for good." With both at 0: "Retention is off: both ages are 0."
- "Last Retention Run {when}: removed {n} resolved Alerts and {m} Device Log entries.", or "Retention has not run since Kuroshiro was started."
- **"Run Retention now"** (plain), disabled while Retention is off. It first asks the server what a run would remove, showing "Counting what is old enough". With nothing to remove it says "Nothing is old enough to remove." and asks nothing. Otherwise it confirms ([render][confirm-retention]): "Run Retention now?" · Lost: "{n} resolved Alerts older than {a} days and {m} Device Log entries older than {b} days." (a half that is zero reads "No resolved Alert is old enough.") · Stays: "Firing Alerts, and everything newer than the ages." · "Run Retention". Afterwards: "**Retention Run finished.** Removed {n} resolved Alerts and {m} Device Log entries."

**Loading:** "Loading Housekeeping". **Failed:** the notice "Could not load Housekeeping.", or under the Stored files heading "Could not check the stored files." with "Try again", while Retention stays usable.

## Device Simulator

`/instance/simulator` · [before a poll, three Devices][simulator-before] · [polled as a Device][simulator-polled] · [a Device with a Firmware push pending, dark][simulator-pending] · [a Device that is not registered][simulator-new] · [phone][phone-simulator]

**For:** seeing what the server answers a Device, without the Device. Lede: "Makes the two calls a Device's firmware makes, from this browser, and shows what the server answers. For finding out why a Device shows what it shows, without walking to it."

Two columns: the answer at the left, the controls at the right.

### The controls

- **"Poll as"**: a select of the Devices by name, then "A Device that is not registered". With `?device=` that Device is chosen; otherwise the first by name; with no Devices the last entry.
- **"MAC address"**, only for a Device that is not registered: a mono input and "Make one up". Hint: "Calling setup with a MAC address nobody registered creates a Device. It stays until you delete it."
- **Tucked, closed: "What it reports".** For a Device: "Filled with what {Device} last reported, so a poll leaves its facts as they are. Change one to see what the server does with it." Otherwise: "What the simulated Device tells the server about itself." Six mono inputs, each with the header it is sent as under it: "Battery voltage" (`Battery-Voltage`), "Signal, dBm" (`RSSI`), "Firmware version" (`FW-Version`), "Model" (`Model`), "Width" (`Width`), "Height" (`Height`).
- **What a call does,** between two rules, always visible:
  - For a Device: "**A poll here is a real poll.** It moves {Device}'s Rotation on by one Screen, counts as {Device} having been seen, and takes any pending Special Function, Device Reset or Firmware push, which then never reaches the Device." When one is pending the sentence names it in ink: "… and takes **the Firmware push of {version}**, which then never reaches the Device."
  - For a Device that is not registered: "**Setup here is a real setup.** It registers a Device with this MAC address, and a poll gives it the welcome Fallback Screen."
- **"Poll as {Device}"** (primary) and **"Call setup"** (plain). For a Device that is not registered the first reads "Poll" and is disabled until setup has been called.
  - While something is pending for the Device, "Poll as {Device}" confirms: "Poll as {Device}?" · Lost: "The pending {Firmware push of {version} / Device Reset / Special Function {name}}. The simulator takes it and the Device never gets it." · Stays: "{Device}, its Screens and its Settings." · "Poll as {Device}". Without anything pending it polls at once.

### The answer

- **Before a call:** an empty plate on `wash` with a dashed border, "Nothing polled yet".
- **After "Call setup":** under the plate, "Setup answered with {Device}'s API key and friendly id. Nothing changed.", or "**Setup registered a Device.** It is called {friendly id} until you name it, and has its API key." The bar gains the new Device.
- **After a poll** ([render][simulator-polled]): the image the answer points to, on a plate with the hero's 2 px ink border. Under it, as label and value:

  | Label | Value |
  |---|---|
  | Shows | "{Screen}, Order {n} of {N}", or which Fallback Screen |
  | Polls again in | "{n} min" |
  | Firmware | "no update", or "told to update to {version}" |
  | Special Function | "none pending", or its name |
  | Device Reset | only when the answer carries one: "told to reset" |

  Then, tucked and open, "The answer as the Device gets it": the answer as a code block with "Copy".
- **A refused call** is a notice in place of the plate: "**The server refused the poll.** {status and reason}", for example an API key the server does not know.

The simulator has no loading state of its own beyond the Devices in its select.

## The Alerts page

`/alerts` · [two firing, three Devices][alerts-firing] · [one firing, dark][alerts-one] · [nothing firing, Notifications off][alerts-quiet] · [nothing at all][alerts-nothing] · [loading][alerts-loading] · [failed][alerts-failed] · [phone][phone-alerts]

**For:** everything that is wrong right now, in one list, and what was wrong lately. It is the page behind the bar's indicator. It has no entry in the bar or the Instance list of its own; while nothing fires it is reached from "Alerts" beside the Alert Rules.

- Title "Alerts". No actions.
- **Firing,** newest first, straight under the title. A row, left to right:
  - **The Alert,** in red with the red square, in the words the Device and Plugin specs use: "Alert: battery low", "Alert: offline", "Alert: a Data Source keeps failing".
  - **Its subject,** a link: the Device by name, opening its Screens view; or "{Plugin} · {Data Source}" with the Data Source's name in mono, opening `/plugins/:pluginId?source=:name`.
  - **Why,** in `ink-soft`: "Battery at {n} %, below {threshold} %" · "Last seen {when}, {duration} ago" · "{n} fetches failed in a row. The last answer: {error}" with the error in mono.
  - **Since when,** at the right: "since 08:10", "since yesterday, 21:35".
- **Nothing firing:** one line in place of the list, with the check icon: "No Alert is firing."
- **What is watched,** under the list, in `ink-soft`: "Every 5 minutes Kuroshiro checks each Device for a battery below {n} % and for {n} missed polls, and each Data Source for a Fetch Failure Streak of {n}. An Alert resolves by itself once its cause is gone; there is nothing to dismiss." and the link "Change the Alert Rules".
- **Notifications,** one line: "Each Alert is announced through Apprise when it fires and when it resolves.", or "**Notifications are off**, so an Alert only shows here, on its Device and on its Plugin." Either ends with the link "Notifications", which opens Instance Settings at `#notifications`.
- **"Resolved in the last 7 days"**, newest first. A row is the same four cells with nothing red and the kind in the past: "Battery low", "Offline", "A Data Source kept failing"; why it fired ("Battery at 17 %", "No poll for 1 h 5 min", "3 fetches failed in a row: {error}"); and "{when it fired}, for {duration}". With 50 rows, a last line: "The 50 most recent." Empty: "Nothing resolved in the last 7 days."
- The page asks the server again every 30 seconds, like a Device's Screens view.
- **Loading:** "Loading Alerts" and two rows of `wash` bars. **Failed:** the notice "Could not load the Alerts."

An Alert whose Device or Plugin was deleted is deleted with it, so every row has a subject to link to.

## Phone

Works fully below 820 px: the Alerts page; Instance Settings, with every field; the Firmware page with Firmware Auto-Update, "Sync from TRMNL" and deleting; reading Device Models and Palettes and syncing them; Configuration Export; Retention with "Run Retention now".

Only has to stay readable: Upload Firmware, the custom Palette form, Configuration Import, the stored-files check and the Device Simulator. Their forms stack to one column and can be used, but nothing is tuned for a phone.

A library row stacks to the name with its date and button on one line and what it is below. An Alert row stacks to the Alert, then subject and time, then why.

## Components this spec adds

Each uses the tokens and rules of [Design tokens and component inventory](https://github.com/PhyberApex/kuroshiro/issues/1091), and the row menu, save bar, code block and checkbox [plugins.md](./plugins.md) added.

| Component | Backed by | States |
|---|---|---|
| Page list | `nav` with a list of links; on phone a scrolling row. No primitive | default, hover (`wash`), current (solid ink), focus |
| Setting row with its source | the Settings row of [devices.md](./devices.md), with the source and "Reset to {fallback}" in its note | default, set here, saving, saved, invalid, not saved |
| Result line | `role="status"`, an icon or the loading mark and one sentence | running, done |
| Library row | `li`, three cells: name, what it is, date and actions | default, with a problem, with a form open under it |
| Swatches | a row of 14 px squares with a 1 px `ink-soft` border, `aria-hidden`; the colours are named in text beside it or in the form | — |
| Colour row | a 32 px swatch, a mono text input, a remove button | default, invalid, focus |
| Finding row | `AccordionRoot` (single, collapsible) with a checkbox outside the trigger | unticked, ticked, open |
| Summary list | `dl` of label and value on rules | — |
| Empty plate | the plate on `wash` with a 1 px dashed `ink-soft` border | — |

No icon joins the thirteen.

## Capability coverage

Numbers are those of the [capability inventory](https://github.com/PhyberApex/kuroshiro/issues/1075).

| # | Capability | Home |
|---|---|---|
| 17 | Sync Device Models and Palettes; see counts, deprecated ones, last sync | Device Models and Palettes, "Sync from TRMNL" and the section headings. They are now also a list. |
| 19 | Create a custom Palette | Device Models and Palettes, Custom Palettes. Editing one is added. |
| 20 | Delete a custom Palette | The same |
| 69 | See available Firmware | Firmware, Available Firmware and the tucked earlier ones |
| 70 | Sync official Firmware | Firmware, "Sync from TRMNL" |
| 71 | Upload custom Firmware | Upload Firmware |
| 72 | Delete a custom Firmware | Firmware, "Delete", now with a confirmation |
| 74 | Turn Firmware Auto-Update on or off, or reset it | Firmware, the switch. It has no fallback but "off", so "reset" is switching it off. |
| 77 | See firing Alerts and those resolved in the last 7 days | The Alerts page |
| 79 | Send a Test Notification | Instance Settings, Notifications |
| 80 | Override or reset the Alert Rule thresholds, each with its fallback source | Instance Settings, Alert Rules |
| 81 | Retention ages as Instance Settings | Instance Settings, Retention; read on Housekeeping |
| 82 | Configuration Export, warned beforehand | Configuration Archive, "With its secrets" |
| 83 | Export a Redacted Archive | Configuration Archive, "Redacted Archive" |
| 84 | Configuration Import with its summary and warnings | Configuration Archive, Configuration Import; linked from Connect a Device on a fresh Instance |
| 85 | Scan storage and see a summary | Housekeeping, Stored files |
| 86 | Clean up selected findings, with dry run and confirmation | Housekeeping, "Clean up {n} groups". The dry run is gone; see Departures. |
| 87 | See Retention ages and the last run; preview and confirm a run | Housekeeping, Retention |
| 88 | Storage totals | Housekeeping, the first line of Stored files |
| 89 | Device Simulator | Device Simulator |
| 91 | Switch light and dark | The Instance frame, Appearance |
| 92 | See the running version and the demo banner | The Instance frame, under the list; the demo line under the bar |
| 93 | Prometheus metrics | No screen by design (ADR-0026). Instance Settings names the address. |

Capability 78 (a Device's firing Alerts) is homed by [devices.md](./devices.md) and 73 (a Device's target Firmware) likewise; 90 (HTML Preview) is Edit HTML there.

## What this asks of the admin API

A request list for [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096), which settles the shapes. [devices.md](./devices.md) already asks for the Instance facts (server URL, timezone, demo mode) and [plugins.md](./plugins.md) for the Plugin's id on a fetch Alert; both are leaned on here.

**To add**

1. Instance facts beyond those already asked for: whether Notifications are set up and the Apprise address without its key, and the server's version.
2. Reading a Configuration Archive without importing it: what it would add and overwrite by kind, with the names of the Devices, the Instance Settings it holds, its manifest, and the warnings an import would give.
3. On each warning of an import, a kind and the record it is about, so the page can word it. Today a warning is a sentence.
4. Updating a custom Palette. ADR-0035 calls them freely editable; only create and delete exist.
5. On a Firmware: whether its file is present, and the Devices that target it with whether a push is pending.
6. On a Firmware sync: the Devices Firmware Auto-Update assigned, by id and name. Today it is a count.
7. On an Alert: why it fired, kept after it resolves. Today the details are overwritten on every Alert Sweep and at resolve, so a resolved fetch Alert reads a streak of 0 and no error.
8. The findings of a storage check carry an id, the Screen's name, kind, Device and Order for a Screen, and a path below the storage folder instead of an absolute one.
9. When the last sync with TRMNL ran, for Firmware and for Device Models, as a fact of its own. Today it is read off the newest row.
10. The two Retention ages as Instance Settings, which is [#1062](https://github.com/PhyberApex/kuroshiro/issues/1062).

**To change**

1. Deleting a custom Firmware clears a pending push of it. Today the Device keeps "update pending" for good: its target becomes empty, the flag stays, no push is ever served, and Firmware Auto-Update skips the Device from then on.
2. A push with no target, or to a mirrored Device, is refused. Today both are accepted and never served.
3. Uploading a Firmware refuses a version that exists and Device Models the Instance does not know, and answers a too-large file with the limit.
4. Deleting or changing a custom Palette converts the stored images of the Devices that used it again. Today only a change on the Device does.
5. Creating a custom Palette checks that the name is not taken.
6. An import that is not a .zip, or whose files are not readable, is refused with a reason. Today it is a server error.
7. An import hands the Poll Plugins it brought to the scheduler. Today they do not fetch until a restart or a save.
8. The Configuration Archive carries Field Values per Plugin and redacts password Field Values, as `CONTEXT.md` and ADR-0032 describe. Today they are per Plugin Assignment and a Redacted Archive holds them as written. This rides on [#1101](https://github.com/PhyberApex/kuroshiro/issues/1101).
9. A cleanup takes the ids of findings, checks each again before removing it, and deletes a Screen the way deleting a Screen does, closing the gap in the Order. Today it removes whatever paths and Screen ids it is sent, under a check that only looks for a folder name in the path.
10. An HTML Screen that was never polled is not a Screen whose image is missing. Today it has no image yet and is listed as one.
11. The last Retention Run survives a restart.
12. A Device that has never polled is not offline. Today it carries a fixed past date as its last seen and the offline Alert fires at the next Alert Sweep.
13. Switching Notifications on does not announce Alerts that resolved while they were off. Today every stored resolved Alert that was never announced gets a "recovered" Notification. The page's sentence ("Alerts that fired while Notifications were off are announced then") covers the firing ones only.
14. The Alert list answers for one Device and for one Plugin, as [devices.md](./devices.md) asks.
15. Saving a Plugin keeps its firing fetch Alert, as [plugins.md](./plugins.md) asks. Today the Alert is deleted with the recreated Data Source, without a Notification.

**To remove:** the `dryRun` of a cleanup, which no screen sends; and `GET /api/maintenance/stats` once the check answers the totals.

## Departures

- **Firmware Auto-Update lives on the Firmware page,** not among the Instance Settings. It was in three places; it has one, beside the Firmware it acts on, and Instance Settings links there.
- **The Test Notification lives under Instance Settings,** with the state of Apprise, not on the Alerts page. ADR-0024 put the button on the Alerts surface; here the Alerts page links to it.
- **The cleanup has no dry run.** The old page defaulted to a dry run and then asked again. The list of findings is the preview and the confirmation names what is lost.
- **A Configuration Import is read before it is confirmed.** The old dialog imported on its one button.
- **Custom Palettes can be edited,** as ADR-0035 intended.
- **"Virtual Device"** is the Device Simulator, after the glossary; **"Maintenance"** is gone as a page and as a word: its six cards are five Instance pages and the Alerts page.
- **The Device Simulator fills in what the Device last reported.** The old page sent its own defaults, so every simulated poll overwrote the Device's battery, signal and Firmware version.
- **Earlier official Firmware is shown,** tucked. The old list left deprecated rows out.
- **A Palette's colours are shown as colours,** the one exception to black, white and the seal's red outside a Screen's image.
- **The approved Instance template's rows are regrouped.** It drew Firmware Auto-Update as the last row of the Firmware list and "Sync now" as the button; here the switch leads the page and the button reads "Sync from TRMNL".

## Open points

**Decided on the agent's own call; the maintainer may want to overturn them**

- The Alerts page is not in the Instance list. While nothing fires it is reached from "Alerts" beside the Alert Rules, and from nowhere in the bar.
- The Retention ages are edited under Instance Settings and only read on Housekeeping.
- Appearance and the version sit under the Instance list, not in the bar. Appearance is kept per browser.
- The demo line is on every page and cannot be dismissed.
- "Reset to {fallback}" asks nothing.
- A fallback from the environment that is out of range is shown as it is, without a warning.
- The four groups of files are ticked by default and Screens are not. Findings are ticked by group, not one by one.
- Device Models show only those in use; the rest are tucked behind a search. TRMNL's Palettes are tucked too.
- A custom Palette's Palette Family cannot be changed while a Device uses it.
- Uploading a Firmware preselects "Only these Device Models" with nothing ticked, so fitting every Device Model is a choice someone makes.
- A custom Firmware whose file is missing can only be deleted and uploaded again; there is no "replace file".
- The simulator confirms a poll only while something is pending for the Device.
- Resolved Alerts stay at 7 days and 50 rows, as ADR-0024 set, though Retention keeps them for 90 days.
- "Sync from TRMNL" is the Firmware page's primary button and a plain one on Device Models and Palettes, where adding a custom Palette is the thing to do.

**Left undecided**

- **Whether reading an archive before importing is worth its endpoint.** If [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096) declines it, step 3 becomes a confirmation that can only say what an import does in general: "Records with the same id are overwritten, the Instance Settings are replaced, nothing is deleted."
- **A size limit for an archive.** None is set in the code. The page states none.
- **What the server reports as its timezone** when `TZ` is not set.
- **The numbers a custom Palette's family expects.** The server accepts any number of colours for any family. The form does not say "three" for a three-ink family; whether it should is the API ticket's call.
- **What a Device shows about a missing Firmware file.** A Device whose target Firmware has no file retries at every poll without saying so. Its Settings page belongs to [devices.md](./devices.md).
- **Authentication.** No admin route asks for any, `/metrics` included, and `/api/setup` hands a registered Device's API key to anyone who knows its MAC address. The page says who can read the metrics; it does not say that the admin UI itself is open. That is a decision about the product, not about this page.

[proto]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces
[settings-light]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-light.png
[settings-dark]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-dark-three.png
[settings-invalid]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-invalid.png
[settings-notify-off]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-notifications-off.png
[settings-test]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-test-sent.png
[settings-loading]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/settings-loading.png
[demo]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/demo-line.png
[firmware-light]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-light.png
[firmware-auto]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-dark-auto.png
[firmware-synced]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-synced.png
[firmware-sync-failed]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-sync-failed.png
[firmware-empty]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-empty.png
[firmware-failed]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-failed.png
[firmware-upload]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/firmware-upload.png
[confirm-firmware]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/confirm-delete-firmware.png
[models-light]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/models-light.png
[models-all]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/models-all-dark.png
[models-add]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/models-add-palette.png
[models-edit]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/models-edit-palette.png
[confirm-palette]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/confirm-delete-palette.png
[archive-light]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/archive-light.png
[archive-fresh]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/archive-fresh-dark.png
[archive-checked]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/archive-checked.png
[archive-imported]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/archive-imported.png
[archive-refused]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/archive-refused.png
[housekeeping-light]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/housekeeping-light.png
[housekeeping-screens]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/housekeeping-screens-dark.png
[housekeeping-clean]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/housekeeping-clean.png
[housekeeping-scanning]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/housekeeping-scanning.png
[confirm-cleanup]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/confirm-cleanup.png
[confirm-retention]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/confirm-retention.png
[simulator-before]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/simulator-before.png
[simulator-polled]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/simulator-polled.png
[simulator-pending]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/simulator-pending-dark.png
[simulator-new]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/simulator-new.png
[alerts-firing]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-firing.png
[alerts-one]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-one-dark.png
[alerts-quiet]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-quiet.png
[alerts-nothing]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-nothing.png
[alerts-loading]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-loading.png
[alerts-failed]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/alerts-failed.png
[phone-settings]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-settings.png
[phone-firmware]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-firmware.png
[phone-models]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-models.png
[phone-archive]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-archive.png
[phone-housekeeping]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-housekeeping.png
[phone-simulator]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-simulator.png
[phone-alerts]: https://github.com/PhyberApex/kuroshiro/blob/f3eb076/packages/ui/prototypes/instance-surfaces/shots/phone-alerts.png
