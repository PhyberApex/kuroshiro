# Manual Rotation re-renders instead of holding, the button has one fixed meaning, and the Picked Screen is the admin advance

Terminus has a manual playlist mode in which a Device's page turns only on a button press, with per-Device button commands (first, forward, backward, last, identify, wipe) and a `screen_forward` admin command (issue #1460). A long `refreshRate` is not a substitute: it also stops the Active Screen from re-rendering, so live content goes stale. Grilling settled the following, building on the Device's recorded wake source (#1456) and its shared press predicate (`button`, `EXT0`, `EXT1`).

- **Manual Rotation is a per-Device setting**, `rotationMode: 'automatic' | 'manual'`, default `automatic`; never per Screen or Schedule. It is on the Device read model and update DTO and in the Configuration Archive next to `refreshRate`; a manifest without it imports as `automatic`.
- **A timer poll re-renders and serves the Active Screen**, not a `hold`. The page stays, the content stays live. Header report, Special Functions, Device Reset and Firmware push behave as ever.
- **A press advances one step in Order.** The button has one fixed meaning, next.
- **The Picked Screen is the admin's advance.** In manual it is served on the next poll of any kind, timer included, and cleared as today (ADR-0038 unchanged).
- **Schedule and Render Signal keep their veto.** A timer poll whose Active Screen has become ineligible advances to the next eligible Screen instead of showing the no-screen Fallback Screen. A Device with no Active Screen starts Rotation on its first poll.
- **Sleep Mode wins**: a press inside the window still gets the sleep screen. A mirrored Device keeps the value but it is not applied, as with Sleep Mode.
- **No new Screen State.** `Up next` now reads as the Screen Rotation turns to on its next advance.

## Considered and rejected

- **A configurable button command per Device.** Five of Terminus's six commands need state Kuroshiro has no use for; next is the one that matters, and the Picked Screen covers jumping.
- **A separate "advance now" action.** The Picked Screen already is one.
- **Hold semantics on timer polls** (serve the stored image unchanged). Cheaper, and it is exactly the stale-content problem a long `refreshRate` already has.

## Consequences

- The Device gains a non-null `rotationMode` text column, default `automatic`, via migration.
- Rotation's pure pick takes a "stay on the Active Screen" flag; the render-and-retry loop is unchanged, so a fresh `skip` on the Active Screen falls through to the next one.
- The Device Simulator can send an `Update-Source` header, so the mode is testable without hardware.
