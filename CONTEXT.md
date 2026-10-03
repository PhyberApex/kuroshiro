# Kuroshiro

Self-hosted BYOS (Bring Your Own Server) backend for TRMNL e-ink display devices — manages what content a physical device shows and in what order.

## Language

**Device**:
A TRMNL e-ink display unit, or anything speaking its firmware's protocol, registered against this server and identified by its MAC address and API key. Usually physical hardware, but a Device registered by hand or through the Device Simulator is a Device like any other.
_Avoid_: Display (reserve "Display" for the API response type returned to the device)

**Device Model**:
The hardware class a Device belongs to — pixel dimensions, colour depth, rotation and rendering scale — which determines how images are generated for it. Every Device has exactly one Device Model, resolved from what the Device reports or chosen manually.
_Avoid_: Model (bare, in prose), panel, profile, display type

**Palette**:
The set of greys or colours an image is reduced to for a Device — chosen per Device from those its Device Model supports. Determines the image's bit depth. Either `official` (synced from TRMNL, curated per Device Model via `paletteIds`) or `custom` (admin-created, restricted to a fixed colour family — see Palette Family — with compatibility derived automatically rather than curated per model).
_Avoid_: Colour mode, bit depth (as a name for the choice), dither mode

**Palette Family**:
Which of TRMNL's 9 fixed rendering modes a Palette belongs to — 3 grayscale (1/2/4-bit), 5 colour (`3bwr`/`3bwy`/`4bwry`/`6a`/`7a`, each a fixed set of physical ink colours), or full-color. Identified by `frameworkClass`, which also drives the on-device CSS class — not a freely inventable string. Custom Palettes may only be authored in a colour family; a "custom" grayscale or full-color Palette would be indistinguishable from the official one of that family, so isn't offered.
_Avoid_: Framework class (bare, in prose — reserve for the field name), colour mode, render mode

**Screen**:
A single unit of content assigned to a Device's rotation — a static image, an externally-fetched image, raw HTML, a plugin's rendered output, or a mashup. Screens belong to exactly one Device.
_Avoid_: Slide, page

**Order**:
An integer position (1..N, sequential, no gaps) that determines a Screen's place in its Device's rotation. Reassigned to close gaps whenever screens are deleted, and fully reassigned when a Device's Screens are reordered.
_Avoid_: Position, index, sequence number

**Active Screen**:
The one Screen per Device currently being shown (`isActive: true`). Not a fixed pointer — advances dynamically to the next eligible Screen by `order` each time the Device polls for its display, wrapping back to `order: 1` after the last screen. If no Screen on the Device can currently be shown (every Screen has a Schedule and none match, or every eligible Screen raises a `skip` Render Signal), there is no Active Screen — the Device gets the same no-screen Fallback Screen as a Device with zero Screens at all.
_Avoid_: Selected screen

**Current Screen**:
What a Device is showing right now, as far as the server knows — the Active Screen's image, a Fallback Screen, or on a mirrored Device the mirrored image. Read through `/current_screen`, which never advances the Rotation, unlike the `/display` poll a Device itself makes.
_Avoid_: Active Screen (the Screen whose turn it is — the Current Screen is the image, and may not come from a Screen at all), on the panel (say "on the Device"), preview

**Rotation**:
The cycle through a Device's Screens in `order`, one step per `/display` poll — skipping any Screen currently ineligible per its Schedule, if it has one, and any Screen whose render raises a `skip` Render Signal.
_Avoid_: Cycling, playlist (see Schedule below — the concept "playlist" usually points at is Schedule, not Rotation)

**Schedule**:
A set of day/time constraints (weekday selection, daily time-of-day window — may cross midnight — optional active date range) plus an independent enabled/disabled toggle, attached to at most one per Screen, that gates whether that Screen is eligible to become the Active Screen. A Screen with no Schedule is always eligible; a disabled Schedule makes its Screen ineligible outright regardless of the day/time rules, without discarding them (soft-hide). Time-of-day windows are evaluated in the server's local timezone — Devices have no timezone of their own. Applies uniformly to every Screen type, including Mashup. Distinct from Rotation, which orders currently-eligible Screens — Schedule only narrows eligibility, it never reorders. A Screen needing more than one window (e.g. two separate times of day) needs a second Screen with its own Schedule, not a compound rule on one Schedule.
_Avoid_: Playlist, playlist item, recurrence rule

**Render Signal**:
What a Screen's rendered page declares about itself by setting one of TRMNL's two JS flags — `skip` (`window.TRMNL_SKIP_DISPLAY`: leave this Screen out of Rotation for now) or `hold` (`window.TRMNL_SKIP_SCREEN_GENERATION`: keep showing this Screen's previous image instead of generating a new one); `skip` wins when both are set. Read at the page's `load` event during a `/display` poll, so only Screens that render through Chrome can raise one — `plugin`, raw `html` and Mashup, a Mashup signalling as a whole whichever slot set the flag. A `skip` Screen never becomes the Active Screen; a `hold` Screen does, and shows its stored image (the no-screen Fallback Screen if it has none yet). The verdict is remembered on a `plugin` or Mashup Screen until its cached output changes, while a raw `html` Screen is evaluated on every poll. Distinct from Schedule, which an admin sets on the Screen: a Render Signal is raised by the content itself.
_Avoid_: Skip flag, skip logic, conditional skip, `TRMNL_SKIP_*` (bare, in prose — reserve for the flag names), skip-if-stale (a separate, unbuilt admin-set TTL)

**Screen State**:
The one reason a Screen is or is not showing right now, derived on every read and never stored — `Active Screen`, `Up next` (the Screen Rotation turns to on the next poll), `Schedule off` (its Schedule is disabled), `Not today` (its Schedule's weekdays or date range exclude today), `Not at this hour` (today matches but the time-of-day window does not) or `Skipping` (it raised a `skip` Render Signal). A Screen that is none of these waits its turn in Order and carries no state. While Sleep Mode is in its window the Active Screen reads "Active Screen, paused" — a qualifier, not a further state — and "Always shown" describes a Screen with no Schedule, not a state.
_Avoid_: Queued, status, inactive, disabled (a Schedule is disabled, a Screen is not)

**Fallback Screen**:
One of four built-in images a Device shows when it has no Screen's image to show — welcome (in the setup response, before the Device's first poll), no-screen (registered, but zero Screens or none that can currently be shown), error (the Screen's or the mirrored image could not be produced) and sleep (Sleep Mode in its window with the sleep screen on). Rendered per Device Model and Palette; not a Screen — it has no Order, no Schedule, belongs to no Device and cannot be edited.
_Avoid_: Fallback image, placeholder, default screen, system screen, `noScreen` (bare, in prose — reserve for the kind's code name)

**Plugin Kind**:
Which strategy a Plugin uses to get data into its template — `Poll` (Kuroshiro fetches from a Data Source on a schedule) or `Webhook` (an external system pushes data by POSTing to the Plugin's Webhook URL, rendered synchronously on arrival).
_Avoid_: Plugin type, strategy

**Plugin Assignment**:
A Plugin attached to one Device's Rotation, always paired 1:1 with a plugin-type Screen on that Device. Creating the assignment creates the Screen, and deleting either one removes both. The Plugin itself and its Mashup slots are unaffected, so an admin unassigns a Plugin Assignment, where every other Screen is deleted along with its content. A Plugin has at most one Assignment per Device.
_Avoid_: DevicePlugin (the entity name), install, uninstall, remove, detach

**Plugin Field**:
One named input a Plugin declares for the admin to fill in — a key, a label, a type (single-line text, multi-line text, number, on/off, password, or a select with its options), an optional default and whether it is required. Part of the Plugin: it arrives with a Recipe or `.trmnlp` import, or the admin authors it on the Plugin. A type Kuroshiro has no control for is treated as single-line text; the `author_bio` type is a read-only credit, never an input.
_Avoid_: Custom field, form field (TRMNL's terms), setting, Plugin Configuration, variable

**Field Value**:
What the admin entered for one Plugin Field, falling back to the Plugin Field's default when nothing was entered. Belongs to the Plugin, not to a Plugin Assignment: every Device and every Mashup slot showing the Plugin renders with the same Field Values, and showing it with different values means duplicating the Plugin. Available to the Plugin's templates and to its Data Sources' url, headers and body. A password-type Field Value is a secret. A required Plugin Field with neither a Field Value nor a default marks the Plugin as needing values but never stops it saving, being assigned or rendering.
_Avoid_: Plugin Variable (a removed concept), per-Device value, override, custom field value, config

**Template**:
The Liquid markup a Plugin is rendered from, one per size: `full` (the Screen on its own), `half_horizontal` (the top or bottom half of a Mashup), `half_vertical` (the left or right half) and `quadrant` (a quarter). A Plugin always has a `full` Template and at most one of each other size. A Mashup slot renders the Template of its own size and falls back to `full` when the Plugin has none. Reads the Plugin's Data Sources or Webhook Payload, its Field Values, the Device's Sensors and `trmnl` as Liquid variables. An HTML Screen's markup is not a Template: it is plain HTML with no Liquid.
_Avoid_: Layout (a Mashup's arrangement of slots), view, markup, variant

**Webhook Token**:
A dedicated, regenerable secret embedded in a Webhook-kind Plugin's ingest URL — distinct from the Plugin's `id`, so the Plugin's admin URL leaking doesn't grant write access.
_Avoid_: Plugin ID, API key (reserve "API key" for Device auth)

**Merge Strategy**:
How an incoming Webhook POST combines with the Webhook Payload already stored — `standard` (replace outright), `deep_merge` (recursively merge objects, replacing arrays on collision), or `stream` (append top-level arrays, replacing other keys normally). Fixed on the Plugin when it's created; never supplied per-POST.
_Avoid_: merge_variables strategy, merge mode

**Stream Limit**:
The maximum length a `stream` Merge Strategy retains for its arrays — enforced server-side, oldest entries evicted first as new ones arrive. Required when Merge Strategy is `stream`; meaningless otherwise.
_Avoid_: stream_limit (bare, in prose — reserve backticks for the field name)

**Webhook Payload**:
The single JSON blob a Webhook-kind Plugin persists across POSTs, mutated according to its Merge Strategy and rendered against on every arrival. Readable as-is via `GET` on the Plugin's Webhook URL.
_Avoid_: merge_variables (TRMNL's term), webhook data, raw payload

**Data Source**:
One independently-configured way of getting a value into a template — either `fetch` mode (an HTTP request: method, URL, headers, body, optional per-source JS transform) or `literal` mode (an admin-typed fixed JSON value, no request involved) — see Data Source Mode. Identified by a required, unique-per-Plugin `name`. Belongs to a `Poll`-kind Plugin, which holds an ordered list of zero or more Data Sources of either mode, each exposed to its templates as its own top-level Liquid variable keyed by that `name`; `fetch`-mode sources are fetched in parallel on the Plugin's shared `refreshInterval`, re-evaluated on every scheduled render. If a `fetch`-mode Data Source's request fails, its variable is still present but carries an error marker instead of real data — the rest of the render proceeds with whatever succeeded. Distinct from a Mashup, which combines multiple Plugins' rendered outputs into layout slots on one Screen — a Data Source combines multiple values within a single Plugin.
_Avoid_: Extension, Exchange (Terminus's terms — not adopted here)

**Data Source Mode**:
Which of the two ways a Data Source gets its value — `fetch` (performs an HTTP request; carries `method`/`url`/`headers`/`body`/transform) or `literal` (holds an admin-typed fixed JSON value directly; carries none of the fetch fields). Fixed on the Data Source when it's created, editable like any other Data Source field thereafter — not write-once. Distinct from Plugin Kind, a different axis: Plugin Kind picks how a whole Plugin receives data (`Poll` vs `Webhook`); Data Source Mode picks, per Data Source, how one named value within a `Poll`-kind Plugin is obtained. A `Poll`-kind Plugin may freely mix `fetch`- and `literal`-mode Data Sources.
_Avoid_: Data Source Kind (collides with Plugin Kind), Data Source type, static/dynamic (Terminus's `strategy` values — those describe a whole Plugin/Recipe in Terminus, not a single Data Source, so reusing them here would be misleading)

**Fetch Failure Streak**:
The number of consecutive scheduled renders on which a `fetch`-mode Data Source's request failed, kept on the Data Source itself and reset to zero by the next successful scheduled fetch. Only scheduled renders count — editor previews, Mashup slot renders and on-demand Device renders never move it — and a `literal`-mode Data Source has none. The subject state the Data Source fetch-failure Alert Rule reads.
_Avoid_: Error count, failure counter, fetch status, last error (bare — the streak carries the last error message, but the message alone is not the streak)

**Recipe**:
A pre-built, TRMNL-vetted Plugin template published at trmnl.com/recipes, importable into Kuroshiro by pasting its id or page URL. A Recipe exists only as an import source — the result of importing one is a normal Poll-kind Plugin, indistinguishable from a hand-built one, carrying its source Recipe's id and a Recipe Snapshot. Nothing updates automatically; an admin runs a Recipe Update Check by hand.
_Avoid_: Extension, Exchange (Terminus's terms), Plugin (the imported result — see above)

**Recipe Snapshot**:
The copy of a Recipe, as the importer parsed it, that an imported Plugin keeps alongside its source Recipe id. The base a Recipe Update Check diffs against, replaced wholesale every time an update is applied. A Plugin imported before snapshots existed has none.
_Avoid_: Baseline (as a noun — the snapshot is the baseline, but the term is the Snapshot), import copy, upstream copy, version

**Recipe Update Check**:
The on-demand action on an imported Plugin that re-downloads its source Recipe, diffs it against the Recipe Snapshot and the Plugin's current state, and shows the resulting Update Items for the admin to apply, apply in part, or dismiss. Never runs on its own and never changes anything without the admin having seen the diff.
_Avoid_: Sync, upgrade, pull, auto-update, refresh (collides with the render/refresh cycle)

**Update Item**:
One unit a Recipe Update Check can show and apply on its own: the Plugin's name, description or refresh interval, one template (by layout), one Data Source (by name, transform included) or one Plugin Field (by keyname). Each is `added`, `changed` or `removed` relative to the Recipe Snapshot, and a `conflict` when both the Recipe and the local Plugin changed it. Anything that exists only locally is not an Update Item.
_Avoid_: Diff entry, change, hunk (that is a line-level thing inside a template's diff)

**Configuration Archive**:
A single zip holding every piece of admin-built configuration on a Kuroshiro instance — Plugins (as nested `.trmnlp` folders plus a manifest for what `.trmnlp` can't carry), Devices, Screens with their Order and Schedule, Mashups, Plugins with their Field Values, Plugin Assignments, custom Palettes, custom Firmware metadata and the overridden Instance Settings — stamped with the Kuroshiro version and an archive `schemaVersion`. Produced by Configuration Export, consumed by Configuration Import. Every record keeps its `id`, which is the identity Configuration Import upserts on. Contains secrets (Data Source headers, Device API keys, password-type Field Values, Webhook Tokens) in plaintext and the export surfaces warn about this, unless it is a Redacted Archive. Excludes runtime state: Webhook Payloads, Sensor readings, rendered images for `plugin`/`mashup`-type Screens, logs, Device telemetry, and anything `official`/`official-synced` — except a `file`-type Screen's converted image, which for that Screen type is the actual admin-supplied content, not a regenerable cache.
_Avoid_: Backup (reserve for `pg_dump`-level disaster recovery, which this does not replace), dump, snapshot, `.trmnlp` (that is one Plugin's export, which the archive nests but is not)

**Configuration Export**:
The read-only action that produces a Configuration Archive from the running instance's current state (`GET /api/config/export`) — every Plugin via the existing per-Plugin exporter, plus the top-level manifests Configuration Import reads back. Includes secrets as-is by default, with the credentials warning surfaced before the download starts, not only after; the admin can opt in to producing a Redacted Archive instead.
_Avoid_: Dump, snapshot (see Configuration Archive)

**Redacted Archive**:
A Configuration Archive whose secrets — Data Source header values, Device API keys and mirror API keys, password-type Field Values, Webhook Tokens — have each been replaced by the Redaction Sentinel, with the manifest marked `redacted`. Everything else, including header keys and Data Source `url`/`body`, is exported as-is. Safe to share or diff; a degraded source for a fresh-instance restore.
_Avoid_: Sanitized, scrubbed, anonymized (nothing but credentials is removed)

**Redaction Sentinel**:
The one fixed string Configuration Export writes in place of every redacted secret and Configuration Import recognises in any redactable field. On import it means "keep the value the target already has"; where the target has none, the field falls back (header dropped, Variable emptied, mirror API key unset, Device API key or Webhook Token freshly generated) and the import summary carries a warning for it.
_Avoid_: Placeholder, mask, `***`

**Configuration Import**:
Restoring a Configuration Archive onto an instance: an upsert of every record by its exported `id`, so re-importing the same archive is idempotent. Devices additionally re-attach by `mac` when an existing row has it. Refuses an archive whose `schemaVersion` differs from the running instance's. Designed for a fresh instance; merging onto an instance that already holds unrelated content is not defined.
_Avoid_: Restore (bare, in prose — reserve for the ADR's "restore targets a fresh instance" framing), sync

**Special Function**:
A one-shot command an admin triggers on a Device — `identify`, `sleep`, `add_wifi` or `rewind`, with `none` meaning nothing pending — that reaches the Device on its next `/display` poll. (`restart_playlist` and `send_to_me` are accepted by the API and offered in the UI, but marked unavailable: no Device Kuroshiro targets acts on them.) That response carries the value twice — as `special_function`, and echoed back as `action`, which is the field firmware waits for before actually performing the behaviour — and the Device's stored value is cleared to `none` in the same poll, so the command fires exactly once instead of re-asserting on every poll. On a Proxied Device both fields come from TRMNL's own `/display` response instead of the local value.
_Avoid_: Special function toggle, device action, command

**Device Reset**:
A one-shot command an admin triggers on a Device, delivered on its next `/display` poll, that makes the Device erase its Wi-Fi credentials and everything else it has stored — API key and server URL included — and restart into Wi-Fi setup. Nothing on the server is lost and the Device gets its same API key back, but it does not return until someone sets it up by hand again. Separate from Special Function, and dropped on a Proxied Device, where TRMNL's answer decides.
_Avoid_: Reset (bare), factory reset, reboot, restart, `reset_firmware` (bare, in prose — reserve for the response field)

**Sleep Mode**:
A per-Device night window (`sleepStartTime`–`sleepEndTime`, time-of-day, may cross midnight, evaluated in the server's timezone) gated by an independent `sleepModeEnabled` toggle, mirroring Schedule's enabled/window split. While active, the Device's Active Screen stops advancing, and `/display` returns a `refresh_rate` computed as seconds-until-`sleepEndTime` so the Device wakes exactly when the window ends rather than on its usual cadence. A second toggle, `sleepScreenEnabled`, chooses between showing the sleep Fallback Screen or freezing whatever content was already showing. Applies only to non-mirrored Devices, and is entirely independent of the `sleep` Special Function — a separate, one-shot command an admin triggers by hand, sharing nothing but a name.
_Avoid_: Sleep (bare, in prose — ambiguous with the Special Function of the same name), Night Mode, Do Not Disturb

**Mirroring**:
A per-Device setting that makes the Device show the image of a Device on TRMNL's own server — named by a mirror MAC and mirror API key — instead of its own Rotation. A Device with Mirroring on is a mirrored Device: its Screens are kept, but Rotation, Sleep Mode and Firmware pushes do not apply to it.
_Avoid_: Mirror mode, sync, mirror (as a name for grouping Devices)

**Proxied Device**:
A mirrored Device whose mirror MAC is its own, so its whole poll is forwarded and TRMNL answers it — refresh rate, Firmware, Special Functions and Device Reset all come from TRMNL, and those triggered in Kuroshiro never reach the Device. Not a setting of its own: it follows from the two MACs being equal.
_Avoid_: Proxy mode, proxy mirror, passthrough

**Firmware**:
A versioned OTA binary a Device can be pushed to — either `official-synced` (mirrored automatically from `usetrmnl.com/api/firmware/latest`) or `custom` (uploaded directly by an admin). Carries a SHA-256 checksum, verified again at serve-time, and an optional set of compatible Device Models (empty means universal) enforced whenever a Firmware is assigned to a Device. A Device references at most one Firmware as its target, which stays until an admin changes it; a push of that target is pending from the moment it is asked for until a poll serves it — the same explicit, admin-driven assignment Device Model already uses, never inferred by comparing version numbers; with Firmware Auto-Update on, a newly synced `official-synced` Firmware is assigned the same way on the admin's behalf. Applies only to non-mirrored Devices.
_Avoid_: Update, OTA package, release, firmware version (bare — reserve for the `version` field)

**Firmware Kind**:
Where a Firmware came from — `official-synced` (Kuroshiro's daily sync job) or `custom` (an admin's direct upload).
_Avoid_: Firmware type, firmware source

**Sensor**:
A Device's current reading for one Qwiic sensor add-on kind — `carbon_dioxide`, `humidity`, `pressure`, or `temperature` — parsed from the `SENSORS` header official OG firmware sends on every `/display` poll. At most one Sensor per Device per kind: each poll's header is the authoritative full snapshot, so a kind missing from a poll is deleted rather than left stale, and a kind present is upserted with its `value`/`unit`. Exposed to Plugin Liquid templates as an implicit `sensors` object keyed by kind (e.g. `sensors.temperature.value`), present only when the Device currently has that reading — no Plugin opt-in required. Device-attached only; a physically separate concept from server-attached (Raspberry Pi) sensors, which Kuroshiro does not support.
_Avoid_: Telemetry (too broad), Extension, Exchange (Terminus's terms — not adopted here)

**Device Log**:
The record of what one Device's firmware has reported about itself to the server, kept per Device as Device Log entries until an admin clears it or Retention prunes it. Labelled "Logs" where the Device is already the context.
_Avoid_: System logs, server logs (Kuroshiro's own process output, which is not stored), events

**Device Simulator**:
The troubleshooting tool that makes the firmware's setup and `/display` calls from the browser. Its calls are real: setup with an unknown MAC registers a Device, and a poll advances that Device's Rotation, overwrites what it last reported and consumes a pending Special Function, Device Reset or Firmware push.
_Avoid_: Virtual Device (it is a tool, not a kind of Device), emulator, test device

**Alert Rule**:
A named condition Kuroshiro watches for on a subject — a Device (low battery, offline) or a `fetch`-mode Data Source (its Fetch Failure Streak reaching the threshold). The set of Alert Rules is fixed in code; an admin tunes their thresholds instance-wide through Instance Settings, never per subject.
_Avoid_: Alarm, trigger, check, monitor

**Alert**:
One Alert Rule being true for one subject right now — created the first time an Alert Sweep sees the condition hold, resolved the first time a Sweep sees it no longer hold. An Alert is stateful (active or resolved); at most one active Alert per Rule per subject.
_Avoid_: Incident, event, alarm

**Offline**:
A Device for which the offline Alert is active, and on no other basis. A Device that is not offline carries no label of its own — only when it was last seen, as a fact.
_Avoid_: Online (as a state or indicator), down, disconnected, unreachable

**Alert Sweep**:
The periodic job that evaluates every Alert Rule against Kuroshiro's persisted state and opens or resolves Alerts accordingly. The only place Alerts are decided — no Rule is evaluated inline in a Device poll or any other request path.
_Avoid_: Poll (reserved for what a Device does), scan, check

**Retention**:
The daily job that deletes resolved Alerts and Device Log entries older than their configured retention age. Active Alerts are never pruned. One execution, scheduled or triggered from the Maintenance page, is a Retention Run.
_Avoid_: Cleanup (reserved for the Maintenance page's file cleanup), purge, garbage collection

**Notification**:
The message pushed to an admin's channels when an Alert is opened or resolved, delivered via Apprise. Fire-and-forget: a Notification carries no state of its own beyond whether the Alert it belongs to has been announced.
_Avoid_: Alert (as a name for the message), push, message

**Test Notification**:
A Notification an admin sends on demand from the Maintenance page to confirm the Apprise sidecar delivers. It travels the exact path a real Notification does but belongs to no Alert and leaves no record.
_Avoid_: Ping, health check, dry run

**Instance**:
One running Kuroshiro server together with its database and stored files — the whole that Devices, Plugins and Instance Settings belong to.
_Avoid_: Installation, deployment, site, server (bare, as a name for the whole — fine for the machine or URL a Device connects to)

**Instance Settings**:
The one set of admin-tunable values that apply to the whole Kuroshiro instance rather than to any single Device, Plugin or Screen — today the Alert Rule thresholds and Firmware Auto-Update. Each Setting is either overridden (an admin saved a value, which wins) or not (the matching environment variable, else the built-in default, applies); clearing an override returns the Setting to that fallback.
_Avoid_: Global settings, preferences, options, Settings (bare — that names one Device's Settings view), Configuration (reserved for the Configuration Archive), config (reserved for environment variables)

**Firmware Auto-Update**:
A boolean Instance Setting, off by default and with no environment-variable fallback, that makes each newly synced `official-synced` Firmware the target of every eligible Device — not mirrored, no push already pending, Device Model within the Firmware's compatible set — as if an admin had assigned it. A default policy, not an override: a pending admin assignment is never replaced, `custom` Firmware is never auto-assigned, and turning the toggle on does not catch Devices up until the next official Firmware lands.
_Avoid_: Auto-OTA, global firmware toggle, automatic updates (bare), version check
