# Firmware management v1 scope cuts

Grilling issue #781 deliberately cut the following from v1:

- **No global auto-update toggle** — per-Device only (see ADR-0014). No global settings module exists in Kuroshiro today.
- **No binary/magic-byte validation on custom uploads** — only file size and extension/mimetype are checked, the same trust level Screens already gives uploaded images. Verifying a `.bin` actually looks like a legitimate ESP32 firmware image is real effort for a self-hosted, admin-only upload path; the admin is responsible for uploading a binary that matches their own hardware.
- **Dedicated storage, not reused Screens storage** — binaries live under `public/firmware/{firmwareId}.bin`, not `public/screens/devices/{deviceId}/`, since a Firmware is a resource shared across many Devices, not generated per-Device.
- **Sync cadence matches Device Model sync** (daily-at-4am + on boot), not Terminus's 6-hourly job — official firmware doesn't change often enough to justify a second cadence convention alongside the one sync job Kuroshiro already has.
- **Full history retained, nothing silently overwritten** — official-synced rows are deprecated, never deleted, matching Device Model's own deprecate-on-disappear behaviour; custom uploads support explicit delete, mirroring Terminus's bulk delete.
- **SHA-256 checksum, computed at upload/sync and re-verified at serve-time** — the wire protocol's `firmware_url` carries no checksum of its own, so this is the only integrity check available.

## Consequences

- Rolling a Device back to an older version is possible (nothing is deleted out from under a `targetFirmware` reference) without any extra "rollback" feature — it's just assigning an older row.
- A future global auto-update toggle or deeper upload validation are both additive; neither requires reshaping the `Firmware` entity or the `/display` push mechanism from ADR-0014.
