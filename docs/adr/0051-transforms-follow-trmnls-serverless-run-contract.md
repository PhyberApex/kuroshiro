# Transforms follow TRMNL's serverless `run(input)` contract

TRMNL replaced its Transformer with Serverless in August 2026 (help.trmnl.com, "Serverless"). Every JavaScript transform among the 25 Recipes featured on trmnl.com/recipes is now `async function run(input)` with `module.exports = { run }`, reads `input.trmnl.plugin_settings.custom_fields_values` and `input.trmnl.user`, and gets the polled data laid over that context, as the template does. Kuroshiro's transform runner called `module.exports(data)` or a global `transform(data)` with the raw response alone, never awaited, so each of those Recipes rendered its untransformed response. Four Recipes have a `transform.js` and no polling URL at all (they fetch on their own), one is `strategy: static` with a transform that computes from the Field Values, and the importer refused or silently dropped all of them (ADR-0037 assumed a literal value has nothing to transform). Four more ship `transform.py` and were imported with the transform ignored. One polls an Atom feed, which the fetcher refused as not JSON.

**A transform is called as TRMNL's runtime calls it.** The runner looks for `run`, declared or exported as `module.exports = { run }` or `exports.run`, then `module.exports` itself, then a declared `transform`; without one the input passes through. The result is awaited, within the same five seconds the sandbox allows synchronous code. The input is the template context, `trmnl`, the Field Values and `sensors`, with the fetched object laid over it; a list, text or nothing fetched sits under `data`. Both the bare `input` and the earlier `data` name address it, so a transform written for the earlier runner still runs, reading its object's keys where it did.

**A literal Data Source may carry a transform.** It runs over the Value laid on the context, so a static Recipe's transform computes from the Field Values as on TRMNL, and a Recipe with a transform and no polling URL imports as an empty literal Data Source named `source` carrying the transform, where it will fetch on its own once the sandbox has a `fetch`. ADR-0037's "nothing to transform" no longer holds and is amended; its import refusals `recipe-static-transform` and `recipe-none-transform` go.

**A response that is not JSON is its text.** The fetcher answers the body's text, as TRMNL hands an XML feed or an HTML page to a transform, and nothing for an empty body. A Template reading a text Data Source gets the text.

**Serverless code in Python, Ruby or PHP refuses the import.** `recipe-serverless-language` names the language; importing the Recipe with the transform silently dropped left a Plugin that rendered wrong with no hint why. Running those languages is out of scope; a Recipe's author can rewrite the transform in JavaScript.

Not in this decision: `fetch` inside the sandbox and the saved state TRMNL keeps for a transform (`input.trmnl.state`, `trmnl_state`), which follow as their own decision.

## Consequences

- Imported Recipes' transforms run as on TRMNL, and the Plugin's Data Source shows them.
- The Transform editor shows for both Data Source modes; the mode rule, the export, the Recipe Update Check and the archive carry a literal Data Source's transform.
- A transform's input differs from before only for a response that is not an object: a list it received as the whole input now sits under `data`.
