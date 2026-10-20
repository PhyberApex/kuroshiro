# Each line of a Polling URL reads a list or text under data

ADR-0058 gave a Data Source several lines of URL, read as `IDX_0`, `IDX_1`, …, and laid a lone line's list or text at the root as `data`. TRMNL wraps every response the same way before it is laid at its `IDX_n`: trmnlp's poller parses each response and puts a list under `data` (`wrap_array`), text under `data` too, and only then builds `{ IDX_0: …, IDX_1: … }`. A Recipe on the first page of trmnl.com/recipes reads `IDX_0.data.items[0]`, and transforms across the gallery look at `source.IDX_0?.data` beside `source.IDX_0`. Kuroshiro laid a line's bare list at `IDX_n`, so `IDX_0.data` was nothing.

**A line's response that is a list or text reads under `data` at its `IDX_n`; an object reads as it is.** A line's error marker stays the marker (ADR-0005). A lone line is unchanged: its object's keys and its list or text as `data` at the root, and the Data Source's own name holds the value as fetched (ADR-0049, ADR-0058).

Considered and rejected:

- **Wrapping the lone line's value under its Data Source name too** (`source.data`). The name is Kuroshiro's own address for the value and nothing on TRMNL reads it; the root `data` is what a Recipe reads.
- **Wrapping an empty body.** trmnlp reads an empty body as a failed parse, `{}`; Kuroshiro's `null` already reads as nothing in Liquid.

## Consequences

- A Plugin of Kuroshiro's own with several lines and a list on one of them now reads `IDX_n.data` where it read `IDX_n`; no such Plugin was found in the probed Recipes, which were written for TRMNL's shape.
