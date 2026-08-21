# Sleep Mode wakes a Device via a dynamic refresh_rate, not the specialFunction toggle

The TRMNL protocol gives Kuroshiro exactly one lever over when a Device next polls: the `refresh_rate` int on every `/display` response — the Device always decides its next poll from the last value it received, and there is no "stop polling" primitive. So while a Device is inside its Sleep Mode window, `/display` returns `refresh_rate` computed as seconds-until-`sleepEndTime` (clamped to a minimum), rather than a long fixed value re-checked on the next poll. This wakes the Device exactly when the window ends instead of oversleeping by up to a full sleep-rate interval. The Active Screen also stops advancing for the duration — "last content" means the Device keeps showing the same image it already had, not a rotation that silently moved on in the background.

Sleep Mode is deliberately independent of the existing `sleep` `specialFunction` value (`Device.specialFunction`, sent verbatim in every `/display` response). That field turned out, on inspection, to be a sticky manual override — nothing in the codebase resets it after use — not the one-shot trigger the firmware evidence suggested. Coupling Sleep Mode to it would mean setting `specialFunction: 'sleep'` on window entry and un-setting it on exit, which both adds a state machine and risks stomping a user's own manual selection. The two features share a name and nothing else.

Two related priority rules fall out of the same window logic: the new `sleep` fallback-screen kind (added to `FallbackScreensService` alongside `noScreen`/`error`/`welcome`) only ever appears when `sleepScreenEnabled` is true — with it false, a zero-Screen Device still falls through to plain `noScreen`, since "last content" has nothing to preserve on a Device that never had a Screen. And `/current_screen`, the non-advancing admin preview, reflects sleep state too, since it exists specifically to show "what a Device shows right now."

Sleep Mode is skipped entirely for mirrored Devices (`mirrorEnabled: true`) — in that mode `refresh_rate` and `specialFunction` already come from the real TRMNL account's own `/display` response, which Kuroshiro just relays. Layering a local sleep window on top would fight values Kuroshiro doesn't actually control.

## Consequences

- No new field or process tracks whether a Device is "currently asleep" — it's a pure function of `sleepStartTime`/`sleepEndTime`/`sleepModeEnabled` against server time, recomputed on every `/display` call, same pattern as Schedule eligibility.
- A future change that wants Sleep Mode to trigger real firmware deep-sleep (via `specialFunction`) is additive but non-trivial — it would need to introduce the coupling and state-restoration logic explicitly rejected here.
- Mirrored Devices cannot use Kuroshiro's Sleep Mode at all; if that's needed later, TRMNL's own account-level Sleep Mode is the workaround in the meantime.
