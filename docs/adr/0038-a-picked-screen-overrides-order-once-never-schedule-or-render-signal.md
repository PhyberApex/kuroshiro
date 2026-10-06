# A Picked Screen overrides Order once, never a Schedule or a Render Signal

Issue #1084 asks for a way to put a Screen on the Device now, without reordering Screens or waiting for Rotation to cycle round to it. Rotation already takes one step on every `/display` poll, and Kuroshiro cannot make a TRMNL Device poll sooner. A plain "advance" therefore does nothing the next poll would not do anyway. The useful action is choosing *which* Screen the next poll turns to. Grilling settled the following.

- **The admin picks a Screen; there is no "advance".** "Show next" on a Screen's row makes it the Device's **Picked Screen**, and the next `/display` poll serves it instead of the Screen Order would have given.
- **A pick overrides Order and nothing else.** It is offered only on a Screen that Rotation could show at the next poll, and never on the Active Screen or on the Screen already Up next. A Schedule stays the admin's own rule; to show a Screen outside it, they edit the Schedule. A `skip` Render Signal has no manual override (ADR-0031).
- **It is stored as its own value, not by setting `isActive`.** `nextEligibleScreen` scans from the Screen *after* the Active Screen, so marking the picked Screen active would make the next poll step past it. The Device gains a nullable `pickedScreenId`, set to null when that Screen is deleted.
- **One pick per Device, used once.** A new pick replaces the old one, and "Back to Order" clears it. The poll that serves it clears it, the same way a Special Function is cleared once it fires. Rotation then continues in Order from the picked Screen, which has become the Active Screen, so no second position is remembered.
- **A pick that lapses is dropped quietly.** If the Screen's Schedule shuts it out by the time of the poll, or its render raises a fresh `skip`, the pick is cleared and that poll runs normal Rotation from the Active Screen. Nothing is reported.
- **Sleep Mode holds it.** Rotation does not advance during Sleep Mode's window (ADR-0012), so the Picked Screen is the first Screen shown at wake.
- **Mirrored and Proxied Devices have no Rotation**, so the action is hidden there rather than disabled. The notice above the rows already says Rotation is paused.
- **The admin sees the pick as Up next.** The picked row carries the Screen State "Up next" with the qualifier "picked by hand", and the Current Screen's "Up next" line names it. There is no separate queued state, because Up next already means "shows at the next poll".

## Considered and rejected

- **"Advance" on the Current Screen.** Without a way to make the Device poll sooner, it is the next poll's own behaviour.
- **A pick that overrides the Screen's Schedule.** It would create a second way to show a Screen outside its Schedule, and the row would have to explain why a "Not at this hour" Screen is Up next.
- **Returning Rotation to where it was before the pick.** That would mean remembering a second position, for a difference an admin is unlikely to notice.
- **ADR-0008's pause/resume API.** That cut was a held state for third-party automation. A pick is a one-shot choice made by the admin, closer to a Special Function, and leaves ADR-0008 standing.
- **The `rewind` Special Function.** It asks the firmware to show its previous image and does not touch Rotation.

## Consequences

- `screenStatesOf` and `pickAndRenderScreen` must both honour the pick, so the Up next a row shows is the Screen the poll serves.
- `pickedScreenId` is runtime state: it is excluded from the Configuration Archive and from `.trmnlp` export, like every other runtime value (ADR-0021).
- A pick takes effect only at the Device's next poll, which can be up to its refresh rate away. The row's "Shows at the next poll, around {hh:mm}" is the only promise made.
