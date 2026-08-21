# Firmware push is manual and admin-assigned, not automatic version comparison

Issue #781 asks whether firmware updates should be pushed automatically — Kuroshiro already captures a Device's exact reported firmware version (`fw-version` header → `device.fwVersion`), so comparing it against the latest synced Firmware and auto-flipping `update_firmware` was a real option. We rejected it for v1: a Device only receives a push when an admin explicitly assigns a Firmware as its `targetFirmware` and sets `updateFirmware` (an entity column that already existed but was dead code — `display.service.ts` hardcoded it to `false`). On the Device's next poll, `/display` serves that Firmware's binary URL once and clears the flag — the same explicit, one-shot pattern `resetDevice` already uses, and the same "admin assigns, never inferred" shape as `device.deviceModel`. This applies only to non-mirrored Devices; a mirrored Device already gets `firmware_url` via TRMNL's own pass-through, and letting Kuroshiro's own targeting logic apply there too would create two competing authorities for the same field.

## Considered options

- **Automatic version-diffing** (compare `fwVersion` against the latest synced Firmware, auto-push when behind). Rejected: flashing the wrong or incompatible binary can brick a physical device, and per-Device explicit action is a much smaller blast radius than a background job deciding on its own — version-ordering semantics (semver vs. build number vs. string compare) aren't settled either.
- **Global auto-update toggle** applying to every Device. Deferred: no global settings module exists in Kuroshiro yet; building one just for this would be new architecture, not a firmware decision.

## Consequences

- `device.updateFirmware` and `device.targetFirmware` are the entire push mechanism — nothing decides on its own that a Device is "due" for an update.
- A future automatic policy is additive: it would set the same two fields Kuroshiro already reads on every poll, not change how `/display` serves them.
