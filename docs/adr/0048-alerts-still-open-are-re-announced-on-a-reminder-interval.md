# Alerts still open are re-announced on a Reminder Interval, from inside the Sweep's digest

ADR-0023 cut reminders from Alerting v1: a Notification fires on open and on resolve, never again in between. An offline Device from last week is therefore announced once and then silent for as long as it stays offline, which issue #1468 found easy to miss. Grilling settled the following, and this ADR supersedes ADR-0023's "no reminders" in part; "no pruning" was already lifted by Retention (#1062).

- **A Reminder is a digest entry, not a new Notification.** Each Alert Sweep already builds one digest Notification out of every Alert opened or resolved (ADR-0022 addendum). A Reminder is a third kind of entry in that digest, listed under its own `Still open:` heading between the opened and the resolved sections, grouped by Alert Rule and then by subject like the other two. Each entry reuses the Rule's opened wording for the subject and carries the opened entry's severity. The digest title gains a "still open" count only when it is non-zero, so a digest with no Reminders reads exactly as it did before.
- **Only Alerts still active are reminded.** A resolved Alert whose resolution Notification failed already rides in every Sweep's digest until it lands, so there is nothing to remind about on that side. A resolve is a one-shot event, not a lingering state.
- **The clock restarts on every announcement.** "Remind every N hours" counts from the last time the open Alert was announced, whether that was its opening Notification or its previous Reminder. An Alert open for three days with N=24 is reminded three times.
- **A Reminder is due only where the Rule evaluates the subject as still active.** The decision sits in the Sweep's "still active" branch. A subject the Rule skips that Sweep, such as a Device inside its Sleep Mode window or one with no `lastSeen`, is not reminded; Reminders resume when the Rule evaluates it again.
- **The interval is one numeric Instance Setting, `alertReminderHours`, applying to every Alert Rule.** It follows the Retention ages exactly: environment-variable fallback `KUROSHIRO_ALERT_REMINDER_HOURS`, built-in default `0`, bounds `{ min: 0 }`, and `0` means off. `null` already means "override cleared" for every Setting (ADR-0027), so it cannot also mean off. Hours is the unit because the Sweep runs every five minutes and finer granularity would buy nothing. ADR-0023's "thresholds are instance-wide" still holds: no per-Rule or per-Device interval.
- **A new nullable `remindedAt` column on `Alert` carries the last Reminder.** `notifiedAt` keeps its single meaning, "the opening Notification was delivered", which the Sweep relies on to decide whether an opened entry still needs to ride. A Reminder is due when the later of `notifiedAt` and `remindedAt` is older than the interval. Bumping `notifiedAt` on every Reminder would have saved a migration and made the column name lie.
- **Delivery and stamping are unchanged.** The whole digest is sent all-or-nothing; on success every Reminder entry is stamped `remindedAt` together with the opened and resolved stamps, and on failure none is, so each rides again next Sweep.

## Considered and rejected

- **A separate Reminder Notification per Sweep.** Two Notifications per Sweep is what the digest was introduced to avoid.
- **Reminding about resolved-since-last-digest Alerts too.** Already covered by the resolution retry, and would turn a one-shot event into a repeated one.
- **A one-shot reminder.** The word "every" in the Setting rules it out, and a single nudge after N hours is as easy to miss as the opening Notification.
- **Reusing `notifiedAt` as "last announced at".** No migration, but the fact that the opening Notification was delivered would be lost.
- **A per-Rule or per-Device interval.** Three knobs for an S-sized feature with no demonstrated need.
- **A grace period when the interval is lowered.** Lowering N from 48 to 1 reminds every qualifying open Alert on the very next Sweep, in one digest. That is ADR-0027's "applies from the next Sweep" rule and one digest is the worst case.

## Consequences

- ADR-0023's "No reminders" is superseded by this ADR; its other cuts stand as recorded there.
- `Alert` gains a nullable `remindedAt` timestamp via migration.
- `alertReminderHours` joins `SETTING_KEYS`, so it travels in the Configuration Archive like every other Setting; an archive from before this change imports with the Reminder off and no `schemaVersion` bump is needed. The environment variable is documented alongside the others in `README.md`, `.env.example` and `docker-compose.yml`.
- The only admin UI change is the one number field on the Instance Settings page, beside the Alert thresholds. The Alerts page does not show when an Alert was last reminded; that is an additive follow-up.
- Without an Apprise URL nothing is delivered, so `notifiedAt` is never stamped and no Reminder is ever due; enabling delivery later still does not burst-notify beyond the pending opened entries ADR-0022 already allows.
