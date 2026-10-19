# A Data Source requests each line its URL renders to, and a lone list or text reads as data

TRMNL lets a polling plugin name several URLs, one per line (help.trmnl.com, "Dynamic Polling URLs"): the Polling URL is run through Liquid first, the output is split at line breaks, blank lines are dropped, every line is requested, and the responses read as `IDX_0`, `IDX_1`, … With one URL the response reads at the root. Four of the twenty-five Recipes on the second page of trmnl.com/recipes do this, one of them generating its lines with a Liquid `for` loop over a Field Value; Kuroshiro requested the whole text as one address and rendered their empty states. TRMNL also puts a response that is not an object, a list or text, under `data`; a fifth Recipe reads its list that way.

**A `fetch`-mode Data Source's rendered URL is split into lines**, as trmnlp does it: at either line break, each line's inner whitespace collapsed and trimmed, blank lines dropped. One line is the one request it always was. Several lines are requested in parallel with the same method, headers and body, and the Data Source's value is `{ IDX_0: …, IDX_1: … }` in line order; a line that fails, or that the demo refuses as an internal host, carries the error marker of ADR-0005 under its index, so the other lines still read. An imported Recipe keeps its multi-line `polling_url` as the single Data Source's URL, and `IDX_n` lifts to the root through ADR-0049 like any lone object.

**A lone Data Source that resolved to a list or text reads as `data` at the root**, besides its own name, so `{{ data[0] }}` and a transform's `input.data` agree with TRMNL. An empty body and an error marker still lay nothing at the root. Amends ADR-0049, which laid nothing for a list or a scalar.

**A URL may start with Liquid.** The form and the API take a line that starts with `http://`, `https://`, `{{` or `{%`, since a Recipe's URL often begins with an `assign` or a Field Value; the rendered line is what the demo-mode guard checks, each line on its own.

Considered and rejected:

- **Splitting the URL before rendering.** The Liquid `for` loop of the Rolling Month Calendar Recipe emits its line breaks while rendering; TRMNL renders first, and so does Kuroshiro.
- **One Data Source per line on import.** The Recipe's Templates read `IDX_n`, and the Recipe Update Check compares one Data Source against the Recipe's one polling URL; splitting would make both diverge from the original.
- **At most six requests at a time, as TRMNL does.** A Data Source's lines are a handful; ADR-0005 already fetches Data Sources in parallel without a cap.

## Consequences

- The Data Source form's Request is a textarea; its hint says "Several addresses, one per line, read as IDX_0, IDX_1 and so on."
- A preview lists `IDX_0`, `IDX_1`, … or `data` among the names it offers, as it lists a lone object's keys.
- The glossary's Data Source is "one or more HTTP requests, one per line of its URL" rather than one request.
