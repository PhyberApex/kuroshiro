# Literal Data Sources add a Data Source Mode, not a third Plugin Kind

Issue #794 (follow-up from #778/#796) asks for real support for the fixed `static_data` payload a TRMNL `strategy: static` Recipe carries — #796 explicitly rejected importing these because nowhere in Kuroshiro's model could that literal data live. Terminus solves this with a separate `static`/`polling` split at the whole-Extension level (`static_body` vs `poll_body`), but that split exists only because Terminus has no concept of multiple named data sources per plugin to begin with. Kuroshiro already generalized past that (#810: multiple named Data Sources per `Poll` Plugin), so we add the literal case there instead: `PluginDataSource` gains an explicit `mode: 'fetch' | 'literal'` discriminator column (default `'fetch'`), mirroring the existing explicit-enum pattern used by `Plugin.kind` and `Firmware.kind` rather than inferring literal-ness from `url` being absent. A `literal`-mode Data Source carries only `name` + a nullable `literalValue` jsonb column; `method`/`url`/`headers`/`body`/`transformJs` are all disallowed for it, enforced by a Data-Source-level sibling to `pluginKindFieldViolation`. It's editable like any other Data Source field after creation — not write-once — and a `Poll`-kind Plugin may freely mix `fetch`- and `literal`-mode Data Sources, something Terminus's model can't express at all.

Scheduled re-render on `refreshInterval` is unaffected by mode: a literal-only Plugin still re-renders on schedule, since templates can reference time-based Liquid (e.g. `trmnl.system.timestamp_utc`) regardless of where the data came from, and a literal source's "fetch" is free (no network call), so there's no cost worth special-casing away.

Static Recipe import is now unblocked: the archive's single `static_data` hash (Terminus schema: `maybe :hash`) imports as one `literal`-mode Data Source named `'source'` — matching the existing single-implicit-source naming convention `parseLegacySingleDataSource` already uses for plain polling imports — falling back to `{}` if null/absent, consistent with how malformed `polling_headers`/`polling_body` already fall back rather than crashing the import. A `transform.js` found alongside `strategy: static` still fails the import with a clear error rather than being silently dropped, since `literal` mode has no fetch response to transform in the first place.

## Considered Options

- **A third Plugin Kind (`Static`)**, mirroring Terminus's Extension-level split. Rejected: it would duplicate `Poll`'s Data-Source/template/`refreshInterval` machinery on a new Kind for no real benefit, and would foreclose a Plugin mixing a real fetch with a literal value — which the Data Source Mode approach allows for free.
- **Inferring `literal` from `url` being null**, avoiding a new column. Rejected: inconsistent with how every other kind-like distinction in this codebase (`Plugin.kind`, `Firmware.kind`) is an explicit, validated enum rather than derived from field presence.

## Consequences

- `PluginDataSource` gains `mode` (default `'fetch'`) and nullable `literalValue` columns via migration; existing rows are unaffected (`mode: 'fetch'`).
- **Data Source Mode** is a new glossary term, deliberately distinct from **Plugin Kind** despite the naming similarity — see `CONTEXT.md`.
- A future non-Recipe way to author literal data (e.g. pasting raw JSON in the Plugin editor) needs no new model — it's just creating a `literal`-mode Data Source directly, the same path the Recipe importer now uses.
