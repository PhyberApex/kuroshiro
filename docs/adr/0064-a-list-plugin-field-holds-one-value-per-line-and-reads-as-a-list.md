# A list Plugin Field holds one value per line and reads as a list

TRMNL has two Plugin Field shapes whose value is a list: a `select` with `multiple: true` (the chosen option values) and `multi_string` (free strings). Templates read them as lists: `{{ s.calendar_labels | json }}` expects `["a","b"]`, `{% if config.low_days contains wk %}` and `{% for entry in visited %}` iterate, and a transform asks `Array.isArray(settings.packs)`. On the first three pages of trmnl.com/recipes ten selects allow several and eleven fields are `multi_string`. A Field Value is one string (ADR-0032); `multiple` was dropped on import, the field showed as a single select or a text input, and the template got a string.

**A list Plugin Field's Field Value is text with one value per line, and a template reads it as a list of those lines**, at its bare key and under `custom_fields_values` alike; blank lines are no value, an empty value an empty list. A `multi_string` Plugin Field is entered one per line in a textarea; a select that allows several, as a checklist of its options that keeps the ticked ones in the options' order. `multiple` is a Plugin Field attribute (ADR-0053), read from a Recipe and written back by the export. A Data Source's URL, headers and body render with the same list, so `{{ calendars | join: "," }}` works as on TRMNL.

Considered and rejected:

- **A list column, or JSON text, for the stored value.** One value per line is what the admin types and what the API already carries as a string; the list is a reading of it, and nothing else in the Field Value's path (secrets, clearing, defaults, the preview's unsaved values) needs to change.
- **Reading every Field Value with a line break as a list.** A multi-line text field holds prose with line breaks and reads as prose on TRMNL.
- **A combobox with chips instead of a checklist.** The option lists in the gallery are short (weekdays, regions, themes); a checklist shows them all and needs no new primitive.

## Consequences

- `isListField` and `listValuesOf` live in `kuroshiro-shared`, read by the API's context and the UI's controls alike (ADR-0020).
- A default of a list Plugin Field is text as written, so `default: all` reads as `["all"]`, which is the one value TRMNL gives it.
