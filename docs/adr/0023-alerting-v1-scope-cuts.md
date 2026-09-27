# Alerting v1 scope cuts

Grilling issue #1006 deliberately cut the following from v1:

- **Only two Alert Rules: Device low battery and Device offline.** Data Source fetch failures and firmware-sync failures are natural Rules but each needs its own subject modelling; two Device-scoped Rules are enough to prove the Sweep abstraction. Follow-up issues.
- **Configuration is environment variables only, thresholds are instance-wide.** Kuroshiro has no persisted instance-settings entity or admin settings page; building one to carry two numbers would dwarf the feature. Per-Device thresholds are therefore also out — they'd need that settings surface or a per-Device column, and there's no demonstrated need yet.
- **No admin UI.** No Alerts list, no active-Alert badge on a Device, no "send test notification" button. The `Alert` table is persisted even without Apprise configured precisely so a later UI is a pure read.
- **No reminders, no pruning.** A Notification fires on open and on resolve, never again in between. Resolved Alerts are kept indefinitely; a retention job can be added if the table ever matters.
- **No polymorphic subject.** `Alert` carries a nullable `deviceId` FK (cascade delete) rather than a `subjectType`/`subjectId` pair; every v1 Rule is Device-scoped and a future non-Device Rule can add its own nullable FK.

## Consequences

- A settings-page feature would migrate the `KUROSHIRO_ALERT_*` thresholds into it; env vars should keep working as defaults/overrides so that migration is additive.
- The voltage-to-percent mapping moves into `packages/shared` (ADR-0020) so the Sweep and the Device UI can never disagree about what "20%" means.
