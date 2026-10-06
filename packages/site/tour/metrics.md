# Prometheus Metrics

`GET /metrics` answers in the Prometheus text exposition format, read from the database at scrape time. Kuroshiro keeps no history of its own, so point an external Prometheus at it for charts and long-term retention ([ADR-0026](https://github.com/PhyberApex/kuroshiro/blob/main/docs/adr/0026-metrics-are-scrape-time-reads-with-no-history-of-their-own.md)).

| Metric | Labels | What it is |
|---|---|---|
| `kuroshiro_device_battery_volts` | `device`, `friendly_id` | Last reported battery voltage |
| `kuroshiro_device_rssi_dbm` | `device`, `friendly_id` | Last reported Wi-Fi signal strength |
| `kuroshiro_device_last_seen_timestamp_seconds` | `device`, `friendly_id` | When the Device last polled, as a Unix timestamp |
| `kuroshiro_alerts_active` | `kind` | Active Alerts per kind, zeros included |
| `kuroshiro_device_sensor_carbon_dioxide_ppm` | `device`, `friendly_id` | Last CO₂ Sensor reading |
| `kuroshiro_device_sensor_humidity_percent` | `device`, `friendly_id` | Last humidity Sensor reading |
| `kuroshiro_device_sensor_pressure_hpa` | `device`, `friendly_id` | Last pressure Sensor reading |
| `kuroshiro_device_sensor_temperature_celsius` | `device`, `friendly_id` | Last temperature Sensor reading |
| `kuroshiro_data_source_fetch_failure_streak` | `plugin`, `plugin_id`, `data_source` | Consecutive failed scheduled fetches of a fetch-mode Data Source |

All of them are gauges. The MAC address is never used as a label.

::: warning
Like the routes a Device calls, `/metrics` sits outside the `/api` prefix and has no authentication of its own. If you want it private, keep it off your reverse proxy.
:::

```yaml
scrape_configs:
  - job_name: kuroshiro
    static_configs:
      - targets: ['kuroshiro.local:3000']
```
