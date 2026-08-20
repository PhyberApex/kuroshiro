# Schedule gates Rotation eligibility; "Playlist" rejected as the concept name

Issue #777 asks for day-parted, recurring screen scheduling — TRMNL's Playlist Scheduler and Terminus's `playlist_item` model (weekday arrays, date windows, `hidden_at`) both name this concept "playlist." Kuroshiro's `CONTEXT.md` already defines **Rotation** as the cycle through a Device's Screens by `order`, and had already flagged "playlist" as a rejected synonym for it. Reusing "playlist" for the new feature would have re-opened that exact conflict.

We introduced **Schedule** instead: a set of day/time constraints (weekday selection, a daily time-of-day window that may cross midnight, an optional active date range) plus an independent enabled/disabled toggle, attached to at most one per Screen. Rotation is unchanged as the ordering mechanism — `order`, `isActive`, the advance-and-wrap logic in `display.service.ts` all stay as they are. Schedule only narrows *eligibility*: the advance step now skips a Screen whose Schedule doesn't currently match, continuing around the ring, instead of picking whatever's next by `order` unconditionally. A Screen with no Schedule is always eligible, so existing Devices with no Schedules configured see no behavior change at all.

We considered replacing the round-robin advance with a rules engine that computes "what should be showing right now" from scratch each poll (closer to option (b) we rejected in grilling). We rejected it: it would touch every Screen regardless of whether it uses scheduling, is a materially bigger change, and Terminus's own advancing logic (`current_item_advancer`, `slide_window`, `screen_optioner`) is itself filter-shaped, not a from-scratch recompute — validating that the filter approach is sufficient.

We also decided a Screen carries at most one Schedule, not a compound "AND" of several (TRMNL's "+And during" templates). A Screen needing two separate windows gets a second Screen with its own Schedule — Rotation already cycles through multiple Screens, so this reuses existing machinery instead of adding compound-rule evaluation.

## Consequences

- Schedule applies uniformly to every Screen `type`, including `mashup` — no special-casing in the eligibility check.
- When no Screen on a Device is currently eligible, the Device falls back to the same `noScreen.png` path used today when a Device has zero Screens at all (`display.service.ts:100-112`) — no new fallback concept was introduced.
- A future need for compound per-Screen schedule rules, or a from-scratch rules engine, reopens this decision.
