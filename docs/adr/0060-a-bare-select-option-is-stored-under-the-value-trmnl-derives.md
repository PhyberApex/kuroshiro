# A bare select option is stored under the value TRMNL derives

A Recipe's `custom_fields` writes a select's options either as `{ Label: value }` maps or as bare strings. TRMNL stores a bare one under a derived value: the label lowercased with spaces as underscores, so `Metric` is saved as `metric` and `Dark Mode` as `dark_mode` (trmnlp's `SelectFieldChoices`, mirroring the hosted form). Recipe authors write for the stored value: on the first three pages of trmnl.com/recipes, 24 select fields carry bare options with capitals or spaces, and their templates compare `theme == 'dark'` and their defaults read `default: metric` beside options `Metric` / `Imperial`. Kuroshiro kept the label as the value, so picking "Metric" stored `Metric` and the comparison never matched.

**A bare select option imports with the label as written and the value TRMNL derives from it.** A `{ Label: value }` option keeps its value, whatever its case. The export writes an option bare where an import would derive its value again, and as `{ Label: value }` wherever it would not, which TRMNL and trmnlp read back as the same pair.

Considered and rejected:

- **Deriving in the form as well**, for an option the admin types on a Plugin of their own. The admin writes their own template and reads the value they typed; the derivation is TRMNL's convention for Recipes, not a rule of Kuroshiro's.
- **Deriving the default too.** TRMNL leaves a default as written (`default: US AQI` beside options `US AQI`), and the template is written for that.
- **Comparing case-insensitively in Liquid.** It would diverge from Ruby Liquid's `==` (ADR-0043) for every string.

## Consequences

- A Plugin imported before this holds the label as the value; a Recipe Update brings the derived value as an option change, and a stored Field Value equal to the old label no longer matches an option until picked again.
- `storedOptionValue` lives beside `parseFieldOptions` and is the one place the convention is spelled.
