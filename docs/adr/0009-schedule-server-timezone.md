# Schedule's time-of-day window is evaluated in the server's timezone, not per-Device

Day-parting (issue #777) needs a timezone to anchor "7am–9am" against, and `Device` has no timezone field today — nothing on the entity locates a Device geographically or otherwise. Grilling raised adding a per-Device IANA-timezone field, since self-hosted Kuroshiro deployments can have Devices physically distant from the server (e.g. a US-hosted server with a Device in Berlin). That was rejected in favor of evaluating every Schedule's time-of-day window against the server process's own local timezone — no new Device field, no per-Device configuration step.

This is a known, accepted limitation: a Device not co-located (in timezone terms) with the server will see its day-parting fire at the wrong local wall-clock time, offset by the difference between server and Device timezones. We're recording this explicitly so it reads as a deliberate simplicity trade-off for v1, not an oversight — and so a future fix (adding a per-Device timezone field and threading it through Schedule's eligibility check) knows exactly what it's replacing.

## Consequences

- Self-hosted users with geographically distributed Devices need to account for the offset manually when authoring a Schedule (e.g. shift the window by the known difference).
- Adding per-Device timezone later is additive — it doesn't change Schedule's shape from ADR-0007, only what timezone its window is evaluated against — but does require a migration and a UI field.
