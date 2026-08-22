# Device sensor readings are a latest-value snapshot, one row per kind

TRMNL OG firmware reports Qwiic sensor add-on data on every `/display` poll via a `SENSORS` header — a comma-delimited list of `make=...;model=...;kind=...;value=...;unit=...;created_at=...` records, one per attached sensor. Kuroshiro parses this into a new `DeviceSensor` entity: at most one row per `(Device, kind)`, `kind` one of `carbon_dioxide`/`humidity`/`pressure`/`temperature`, holding just `value` and `unit`.

Each poll's header is treated as the complete, authoritative snapshot of what's currently attached — not a delta. On every poll, any `DeviceSensor` row whose kind is absent from that poll's header is deleted, and every kind present is upserted with its latest `value`/`unit`. This means a sensor physically unplugged from its Qwiic bus disappears from Kuroshiro on the very next poll, rather than leaving a stale reading behind indefinitely — no separate staleness window or expiry job is needed.

The header's `make`/`model` (sensor hardware identity, e.g. `Sensirion`/`SCD41`) and per-reading `created_at` are read but not persisted. `model` here would collide with Kuroshiro's existing "Device Model" concept (the TRMNL panel's own hardware class) if stored under that name, and neither field is needed: hardware identity isn't used by any decision or template, and `created_at` freshness is already implied by the snapshot-clearing behaviour above.

Sensor values are exposed to Plugin Liquid templates as an implicit `sensors` object, keyed by kind (e.g. `sensors.temperature.value`, `sensors.temperature.unit`), present whenever the Device has current readings and absent otherwise — no Plugin opt-in or declaration required. `unit` is kept as its own field rather than folded into a formatted string, since it's device-reported and not a constant Kuroshiro controls.

## Consequences

- No time-series/history table exists for sensor readings — only ever "what does this Device currently report." A future trends feature would need new storage, not an extension of `DeviceSensor`.
- Template authors must guard for absence (`{% if sensors.temperature %}`) since any kind can vanish between polls.
- Hardware identity (`make`/`model`) is additive to bring back later — it wasn't discarded because it's wrong, just because nothing needs it yet.
