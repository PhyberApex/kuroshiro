# Special Function is a one-shot command acknowledged by an `action` echo

Issue #780 cross-checked `/api/display` against `usetrmnl/trmnl-firmware` source and found two gaps that made three of Kuroshiro's Special Functions dead on arrival. Firmware only performs `identify`, `sleep` and `add_wifi` once it sees an `action` field echoing back which command the server is acknowledging; Kuroshiro never sent one, so a triggered command reached the Device and did nothing. And `device.specialFunction` was never cleared after being served, so the value kept being re-asserted on every poll until someone reset it to "None" in the UI by hand.

So `/display` now sends `action` on every response — never conditional, never omitted, always equal to the `special_function` in that same response — and `device.specialFunction` is read and cleared to `'none'` in the same batch as `device.resetDevice`, right before the existing `deviceRepository.save(device)`. The pre-clear value is what that one response reports; every later poll gets `none`. This is the same read-then-clear-then-save shape `device.resetDevice` already uses, and the shape ADR *Firmware push is manual and admin-assigned* specifies for `updateFirmware` once that lands — `display.service.ts` still hardcodes `update_firmware` to `false` today.

The proxy mirror path (`device.mac === device.mirrorMac`) is the exception: both `special_function` and `action` are taken verbatim from TRMNL's own response, since in that mode TRMNL's server already owns the pair and a locally-derived `action` would fight it. Mirroring by `current_screen` (different MAC) keeps deriving both from the local Device, so a mirrored Device's own Special Functions still work.

`temperature_profile` (e-ink refresh waveform compensation) is also added, hardcoded to `"default"` for every Device — no per-Device or per-Device-Model setting until there's a reason for one.

## Considered options

- **`touchbar_mode`**. Omitted: it maps to NVS-persisted hardware state on a TRMNL X, and sending a guessed value would overwrite what the Device already has.
- **`maximum_compatibility`**. Omitted: it forces full (slow) e-ink refreshes. TRMNL's own server omits it for firmware ≤ 1.6.2, and Kuroshiro has no scenario that needs to force a full refresh.
- **`image_url_timeout`**. Omitted: firmware's own default is sensible; overriding it with a guess is worse than not sending it.

## Consequences

- Supersedes the premise ADR-0012 recorded in passing — that `specialFunction` is "a sticky manual override — nothing in the codebase resets it after use". That was true when ADR-0012 was written; it isn't now. ADR-0012's actual decision stands: Sleep Mode still wakes a Device via `refresh_rate` and stays independent of the `sleep` Special Function, and a one-shot field is if anything a worse fit for a window-shaped feature.
- `DeviceInformationCard.vue`'s dropdown is unchanged, but its selection now behaves as a trigger rather than a setting: it reverts to `none` on the Device's next poll.
- `guest_mode` is not offered as a Special Function value at all — it has no behaviour to attach until Screen Playlists (#777) exists.
- `Device.specialFunction` still defaults to `identify` (entity column and baseline migration), which under one-shot semantics means a freshly registered Device, and every existing Device whose owner never touched the dropdown, fires one `identify` on its next poll. Normalising that default to `none` needs a migration and is left to a follow-up.
