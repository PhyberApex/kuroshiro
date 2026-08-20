# Data Sources fetch in parallel on one shared Plugin interval, with per-source error markers

Issue #776 gives `Poll`-kind Plugins multiple Data Sources instead of one. `PluginSchedulerService` today runs exactly one `node-cron` job per Plugin, keyed by `plugin.id`, on `plugin.refreshInterval`. Terminus's own multi-source model (Extension Exchanges) polls and error-surfaces each exchange independently, which raised the question of whether Kuroshiro should do the same.

We chose to keep one cron job per Plugin. On each tick, all of that Plugin's Data Sources are fetched in parallel — not sequentially, not gated on each other — still on the Plugin's single existing `refreshInterval`; there is no per-source interval column. If an individual source's fetch or transform fails, that source's key in the render context becomes an error marker instead of aborting the whole render, while sources that succeeded still render normally in the same pass.

We rejected per-source `refreshInterval`s. That would mean one cron job per Data Source instead of per Plugin — N jobs per Plugin, each independently tracking its own last-fetched/next-fetch state — a materially larger scheduler rewrite for a need the issue's own motivating cases (weather + air quality, a paginated endpoint) don't establish. Nothing in those scenarios needs sources on different cadences; the value we did want from Terminus's model — one source's flakiness not blanking the others — is captured by the per-source error marker, not by independent scheduling.

## Consequences

- Adding a Data Source to a Plugin has no cost to the scheduler's job count — it's still one job per Plugin.
- All Data Sources on a Plugin share one blast radius for scheduling changes (e.g. changing `refreshInterval` affects every source at once).
- A future need for independent per-source cadences would require revisiting this decision and the scheduler's job-keying scheme.
