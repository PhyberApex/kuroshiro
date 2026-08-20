# Webhook plugins render synchronously and discard the raw payload

Kuroshiro's plugin system had one data-acquisition strategy: Poll, where `PluginSchedulerService` fetches from a `PluginDataSource` on a cron tick and, in the same step, renders the Liquid template and writes the result to `Screen.cachedPluginOutput`. There was no persisted store of raw fetched data anywhere — only the rendered output.

Adding a Webhook strategy (#775) — external systems POST data to a per-Plugin URL instead of Kuroshiro pulling it — raised the question of whether that POST body needs to be persisted before rendering. TRMNL's own webhook plugins support `deep_merge` and `stream` merge semantics, both of which require reading back prior state, which would require a new persisted `merge_variables`-equivalent store.

We chose to support replace-only semantics for v1: the webhook handler renders the POST body against the plugin's template synchronously, inline, in the request handler — reusing the same render-and-cache logic the Poll scheduler uses — and writes straight to `Screen.cachedPluginOutput`. The raw payload itself is never persisted. This keeps one render pipeline for both Poll and Webhook plugins and requires no new schema.

The trade-off: there is no way to inspect what was last POSTed to a webhook (no `GET`-to-retrieve, unlike TRMNL), and `deep_merge`/`stream` aren't possible without a payload store. If a POST arrives for a plugin with no template configured yet, it is rejected with `422` rather than silently accepted and dropped, since there is nowhere for it to go.

## Consequences

- `deep_merge`, `stream`, and `GET`-to-inspect are deferred to a follow-up feature (tracked separately) that adds a persisted payload store — all three depend on the same underlying storage, so they should land together rather than being retrofitted one at a time.
- Poll and Webhook plugins share one render-and-cache code path; only the trigger differs (cron tick vs. HTTP POST).
