# Kuroshiro vs. the rest

Kuroshiro isn't the only way to run a TRMNL: the device also works with the official [trmnl.com](https://trmnl.com/) cloud, and with [Terminus](https://github.com/usetrmnl/terminus), the other open-source, self-hosted BYOS. Here's how they line up today:

| | **Kuroshiro** | [**Terminus**](https://github.com/usetrmnl/terminus) | **Official TRMNL Cloud** |
|---|---|---|---|
| Hosting | Self-hosted, one Docker image (NestJS + Vue) + your own Postgres | Self-hosted (Docker/K8s/Raspberry Pi), Ruby/Hanami + Postgres + Redis/Sidekiq | Managed SaaS, closed source |
| Cost | Free, MIT-licensed | Free, MIT-licensed | Free tier + paid "Developer Edition" for custom plugins; device sold separately |
| Accounts | Single admin, no login | Multi-user accounts with email verification | Cloud account required |
| Device models & palettes | Full official catalog synced daily, plus admin-created custom colour Palettes | Device models & palettes supported | Defines the catalog—sells the hardware |
| Plugins | `Poll` (multiple named Data Sources, each fetched or a literal value) & `Webhook` (3 merge strategies) | "Extensions"/Exchanges, single- or multi-source polling | 1,000+ native, community & private plugins |
| Recipe import | Imports any trmnl.com Recipe, including serverless-transform ones Terminus's importer rejects | Imports via its Extension Gallery | Native—it's the source catalog |
| Screen scheduling | Per-Screen day/time Schedule gates rotation eligibility | Playlist model: weekday/date windows, skip-if-stale TTL, device-grouped playlists | Playlist Scheduler, group scheduling by time of day |
| Mashups | 7 layouts | Supported | 8 layouts |
| Firmware | Official sync + custom OTA upload, hard-blocked unless the Firmware is compatible with the Device's model | Official sync + custom upload, no model-compatibility link | Manages its own hardware directly |
| Sensors | Device-attached Qwiic sensors (CO₂/humidity/pressure/temperature), exposed to Plugin templates | Device-attached *and* server-attached (Raspberry Pi) sensors | — |
| Sleep Mode | Per-Device night window that parks the Device until the window ends, with an optional dedicated sleep Screen | Supported | Supported |

The short version: Kuroshiro trades Terminus's multi-user accounts and device-grouped playlists for a simpler single-admin, single-container deployment, while going further than either self-hosted option on per-Device-Model firmware safety and mixed fetch/literal Data Sources within one Plugin.

## Why it works the way it does

Every significant design decision, including the prior-art comparisons behind the table above, is recorded as an Architecture Decision Record. Browse them in [`docs/adr`](https://github.com/PhyberApex/kuroshiro/tree/main/docs/adr) on GitHub, and the domain language they use in [`CONTEXT.md`](https://github.com/PhyberApex/kuroshiro/blob/main/CONTEXT.md).
