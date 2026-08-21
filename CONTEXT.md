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
The one Screen per Device currently being shown (`isActive: true`). Not a fixed pointer — advances dynamically to the next Screen by `order` each time the Device polls for its display, wrapping back to `order: 1` after the last screen.
_Avoid_: Selected screen

**Current Screen**:
The specific feature/endpoint (`/current_screen`) that returns the Active Screen's image without advancing the rotation — used for previewing what a Device shows right now, distinct from the polling endpoint (`/display`) a Device itself calls, which always advances.
_Avoid_: Active screen (see above — related but not the same concept)

**Rotation**:
The cycle through a Device's Screens in `order`, one step per `/display` poll.
_Avoid_: Cycling, playlist
