# Screen Playlists v1 excludes skip logic, per-item overrides, device grouping, and a pause/resume API

Issue #777's evidence section lists a wide TRMNL/Terminus feature set beyond day-parted scheduling: conditional skip logic (`window.TRMNL_SKIP_SCREEN_GENERATION` / `TRMNL_SKIP_DISPLAY`, a "skip if stale" TTL mode), per-item duration and colour-palette overrides, device grouping via a shared playlist (Terminus's `PUT /playlists/:id/mirror`), and a `/api/playlist_items` pause/resume endpoint. Grilling this issue deliberately cut all four from v1, on separate grounds:

- **Conditional skip logic** is a plugin-rendering-contract change — a plugin's own output would need to signal "don't show me right now" — which is an orthogonal mechanism to time-based Schedule eligibility (ADR-0007) and touches the plugin/template pipeline, not the Screen/Schedule relationship.
- **Per-item overrides** (duration, palette): duration needs a server-side elapsed-time-per-Screen model that doesn't exist today — Devices just poll at their own `refreshRate`, there is no timer — so it's a real new subsystem, not a Schedule field. Palette-per-Screen is a rendering concern, not an eligibility concern; Kuroshiro already has per-Device palette (`devices.entity.ts`), and extending it per-Screen is unrelated to whether that Screen is *currently eligible*.
- **Device grouping** ("shared schedule/playlist across Devices") is a distinct concern from per-Screen scheduling. It's also a naming trap: `Device` already has `mirrorEnabled`/`mirrorMac`/`mirrorApikey` meaning "this Device mirrors TRMNL cloud's own display" — reusing "mirror" for device-grouping, as Terminus does, would collide with that existing meaning.
- **Pause/resume API** (`/api/playlist_items`-equivalent) targets multi-tenant SaaS automation — a third party programmatically pausing a customer's item. Kuroshiro is self-hosted/single-tenant; an admin can edit or delete a Schedule through the existing admin surface. The soft-hide need this would otherwise cover is met by Schedule's enabled/disabled toggle (ADR-0007), reachable through normal admin CRUD rather than a dedicated endpoint.

## Consequences

- None of these four are precluded by the Schedule design in ADR-0007 — each can be layered on independently later without revisiting Schedule's shape.
- Each is expected to be filed as its own follow-up issue rather than folded into #777's implementation.
