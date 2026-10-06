# Alerts

A background sweep runs every 5 minutes, and once on startup, and checks three conditions:

- **Low battery** for every Device, with a 5-point hysteresis so it does not flap right at the threshold.
- **Offline** for every Device that has not polled for longer than its refresh rate times a multiplier. Skipped while the Device sleeps under Sleep Mode, and for a grace period after it wakes.
- **Data Source fetch failing** for every fetch-mode Data Source of a Poll Plugin whose consecutive scheduled failures reach a threshold.

Each condition opens an **Alert** the first time it is seen and resolves it the first time it clears. The Alerts page shows every active Alert plus anything resolved in the last 7 days.

<ThemedShot name="alerts" />

## Notifications through Apprise

Delivery goes through an [apprise-api](https://github.com/caronc/apprise-api) sidecar, which supports dozens of notification channels. Set `KUROSHIRO_APPRISE_URL` to enable it; without it, Alerts still open and resolve, they just are not delivered. Instance Settings has a **Send a Test Notification** button that exercises the real delivery path.

## Thresholds and Retention

The low battery percentage, offline multiplier and fetch failure count come from environment variables, and each one can be overridden in **Instance Settings** without a restart. A daily Retention job prunes resolved Alerts and Device Log entries older than their Retention age; active Alerts are never touched.

The design decisions behind Alerts are recorded in [ADR-0022](https://github.com/PhyberApex/kuroshiro/blob/main/docs/adr/0022-alerts-decided-by-sweep-delivered-via-apprise-sidecar.md), [ADR-0025](https://github.com/PhyberApex/kuroshiro/blob/main/docs/adr/0025-fetch-failure-alerts-scoped-to-data-source-with-streak-on-entity.md) and [ADR-0027](https://github.com/PhyberApex/kuroshiro/blob/main/docs/adr/0027-instance-settings-typed-single-row-persisted-over-env-in-the-archive.md).
