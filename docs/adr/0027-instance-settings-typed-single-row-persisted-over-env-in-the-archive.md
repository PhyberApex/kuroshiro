# Instance Settings are a typed single row whose overrides win over environment variables and travel in the Configuration Archive

Triage of issue #1025 lifted the "configuration is environment variables only" cut from ADR-0023 and introduced Instance Settings as the persisted home for admin-tunable, instance-wide values. Its first tenants are the three Alert Rule thresholds (low-battery percent, offline multiplier, fetch-failure count). Three choices were real forks.

**A persisted override wins over the environment variable.** Each Setting resolves as override, else the matching `KUROSHIRO_ALERT_*` variable, else the built-in default. The alternative, env locking the field, keeps infrastructure-as-code deployments authoritative but leaves an admin page whose fields can be silently dead. With override-wins the page always shows what the Alert Sweep uses, and an instance that never saves a value behaves exactly as before, which is the additive migration ADR-0023 asked for. An override can be cleared, which returns the Setting to its fallback; without that the environment variable would be unreachable after the first save.

**One typed row, one nullable column per Setting.** `NULL` means "not overridden". A key/value table would avoid a migration per Setting, but gives up column types and constraints and moves all validation into code, against how every other entity in the repo is modelled. Settings are added rarely enough that a migration each is an acceptable price.

**Instance Settings are part of the Configuration Archive.** They are admin-built configuration, not runtime state, so leaving them out would break the archive's "a restore reproduces configuration" promise (ADR-0021). The archive carries only overridden values and Configuration Import replaces the whole row, so a Setting absent from the archive is cleared on the target. Fallback values are never exported: they belong to the target's own environment.

## Consequences

- The archive `schemaVersion` goes from 1 to 2, so archives exported before this change are refused on import (ADR-0021 has no archive migrations). _(Superseded in part by ADR-0032's 2026-10-09 addendum: a version 1 archive imports as one with no overridden Instance Settings.)_
- A deployment that sets a `KUROSHIRO_ALERT_*` variable after an admin saved an override sees no effect until the override is cleared. The admin surface names each Setting's fallback source so this is discoverable.
- A saved threshold applies from the next Alert Sweep; saving never triggers one, keeping the Sweep the only place Alerts are decided (ADR-0022).
- Apprise URL and key stay environment-only: they are deployment wiring and a secret, not tuning.
- The global firmware auto-update toggle ADR-0016 deferred and any per-Device threshold override are additive on top of this and are not part of it.
