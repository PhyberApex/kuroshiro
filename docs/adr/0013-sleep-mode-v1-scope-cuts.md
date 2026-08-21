# Sleep Mode v1 has no per-Device timezone and no custom-uploadable sleep screen

Issue #779's evidence section raises two follow-on questions beyond the core window/refresh-rate mechanics (ADR-0012). Grilling this issue deliberately cut the following from v1:

- **No per-Device timezone.** Sleep Mode's `sleepStartTime`/`sleepEndTime` are evaluated in the server's local timezone, reusing the decision already made for Schedule's day-parting in ADR-0009 rather than reopening it. Same accepted limitation applies: a Device not co-located with the server (in timezone terms) sees its sleep window fire at the wrong local wall-clock time.
- **No custom-uploadable sleep screen.** TRMNL's own product lets a user upload a bespoke image to show while asleep. v1 instead adds `sleep` as a fourth kind to the existing `FallbackScreensService` mechanism (alongside `noScreen`/`error`/`welcome`) — rendered and cached per Device Model/Palette like the others, with no per-Device upload path. A real upload feature needs its own storage, upload UI, and validation, which is materially bigger than this issue's scope.

Unlike the Recipe Import and Schedule features this repo has grilled before, Sleep Mode ships as a single full-stack pass — entity fields, `/display` logic, the `sleep` fallback kind, and the Device-settings UI all in one issue — rather than staged across multiple PRs. The whole feature is a handful of fields, one new fallback-screen kind, and one settings card; it doesn't have the surface area (multi-source fetching, mashup rendering, day-parting eligibility) that justified staging those larger features.

## Consequences

- A future per-Device timezone field is additive to both Schedule and Sleep Mode — neither one's shape changes, only what timezone their windows are evaluated against.
- A future custom-sleep-screen upload feature slots in as an alternative to the `sleep` fallback kind (e.g. a per-Device override checked before falling back to the shared rendered image) without touching the window/refresh-rate mechanics in ADR-0012.
