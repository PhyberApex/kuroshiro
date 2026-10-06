# A Render Signal is read in the poll's own render and remembered until the Screen's cached output changes

ADR-0008 cut conditional skip logic from Schedule v1 as "a plugin-rendering-contract change" and expected a follow-up issue. Issue #1065 is that follow-up: a Screen's rendered page can declare a **Render Signal** about itself, either `skip` (leave me out of Rotation) or `hold` (keep showing my previous image). This supersedes ADR-0008's "conditional skip logic" bullet except for the skip-if-stale TTL, which stays cut. Grilling settled the following.

- **The signal is TRMNL's own pair of JS flags, not a Kuroshiro marker.** `window.TRMNL_SKIP_DISPLAY` raises `skip` and `window.TRMNL_SKIP_SCREEN_GENERATION` raises `hold`. An imported Recipe that already sets either flag works unchanged. A Liquid tag or HTML attribute would be cheaper to detect but would need every such Recipe edited by hand.
- **It is read in the Chrome pass the poll already runs.** The scheduler tick and a Webhook arrival only render Liquid to an HTML string; Chrome loads that HTML inside `/display`, after Rotation has picked a Screen. So Rotation renders the Screen it picked and, on `skip`, discards it and tries the next eligible one. The alternative was a second Chrome launch at cache-write time so Rotation could stay a pure read of persisted state; it would charge every Plugin refresh a launch, including the Plugins that never raise a signal.
- **The verdict is remembered on the Screen until its cached output changes.** Later polls act on a stored `skip` or `hold` without launching Chrome, so a signalling Screen costs one launch per refresh rather than one per poll. A raw `html` Screen has no cached output and is never remembered: it is evaluated on every poll it comes up in, which is nearly free because it already launches Chrome every time. No verdict expires on a timer.
- **Every Screen that passes through Chrome honours it**: `plugin`, raw `html` and Mashup, matching how Schedule applies to every Screen type. `file` and external-link Screens run no JS and cannot raise one.
- **A Mashup signals as a whole.** Its slots are concatenated into one document sharing one `window`, so a flag cannot be attributed to the slot that set it. Blanking only that slot would need each slot evaluated in its own page and would leave a hole in the layout; ignoring the flag in Mashups would make a signalling Plugin behave differently in a slot than on its own.
- **`skip` removes the Screen from this poll's Rotation.** A skipped Screen never becomes the Active Screen. When every eligible Screen skips there is no Active Screen and the Device gets the `noScreen` fallback, the same outcome as no Schedule matching.
- **`hold` keeps the Screen in Rotation.** It takes its turn and becomes the Active Screen, but its stored image is served without being regenerated. A held Screen with no stored image yet shows the `noScreen` fallback rather than adding a fallback kind. When a page raises both, `skip` wins: a Screen that is out of Rotation has no turn in which to hold.
- **The flag is read at the page's `load` event**, the moment the screenshot is taken. No extra wait is added.
- **Only `/display` evaluates it.** Current Screen and Sleep Mode's frozen image keep serving the Active Screen's stored image; a signal that appears while a Screen is Active takes effect on the next `/display` poll.
- **The admin sees the verdict, read-only, on the Device's Screen list.** `skip` is the Screen State "Skipping"; `hold` is the qualifier "holding image" on whatever state the Screen already has, because a held Screen still takes its turn. The opened row explains either in a sentence (`docs/ui/devices.md`). Without it a Screen that never reaches the Device looks broken. There is no manual override or clear action.

## Considered and rejected

- **A cap on Chrome launches within one poll.** The worst case is bounded by the number of Screens on the Device and occurs once per refresh, on the first poll after it.
- **A time-to-live on remembered verdicts.** It would only matter for content that does not refresh on a timer; `html` Screens are already re-evaluated per poll, and a Webhook Plugin's content is frozen until its next POST anyway.

## Consequences

- Rotation is no longer a pure function of Schedules: choosing the next Screen can render, and a poll that meets several not-yet-remembered `skip` Screens in a row launches Chrome once for each before one shows.
- A flag set by asynchronous JS after `load` is missed, and a signal computed from the time of day is only as fresh as the cached output it was evaluated against. A Webhook Plugin's verdict holds until its next POST.
- The remembered verdict is runtime state: it is excluded from the Configuration Archive and from `.trmnlp` export like every other runtime value (ADR-0021).
- While a Screen is held, the `filename` in the `/display` response must stay what it was when the stored image was generated, so the Device does not redraw an identical image.
- Additive follow-ups: the skip-if-stale TTL from ADR-0008, surfacing the signal in the Plugin editor preview, waiting for flags set after `load`, per-slot handling inside a Mashup.
