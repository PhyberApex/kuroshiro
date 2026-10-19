# The template reads when its data was fetched

TRMNL's `trmnl.plugin_settings` carries `data_fetched_utc`, "available once data has been fetched" (docs.trmnl.com, "Templates"): the Unix second the plugin's data was last fetched at, which trmnlp takes from the cached data's mtime. The DWD Rainradar Recipe prints its footer from it, and rendered "1970-01-01 03:00" here, where the key did not exist.

**`trmnl.plugin_settings.data_fetched_utc` is the second the render's data was fetched at.** For a Poll-kind Plugin that is the moment its Data Sources were resolved for this render, since Kuroshiro caches the rendered Screen and not the data (ADR-0052), so every render fetches. For a Webhook-kind Plugin it is the moment the Webhook Payload arrived, which the Plugin already records. A Plugin with no Data Sources fetched nothing, and a Webhook Plugin not sent a payload yet received nothing: the key is absent, as on TRMNL before the first fetch, so a Template prints an empty string rather than the epoch.

**`trmnl.plugin_settings.strategy` names the Kind as TRMNL spells it**, `polling` or `webhook`, where it always read `polling`.

Not in this decision: `trmnl.user.name`, `first_name` and `last_name`, which Kuroshiro has no user for, and `trmnl.device.*`, which a render shared by every Device showing the Plugin cannot name honestly.

## Consequences

- A Poll Plugin's `data_fetched_utc` moves on every render, including a preview; TRMNL's moves on every refresh, so a Template printing it shows the render time either way.
- The `trmnl` object stays per Plugin; nothing per Device joins it.
