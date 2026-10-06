# Spec: the Device surfaces

Everything under **Devices** in the rebuilt admin UI: a Device's Screens view, an opened Screen of each kind, Add Screen, Edit HTML, Settings, Logs, the Devices list and Connect a Device. Read [README.md](./README.md) first; its shared patterns (loading, a failed load, saving, destructive actions, fresh data, time, phone) apply here and are not repeated.

- **Reference.** The Screens view is the Plate screen approved in [Device details hero screen](https://github.com/PhyberApex/kuroshiro/issues/1081). This spec keeps it and closes what it left open.
- **Drawings.** [`packages/ui/prototypes/device-surfaces`][proto] on the throwaway branch `prototype/device-surfaces`, at commit `661601a`. Open `index.html` in a browser; `t` switches the theme, `d` the number of Devices (1, 3, 7, none), `a` the firing Alert, `s` the scene, `g` whether there are Plugins, `p` simulates one poll. Each section below links the renders it describes.
- **Facts.** How the server behaves today was read from `main` at `d0589c7`. Nothing was run on a Device.

## Routes

| Route | Shows |
|---|---|
| `/` | No Devices: Connect a Device. One Device: that Device's Screens view. Two or more: the Devices list. |
| `/devices` | The Devices list. With no Devices it redirects to `/connect`. |
| `/devices/:deviceId` | The Device's Screens view. `?screen=:screenId` opens that Screen's row and scrolls to it. |
| `/devices/:deviceId/screens/new` | Add Screen. `?kind=plugin\|mashup\|link\|file\|html` preselects the kind. |
| `/devices/:deviceId/screens/:screenId/html` | Edit HTML, for an HTML Screen only. |
| `/devices/:deviceId/settings` | Settings. |
| `/devices/:deviceId/logs` | Logs. |
| `/connect` | Connect a Device. |

`:deviceId` is the Device's id. A Device that does not exist gets the "No Device here" page of the shared patterns ([render][missing]).

## The bar and the Devices

Decides the two limits [App shell and navigation](https://github.com/PhyberApex/kuroshiro/issues/1080) carried forward.

- **Order.** Devices are listed by name, case-insensitive, everywhere: the bar, the Devices list, any Device select.
- **One to four Devices.** The bar names each Device, then "Connect a Device", as approved. A name longer than 16 characters is cut with an ellipsis; the full name is the link's tooltip and accessible name.
- **Five or more Devices.** The bar carries a single entry, "Devices", which opens the Devices list and is current on every Device page and on Connect a Device. "Connect a Device" leaves the bar and is the Devices list's action. A Device page then shows a "Devices" back link above its title ([render][device-of-seven]).
- **When the names do not fit.** If one to four names would not fit on one line at the current width, the bar falls back to the single "Devices" entry as well. The bar never wraps and never scrolls.
- **No Devices.** "Connect a Device" is the only Device entry, as approved.
- **Phone.** The first bottom tab is named after the Device when there is one, "Devices" when there are more, "Connect" when there are none, and opens `/`. Tapping it while already on a Device page or on Connect a Device opens `/devices`, which is how "Connect a Device" is reached with a single Device.

## The Devices list

`/devices` · [three Devices][devices-three] · [seven Devices, one offline, dark][devices-seven] · [phone][phone-devices]

**For:** choosing a Device, seeing at a glance what each one shows.

- Title "Devices". Action on the title line: "Connect a Device" (plain button).
- One row per Device, the whole row a link to that Device's Screens view:
  - The Device's Current Screen as a 168 px plate (112 px on phone). A Fallback Screen or the mirrored image is shown as it is. No seal on a thumbnail.
  - The Device's name at `title-md`.
  - One line saying what it shows: "Showing **{Screen}**" for an Active Screen; otherwise the title the Screens view gives the same state ("Asleep until 06:00", "No Screens yet", "No Screen to show", "Mirrored from TRMNL", "Mirroring failed").
  - One line of facts in `ink-soft`: any firing Alert first, in red with the red square ("Alert: battery low", "Alert: offline"), then "Last seen {when} · Battery {n} %". A Device that never polled reads "Has not called in yet" and has no battery fact.
- No counts, no sorting control, no search. The list is whole at any length.
- **Loading:** three rows with a rendering plate and two `wash` bars, and "Loading Devices". **Failed:** the notice "Could not load the Devices." **Empty:** never shown; no Devices means Connect a Device.

## A Device's Screens view

`/devices/:deviceId` · [light][screens-light] · [dark][screens-dark] · [phone][phone-screens]

**For:** "what is this Device showing, and what comes next." The plate is the one primary thing.

Layout, as approved: title line with the Device's name and "Add Screen" (primary; a link to Add Screen; absent while the Device has no Screens, where the empty block carries it), the tabs Screens, Settings, Logs, then the 576 px plate with a 296 px column beside it, then "Screens in Order" full width. On phone: plate, column, rows.

### The plate and the sentences beside it

The plate always shows the Device's Current Screen. The column's heading and sentences depend on why:

| State | Plate | Heading | Sentences |
|---|---|---|---|
| An Active Screen | its image, with the red seal | the Screen's name | "The Current Screen. Order {n} of {N}, on the Device since the {hh:mm} poll." then "Up next: **{Screen}**, at the poll around {hh:mm}." or, when no other Screen can be shown, "No other Screen can be shown right now, so it stays on." |
| Sleep Mode in its window, sleep Fallback Screen ([render][screens-sleep]) | the sleep Fallback Screen, or the Device's sleep image | "Asleep until {hh:mm}" | "Sleep Mode is in its window, so {Device} shows the sleep Fallback Screen." then "Rotation resumes at {hh:mm} with **{Screen}**." |
| Sleep Mode in its window, keeping the image | the Active Screen's image, no seal | the Screen's name | "Sleep Mode is in its window until {hh:mm} and keeps this image on the Device." then the same resume sentence. |
| No Screens ([render][screens-empty]) | the no-screen Fallback Screen | "No Screens yet" | "{Device} shows the no-screen Fallback Screen until you add one." |
| Screens, but none can be shown ([render][screens-none]) | the no-screen Fallback Screen | "No Screen to show" | "Rotation passes over every Screen here right now, so {Device} shows the no-screen Fallback Screen." then "Open a Screen below to see why." |
| The Active Screen could not be rendered | the error Fallback Screen | "{Screen} could not be shown" | "Kuroshiro could not produce {Screen}'s image at the {hh:mm} poll, so {Device} shows the error Fallback Screen. It tries again when the Screen's turn next comes." |
| Mirroring ([render][screens-mirrored]) | the mirrored image, no seal | "Mirrored from TRMNL" | "The Current Screen is the image of the TRMNL Device {mirror MAC}, fetched at the {hh:mm} poll." then "{Device}'s own Screens are kept but not shown." |
| A Proxied Device ([render][screens-proxied]) | the mirrored image, no seal | "Mirrored from TRMNL" | "The Current Screen is the image of this same Device on TRMNL's server, fetched at the {hh:mm} poll." then "{Device} is a Proxied Device: TRMNL answers its polls and decides its refresh rate and Firmware." |
| Mirroring failed ([render][screens-mirrorfail]) | the error Fallback Screen | "Mirroring failed" | "Kuroshiro could not fetch the image from TRMNL at the {hh:mm} poll, so {Device} shows the error Fallback Screen. It tries again at the next poll, around {hh:mm}." then "Check the mirror MAC address and API key in Settings." (a link) |
| Offline ([render][screens-offline]) | the last image, no seal | the Screen's name | "The last image {Device} was given: Order {n} of {N}, at the {hh:mm} poll. It has not called in since." then "Up next: **{Screen}**, when {Device} calls in again." |
| Never polled | the welcome Fallback Screen | "Waiting for {Device}'s first poll" | "{Device} is registered and has not called in yet." |

- **The seal** sits on the plate only while the plate shows the Active Screen's image and the Device is not offline. It stamps (the one authored motion) when a refresh brings a different Active Screen.
- **The next poll's time** comes from the server, which works it out from the refresh rate the last poll was actually given, so it is right while the Device sleeps and on a Proxied Device. When that moment has passed, sentences say "at its next poll" without a time.
- The plate's image has an accessible name: "On {Device}: {heading}".
- An empty Device shows the no-screen Fallback Screen, not welcome as the approved screen drew it. Welcome is served only in the setup response, so it appears only for a Device that never polled.

### The facts

A `dl` under the sentences. Rows, in this order; a row with nothing to say is left out.

| Row | Value | Notes |
|---|---|---|
| Last seen | "4 min ago" | While the offline Alert fires the row reads "Alert: offline" / "last seen 3 h ago" in red with the red square. |
| Battery | "76 %" | Percent comes from the shared voltage function. While the low-battery Alert fires the label reads "Alert: battery low", in red with the red square. Left out when the Device reports no voltage. |
| Signal | "−61 dBm" | |
| Sleep Mode | "Off", "23:00–06:00", "in its window until 06:00", or "Off while Mirroring" | |
| One row per Sensor | "21.4 °C" | Labels: Temperature, Humidity, Pressure, CO₂. The value and unit as the Device sent them. Only when the Device reports any. |
| Device Model | "reports another size", a link to Settings | Only when the Device reports a width and height that differ from its Device Model's. |
| Special Function | "{name} at the next poll", with the loading mark | Only while one is pending. |
| Device Reset | "at the next poll", with the loading mark | Only while one is pending. |
| Firmware | "{version} at the next poll", with the loading mark | Only while a push is pending. |

Nothing but a firing Alert is red. An Alert is known from the Alert list filtered to this Device, so a fact can turn red up to one Alert Sweep (5 minutes) after the cause.

### Screens in Order

A heading "Screens in Order" on a 2 px ink rule, then one row per Screen. A row, left to right: drag grip, Order, a 72 px thumbnail, the name with the kind in `ink-soft` (Plugin, Mashup, External link, File, HTML), the Schedule switch and summary, the Screen State, a chevron. The name is the button that opens the row.

- **Thumbnail.** The Screen's image as last rendered. A Screen that has never been rendered shows the plate's rendering state. A Screen Rotation passes over has its thumbnail and name dimmed.
- **Schedule summary.** "Always shown" for a Screen without a Schedule. Otherwise seven day marks, Monday first, and the hours or "all day". A Schedule that is off is struck through. The switch appears only when the Screen has a Schedule and saves as changed.
- **Screen State.** One of the six `CONTEXT.md` states, or nothing. The Active Screen's state carries the small red seal.

**Which Screen State a Screen carries.** The first that applies, in this order:

1. **Active Screen.** During Sleep Mode's window it reads "Active Screen, paused".
2. **Schedule off.**
3. **Not today.** The Schedule's weekdays or its dates exclude today.
4. **Not at this hour.**
5. **Skipping.** The Screen raised a `skip` Render Signal.
6. **Up next.** The Screen Rotation turns to at the next poll. During Sleep Mode's window: "Up next at {wake time}". When it is the Picked Screen it gains the qualifier "picked by hand" in `ink-soft`, as "Up next · picked by hand".
7. No state: the Screen waits its turn.

This settles the precedence the glossary ticket left open: the admin's own Schedule comes before the content's Render Signal, because the Schedule is what the admin can change and because a Screen outside its Schedule is not rendered, so its Render Signal is not current. When a Schedule reason and Skipping both apply, the opened row says both.

**Holding image** is not a Screen State. A Screen that raised a `hold` Render Signal still takes its turn, so it keeps its state and gains a qualifier in `ink-soft`: "Active Screen · holding image", "Up next · holding image", or "Holding image" alone when it carries no state. This replaces the chip of [#1071](https://github.com/PhyberApex/kuroshiro/issues/1071); its two labels, "Skipping" and "Holding image", are kept.

**Show next** (ADR-0038). An opened row whose Screen Rotation could show at the next poll, and that is neither the Active Screen nor Up next, offers "Show next". It makes the Screen the Picked Screen, which then reads "Up next · picked by hand"; picking another Screen replaces it. The picked row offers "Back to Order" instead, which clears the pick. Neither confirms. On a mirrored or Proxied Device neither is offered.

**Reordering.**

- Dragging a row by its grip moves it. The lifted row sits on `wash` with a 1 px ink outline; a 2 px ink line shows where it will land. The list scrolls when the pointer nears its edge.
- The grip is a button. Space or Enter lifts the row, the arrow keys move it, Space or Enter drops it, Escape puts it back. A live region says "{Screen}, Order {n} of {N}" on every move.
- On phone the grip is replaced by two buttons, "Move {Screen} earlier in the Order" and "Move {Screen} later in the Order".
- The new Order is saved on drop, with "Saving" then "Saved" on the heading's line. A failed save puts the rows back and shows "Not saved" with "Try again".
- Reordering never changes the Active Screen.

**A Device with many Screens** ([render][screens-many]). Nothing collapses and nothing pages: the Order is only readable whole. From nine Screens on, the heading shows the count, and an opened row offers "Move to top" and "Move to end" beside "Move up" and "Move down". Thumbnails load as they scroll into view.

**No Screens.** In place of the rows, an empty state: "Add {Device}'s first Screen", "A Screen is one thing the Device shows: a Plugin, a Mashup, an image from a link or a file, or HTML you write. With more than one, {Device} steps through them in Order, one per poll.", and "Add Screen" (primary).

**A mirrored Device** ([render][screens-mirrored], [phone][phone-mirrored]). The rows stay and can be opened, edited, reordered, added to and deleted. Above them, a notice: "Rotation is paused while Mirroring is on. These Screens are kept and can still be edited; they return when you switch Mirroring off in Settings." No row carries a Screen State or the seal, and names are in `ink-soft`.

**Loading** ([render][screens-loading]): a rendering plate, "Loading {Device}'s Screens", four `wash` bars for the facts, three empty rows. **Failed** ([render][screens-failed]): the notice "Could not load {Device}'s Screens." above whatever was loaded before.

## An opened Screen

A row opens in place under itself; opening another closes it. `?screen=` in the address follows the opened row. There is no row menu: everything a Screen can do is here.

Opened, a row shows, in this order ([render][screens-mashup], [phone][phone-screens-open]):

1. **Why.** One sentence on why the Screen is or is not showing:

   | State | Sentence |
   |---|---|
   | Active Screen | "On the Device since the {hh:mm} poll." |
   | Active Screen, paused | "On hold while {Device} is in Sleep Mode." |
   | Up next | "Shows at the next poll, around {hh:mm}." |
   | Up next, picked by hand | "Picked by hand: shows at the next poll, around {hh:mm}. Rotation then carries on in Order from it." |
   | Schedule off | "Its Schedule is switched off, so Rotation passes over it. The days and hours are kept." |
   | Not today, by weekday | "Its Schedule leaves out {Thursdays}, so Rotation passes over it today." |
   | Not today, by dates | "Its Schedule only runs from {1 March} to {31 August}, so Rotation passes over it." |
   | Not at this hour | "Its Schedule runs {06:00–09:00} and it is {12:10}, so Rotation passes over it." |
   | Skipping | "Skipping: this Screen's own content asked to be left out of Rotation for now. It returns by itself when the content changes." |
   | no state | "Waiting its turn. It comes after {Screen}." |
   | on a mirrored Device | "Kept while Mirroring is on. It takes its place in Rotation again when Mirroring is switched off." |

   A second sentence in `ink-soft` follows when it applies: "It is also skipping: its own content asked to be left out of Rotation." and "Holding image: its own content asked to keep the previous image, so nothing new is rendered for it."
2. **A preview**, 296 px wide, with a caption: "Rendered {when}" for a Plugin, a Mashup and an External link; "The converted image" for a File; "As {Device} renders it" for HTML. A Screen never rendered shows the rendering plate and "Not rendered yet. It renders when its turn first comes." ([render][screens-never]). A preview is always for this Device's Device Model and Palette.
3. **The Schedule editor.**
4. **What the Screen is made from**, by kind, and its **actions**.

### The Schedule editor

- **Without a Schedule:** "Always shown. A Schedule limits this Screen to certain days and hours." and "Add a Schedule", which creates one for every day, all day, switched on.
- **With one:** the heading "Schedule" with "on" or "off, days and hours kept" and the switch; seven weekday toggles, Monday first; "From {time} to {time}" with an "All day" checkbox that hides the two times; "Only between two dates"; the timezone line; "Remove Schedule".
- **Weekdays.** No day selected means every day, the same as all seven, so the last selected day cannot be switched off. The API counts Sunday as 0; the UI shows Monday first.
- **Hours.** `HH:MM`, both ends count. A "to" earlier than the "from" is allowed and adds the line "This window crosses midnight." Unchecking "All day" fills in 06:00 to 09:00.
- **The date range** ([render][screens-dates]). Checking "Only between two dates" shows "From {date} to {date}" as two date inputs, filled with today and a week from today, and saves them. Both days count. A first day after the last day is refused on the field: "The first day is after the last day." When the last day has passed: "The last day has passed, so this Screen no longer shows." Unchecking clears both dates.
- **Timezone.** "Hours and dates are in the server's timezone, {Europe/Berlin}."
- **Saving.** Every control saves as changed; a time or date saves on blur once the pair is complete and valid.
- **Remove Schedule** confirms ([render][confirm-schedule]): "Remove {Screen}'s Schedule?" · "To keep the days and hours and only stop showing it, switch the Schedule off instead." · Lost: "Its days, hours and dates." · Stays: "{Screen} itself, which is then always shown." · "Remove Schedule".

### By kind

**Plugin** ([render][screens-plugin]). "Rendered from the Plugin {Plugin}, last at {when}." with the name linking to the Plugin page. Then, when they apply:

- For a Webhook-kind Plugin: "It renders again whenever its Webhook URL receives data."
- A required Plugin Field left empty: the problem icon and "A required Plugin Field is empty. Fill it in on the Plugin." (a link).
- A firing fetch Alert on one of its Data Sources: in red with the red square, "Alert: a Data Source of this Plugin keeps failing", linking to the Plugin page.
- Always, in `ink-soft`: "Its name, template and Data Sources are edited on the Plugin and apply to every Device it is assigned to."

A Plugin Screen has no name of its own, so it has no "Rename".

**Mashup** ([render][screens-mashup]). A small drawing of the layout with its name, then one line per slot: the slot's name and a select holding its Plugin. Then "Change layout".

- **Slot Change.** The select lists every Plugin by name. A Plugin already in another slot of this Mashup is disabled, since a Plugin fills one slot at most. Choosing saves as changed and the preview shows the rendering plate until the Mashup is rendered again.
- **Change layout** ([render][screens-layout]) opens a small form in place: the seven layouts as drawings, the slots of the chosen layout as selects, "Save layout" (primary) and "Cancel". It is a form because a layout is only valid with every slot filled.
  - Plugins carry over by slot order. A new slot starts empty ("Choose") and "Save layout" stays disabled until every slot is filled.
  - When the new layout has fewer slots: "{Plugin} no longer has a slot. The Plugin itself stays."
- The seven layouts and their slots, in slot order:

  | API id | Name | Slots |
  |---|---|---|
  | `1Lx1R` | Left and right | Left, Right |
  | `1Tx1B` | Top and bottom | Top, Bottom |
  | `1Lx2R` | One left, two right | Left, Top right, Bottom right |
  | `2Lx1R` | Two left, one right | Top left, Bottom left, Right |
  | `2Tx1B` | Two top, one bottom | Top left, Top right, Bottom |
  | `1Tx2B` | One top, two bottom | Top, Bottom left, Bottom right |
  | `2x2` | Four quarters | Top left, Top right, Bottom left, Bottom right |

**File** ([render][screens-replace]). The file's name in mono, then "{width} × {height} · {size} · uploaded {date}. Converted for {Device Model}, {Palette}." and "Replace file".

- **Replace file** opens in place: a drop zone ("Drop an image here. PNG, JPEG, BMP, GIF, TIFF or WebP." and "Choose file") and "Cancel".
- Once a file is chosen it is uploaded and converted, and the two images are shown side by side, "Now" and "New: {file name}", with "The current image is deleted. The Screen keeps its name, its Order and its Schedule.", "Replace image" (primary) and "Keep the current image".
- A file the server cannot read: "This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP."
- In demo mode "Replace file" is disabled with "Not available in the demo."

**External link** ([render][screens-link]). "Image URL" as a URL input that saves as changed; a radio row with two choices; for a kept image, "Refresh image" with "Fetched {when}".

- "Fetch once and keep": "Kuroshiro keeps the converted image until you refresh it."
- "Fetch on every poll": "Kuroshiro downloads and converts it each time this Screen's turn comes."
- A URL that is not `http` or `https`: "Enter an address that starts with http:// or https://."
- A fetch that fails, on saving the URL or on "Refresh image", shows a message under the field: "Kuroshiro could not fetch an image from this address. {reason}" The earlier image stays.

**HTML.** "Rendered from HTML written here, on every poll." and "Edit HTML", a link to the Edit HTML page.

### Actions

A row of quiet buttons, then the destructive one as a plain button:

- **Rename** (every kind but Plugin; [render][screens-rename]). The name in the row becomes a text input holding the name, selected, with "Save" (primary) and "Cancel". Enter saves, Escape cancels, and focus returns to "Rename". An empty name is refused: "A Screen needs a name."
- **Move up**, **Move down**, and from nine Screens on **Move to top**, **Move to end**. Disabled at the ends.
- **Delete Screen** (every kind but Plugin; [render][confirm-delete]). "Delete {Screen}?" · Lost, by kind: "The Screen, its Schedule and the uploaded image." / "The Screen, its Schedule and the Mashup's layout." / "The Screen, its Schedule and the HTML written for it." / "The Screen, its Schedule and the link." · Stays: "{Device}'s other Screens, which move up in the Order." or for a Mashup "The Plugins in its slots." · "Delete Screen".
- **Unassign Plugin** (Plugin only; [render][confirm-unassign]). "Unassign {Plugin} from {Device}?" · Lost: "This Screen on {Device} and its Schedule." · Stays: "The Plugin {Plugin}, with its template, its Data Sources and its place in any Mashup." · "Unassign Plugin".

Deleting or unassigning the Active Screen leaves the plate as it is until the Device's next poll.

## Add Screen

`/devices/:deviceId/screens/new` · [Plugin][add-plugin] · [Mashup][add-mashup] · [External link][add-link] · [File][add-file] · [HTML][add-html] · [phone][phone-add]

**For:** putting one more thing into the Device's Rotation. A page under the Screens tab, not a dialog. A back link "{Device}'s Screens" sits above the heading "Add Screen".

Left, the kind as a radio row; right, only that kind's form. On phone the kinds come first, then the form.

| Kind | Line under it |
|---|---|
| Plugin | One of your Plugins, rendered for this Device |
| Mashup | Several Plugins sharing one Screen in a layout |
| External link | An image fetched from a URL |
| File | An image you upload |
| HTML | Markup you write here, with a live preview |

The form ends with the primary button, "Cancel" (back to the Screens view) and the line "Joins the end of the Order, always shown until you give it a Schedule." After adding, the Screens view opens with the new row opened. **Adding a Screen never changes the Active Screen**; the new Screen shows when Rotation reaches it.

- **Plugin.** A radio row of every Plugin: name, and "{Poll\|Webhook} Plugin". A Plugin already assigned to this Device is disabled and reads "Already on {Device}". A Plugin with a required Plugin Field left empty adds "· a required Plugin Field is empty" and can still be chosen. With more than eight Plugins a "Find a Plugin" search field filters the list by name; nothing found reads "No Plugin is called “{query}”." Below: "No Plugin for it yet? Import a Recipe or build one; it is assigned to {Device} when you save it." The link opens the Plugins section carrying this Device, so the new Plugin is assigned on save. Primary button: "Assign Plugin".
  - **No Plugins at all** ([render][add-plugin-none]): an empty state, "No Plugins yet", "A Plugin fetches data and renders it with a template. Import one as a Recipe from TRMNL, or build your own. Either way it is assigned to {Device} when you save it.", "Import a Recipe" (primary) and "Build a Plugin".
- **Mashup.** "Name"; "Layout" as the seven drawings; "Plugins" as one select per slot, with "Any Plugin can fill a slot, whether or not it is assigned to {Device}. A Plugin fills one slot at most." "Add Screen" stays disabled until the name and every slot are filled.
- **External link.** "Name"; "Image URL"; the same two fetch choices as on the opened Screen, "Fetch once and keep" chosen. For a kept image the fetch happens on "Add Screen"; if it fails the Screen is not added and the field says why.
- **File.** "Name", filled from the file's name once one is chosen and still editable; "Image" as a drop zone: "Drop an image here. PNG, JPEG, BMP, GIF, TIFF or WebP. It is converted for {Device Model}, {Palette}." In demo mode the File kind is disabled and reads "Not available in the demo."
- **HTML.** "Name"; "HTML" in the code editor; "Preview", labelled "as {Device} renders it: {Device Model}, {Palette}", a plate that renders the markup as it is typed, in the same screen shell the server uses.

"Name" is required for every kind but Plugin: "A Screen needs a name."

## Edit HTML

`/devices/:deviceId/screens/:screenId/html` · [render][edit-html]

**For:** changing an HTML Screen's markup with the result in view. The page HTML Preview used to be.

- Under the Screens tab: the back link "{Device}'s Screens", the heading "Edit {Screen}", then the code editor and the live preview side by side (stacked on phone, editor first).
- A form: "Save HTML" (primary), "Cancel", and "{Device} shows the change when this Screen's turn next comes." Markup is not saved as it is typed, since half-written HTML would reach the Device.
- Leaving with unsaved changes asks: "Leave without saving?" · Lost: "Your changes to {Screen}'s HTML." · "Leave" / "Keep editing".
- The code editor is the one of [template-editor.md](./template-editor.md), in its HTML mode. The drawings here show a mono textarea.

## Settings

`/devices/:deviceId/settings` · [light, all sections open][settings-light] · [dark][settings-dark] · [a Proxied Device][settings-proxied] · [phone][phone-settings]

**For:** how this Device behaves. Opens with "Changes save as you make them." Every control saves as changed; there is no page-level save. Each row is a label, the control, and a note or the save state at the right.

### Display

| Row | Control | Notes |
|---|---|---|
| Name | text input | Required: "A Device needs a name." This is renaming the Device; the bar and the title follow on save. |
| Device Model | select of the Device Models, "{label} · {width} × {height}", deprecated ones left out unless assigned | Note: "{Device} reports {reported model}". When the reported size differs from the chosen Device Model's: the problem icon and "{Device} reports {w} × {h}, which is not this Device Model's size. Images are rendered for the Device Model chosen here." When the assigned Device Model is deprecated: "TRMNL no longer lists this Device Model." Until one is resolved: "Not resolved yet. Images are rendered for TRMNL OG." |
| Palette | select of the Palettes this Device Model supports, custom Palettes of a matching Palette Family included and marked "· custom" | Changing the Device Model resets the Palette to that Device Model's richest one. Under the row: "Changing the Device Model or the Palette converts this Device's stored images again." |
| Refresh rate | "every" {number} {minutes\|hours} | At least 1 minute, at most 24 hours: "Enter between 1 minute and 24 hours." Under the row: "How often {Device} polls, and so how often Rotation moves on. It also sets when {Device} counts as offline." On a Proxied Device the control is replaced by "Set by TRMNL" and "{Device} is a Proxied Device, so TRMNL's answer decides how often it polls." |

### Sleep Mode

| Row | Control | Notes |
|---|---|---|
| Sleep Mode | switch, "On" or "Off" | Switching it on saves with the window shown, 23:00 to 06:00 the first time. While in its window the note reads "In its window until {hh:mm}". On a mirrored Device the switch is disabled and reads "Off while Mirroring". |
| Window | two time inputs, "{from} to {to}" | Note: "Server timezone, {Europe/Berlin}". When it crosses midnight: "This window crosses midnight." Shown only while Sleep Mode is on. |
| While asleep | radio row | "Show the sleep Fallback Screen": "“Asleep until {hh:mm}”, or your own image." / "Keep the Current Screen": "Whatever {Device} showed last stays on." |
| Sleep image | "Upload an image", or the image as a 120 px plate with "Replace" and "Remove" | Shown only with "Show the sleep Fallback Screen". Without one: "Optional. Without one, {Device} shows the sleep Fallback Screen." With one: "Shown instead of the sleep Fallback Screen." Same formats as a File Screen; disabled in demo mode. "Remove" confirms: Lost: "The uploaded sleep image." Stays: "Sleep Mode, which shows the sleep Fallback Screen again." This row is the home of [#1064](https://github.com/PhyberApex/kuroshiro/issues/1064) and appears once that is built. |

### Firmware

| Row | Control | Notes |
|---|---|---|
| Reported version | the version in mono | "Not reported yet" until the first poll. |
| Target Firmware | select, "None" then "{version} · official" or "{version} · custom · {label}", and the button "Update now" | Only Firmware that fits the Device Model and is not deprecated is listed, plus the assigned one. Under the row: "Only Firmware that fits {Device Model} is listed." Choosing saves the target and pushes nothing. "None" clears the target; while a push is pending "None" is disabled, since taking a pending push back is [Cancel a pending Firmware push](https://github.com/PhyberApex/kuroshiro/issues/1086). "Update now" queues the push; until the next poll delivers it the row reads "Goes out at the next poll, around {hh:mm}" with the loading mark and the button is disabled. On a mirrored Device the row reads "Off while Mirroring"; on a Proxied Device "Set by TRMNL". |

Under the section: "The Firmware library lives under Instance." (a link) and the state of Firmware Auto-Update: "Firmware Auto-Update is off, so {Device} only updates when you press “Update now”." or "Firmware Auto-Update is on: {Device} is given each new official Firmware by itself."

### Mirroring

| Row | Control | Notes |
|---|---|---|
| Mirroring | switch, "On" or "Off" | Switching it on shows the two fields and saves nothing yet: "Not on yet. Enter the mirror MAC address and API key." It is saved as on once both are valid. Switching it off saves at once and keeps both values. |
| Mirror MAC address | text input, and "Use {Device}'s own" | Six pairs of hex digits: "Enter a MAC address like A4:CF:12:00:00:00." Under the row: "The MAC address of the Device on TRMNL's server whose image is shown." When it equals the Device's own: "This is {Device}'s own MAC address, which makes it a Proxied Device: its whole poll is forwarded and TRMNL answers it." |
| Mirror API key | password input | "That Device's API key on TRMNL." |

Under the section: "{Device} shows the image of a Device on TRMNL's own server instead of its own Screens. While it is on, Rotation, Sleep Mode and Firmware pushes do not apply to {Device}; its Screens are kept."

### Tucked at the bottom

Three tucked sections, closed by default.

**Identity and credentials.** Friendly id (mono). MAC address as a Copy value. API key as a Copy value that shows only its last four characters until "Reveal", which becomes "Hide"; "Copy" copies the whole key either way. None of the three can be changed here.

**Special Functions.** "A one-shot command that reaches {Device} at its next poll and fires once. The `sleep` Special Function is separate from Sleep Mode." Then one row per Special Function, its name in mono, what it does, and "Trigger":

| Name | What it does |
|---|---|
| `identify` | Shows the Device's identification screen once |
| `sleep` | Puts the Device to sleep until its button is pressed |
| `add_wifi` | Opens Wi-Fi setup so another network can be added |
| `rewind` | Shows the previous Screen again |

- Triggering one replaces its description with "Pending, reaches {Device} around {hh:mm}" and the loading mark, disables every "Trigger" until the poll delivers it, and adds the fact on the Screens view. The section opens by itself while one is pending.
- `restart_playlist` and `send_to_me` are not offered: no Device Kuroshiro targets acts on them.
- On a Proxied Device every "Trigger" is disabled, under: "{Device} is a Proxied Device. TRMNL answers its polls, so a Special Function triggered here never reaches it."

**Reset or delete {Device}.** "A Device Reset makes {Device} erase its Wi-Fi credentials and this server's URL at its next poll, so someone has to set it up by hand again. Nothing here is lost. Deleting removes {Device}, its {n} Screens, their Schedules and its Device Log from this Instance." Then two plain buttons.

- **Device Reset** ([render][confirm-reset]). "Reset {Device}?" · "At its next poll, around {hh:mm}, {Device} erases what it has stored and restarts into Wi-Fi setup. You need to be at the Device afterwards and enter the Wi-Fi and this server's URL again." · Lost: "On the Device: its Wi-Fi credentials, its API key and this server's URL." · Stays: "Everything here: {Device}, its Screens, Schedules and Device Log. It gets the same API key back." · "Device Reset". Afterwards the button is disabled beside "Device Reset pending, reaches {Device} around {hh:mm}". On a Proxied Device the button is disabled, under: "{Device} is a Proxied Device, so a Device Reset triggered here never reaches it."
- **Delete {Device}** ([render][confirm-delete-device]). "Delete {Device}?" · Lost: "{Device}, its {n} Screens with their Schedules and uploaded images, and its Device Log." · Stays: "Your Plugins. The Device itself keeps working until it next polls and is then registered again as a new Device." · "Delete {Device}". Afterwards `/` opens.

**Loading:** the section headings with `wash` bars for the rows and "Loading {Device}'s Settings". **Failed:** the notice "Could not load {Device}'s Settings."

## Logs

`/devices/:deviceId/logs` · [light, an entry open][logs-light] · [warnings and errors, dark][logs-problems] · [search][logs-search] · [nothing matches][logs-none] · [phone][phone-logs]

**For:** finding out what the Device itself reported when something is wrong.

- **The bar above the list:** a segmented filter, "All" and "Warnings and errors"; a search field, "Search messages"; and "Clear Logs" (plain button, at the right).
- **The line under it:** "Showing {n} of {N}, newest first", or "Showing {n} of {N} that match, newest first" with a filter or a search. At its right, when entries arrived since the list was loaded: "{n} new entries", a quiet button that loads them. New entries never push the list down by themselves.
- **The list,** newest first, grouped under day headings ("Today", "Yesterday, Wednesday 30 September", "Tuesday 29 September"). A row is the time to the second, the level, the message, a chevron, all in mono. A warning's or an error's level is in ink at weight 600 and an error's message at weight 500; nothing is red.
- **Levels** are `error`, `warning`, `info` and `debug`, from the firmware's level (`fatal` counts as `error`).
- **An opened entry** shows what the entry carries, as label and value: Source (file and line), Device status (battery, signal, Wi-Fi state, free heap, wake reason), Firmware, and any further fields the firmware sent, by their own names.
- **Paging.** 50 entries at a time. "Older entries" appends the next 50 below, and focus moves to the first of them. At the end: "That is the whole Device Log."
- **Search** matches the message text, ignoring case, from two characters on, 300 ms after typing stops. It runs on the server over the whole Device Log, combined with the level filter, and the matched text is marked in each message. The filter and the search are kept in the address (`?level=problems&q=wifi`).
- **Retention.** Beside the paging: "Entries older than {30} days are removed by Retention." (a link to the Instance page).
- **Clear Logs** ([render][confirm-clear]). "Clear {Device}'s Logs?" · Lost: "All {N} entries of {Device}'s Device Log." · Stays: "Nothing else changes. New entries arrive with the next poll." · "Clear Logs". It always clears the whole Device Log, whatever the filter. Disabled while the Device Log is empty.
- **Empty:** "No Device Log entries yet" · "{Device} sends an entry when something goes wrong on its side. They appear here after its next poll."
- **Nothing matches:** "No entry matches" · "Nothing in {Device}'s Device Log matches “{query}” among warnings and errors." (each half only when it applies) · "Show all entries".
- **Loading:** the bar, then five rows of `wash` bars and "Loading {Device}'s Logs". **Failed:** the notice "Could not load {Device}'s Logs."

## Connect a Device

`/connect` · [first-run][connect-first] · [a Device called in, dark][connect-arrived] · [register by hand][connect-hand] · [phone][phone-connect]

**For:** getting a Device to call this server. The server URL is the one primary thing. With no Devices this is the landing screen and its title is "Connect your Device"; otherwise "Connect a Device".

1. **Lede:** "Enter this server URL on the Device's Wi-Fi setup page. The Device shows up here the moment it calls in."
2. **The server URL** in mono at title size inside a 2 px ink frame, with "Copy URL" (primary; reads "Copied" for 2 seconds). It is the address the server hands to Devices. When that address is `localhost` or `127.0.0.1`, a message sits under the frame: "A Device cannot reach “localhost”. Set `KUROSHIRO_API_URL` to this machine's address on your network and restart Kuroshiro."
3. **The waiting line:** the loading mark and "Waiting for a Device to call in". The page asks the server for the Devices every 3 seconds while it is open.
4. **When a Device calls in** the waiting line is replaced by a block: the welcome Fallback Screen as a thumbnail, "A Device called in", its friendly id, Firmware version and Device Model in mono, a "Name" input holding its name (the friendly id until changed; saves as changed) and "Open {Device}" (primary). Under it the page keeps listening: "Still listening, in case there is another one". Each further Device adds a block. A Device counts as new when it was not there when the page was opened.
5. **Three steps,** numbered because the order matters:
   1. "**Put the Device into Wi-Fi setup.** A new Device starts there. Otherwise hold its button for five seconds."
   2. "**Join its Wi-Fi network from your phone or laptop.** It is called TRMNL. The setup page opens by itself."
   3. "**Enter your Wi-Fi and the server URL above.** The URL goes into the custom server field. The Device restarts and calls in."
6. **Only with no Devices:** "Moving from another Instance? Import a Configuration Archive to bring its Devices, Screens and Plugins along." The link opens the Configuration Archive page under Instance.
7. **Tucked: "Register a Device by hand".** "For a Device that cannot call the setup address itself, or to try Kuroshiro with the Device Simulator. A Device registered here appears at once and waits for its first poll." A form: "Name" (required), "MAC address" (required, six pairs of hex digits, with "Make one up" filling in a random one and the hint "Six pairs of hex digits. Make one up only for a Device that has no real one."), and "Register Device". A MAC address already registered: "A Device with this MAC address is already registered." After registering, that Device's Screens view opens.

**Failed:** when the Devices cannot be fetched the waiting line reads "Kuroshiro's server is not answering." and the page keeps retrying.

## Phone

Works fully below 820 px: the Screens view (see the Current Screen, reorder with the two buttons, switch a Schedule, open a row and use everything in it), Settings, Logs, the Devices list and Connect a Device. Add Screen works for every kind; Edit HTML and the HTML kind of Add Screen only have to stay usable, with the editor above the preview.

## Components this spec adds

Each uses the tokens and rules of [Design tokens and component inventory](https://github.com/PhyberApex/kuroshiro/issues/1091).

| Component | Backed by | States |
|---|---|---|
| Inline edit (Rename) | native input and two buttons | editing, invalid, saving |
| The Screen row's drag state, owed by the component inventory | the drag library the first build issue picks; grip as a native `button` | lifted, drop before, drop after, lifted by keyboard |
| Server URL | Copy value at title size | default, copied |
| Search field | native `input type="search"` with the search icon | empty, filled, focus |
| Layout picker | `RadioGroupRoot`, `RadioGroupItem`, each with a drawing | checked, default, hover, focus |
| Day heading in a list | `li`, no primitive | default |
| Numbered steps | `ol`, no primitive | default |

No new icon is needed: every icon used is one of the twelve.

## Capability coverage

Numbers are those of the [capability inventory](https://github.com/PhyberApex/kuroshiro/issues/1075).

| # | Capability | Home |
|---|---|---|
| 1 | Register a Device by hand, with a made-up MAC | Connect a Device, "Register a Device by hand" |
| 2 | Auto-provisioning | Connect a Device: the server URL, the waiting line, "A Device called in" |
| 3 | See all Devices | The Devices list; the bar |
| 4 | Delete a Device | Settings, "Reset or delete {Device}" |
| 5 | Rename a Device | Settings, Display, Name; also in "A Device called in" |
| 6 | See a Device's status | Screens view, the facts; Firmware version, Device Model and the size mismatch in Settings |
| 7 | Identity and credentials | Settings, "Identity and credentials" |
| 8 | Refresh rate | Settings, Display |
| 9 | Trigger a Special Function | Settings, "Special Functions"; pending as a fact on the Screens view |
| 10 | Device Reset | Settings, "Reset or delete {Device}"; pending as a fact |
| 11 | Mirroring | Settings, Mirroring; the Screens view of a mirrored Device |
| 12 | Read Device Logs | Logs |
| 13 | Clear a Device's Logs | Logs, "Clear Logs" |
| 14 | Change a Device's MAC or friendly id | None. Removed, as [Primary journeys](https://github.com/PhyberApex/kuroshiro/issues/1078) decided. |
| 15 | Device Model of a Device | Settings, Display |
| 16 | Palette of a Device, custom Palettes included | Settings, Display |
| 21 | Add an External link Screen | Add Screen, External link |
| 22 | Add a File Screen | Add Screen, File |
| 23 | Add an HTML Screen with a preview | Add Screen, HTML |
| 24 | See a Device's Screens in Order | Screens view, "Screens in Order" |
| 25 | Reorder Screens | Screens view: drag, keyboard, the move actions |
| 26 | Preview one Screen | An opened Screen's preview; the row's thumbnail |
| 27 | Refresh a kept external image | An opened External link Screen, "Refresh image" |
| 28 | Delete a Screen | An opened Screen, "Delete Screen" |
| 29 | See the Current Screen | Screens view, the plate; the Devices list |
| 30 | List every Screen across all Devices | None. Removed, as Primary journeys decided. |
| – | Edit a Screen after creation (a gap today) | Rename; External link's URL and fetch choice; Replace file; Edit HTML |
| 31 | Create or edit a Schedule | An opened Screen's Schedule editor; the switch on the row |
| 32 | Remove a Schedule | The Schedule editor, "Remove Schedule" |
| 33 | See each Screen's Schedule state | The row's Schedule summary and Screen State; the "why" sentence |
| 34 | `skip` Render Signal | The Screen State "Skipping" and its sentence |
| 35 | `hold` Render Signal | The qualifier "holding image" and its sentence |
| 36 | The Render Signal shown on the Screen list | Both of the above; replaces the chip |
| 37 | Create a Mashup | Add Screen, Mashup |
| 38 | Preview a Mashup | An opened Mashup's preview |
| 39 | Delete a Mashup | An opened Mashup, "Delete Screen" |
| 40 | Edit a Mashup | An opened Mashup: Rename, the slot selects, "Change layout" |
| 41 | Read a Mashup's configuration | An opened Mashup: the layout and its slots |
| 62 | Assign a Plugin from the Device, with a shortcut to a new Plugin | Add Screen, Plugin |
| 63 | Unassign from the Device | An opened Plugin Screen, "Unassign Plugin" |
| 64 | A Plugin Assignment's own enable flag and order | None. Removed, as Primary journeys decided; the Schedule switch and the Order cover it. |
| 67 | Configure Sleep Mode | Settings, Sleep Mode; its state on the Screens view |
| 68 | A custom sleep image | Settings, Sleep Mode, "Sleep image" |
| 73 | Target Firmware, "Update now", reported version, pending | Settings, Firmware; pending as a fact |
| 75 | See Sensor readings | Screens view, the facts |
| 76 | Sensor readings on `/metrics` | None by design (ADR-0026). |
| 90 | HTML Preview | Add Screen, HTML and Edit HTML |

Capabilities 17 and 69 to 72 and 74 (syncing Device Models, the Firmware library, Firmware Auto-Update) belong to the Instance spec; 18 (preview as another Device Model and Palette) and 61 (assign from the Plugin) to the Plugins specs; 89 (the Device Simulator) to the Instance spec. This spec only links to them.

## What this asks of the admin API

A request list for [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096), which settles the shapes.

**To add**

1. A read of one Device (`GET /api/devices/:id` does not exist today).
2. On a Device read: battery as a percent; the last seen time as nullable, so "never polled" can be told from a date (today a hand-registered Device carries a fixed date); the expected time of the next poll; whether Sleep Mode is in its window and when it ends; whether it is a Proxied Device.
3. On the Current Screen: what kind of image it is (a Screen's, which Fallback Screen, the mirrored image), why a Fallback Screen is shown (no Screens, none can be shown, a failed render, a failed mirror fetch), and when it was fetched or rendered, for a mirrored Device too.
4. On each Screen of a Device: its Screen State and the reason, which Screen is up next, its Render Signal, an image address that always answers (with "not rendered yet" told apart), when it was last rendered, and for a Mashup its layout and slots.
5. Editing a Screen: its name, an External link's URL and fetch choice, an HTML Screen's markup, and replacing a File Screen's image.
6. Converting an uploaded image for a preview without saving it, for "Replace file".
7. Device Logs: newest first, a page size and a cursor, a level filter, a search over the message, the total and the matching count, and the level, message, source and status as fields instead of a raw string the UI has to parse.
8. Instance facts for the UI: the address the server hands to Devices, the server's timezone name, and whether demo mode is on. The Retention ages are Instance Settings ([instance.md](./instance.md)), not Instance facts.
9. The custom sleep image of [#1064](https://github.com/PhyberApex/kuroshiro/issues/1064).

**To change**

1. Creating a Screen, a Mashup or a Plugin Assignment must not change the Active Screen. Today the first two make the new Screen the Active Screen and the third can leave two.
2. Deleting a Mashup and unassigning a Plugin must close the gap in the Order, as deleting any other Screen does.
3. Saving a Device setting should answer with the saved Device, and reject a refresh rate outside 60 seconds to 24 hours and a non-integer one.
4. The Palettes offered for a Device should include compatible custom Palettes, as the API already accepts them.
5. Registering a MAC address that exists should answer with a conflict the UI can word, not a server error.
6. An upload the server cannot read should answer as a bad request with a reason, and state its size limit.
7. The Alert list should be readable for one Device.
8. Changing a Mashup's layout and its slots is one change.

**To remove** (named by Primary journeys, repeated for completeness): changing a Device's MAC or friendly id; a Plugin Assignment's own enable flag and order; listing every Screen across all Devices.

## Departures

- **External link, "Fetch on every poll".** The approved Add Screen said the Device downloads the URL itself, unconverted. The server downloads and converts it at each turn, so the copy says that.
- **An empty Device** shows the no-screen Fallback Screen, not welcome, as the glossary ticket corrected.
- **"While asleep"** is a radio row with two named choices, not a switch.
- **"On the panel"** is "on the Device" throughout, and "Reset" is "Device Reset".
- **The Render Signal chip** of [#1071](https://github.com/PhyberApex/kuroshiro/issues/1071) becomes a Screen State and a qualifier. Its labels are kept; its hover explanation becomes the sentence in the opened row, which a keyboard reaches by opening the row.

## Open points

**Decided on the agent's own call; the maintainer may want to overturn them**

- The spec lives in `docs/ui/`, one Markdown file per surface group, with the prototype as linked drawings.
- The bar names Devices up to four and collapses to "Devices" from five, or sooner when the names do not fit.
- Devices are ordered by name.
- Screen State precedence: Schedule reasons before Skipping.
- "Holding image" is a qualifier, not a seventh Screen State.
- Nothing collapses on a Device with many Screens.
- Removing a Schedule confirms; so does removing the sleep image.
- The refresh rate is limited to 1 minute through 24 hours.
- File uploads name all six formats the server reads (PNG, JPEG, BMP, GIF, TIFF, WebP), where the old UI offered three.
- `restart_playlist` and `send_to_me` are not offered.
- The three setup steps on Connect a Device describe the TRMNL firmware's Wi-Fi setup from general knowledge of it; the wording was not checked against a Device.

**Left undecided**

- **Cancelling a pending Device Reset.** The API would allow it today. It is a new capability, like [Cancel a pending Firmware push](https://github.com/PhyberApex/kuroshiro/issues/1086), and is not specced.
- **A new Device starts with a pending `identify` Special Function** (the column's default), so its first Screens view shows that fact. Whether the default should be `none` is the API ticket's call.
- **When "no Screen can be shown" ends.** The column says to open a Screen; it does not say when the next one returns, which the server would have to work out from every Schedule.
- **A size limit for uploads.** None is configured today, so the UI can only relay the server's refusal.
- **The code editor** for HTML is specced in [template-editor.md](./template-editor.md).

[proto]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces
[screens-light]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-light.png
[screens-dark]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-dark.png
[screens-plugin]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-plugin-skipping.png
[screens-mashup]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-mashup.png
[screens-layout]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-mashup-change-layout.png
[screens-replace]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-file-replace.png
[screens-rename]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-rename.png
[screens-many]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-many.png
[screens-link]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-external-link.png
[screens-dates]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-html-date-range.png
[screens-never]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-hold-and-never-rendered.png
[screens-mirrored]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-mirrored.png
[screens-proxied]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-proxied.png
[screens-mirrorfail]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-mirroring-failed.png
[screens-offline]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-offline.png
[screens-none]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-none.png
[screens-empty]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-empty.png
[screens-sleep]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-sleep.png
[screens-loading]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-loading.png
[screens-failed]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/screens-failed.png
[confirm-delete]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-delete-screen.png
[confirm-unassign]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-unassign.png
[confirm-schedule]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-remove-schedule.png
[confirm-reset]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-device-reset.png
[confirm-delete-device]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-delete-device.png
[confirm-clear]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/confirm-clear-logs.png
[add-plugin]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-plugin.png
[add-plugin-none]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-plugin-none.png
[add-mashup]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-mashup.png
[add-link]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-link.png
[add-file]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-file.png
[add-html]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/add-html.png
[edit-html]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/edit-html.png
[settings-light]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/settings-light.png
[settings-dark]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/settings-dark.png
[settings-proxied]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/settings-proxied.png
[logs-light]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/logs-light.png
[logs-problems]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/logs-dark-problems.png
[logs-search]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/logs-search.png
[logs-none]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/logs-no-match.png
[devices-three]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/devices-three.png
[devices-seven]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/devices-seven-dark.png
[device-of-seven]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/device-of-seven.png
[connect-first]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/connect-first-run.png
[connect-arrived]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/connect-arrived.png
[connect-hand]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/connect-by-hand.png
[missing]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/missing.png
[phone-screens]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-screens.png
[phone-screens-open]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-screens-open.png
[phone-mirrored]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-mirrored.png
[phone-add]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-add.png
[phone-settings]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-settings.png
[phone-logs]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-logs.png
[phone-devices]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-devices.png
[phone-connect]: https://github.com/PhyberApex/kuroshiro/blob/661601a/packages/ui/prototypes/device-surfaces/shots/phone-connect.png
