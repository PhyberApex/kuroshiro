# A transform keeps saved state and fetches through the guarded fetch

Eight of the thirteen transforms among the Recipes featured on trmnl.com/recipes return `trmnl_state` and read `input.trmnl.state` back on the next run (help.trmnl.com, "Saved State"): a cursor for the next request, the history behind a trend, which entry was shown last. Seven call `fetch` themselves, four of them with no polling URL at all. ADR-0051 made the transform run as TRMNL's `run(input)`; without state every such Recipe started from nothing on every refresh, and without `fetch` the self-fetching ones rendered nothing.

**A Data Source's transform keeps state between scheduled runs.** What the transform returns under `trmnl_state` is taken out of the data the template sees and stored on the Data Source when it is an object of at most 8192 bytes, as TRMNL limits it; a list, a string or an oversized object is dropped and the saved state stays. The next run's request and transform read it at `trmnl.state`, each Data Source its own. The saved state is read fresh from the database at the start of a run, because the scheduler's tick holds the Data Sources as they were when scheduled, and written by the scheduled tick alone: a preview, an on-demand render or a Mashup slot runs the transform but never writes, as TRMNL writes state at the end of a run and never from the editor. A fetch that fails gives an error marker instead of running the transform, so it writes nothing, which is what TRMNL does too.

**The template reads a lone Data Source's state as `trmnl.state`**, the state its transform wrote this run, else the saved one, so a Recipe's markup draws the trend without the transform returning it twice. A Plugin with two or more Data Sources reads an empty `trmnl.state`, as its data reads by name (ADR-0049); each transform still keeps its own.

**The sandbox gets one `fetch`**, the server's, refused for an internal host in demo mode as a Data Source URL is, and nothing else: no `require`, no file system. The transform's five seconds cover its awaits, so a slow endpoint fails the Data Source rather than the tick.

Considered and rejected:

- **One state per Plugin, as TRMNL has it.** TRMNL has one transform per plugin; Kuroshiro has one per Data Source, and two transforms writing one record would race on every parallel fetch (ADR-0005).
- **`trmnl.state` keyed by Data Source name for several Data Sources.** A lone Data Source's template would then differ from TRMNL's, which every imported Recipe is written for.
- **Writing state from the preview.** The editor would advance a cursor on every keystroke, and TRMNL's editor leaves it alone.
- **`trmnl.previous_merge_variables`.** Kuroshiro caches the rendered Screen, not the data; keeping the last data per Data Source is a separate decision. _(Decided by ADR-0067: a transform reads its last scheduled output there.)_

## Consequences

- `PluginDataSource` gains `savedState`; the `.trmnlp` export and the configuration archive do not carry it, as it is run-time state, so a restored Instance starts fresh.
- No surface clears a stuck state yet; removing and re-adding the Data Source does, and a "clear saved state" action can follow.
- The transform runs with network access on the server; the demo-mode guard applies, and an operator who exposes the admin API exposes the same reach a Data Source URL already had.
