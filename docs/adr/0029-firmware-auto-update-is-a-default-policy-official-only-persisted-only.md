# Firmware auto-update is a default policy for official Firmware, persisted-only and off by default

Triage of issue #1041 lifted the "no global auto-update toggle" cut from ADR-0016 now that Instance Settings (ADR-0027) exist to carry it. The toggle, **Firmware Auto-Update**, is one boolean Instance Setting. Three choices were real forks.

**A default policy, not an override or a gate.** When the toggle is on and the daily official sync inserts a new `official-synced` Firmware row, Kuroshiro assigns that row as `targetFirmware` with `updateFirmware` set on every eligible Device, exactly as an admin would have. A Device is eligible when it is not mirrored, has no push pending (`updateFirmware` is `false`) and its Device Model is in the new row's `compatibleModels`. An explicit admin assignment that has not been served yet is never replaced, and the toggle never touches a Device on its own outside the moment a new official row lands. The alternatives were a master override, which would silently discard an admin's pending assignment, and a gate, which would make the per-Device fields do nothing while the toggle is off and so break the "these two fields are the entire push mechanism" promise of ADR-0014. The default policy keeps the blast-radius reasoning of ADR-0014 intact: nothing compares version numbers, the only trigger is a new official row, and `/display` serves it through the same one-shot path.

**Official Firmware only.** The official sync only ever yields the single OG binary (ADR-0015), so "latest official" is one well-defined row: the non-deprecated `official-synced` row. Among `custom` Firmware there is no ordering, several can be compatible with the same Device Model, and picking a "latest" by upload time would be exactly the inferred decision ADR-0014 rejected. Custom Firmware stays admin-assigned per Device.

**Persisted-only, default off.** The Setting is a nullable boolean column on the Instance Settings row; `NULL` means not overridden and resolves to `false`. It gets no environment variable. ADR-0027 gave the Alert thresholds override-wins-over-env only because a `KUROSHIRO_ALERT_*` convention already existed to migrate; there is no prior variable here, and inventing one would set the precedent that every future Instance Setting needs an env counterpart.

## Considered options

- **Master override** — every eligible Device gets the latest official row regardless of pending admin assignments. Rejected: silently drops explicit admin intent.
- **Gate** — the toggle must be on and a per-Device target must be assigned. Rejected: turns the toggle into a global kill switch for a mechanism that is already opt-in per Device, and gives an admin no way to get updates without still touching every Device.
- **Catch-up on enable** — turning the toggle on immediately assigns the current official row to eligible Devices. Rejected for now: it needs a rule for which Devices are "behind", which is the version comparison ADR-0014 avoids. Turning the toggle on only affects the next new official row.

## Consequences

- The per-Device fields from ADR-0014 remain the whole push mechanism; the toggle is one more writer of those fields, not a second serving path.
- A Device that already has a push pending keeps it; the next official row after that one is served will be picked up by the policy.
- Devices without a Device Model, or whose model is not in the official row's `compatibleModels`, are skipped, matching the hard block on manual assignment (ADR-0015).
- The Setting travels in the Configuration Archive like every other overridden Instance Setting (ADR-0027).
- Turning the toggle off does not clear pushes it already queued; those are indistinguishable from admin assignments and are cleared by an admin the usual way.
- A future catch-up-on-enable or custom-Firmware policy is additive on top of this.
