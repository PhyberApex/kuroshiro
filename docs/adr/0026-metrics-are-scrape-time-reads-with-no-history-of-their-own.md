# Metrics are scrape-time reads, kept unauthenticated and unprefixed

Triage of issue #1034 (split out of PhyberApex/infra#2549) settled how Kuroshiro exposes Device battery/RSSI/last-seen and active Alert counts to Prometheus.

**Prometheus owns history; Kuroshiro stores none.** `GET /metrics` reads the current `Device` and `Alert` rows at scrape time and formats them — it persists no time-series of its own. This keeps ADR-0018's "latest value only" stance for `DeviceSensor`-adjacent Device fields intact; a chart of a battery draining over time is an external Prometheus's job, not Kuroshiro's.

**Read directly from the entities, not from a dedicated metrics table or cache.** Four gauges built from one `Device` query and one `Alert` query are cheap enough per scrape that a snapshot table or cache would only add staleness for no benefit.

**Label choice: `device` (the `name`) and `friendly_id`, never the MAC.** The MAC is a hardware identifier with no place in a metrics label an operator might paste into a dashboard or share in a bug report; `name` and `friendlyId` are already the two identifiers surfaced elsewhere (UI, Alerts).

**`kuroshiro_alerts_active` always emits every known `AlertKind`, 0 included.** A Rule with a resolved Alert would otherwise vanish from the series entirely instead of dropping to zero, which breaks any alerting rule or graph built on "this series exists."

**The route is unauthenticated and outside the `/api` prefix, like the Device-facing routes.** Prometheus scrapes hit a bare path (`/metrics`), never carry Kuroshiro's admin session, and are conventionally unauthenticated at the application layer — an operator who wants it private keeps the path off their reverse proxy, the same posture already documented for `/display` and `/current_screen`.

## Consequences

- `MetricsModule` is read-only: it injects the `Device` and `Alert` repositories directly and adds no new columns or tables.
- `app.setGlobalPrefix('api', { exclude: ['metrics'] })` keeps `GET /metrics` outside the prefix without touching how the admin UI or Device-facing routes resolve.
- A future Alert kind (e.g. the fetch-failure Rule from ADR-0025) only needs adding to `ALERT_KIND_LABELS`; `kuroshiro_alerts_active` picks it up with no code change in the metrics module itself.
- Issue #1067 extended this to `DeviceSensor` readings and each `fetch`-mode Data Source's Fetch Failure Streak (ADR-0025), still as scrape-time reads from the existing repositories — no new storage.
- Each Sensor kind gets its own gauge, named after the unit official firmware reports for that kind (`kuroshiro_device_sensor_<kind>_<unit>`, e.g. `..._temperature_celsius`), fixed in code rather than read per-row. A `DeviceSensor` row whose stored `unit` doesn't match is omitted, not converted — `unit` stays device-reported (ADR-0018) but a metric name can't carry a varying unit, so a mismatch has to be dropped rather than silently mislabeled.
- `kuroshiro_data_source_fetch_failure_streak` is labelled `plugin`, `data_source` (the names, consistent with `device`/`friendly_id` never being internal IDs) plus `plugin_id`, since two Plugins can share a name and would otherwise collide into one series.
