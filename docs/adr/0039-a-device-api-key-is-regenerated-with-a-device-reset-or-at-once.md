# A Device's API key is regenerated with a Device Reset, or at once for a Device that will not call in

A Device's `apikey` is its only credential, and until issue #1085 the only way to replace a leaked one was to delete the Device and register it again, losing its Screens, Schedules and Plugin Assignments. Grilling settled how a regenerate reaches the Device, which hinges on firmware behaviour Kuroshiro does not control.

**The firmware never recovers from a rejected key by itself** (read in `usetrmnl/firmware` at `11b4e5ef`). A TRMNL Device calls `/api/setup` only on boot when it has no stored key. A poll answered with an HTTP error (Kuroshiro answers a wrong `access-token` with 401) makes it back off, retry and eventually show an error, but it keeps the key. Only a Device Reset (`reset_firmware`) or holding the button for 15 seconds clears the key, and both also erase the Wi-Fi credentials and the server URL. Terminus, TRMNL's own BYOS server, documents the same sequence: reset the Device, rotate the key, reconnect it.

- **Only the Device's own `apikey`.** `mirrorApikey` is the key of a Device on TRMNL's server and is changed there.
- **"Also give {Device} a new API key" rides on a Device Reset.** It is a checkbox on the Device Reset confirmation. The key is rotated in the same poll that delivers `reset_firmware`, after that poll has been authenticated with the old key, so the Device wipes itself and `/api/setup` hands it the new key when someone sets it up again.
- **"Regenerate now" rotates the key at once,** for a Device that is lost, stolen or will not call in again. Its polls are refused from then on, until someone holds its button for 15 seconds and sets it up again. The confirmation says so.
- **A Device locked out this way reads Offline**, and the offline Alert Rule fires as it would for any Device that stops calling in. A separate "key rejected" state would need Kuroshiro to tell a refused poll from a stranger's, which it cannot do reliably.
- **Neither is offered on a Proxied Device,** where TRMNL answers the polls. Both stay on a mirrored Device, whose own key still authenticates its polls. Both are allowed in demo mode, like Device Reset and delete: demo mode blocks abuse vectors, not destructive actions.
- **Configuration Import never overwrites an existing Device's `apikey`.** An unredacted archive carries every key in plaintext and Import upserts Devices, so restoring an archive made before a regenerate would silently bring a leaked key back. Import sets `apikey` only on a Device it creates, and the import summary says existing Devices kept their keys. This extends ADR-0028's rule for the redaction sentinel ("keep the target's value") to every archive.

## Accepted risk

`/api/setup` hands the stored key to any caller that sends a known MAC, and an unredacted Configuration Archive contains MACs as well as keys. A regenerate therefore protects against a leaked key, not against a leaked MAC. TRMNL's own server has the same property, so it is accepted rather than gated: refusing setup to a known MAC would also refuse a Device someone reflashed without telling Kuroshiro first.

## Considered and rejected

- **Regenerate only, and tell the admin to reset the Device by hand.** Once the key has rotated, the Device's polls are refused, so it can no longer receive a Device Reset; the admin would always need physical access.
- **Rotating the key one poll after the Reset is delivered.** A Device that wipes itself and runs setup before that poll would fetch the old key and keep it.
- **Answering a rejected key with `status: 500` so the firmware resets itself.** The firmware treats it as `reset_firmware` and erases the Wi-Fi and server URL too, for any Device presenting a wrong key.

## Consequences

- If the Device never receives the response that carries `reset_firmware` but the key has already rotated, it is stranded with the old key, exactly as after "Regenerate now". Recovery is the same 15-second button hold.
- A pending Device Reset carries whether it also rotates the key; the pending fact names it ("Device Reset pending, with a new API key").
- Cancelling a pending Device Reset remains unspecced; if it is added, it cancels the rotation with it.
