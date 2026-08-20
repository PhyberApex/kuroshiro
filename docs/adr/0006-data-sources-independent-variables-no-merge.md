# Data Sources expose independent named variables; no cross-source merge step

Issue #776's motivating cases — weather + air quality, a paginated endpoint split across two requests — are fully satisfied by giving each Data Source its own top-level Liquid variable, keyed by its name: `{{ weather.temp }}` and `{{ air_quality.aqi }}` in the same template. `transformJs` already exists as a column on `PluginDataSource`, applied per-source before its result is placed under its name in the render context.

We considered also offering a plugin-level "combine" transform that would receive all sources' results and return one merged context, matching the general shape of "combining multiple APIs into one screen" the issue describes. We rejected it: the stated use case is already solved by referencing two independent variables in the same template — Liquid itself can read across both. A server-side JS step that runs after every source's own fetch/transform, with its own error-handling semantics layered on top of the already-decided per-source error-marker behavior (ADR-0005), is speculative complexity the issue doesn't ask for.

So independent named top-level variables are the only exposure mode. There is no plugin-level combinator.

## Consequences

- Liquid templates do all the "combining" — computing a value from two sources' fields happens in Liquid/its filters, not in a server-side JS step.
- If a real need for cross-source computation emerges later, it reopens this decision — the per-source `transformJs` column is not the place to add it, since it only ever sees its own source's raw response.
