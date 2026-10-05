# Multi-Data-Source migration breaks existing templates; no compatibility shim

`PluginRendererService.render()` passes the fetched JSON straight through as the Liquid root scope — a single-Data-Source Plugin whose API returns `{"temp": 72}` writes `{{ temp }}` directly in its template, flat, no wrapper. Issue #776 gives `Poll`-kind Plugins multiple named Data Sources instead of exactly one, each exposed to the template as its own top-level variable keyed by its name (`{{ weather.temp }}`). That necessarily nests what used to be flat, even for a Plugin migrated from having exactly one Data Source.

We considered two compatibility options and rejected both. Auto-flattening only when a Plugin has exactly one Data Source is worse than it looks: a Plugin working fine at one source would silently break the day someone adds a second, with no change to the template itself — a much nastier failure mode than a known break at migration time. Dual-exposing both the flat root fields and the namespaced object simultaneously is permanent hidden-context magic every future reader has to know about to debug a name collision.

We chose to accept the breaking change outright. The migration backfills a `name` for each pre-existing single-Data-Source row (kept at `order: 0`) so it satisfies the new required/unique `name` constraint, but does not attempt to rewrite the Plugin's Liquid template — authors update their own template once, after migration, to prefix their field references with the source's name. This is viable because Kuroshiro is self-hosted and owner-operated: there's no unknown fleet of third-party templates to break silently across a fleet of installs.

## Consequences

- Every existing single-Data-Source Plugin's template needs a one-time manual edit after this migration ships (flat `{{ field }}` → namespaced `{{ source_name.field }}`).
- Plugin export/import format changes in lockstep (`dataSource` → `dataSources` array) with no legacy-key acceptance, for the same reason.
- No dual-context resolution logic needs to be built or maintained in `PluginRendererService`.
