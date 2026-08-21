# Kuroshiro

Self-hosted BYOS (Bring Your Own Server) backend for TRMNL e-ink display devices — manages what content a physical device shows and in what order.

## Language

**Device**:
A physical TRMNL e-ink display unit registered against this server, identified by its MAC address and API key.
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
The one Screen per Device currently being shown (`isActive: true`). Not a fixed pointer — advances dynamically to the next eligible Screen by `order` each time the Device polls for its display, wrapping back to `order: 1` after the last screen. If no Screen on the Device is currently eligible (every Screen has a Schedule, and none match), there is no Active Screen — the Device gets the same fallback image as a Device with zero Screens at all.
_Avoid_: Selected screen

**Current Screen**:
The specific feature/endpoint (`/current_screen`) that returns the Active Screen's image without advancing the rotation — used for previewing what a Device shows right now, distinct from the polling endpoint (`/display`) a Device itself calls, which always advances.
_Avoid_: Active screen (see above — related but not the same concept)

**Rotation**:
The cycle through a Device's Screens in `order`, one step per `/display` poll — skipping any Screen currently ineligible per its Schedule, if it has one.
_Avoid_: Cycling, playlist (see Schedule below — the concept "playlist" usually points at is Schedule, not Rotation)

**Schedule**:
A set of day/time constraints (weekday selection, daily time-of-day window — may cross midnight — optional active date range) plus an independent enabled/disabled toggle, attached to at most one per Screen, that gates whether that Screen is eligible to become the Active Screen. A Screen with no Schedule is always eligible; a disabled Schedule makes its Screen ineligible outright regardless of the day/time rules, without discarding them (soft-hide). Time-of-day windows are evaluated in the server's local timezone — Devices have no timezone of their own. Applies uniformly to every Screen type, including Mashup. Distinct from Rotation, which orders currently-eligible Screens — Schedule only narrows eligibility, it never reorders. A Screen needing more than one window (e.g. two separate times of day) needs a second Screen with its own Schedule, not a compound rule on one Schedule.
_Avoid_: Playlist, playlist item, recurrence rule

**Plugin Kind**:
Which strategy a Plugin uses to get data into its template — `Poll` (Kuroshiro fetches from a Data Source on a schedule) or `Webhook` (an external system pushes data by POSTing to the Plugin's Webhook URL, rendered synchronously on arrival).
_Avoid_: Plugin type, strategy

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
One independently-configured HTTP fetch (method, URL, headers, body, optional per-source JS transform), identified by a required, unique-per-Plugin `name`. Belongs to a `Poll`-kind Plugin, which holds an ordered list of zero or more Data Sources, each fetched in parallel on the Plugin's shared `refreshInterval` and exposed to its templates as its own top-level Liquid variable keyed by that `name`. If a Data Source's fetch fails, its variable is still present but carries an error marker instead of real data — the rest of the render proceeds with whatever succeeded. Distinct from a Mashup, which combines multiple Plugins' rendered outputs into layout slots on one Screen — a Data Source combines multiple fetches within a single Plugin.
_Avoid_: Extension, Exchange (Terminus's terms — not adopted here)

**Recipe**:
A pre-built, TRMNL-vetted Plugin template published at trmnl.com/recipes, importable into Kuroshiro by pasting its id or page URL. A Recipe exists only as an import source — the result of importing one is a normal Poll-kind Plugin, indistinguishable from a hand-built one, carrying only its source Recipe's id as inert metadata (no ongoing link, no auto-updates).
_Avoid_: Extension, Exchange (Terminus's terms), Plugin (the imported result — see above)

**Special Function**:
A one-shot command an admin triggers on a Device — `identify`, `sleep`, `add_wifi` or `rewind`, with `none` meaning nothing pending — that reaches the Device on its next `/display` poll. (`restart_playlist` and `send_to_me` are accepted by the API and offered in the UI, but marked unavailable: no Device Kuroshiro targets acts on them.) That response carries the value twice — as `special_function`, and echoed back as `action`, which is the field firmware waits for before actually performing the behaviour — and the Device's stored value is cleared to `none` in the same poll, so the command fires exactly once instead of re-asserting on every poll. On a proxied Device (mirroring a Device with an identical MAC) both fields come from TRMNL's own `/display` response instead of the local value.
_Avoid_: Special function toggle, device action, command

**Sleep Mode**:
A per-Device night window (`sleepStartTime`–`sleepEndTime`, time-of-day, may cross midnight, evaluated in the server's timezone) gated by an independent `sleepModeEnabled` toggle, mirroring Schedule's enabled/window split. While active, the Device's Active Screen stops advancing, and `/display` returns a `refresh_rate` computed as seconds-until-`sleepEndTime` so the Device wakes exactly when the window ends rather than on its usual cadence. A second toggle, `sleepScreenEnabled`, chooses between showing a dedicated `sleep` fallback screen (a new kind on the same mechanism as `noScreen`/`error`/`welcome`) or freezing whatever content was already showing. Applies only to non-mirrored Devices, and is entirely independent of the `sleep` Special Function — a separate, one-shot command an admin triggers by hand, sharing nothing but a name.
_Avoid_: Sleep (bare, in prose — ambiguous with the Special Function of the same name), Night Mode, Do Not Disturb

**Firmware**:
A versioned OTA binary a Device can be pushed to — either `official-synced` (mirrored automatically from `usetrmnl.com/api/firmware/latest`) or `custom` (uploaded directly by an admin). Carries a SHA-256 checksum, verified again at serve-time, and an optional set of compatible Device Models (empty means universal) enforced whenever a Firmware is assigned to a Device. A Device references at most one Firmware as its target for the next push, cleared once served — the same explicit, admin-driven assignment Device Model already uses, never inferred by comparing version numbers. Applies only to non-mirrored Devices.
_Avoid_: Update, OTA package, release, firmware version (bare — reserve for the `version` field)

**Firmware Kind**:
Where a Firmware came from — `official-synced` (Kuroshiro's daily sync job) or `custom` (an admin's direct upload).
_Avoid_: Firmware type, firmware source
