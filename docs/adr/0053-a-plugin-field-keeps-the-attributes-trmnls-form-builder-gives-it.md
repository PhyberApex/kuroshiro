# A Plugin Field keeps the attributes TRMNL's form builder gives it

The 25 Recipes featured on trmnl.com/recipes declare, beside a field's type, what TRMNL's form builder (help.trmnl.com, "Custom plugin form builder") calls `group` (161 fields), `placeholder` (45), `help_text` (37), `min`, `max`, `step`, `maxlength` and `rows`; 60 fields are of type `date`, 3 of `time`, 10 of `url`. The importer kept only the keyname, type, name, description, default, options and whether the field is required (ADR-0032), so an admin filling in "How Old?" saw thirty ungrouped rows with no example values, and typed a date into a plain text box.

**A Plugin Field carries attributes: `placeholder`, `hint` (TRMNL's `help_text`), `group`, `min`, `max`, `step`, `maxlength` and `rows`.** They are one JSON column on the Plugin Field, read as `attributes`, imported from and exported to the archive under TRMNL's names, compared by the Recipe Update Check and carried by the configuration archive. A number written as text in a Recipe (`min: '1'`) is a number here; an empty text is no attribute.

**The Field Values form honours them**, and knows three more types: a `date` and a `time` are entered with the browser's date and time inputs, a `url` with its address input, so a Device-side `{{ start_date }}` reads `YYYY-MM-DD` as on TRMNL. The placeholder stands in for the default's; the hint is a third line under the help text; `min`, `max` and `step` bound a number; `maxlength` and `rows` size a text; the rows of one group stand together under its name, after the rows of no group, in the order the groups first appear. A `code` field is a multi-line text.

**The Plugin Field editor does not edit attributes yet.** It carries them through a save unchanged, so an admin's edit of a label or a default loses nothing; authoring them is a surface of its own.

Considered and rejected:

- **One column per attribute.** Eight nullable columns for what the form reads as a bag, with a migration for every attribute TRMNL adds; a JSON column reads as the form builder writes it.
- **`multiple: true` on a select.** TRMNL stores the choice as a list; a Field Value is a string (ADR-0032), so a multi-select needs its own decision on what the template reads. Two of the 25 Recipes use it; they read a single choice for now.
- **`xhrSelect`, `lat_lon`, `time_zone`, `multi_string`.** Each is a control to build; they stay single-line text, as ADR-0032 has every unknown type.
- **A `date` default of `today`.** TRMNL fills the current day in; here it stays the text `today` until a Field Value is entered.

## Consequences

- A Recipe's fields render as its author laid them out, and an imported date is a real date.
- The read model, the input and the archive's `custom_fields` grow by `attributes`; a Recipe Snapshot taken before this has none, and compares as empty.
- Amends ADR-0032's "six controls": nine, with `url`, `date` and `time`.
