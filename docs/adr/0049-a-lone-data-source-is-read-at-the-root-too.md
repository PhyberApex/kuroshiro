# A lone Data Source is read at the root too

Running the 25 Recipes featured on trmnl.com/recipes through the Recipe import showed that almost every template reads its polled data as bare keys: `{{ author }}`, `{{ quote }}`, `{% for item in items %}`. TRMNL lays the response of a single polling URL at the root of the Liquid context and only nests it (`IDX_0`, `IDX_1`) when a Recipe polls several. Kuroshiro has always placed each Data Source under its own name (ADR-0006), and the importer names a Recipe's single source `source` (ADR-0010, ADR-0037), so an imported Recipe rendered its Field Values and nothing else. Only one of the 25 wrote `source.` anywhere.

**A Poll-kind Plugin with exactly one Data Source reads that Data Source's keys at the root of the context as well as under its name.** The keys are laid over the bare Field Values and under the named Data Sources, `trmnl` and `sensors`, which nothing replaces. The rule applies to a `literal`-mode Data Source too, so a static Recipe's `static_data` reads as it does on TRMNL. Nothing is laid at the root when the lone Data Source resolved to a list, a scalar or an error marker, or when the Plugin has two or more Data Sources, which keep ADR-0006's independent named variables as the only exposure.

Considered and rejected:

- **Merging only a Data Source named `source`.** The name is an import convention, not a meaning; an admin who renames or hand-builds the single Data Source should get the same template contract.
- **Merging every Data Source at the root, last one wins.** That is the cross-source merge ADR-0006 refused, with its collision rules and silent overwrites.
- **Rewriting the Recipe's templates on import to prefix `source.`.** Fragile across `{% assign %}`, filters and nested loops, and it breaks the Recipe Update Check's three-way comparison against the original.

## Consequences

- An imported polling or static Recipe with one URL renders unmodified, and a hand-written `{{ source.title }}` keeps working.
- The preview lists the root keys as Data Source names, after the Data Source itself, so completion offers them and the form's unsaved Field Values do not cover them.
- Adding a second Data Source to a Plugin takes the first one's root keys away; its templates then read both by name.
- Amends ADR-0006: the lone-source case is the one exposure beyond independent named variables.
