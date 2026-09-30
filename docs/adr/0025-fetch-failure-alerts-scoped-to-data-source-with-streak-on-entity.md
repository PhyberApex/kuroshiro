# Fetch-failure Alerts are scoped to the Data Source and read a Fetch Failure Streak persisted on it

Triage of issue #1026 lifted the "Data Source fetch failures" cut from ADR-0023 and settled the subject modelling that cut was waiting on. Three choices, each the smaller of two real options.

**The Alert subject is the Data Source, not its Plugin.** The failing thing is one HTTP request; the Plugin is only its container. A Data Source has its own id, so the Alert gains a nullable `dataSourceId` FK (cascade delete) and the same partial unique index on `(kind, subject)` the Device Rules use — exactly the "future non-Device Rule adds its own nullable FK" path ADR-0023 anticipated, with no new dedup shape. Scoping to the Plugin would have been one Alert for "any source failing", which cannot express one source recovering while a sibling still fails, and whose Notification could not name the culprit. The accepted cost is that one dead upstream behind several Data Sources opens several Alerts.

**The Fetch Failure Streak lives as columns on the Data Source, not in a status table.** A streak counter, a last-attempt timestamp and the last error message are three columns with a default; a separate 1:1 status entity would add a table, an entity and a join for the same three facts. The columns are runtime state: they are excluded from `.trmnlp` export and from the Configuration Archive like every other runtime value, and they are reset when a Data Source is switched to `literal` mode.

**Only the scheduled render moves the streak.** Four paths resolve a Plugin's Data Sources — the scheduler tick, the editor preview, Mashup slot renders and on-demand Device renders — and all of them already share one resolver. Recording the outcome inside that resolver would let an admin's preview open or close an Alert, and would count on-demand renders that fire at Device cadence rather than the Plugin's. The scheduler tick is the one path that runs on the Plugin's own `refreshInterval` for every Poll Plugin, assigned or not, so it is the only writer.

## Considered and rejected

- **Plugin as subject with a per-source details list.** Fewer Notifications, but no per-source resolve signal; see above.
- **Deriving the streak from Alert history instead of persisting it.** The Sweep would have to remember render outcomes it never sees; ADR-0022 requires every Rule to read persisted state.

## Consequences

- The `AlertRule` contract and the Sweep stop assuming every subject is a Device; each Rule loads and identifies its own subjects.
- The threshold is a count of consecutive scheduled renders (`KUROSHIRO_ALERT_FETCH_FAILURES`, default 3), so time-to-Notification scales with the Plugin's `refreshInterval`: 45 minutes at the default 15.
- A Plugin assigned to no Device still alerts. An admin who configured a fetch source presumably wants to know it broke.
