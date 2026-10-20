# A transform reads its last scheduled output as previous merge variables

TRMNL hands a transform `trmnl.previous_merge_variables` beside `trmnl.state`: what the transform returned last time, so it can compare today's data with yesterday's or carry a value across a failed fetch. ADR-0052 set it aside as a separate decision. Four Recipes among the 75 featured (500871, 500937, 500939, 500950) read it, guarded, so without it they render but lose the comparison.

**A Data Source's transform reads what it returned on the last scheduled run at `trmnl.previous_merge_variables`**, an empty object before any run stored one. It is stored on the Data Source next to its Saved State, read fresh at the start of a run and written by the scheduled tick alone, as ADR-0052 keeps the state: a preview, an on-demand render or a Mashup slot reads it but never writes it. Only the transform's input carries it, as trmnlp hands it; the request and the template do not.

**What is stored is the transform's object result**, without its `trmnl_state` and without a `previous_merge_variables` key at any depth, as trmnlp strips it, so a transform that echoes its input does not store its history and double it every run. A result over 100 kB, which TRMNL refuses as merge variables, a list, text or a failed transform stores nothing, and the last output stays. A Data Source with no transform stores nothing either.

Considered and rejected:

- **One record per Plugin, as TRMNL has it.** Kuroshiro has one transform per Data Source, for the reason ADR-0052 keeps one state per Data Source.
- **Keeping the last data for a Data Source without a transform.** Nothing reads it: only a transform's input carries `trmnl.previous_merge_variables`.

## Consequences

- `PluginDataSource` gains `previousMergeVariables`; like `savedState`, the `.trmnlp` export and the configuration archive do not carry it, so a restored Instance starts fresh.
- Each Data Source with a transform keeps one more response, at most 100 kB, in the database.
