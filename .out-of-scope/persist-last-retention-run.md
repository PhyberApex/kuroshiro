# Persisting the last Retention Run

Kuroshiro keeps the result of the last Retention Run in memory only. After a restart, `GET /api/maintenance/retention` reports no last run until the daily job fires again or an admin triggers one.

## Why this is out of scope

The last run is a status readout, not state anything acts on. Retention itself does not depend on when it last ran: each run works out what to delete from the data as it stands, so a forgotten last run changes nothing about what gets deleted.

The Housekeeping page already words the empty case truthfully ("Retention has not run since Kuroshiro was started"), so an admin is never told something false. Making it survive a restart would mean new columns on the `InstanceSettings` row (ADR-0027), a migration, and write and read paths in `RetentionService`, all for a value that is filled again within a day.

## Prior requests

- #1126 — "The last Retention Run is lost when Kuroshiro restarts"
