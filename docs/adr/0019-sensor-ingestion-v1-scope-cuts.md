# Sensor ingestion v1 scope cuts

Grilling issue #782 deliberately cut the following from v1:

- **Device-attached only, no server-attached sensors.** Terminus also supports sensors wired to a self-hosted Raspberry Pi, synced independently on their own schedule. That needs a new sync job, a pairing story, and a `source` concept Kuroshiro doesn't have yet — a much bigger, self-hosting-specific undertaking than parsing a header TRMNL OG devices already send on every poll. Deferred to a future issue if there's demonstrated demand.
- **No history/time-series storage.** Only the latest reading per kind is kept (see ADR-0018) — no per-reading history table, matching every other piece of Device telemetry Kuroshiro already stores (`batteryVoltage`, `rssi`, etc., all single overwritten columns).
- **No Device Model gating.** Nothing enforces that only OG Devices can have sensor data — the `SENSORS` header simply won't appear on other models' polls, so the constraint self-resolves without any enforcement code. No Device Model capability-gating mechanism exists elsewhere in the codebase to reuse anyway.
- **No admin UI.** `DeviceInformationCard.vue` already surfaces battery voltage and RSSI, but sensor readings aren't added to it in v1 — backend parsing plus Liquid template exposure is the whole v1 surface. A read endpoint and UI card are a separable follow-up.

## Consequences

- A future server-attached sensor feature is additive — it needs its own sync mechanism and a `source` discriminator on `DeviceSensor`, but doesn't require reshaping the device-attached path from ADR-0018.
- A future admin UI card is a pure read — it needs a new endpoint over the existing `DeviceSensor` table, nothing about ingestion changes to support it.
