# Reference set: how TRMNL, other BYOS servers and calm admin tools tell their story

Research for [#1077](https://github.com/PhyberApex/kuroshiro/issues/1077), part of the map [#1074](https://github.com/PhyberApex/kuroshiro/issues/1074) (Admin UI rebuild from zero). Gathered 2026-10-01.

**Question.** What do the closest neighbours and the best calm admin tools do that Kuroshiro can learn from, in information architecture first and visual identity second? For each: how navigation is organised, what the landing screen makes primary, how one device's content and ordering is presented, how density is controlled, and what the visual identity rests on. Ends with patterns to borrow, patterns to avoid, and four visual directions for a black-and-white e-ink product named Kuroshiro (黒白).

## How to read this

Every statement about a UI below comes from a screenshot I opened or from that product's own source code, and says which. Where I could not see something, it says so rather than guessing. Images are linked, not committed. Upstream repo links are pinned to the commit that was `HEAD` on the day of research.

Kuroshiro vocabulary (`CONTEXT.md`) is used for Kuroshiro; the neighbours' own words are kept when describing them. One mismatch matters throughout: every neighbour calls a device's ordered content a **Playlist**. Kuroshiro deliberately does not. Here a Device has **Screens** in an **Order**, cycled by **Rotation**, narrowed by a **Schedule**, and `CONTEXT.md` lists "playlist" under _Avoid_.

### What was actually seen

| Product | Evidence | Coverage |
| --- | --- | --- |
| TRMNL hosted web app | Help-centre and blog screenshots, landing page, CSS | Partial. Playlist rows, item menu, schedule editor, timeline, mashup editor, plugin directory, sign-up. **Not seen:** the logged-in app shell, its navigation, its landing screen, a device settings page. |
| LaraPaper | 12 README screenshots | Good. Landing, devices list, device details, playlists, plugin list, recipe editor, settings, light and dark. |
| BYOS Next.js | 3 of 11 README screenshots opened | Good for shell, landing, playlists and an empty state. **Not seen:** a single device's page. |
| Inker | 3 of 9 README screenshots opened | Shell, landing, devices list, screens list. **Not seen:** playlist editor, device details. |
| Terminus | Templates and CSS in the repo | Structure only. The repo and its docs contain no screenshots of the admin UI, so **the rendered UI was not seen**. Everything said about Terminus is read from source. |
| BYOS FastAPI, Django, Phoenix | TRMNL's BYOS doc | Not examined. TRMNL's own list marks all three "not actively maintained". |
| Miniflux | 1 screenshot | Shell and landing list. |
| Plausible | 1 screenshot | The whole product is that one page. |
| Beszel | 2 screenshots | Landing table and one system's page. |
| Tailscale admin console | 2 doc screenshots | Settings page and one interstitial. **Not seen:** the Machines list or a machine's page. |

The list of BYOS servers comes from TRMNL's own documentation, which names Terminus ("flagship"), LaraPaper, Inker, BYOS Next.js, and three unmaintained ones: <https://docs.trmnl.com/go/diy/byos>.

---

## 1. TRMNL (the hosted product)

Sources: landing page <https://trmnl.com/>; help articles [Playlist Scheduler](https://help.trmnl.com/en/articles/11663305-playlist-scheduler), [Mashups](https://help.trmnl.com/en/articles/10168132-mashups), [How to set up a new device](https://help.trmnl.com/en/articles/9416306-how-to-set-up-a-new-device); blog post [Introducing Smart Playlists](https://trmnl.com/blog/smart-playlists). The help centre serves its screenshots from signed, expiring URLs, so the articles are linked rather than the images.

**Navigation.** Not seen. The story TRMNL tells about its own structure is in the Smart Playlists post: "TRMNL devices are controlled by a single interface: Playlists. connect a plugin, drag it around, and decide how often it 'plays.'" The Playlist Scheduler article opens with a two-line model: "Plugins are content shown on your device. Playlists are that content's schedule." Two nouns, one sentence each.

**Landing.** Not seen for the app. The marketing landing leads with "Clarity, at a glance" and photographs of the device in rooms.

**One device's content and ordering.** This is the best-documented part and the most useful for Kuroshiro. In the Playlist Scheduler screenshots a playlist is a vertical list of rows, and one row reads left to right:

1. plugin icon
2. a thumbnail of the item's most recent render
3. title and a type badge
4. a schedule glyph: a small bar plus seven weekday dots (S M T W T F S), clickable to edit the schedule
5. a status badge, e.g. "Hidden" (the whole row greys out), or a marker that the item is the one currently on the device
6. a three-dot menu
7. a drag handle

The three-dot menu puts facts before actions. Its first lines are plain sentences: "Last shown about 5 hours ago", "Next shown in about 9 hours", "Renders again in about 3 hours" (or "No render before then, because its plugin updates when data arrives"). Only then come Preview, Settings, Duplicate, Refresh now, Timeline, Presentation (colour palette, font family, text scale as a submenu with "Device Default" preselected), Hide this item, Adjust schedule, Remove from playlist.

Scheduling is hidden by default. The schedule dialog shows Duration and a sentence, "This screen will be shown at all times.", with one button, "Set a custom schedule", that expands the editor. A "Copy schedule from..." dropdown covers common cases.

A "last 24 hours" timeline shows one horizontal bar segmented by which item was on the device, with render ticks underneath, a sleep span marked ("Asleep 10:01 PM to 5:58 AM"), a legend with counts and a 3h / 12h / 24h switch. It answers "what did my device actually show" in one strip.

Adding content is a single "Add Plugin" button whose dropdown is a grid of eight layout pictograms (full, halves, quadrants and so on), so creating a Mashup is choosing a shape. The mashup editor shows the layout as lettered blocks (A, B, C) next to one field per section.

**Density control.** Thumbnails instead of descriptions; state as a badge; everything rare behind the three-dot menu; schedules collapsed to a glyph; defaults stated as a sentence instead of a form.

**Visual identity.** The landing stylesheet (<https://trmnl.com/font-packs/lander.css>) declares Inter, EB Garamond, DM Serif Display and Space Mono. In the app screenshots page titles are set in a serif ("Trending Recipes", "New playlist item") over a sans UI. One accent, a warm orange-red, on primary buttons, the logo glyph and layout pictograms; surfaces are warm off-white with white panels. Imagery is the device itself, photographed in kitchens and on desks, or rendered on flat grounds. Blog art uses a 1-bit dot-pattern ground behind a device. On the device, screens use a pixel-style face and a dithered grey title bar along the bottom. The 24-hour timeline is the one place the app goes multi-colour (purple, olive, green, brown), and it reads as a different product for that strip.

**First run.** The setup article shows the device and the web form telling one story: the device screen prints "Please sign up at usetrmnl.com/signup with Friendly ID 783E4C" and the form has a matching "Device ID" field. The device is the instruction.

---

## 2. LaraPaper

Sources: [README](https://github.com/usetrmnl/larapaper/blob/c58668e526246b7255f4505915776e2848aaa299/README.md) and [SCREENSHOTS.md](https://github.com/usetrmnl/larapaper/blob/c58668e526246b7255f4505915776e2848aaa299/screenshots/SCREENSHOTS.md). Screenshots: [landing, light](https://raw.githubusercontent.com/usetrmnl/larapaper/c58668e526246b7255f4505915776e2848aaa299/README_byos-screenshot.png), [landing, dark](https://raw.githubusercontent.com/usetrmnl/larapaper/c58668e526246b7255f4505915776e2848aaa299/README_byos-screenshot-dark.png), [devices list](https://github.com/user-attachments/assets/74199d77-a856-4df1-8493-6e9c36b8ef13), [plugins and recipes](https://github.com/user-attachments/assets/cde92277-718b-452c-b4c4-39e35eb56baf), [recipe catalogue dialog](https://github.com/user-attachments/assets/86dc0a38-fb87-4a86-baab-c5eaff1705df), [markup plugin](https://github.com/user-attachments/assets/cd078b12-8669-4b62-810a-cd32bfcac2ef), [API plugin](https://github.com/user-attachments/assets/a34a303d-371c-4ac2-9df3-965938f4f107), [device details](https://github.com/user-attachments/assets/7e1d9080-f647-441d-9396-cee8eaccd2fc), [recipe editor](https://github.com/user-attachments/assets/0ba0e4d5-d140-44ca-945b-2000046c32e6), [playlists](https://github.com/user-attachments/assets/35a18570-574c-4ead-af62-936824cb9172), [device edit dialog](https://github.com/user-attachments/assets/9c4b76c9-4db7-4a93-8f2d-2121b08f3d50), [settings](https://github.com/user-attachments/assets/ed2f200f-7e8c-46e6-b12a-40f9a2a6bfed).

**Navigation.** A top bar with four items: Dashboard, Devices, Plugins & Recipes, Playlists. On the right, one global toggle ("Permit Auto-Join") and a user menu that holds Settings. Settings is a separate page with a left text list (Preferences, Appearance, Profile, Password, Support, Updates).

**Landing.** The closest thing in the set to what the map asks for. The dashboard is a single centred column with one card per device, and the card is mostly the screen the device is showing, at large size. Above the image sits one line: device name, MAC address, firmware version, a Wi-Fi icon, a battery icon, and a three-dot menu. Nothing else. A mirrored device collapses to a one-line note ("This device is mirrored from Ben's TRMNL") instead of repeating the image. In dark mode the page goes dark and the screen image stays paper-white, so the device's content becomes the brightest thing on the page.

**One device's content and ordering.** The device page repeats the same card, then a rule labelled "Screen", the current image, a rule labelled "Playlists", and the device's playlists with an on/off toggle each. Device fields (name, API key, Friendly ID, MAC, refresh interval, Device Model, mirroring, advanced width/height/rotate) live in an edit dialog, with "Advanced Device Settings" below a divider. The Playlists page groups by device: device name as a heading, each playlist as a bordered block containing a three-column table: Plugin / Recipe, a Status toggle, and up/down arrows plus delete. A Mashup row shows its member plugins as a second line with a small layout glyph. Ordering is arrows, not drag.

**Density control.** A narrow centred column, a lot of empty page, no descriptions, settings behind a dialog, monospace chips for identifiers. The Devices list is a five-column table with two icon buttons per row.

**Visual identity.** A pixel-font wordmark, an orange-red accent on the active nav underline, primary buttons, toggles and plugin icons, and otherwise black on white with hairline borders and small radii. The imagery is the device screen. The weak point is the Plugins & Recipes page: a grid of eleven identical tiles, each an orange icon and a name, with nothing to tell them apart or say which are in use.

---

## 3. BYOS Next.js

Sources: [README](https://github.com/usetrmnl/byos_next/blob/2511a207b51c3134e027126dd891a82e0e99d103/README.md). Screenshots opened: [dashboard](https://raw.githubusercontent.com/usetrmnl/byos_next/2511a207b51c3134e027126dd891a82e0e99d103/docs/screenshots/dashboard.png), [playlists](https://raw.githubusercontent.com/usetrmnl/byos_next/2511a207b51c3134e027126dd891a82e0e99d103/docs/screenshots/playlists.png), [mixup](https://raw.githubusercontent.com/usetrmnl/byos_next/2511a207b51c3134e027126dd891a82e0e99d103/docs/screenshots/mixup.png). The folder also holds catalog, recipes, tools, system-logs, admin-users and auth screenshots, which I did not open.

**Navigation.** A collapsible left sidebar: Overview, Devices (expandable, with each device listed underneath by name with a status dot, plus an inline "+"), Recipes, Playlists, Mixup, Catalog, Tools, System Log. A top bar holds a search field with a keyboard hint, a theme toggle and a GitHub link. The user sits at the bottom of the sidebar. Putting the devices themselves in the navigation means one click reaches a device from anywhere, and with one device the list is one line long.

**Landing.** "Good afternoon" with a coffee-cup emoji as the page title. Below it a large "Latest screen" panel that draws the screen inside a device bezel, captioned with the device name and "3m ago", and footed by an honest caveat: "Passive device: this preview may be newer than what's currently on the screen." To its right a "Fleet" panel with three number tiles (Total 1, Online 0, Offline 1) and two lists, which for one device spends a third of the page saying one thing three times. Below, a "Recent system logs" table.

**One device's content and ordering.** A device page was not seen. Playlists are a top-level, device-independent collection shown as cards: a film-strip header with the playlist's screens as thumbnails and per-frame durations, a total ("1m 30s loop"), chips naming the items, Edit and delete. Next to it a dashed "New playlist" tile.

**Density control.** Uppercase micro-labels for panel titles, a centred content column with wide margins, and a real empty state on Mixup: one icon, "No mixups yet", one sentence, one text action.

**Visual identity.** Geometric sans, tight tracking in titles, uppercase tracked labels, monospace numerals in tiles, the same orange-red accent, a pale warm sidebar. The dithered 1-bit screen image inside a black bezel is the only imagery and it carries the page. The screenshots themselves are framed with an orange glow border, which is README dressing rather than the app.

---

## 4. Inker

Sources: [README](https://github.com/usetrmnl/inker/blob/83c72b0c590cca40df9da1c646c3d5693e0028df/README.md). Screenshots opened: [dashboard](https://github.com/user-attachments/assets/fd9affac-5c57-4448-9338-ea8f83add08a), [devices](https://github.com/user-attachments/assets/e6ba89e7-7bac-419e-bb2e-54a1c0350e07), [screens](https://github.com/user-attachments/assets/510c7d5c-730a-457d-af7d-50ee04b2dc43).

**Navigation.** A dark left sidebar under a "Main menu" label: Dashboard, Devices, Screens, Playlists, Extensions, Settings. A header repeats the date and "Welcome back" on every page, including Devices and Screens, where it is not true of the page.

**Landing.** A dark green gradient banner ("Good evening, there!" plus a sentence describing the product to the person already using it), then three large gradient tiles in green, indigo and orange (Online Devices 2, Total Screens 2, Total Playlists 2), then Recent Devices, Quick Actions and Recent Screens panels. Seven blocks of similar weight, none primary. This is the map's "dashboard of equal-weight cards" and "no gradients" rules, both broken on one screen, and it is worth keeping as the negative reference.

**One device's content and ordering.** On the Devices page each device is a card with name, Friendly ID, online badge, battery and signal pills, and three key/value rows: last seen, firmware, playlist. The useful part is that the card names the playlist the device is on. Above the cards three more coloured count tiles (Total 2, Online 2, Offline 0), then a search field, a status filter and a grid/list toggle, for two devices. The playlist editor was not seen.

**Visual identity.** Forest green as brand colour, with blue, orange, red and yellow all in use as tile fills; pill badges; soft shadows; large radii. Screens are shown as thumbnails with a "Designed" badge.

---

## 5. Terminus (source only, UI not seen)

Sources, all at commit `0a611e4`: [header partial](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/templates/shared/_header.html.erb), [dashboard](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/templates/dashboard/show.html.erb), [device card partial](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/templates/devices/_device.html.erb), [device page](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/templates/devices/show.html.erb), [playlist page](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/templates/playlists/show.html.erb), [colours](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/assets/css/colors.css), [settings](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/app/assets/css/settings.css), [README](https://github.com/usetrmnl/terminus/blob/0a611e407c095fd9a36efbffb5b0b36f3d00571d/README.adoc). The README has no screenshots and neither does `doc/`.

**Navigation.** One flat top menu of ten peers: Dashboard, Designs, Screens, Playlists, Devices, Models, Extensions, Firmware, Users, Logout. It collapses behind a checkbox toggle on small screens. The menu is the data model, one entry per table, with a daily destination (Devices) and a rarely visited reference list (Models) given the same weight.

**Landing.** The dashboard template renders two rows of boxes. First row: IP Addresses and Firmware. Second row: eight boxes that each contain a label and a count linking to a list (Designs, Devices, Extensions, Firmware, Models, Playlists, Screens, Users). Structurally this is a second copy of the navigation with numbers on it.

**One device's content and ordering.** The device partial is a card with: label, the current screen image (opening a popover), the Device Model as a link, battery and Wi-Fi as native `<meter>` elements, and four icon actions (view, edit, logs, delete). The device page keeps that card and adds a definition list of more than twenty rows (Model, Playlist, MAC Address, API Key, Refresh Rate, Image Timeout, Image Cached, Dimensions, Firmware, Firmware Update, Firmware Reset, Firmware Profile, Display Compatibility, Display Profile, Command, Touch Bar, Wake Reason, Wake Duration, Sleep Start, Sleep Stop and more), nearly every key carrying its own info popover. Content and ordering are not on the device page: the device links to one Playlist, and the Playlist page lists items as screen image plus label plus a "current screen" pill. Screens, Playlists and Devices are three separate top-level collections joined by links.

**Density control.** By source, mostly popovers: every field has help on demand, and list pages have an "overview" popover that also documents keyboard shortcuts (Control + n for new, Control + s to save). The device page itself has no grouping or disclosure; all rows are equal.

**Visual identity.** By source: Inter (`--site-font-family: Inter var, system-ui, sans-serif`), an ash background (`oklch(97% 0% 68deg)`), white cards with a five-layer drop shadow and 0.5rem radius, orange as accent and link colour, the screen image framed by a thick black border as a stand-in bezel. How this looks rendered I cannot say.

**On-device screens.** Terminus keeps its fallback screens as named templates: `screens/interrupts/welcome`, `error`, `sleep`, `identify`. The help article [Connect your device to Terminus](https://help.trmnl.com/en/articles/12263392-connect-your-device-to-terminus-byos) has a photo of the welcome screen on a device: "Welcome to Terminus!" in bold, then Friendly ID, MAC Address and Firmware as three right-aligned key/value lines. Plain, legible, and it shows the three facts needed to recognise the Device in the admin UI.

---

## 6. Calm admin tools

### Miniflux (self-hosted feed reader)

Source: [README](https://github.com/miniflux/v2), screenshot <https://miniflux.app/images/overview.png>.

Navigation is seven words in a row at the top: Unread (52), Starred, History, Feeds, Categories, Settings, Logout. No icons. The landing screen is the unread list, which is the one thing the product is for; the count sits in both the nav and the title. Each entry is a title, then one line of small grey text with source, age and three text actions separated by pipes. Density comes from type size and weight alone. Identity rests entirely on typography: system sans, blue links, dotted hairlines, a two-colour wordmark. It proves an admin UI can have a recognisable character with no imagery and almost no components.

### Plausible Analytics (self-hostable)

Source: [README](https://github.com/plausible/analytics/blob/d21298d9015e277b5be9d4521983d23726efd1f3/README.md), screenshot <https://raw.githubusercontent.com/plausible/analytics/d21298d9015e277b5be9d4521983d23726efd1f3/.github/plausible-analytics-dashboard.webp>.

There is no navigation to speak of: a site switcher top-left, a filter and a date range top-right. The landing screen is the product. A row of six figures sits directly on top of one large chart, and the figures are the chart's tabs: the selected one (Unique Visitors) is highlighted and decides what the chart draws. Numbers that would be decorative stat cards elsewhere are controls here. Below, two panels each hold three tabbed views of a ranked list, with the bar drawn as a tint behind the row text. Identity: one indigo accent used for the chart line and nothing else, uppercase micro-labels, generous white space.

### Beszel (self-hosted server monitoring)

Source: [README](https://github.com/henrygd/beszel), screenshots <https://beszel.dev/image/dashboard.png> and <https://beszel.dev/image/system-full.png>.

The header holds a wordmark, a search field with a keyboard hint, four icon buttons and "Add System". There is no sidebar and no dashboard: the landing screen is one table, "All Systems", one row per system with a status dot, name, three inline meters, network rate, agent version, an alert bell and a three-dot menu. The row is the summary; clicking it opens the system's page. That page starts with the system name and a single line of facts separated by hairlines (Up, host, OS, uptime, kernel, CPU), then a time-range selector. Below that it becomes a two-column grid of eight or more equal charts, which suits monitoring and would not suit Kuroshiro. Identity: near-black surface, one green for healthy and amber for warning in the meters, a distinctive rounded wordmark.

### Tailscale admin console (device management)

Source: [Device approval docs](https://tailscale.com/kb/1099/device-approval), two screenshots on that page. The Machines list and a machine's page were not seen; the [Manage devices](https://tailscale.com/kb/1372/manage-devices) doc page carries no screenshots.

The settings page has a left text list in two groups, each under a small icon and heading (Tailnet Settings: General, User management, Device management, OAuth clients, Webhooks, Contact preferences, Billing; Personal Settings: Keys). The active entry is marked by colour only. Each setting on the right follows one template: a heading, one sentence that says what it does, a "Learn more" link, then a single control. Fields state their own limits underneath ("Must be between 1 and 180 days."). The pending-device interstitial is a wordmark, one bold sentence naming the device ("tardos is a new device"), one sentence saying what happens next, and a small help line. Identity: a sans at comfortable size, near-black on white, one blue for links and the active toggle, a nine-dot logo.

---

## Cross-cutting findings

**Navigation.** Counts of top-level entries, excluding logout: Terminus 9, BYOS Next 8, Miniflux 6, Inker 6, LaraPaper 4, Beszel 0, Plausible 0. The two BYOS servers with the longest menus are the ones that mirror their database tables. LaraPaper gets to four by folding settings into the user menu and by not giving Screens, Models or Firmware their own entries. BYOS Next is the only one that puts the devices themselves in the navigation.

**Landing.** Three approaches appear. LaraPaper and BYOS Next lead with what the device is showing. Terminus and Inker lead with counts of things. Miniflux, Plausible and Beszel have no dashboard at all; the landing screen is the working surface. For a protagonist with one to five Devices, counts carry no information ("Total 1, Online 0, Offline 1"), and the first and third approaches collapse into the same thing: the Device.

**One device's content and ordering.** Everyone except TRMNL splits it across pages. LaraPaper shows the current screen on the device page and the ordered list on a Playlists page. Terminus needs three collections (Devices, Playlists, Screens). TRMNL's playlist row is the only design in the set that puts thumbnail, order, schedule, current-item marker and hidden state on one line, and its timeline is the only view that shows what the device did rather than what it is configured to do. Kuroshiro's model is simpler than all of them, because a Screen belongs to exactly one Device and there is no shared playlist object, so nothing forces the split.

**Density.** The calm ones share four habits. One column or one table per screen. Facts as a single line of text with hairline separators instead of key/value cards (LaraPaper's device header, Beszel's system header). State as a sentence ("This screen will be shown at all times.") with the editor behind one button. Rare actions in a three-dot menu, rare fields in an edit dialog or below an "Advanced" divider.

**Identity.** Orange-red is the ecosystem colour: TRMNL, LaraPaper, BYOS Next and Terminus all use it as their single accent. All four also lean on a geometric or neo-grotesque sans, and Terminus and TRMNL both name Inter. The one consistently distinctive asset is the rendered e-ink screen itself, especially where it is shown at size (LaraPaper, BYOS Next). Nobody in the set builds an identity out of black and white as such, and nobody uses the screen's own visual language (1-bit dither, pixel type, the bottom title bar) in the admin chrome.

---

## Patterns worth borrowing

1. **The Device's current image is the landing screen's primary thing.** LaraPaper's card: one line of facts, then the image at size. With one Device, skip any list and land on that Device.
2. **One row per Screen carries everything.** After TRMNL's playlist row: thumbnail of the last render, name and Screen type, a Schedule glyph (weekday dots plus time bar), a marker on the Active Screen, a greyed state for a disabled Schedule, a menu, a reorder handle. Kuroshiro can add what TRMNL lacks: a mark for a Screen currently left out by a `skip` Render Signal or showing a held image.
3. **Facts before actions in a row's menu.** "Last shown about 5 hours ago / Next shown in about 9 hours / Renders again in about 3 hours" answers the question that made the admin open the menu.
4. **A strip of what the Device actually showed.** TRMNL's 24-hour timeline, including the Sleep Mode span. In a monochrome identity it can be drawn with patterns and labels rather than a rainbow.
5. **Schedule as a sentence with the editor behind it.** "Always shown" by default, one action to add constraints. Matches Kuroshiro's rule that a Screen with no Schedule is always eligible.
6. **Hide without removing.** TRMNL's hide toggle is the same idea as Kuroshiro's disabled Schedule (soft-hide), and deserves a one-click control on the row.
7. **Devices in the navigation by name**, with a status dot (BYOS Next). For one to five Devices this replaces a Devices list page as a destination.
8. **A short top level.** Four or five entries (LaraPaper). Firmware, Device Models, Palettes, Configuration Archive, Instance Settings and logs are reference or maintenance surfaces and can sit one level down.
9. **Settings in one template.** Tailscale: heading, one sentence, the control, limits stated under the field. Suits Instance Settings and Firmware Auto-Update.
10. **Numbers as controls, not decoration.** Plausible's figures select the chart. If Kuroshiro shows battery, RSSI or last seen, each should lead somewhere (the Sensor history, the Device log) or be plain text.
11. **A one-line fact strip under the Device name.** Beszel and LaraPaper: Device Model, firmware version, battery, signal, last seen, separated by hairlines.
12. **Help on demand, per field.** Terminus's info popovers keep explanations off the page until asked for.
13. **Honest preview captions.** BYOS Next: "this preview may be newer than what's currently on the screen." Kuroshiro has the same gap between the Current Screen preview and what the panel physically shows until the next poll.
14. **Empty states with one sentence and one action** (BYOS Next's Mixup page), and **the Device as the first-run instruction** (TRMNL's sign-up screen, Terminus's welcome screen with Friendly ID, MAC address and firmware).
15. **Layout pictograms for Mashups.** Choosing a Mashup layout by shape, with lettered slots.
16. **In dark theme, keep the Screen image paper-white** (LaraPaper). The content becomes the light source of the page.

## Patterns to avoid

1. **A dashboard of counts.** Terminus's eight count boxes, Inker's three gradient tiles, BYOS Next's Fleet panel. For one to five Devices the numbers say nothing and they push the Device's image down or aside.
2. **Navigation that mirrors the schema.** Terminus's nine peers. Screens, Schedules and Plugin Assignments belong to a Device and should be reached through it.
3. **Splitting what a Device shows from the order it shows it in.** Separate Devices and Playlists pages (LaraPaper, Terminus, Inker, BYOS Next) make the admin hold the join in their head.
4. **An unbroken wall of fields.** Terminus's device page lists twenty-plus equal rows. Kuroshiro's Device has as many (Device Model, Palette, Sleep Mode, Special Function, Firmware, API key, Sensors) and needs grouping and disclosure.
5. **Greetings and self-description.** "Good afternoon" with an emoji, "Welcome to your Inker dashboard. Manage your e-ink devices, screens, and playlists all in one place." Both break the map's rules on emoji and filler copy.
6. **A grid of identical tiles for Plugins.** LaraPaper's Plugins & Recipes page gives no way to tell which Plugins are assigned, failing, or stale. A list with state reads better.
7. **Fleet controls for a handful of items.** Search, status filter and grid/list toggle above two device cards (Inker).
8. **Colour as category.** Inker's green, indigo, orange, red and yellow tiles; TRMNL's multi-colour timeline. In a black-and-white product each extra hue costs more than it does elsewhere.
9. **Orange-red as the accent.** Not wrong in itself, but four neighbours already use it, so it cannot distinguish Kuroshiro.
10. **Inter with soft-shadowed white cards on pale grey.** By source this is Terminus, and it is also the default look the map calls out.
11. **Arrows as the only way to reorder** (LaraPaper). Fine as a keyboard and phone fallback, slow as the primary control.
12. **A header that repeats on every page with content unrelated to the page** (Inker's date and "Welcome back").

---

## Four visual directions for Kuroshiro (黒白)

Each obeys the slop rules: no gradients, glass, glow or blobs; one primary thing per screen; no emoji or stock illustration; deliberate type, spacing and radius; nothing on screen without a use. Each works in light and dark. Typeface names are examples of the character meant, to be settled at the prototype stage; all named faces are open-licensed.

The name gives a ready-made rule that all four share: 黒 and 白 are the two themes, and the Screen image is always shown as paper regardless of theme.

### A. Ichi-bit (1-bit)

The admin UI is drawn with the same means as the panel it controls.

- **Type.** A monospaced or pixel-grid-derived face for labels, identifiers and numerals (character of Departure Mono or JetBrains Mono), paired with a plain grotesque for running text. All sizes snap to a small fixed scale.
- **Colour.** Two values only: black and white. No greys in chrome. Tone comes from 1-bit patterns (25 %, 50 % checker, horizontal hatch) used strictly as states: 50 % checker for a disabled Schedule, hatch for a Screen left out by a `skip` Render Signal, solid inversion for the Active Screen. Dark theme is a literal inversion. No accent colour; an Alert is an inverted block with a label.
- **Imagery.** The Screen images themselves, unframed, at 1:1 pixel ratio where the layout allows. The mark is a square split diagonally or vertically into black and white. Fallback screens on the Device and the admin UI look like the same object.
- **Density.** Medium to high. Hard edges, radius 0, 1px and 2px rules, a visible grid. Rows over cards.
- **Risk.** Patterns can vibrate on low-density displays and must stay functional, never decorative. Needs care for contrast and for focus states without colour.

### B. Sumi (ink and paper)

A printed page: quiet, typographic, with the Device's Screen as the plate.

- **Type.** A high-contrast serif for page titles and the Device name (character of Shippori Mincho or Newsreader), a humanist sans for UI text (character of IBM Plex Sans, with its JP companion for 黒白), tabular figures for all data.
- **Colour.** Warm paper white and ink black in light; ink black ground with paper-white text in dark. Exactly four tones, echoing the 2-bit Palette: ink, two greys, paper. No accent. Emphasis by weight, size and rule thickness.
- **Imagery.** The Screen image set like a figure in a book: a hairline frame, a caption line beneath (Screen name, Order, when it was rendered). The mark is the two characters 黒白 set tight, or one brush-weight stroke crossing a square. No bezel drawing.
- **Density.** Low. One generous column, hairline rules instead of boxes, small radius (2px) or none, large margins. Settings read like Tailscale's: heading, sentence, control.
- **Risk.** Serif titles in an admin tool can read as a blog if the UI text beneath is not crisp and compact. TRMNL already pairs a serif title with a sans UI, so the difference must come from the monochrome discipline and the figure treatment.

### C. Hanko (seal)

Strict black and white with one small red mark, used the way a seal is used on a document: once, to say "this one".

- **Type.** A sturdy neo-grotesque with a slightly condensed display cut for titles (character of Archivo or Instrument Sans), mono for identifiers. Confident weights, tight leading in headings.
- **Colour.** Black, white, two neutral greys, plus one vermilion (朱, a blue-leaning red rather than TRMNL's orange) that appears in exactly two places per screen at most: the marker on the Active Screen and a firing Alert. Never on buttons, links or navigation; the primary action is a solid black (or white, in dark) button.
- **Imagery.** The Screen image inside a plain 2px outline. The mark is a small square seal containing 黒白 or a ク/K monogram, which also serves as favicon and as the corner stamp on fallback screens (in black there, since most panels have no red).
- **Density.** Medium. Squared corners with a 2 to 4px radius, 1px rules, compact rows, clear vertical rhythm.
- **Risk.** Sits closest to the neighbours' orange-red. It only works if the red is rationed as described and the hue is clearly not orange. It also cannot carry over to the Device, so the fallback screens need a black-only version of the idea.

### D. Keiki (instrument panel)

A piece of lab equipment: labelled, exact, a little dense, built for the admin who wants to see state.

- **Type.** A condensed or semi-condensed grotesque for uppercase micro-labels (character of Barlow Semi Condensed or IBM Plex Sans Condensed), a mono with good numerals for every value (battery volts, RSSI, refresh rate, timestamps), sentence case sans for the few sentences.
- **Colour.** Light: off-white panel, black ink, one mid grey. Dark: charcoal panel, off-white ink. One signal colour reserved for faults (amber), nothing else. Healthy state is shown by the absence of colour.
- **Imagery.** The Screen image set in a drawn bezel that matches the Device Model's proportions, with tick marks or dimension labels (800 x 480, 2-bit) like a technical drawing. Battery and signal as small segmented meters rather than icons. The mark is a ruled square, half filled, with the name in spaced capitals.
- **Density.** High, controlled by a strict grid: labelled groups separated by rules, values right-aligned, radius 0 to 2px. The one-line fact strip becomes a labelled readout row.
- **Risk.** The most likely to slide back into "too much at once", which is the problem the map exists to fix. It needs the same progressive disclosure as the others, and it is the weakest fit for phone widths.

### How they differ

| | A. Ichi-bit | B. Sumi | C. Hanko | D. Keiki |
| --- | --- | --- | --- | --- |
| Type character | mono / pixel grid | serif titles, humanist sans | sturdy grotesque | condensed labels, mono values |
| Colour | 2 values, patterns | 4 tones, no accent | mono plus rationed vermilion | mono plus amber for faults only |
| Screen image shown as | raw pixels | captioned figure | outlined, stamped when active | bezel with dimensions |
| Density | medium-high | low | medium | high |
| Carries to the Device's fallback screens | fully | well | partly (no red) | well |

---

## Could not verify

- TRMNL's logged-in app shell, navigation, landing screen and device settings page. Only fragments published in help articles and the blog were seen.
- The rendered Terminus UI. No first-party screenshots exist in the repo or its docs; all Terminus findings are from templates and CSS at the pinned commit.
- A single device's page in BYOS Next.js and Inker, and Inker's playlist editor.
- Tailscale's Machines list and machine page.
- Typeface names in the screenshots of LaraPaper, BYOS Next.js, Inker, Miniflux, Plausible, Beszel and Tailscale. Only TRMNL's and Terminus's fonts are confirmed from their CSS; the rest are described by character.
- BYOS FastAPI, Django and Phoenix were not examined beyond TRMNL's note that they are not actively maintained.
