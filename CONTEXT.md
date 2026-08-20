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
The set of greys or colours an image is reduced to for a Device — chosen per Device from those its Device Model supports. Determines the image's bit depth.
_Avoid_: Colour mode, bit depth (as a name for the choice), dither mode

**Screen**:
A single unit of content assigned to a Device's rotation — a static image, an externally-fetched image, raw HTML, a plugin's rendered output, or a mashup. Screens belong to exactly one Device.
_Avoid_: Slide, page

**Order**:
An integer position (1..N, sequential, no gaps) that determines a Screen's place in its Device's rotation. Reassigned to close gaps whenever screens are deleted, and fully reassigned when a Device's Screens are reordered.
_Avoid_: Position, index, sequence number

**Active Screen**:
The one Screen per Device currently being shown (`isActive: true`). Not a fixed pointer — advances dynamically to the next Screen by `order` each time the Device polls for its display, wrapping back to `order: 1` after the last screen.
_Avoid_: Selected screen

**Current Screen**:
The specific feature/endpoint (`/current_screen`) that returns the Active Screen's image without advancing the rotation — used for previewing what a Device shows right now, distinct from the polling endpoint (`/display`) a Device itself calls, which always advances.
_Avoid_: Active screen (see above — related but not the same concept)

**Rotation**:
The cycle through a Device's Screens in `order`, one step per `/display` poll.
_Avoid_: Cycling, playlist

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
