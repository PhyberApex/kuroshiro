# A Plugin keeps TRMNL's no_screen_padding and dark_mode, and its own Screen is drawn with them

Seven of the 25 Recipes featured on trmnl.com/recipes set `no_screen_padding: 'yes'`, and TRMNL's framework applies two modifiers to the `.screen` element from a plugin's settings: `screen--no-bleed`, which takes the padding off so the views reach the panel's edge, and `screen--dark-mode`, which swaps ink and paper (usetrmnl.com/framework/screen). Kuroshiro's importer dropped both settings, its template context told every Recipe `no_screen_padding: 'no'` and `dark_mode: 'no'`, and its screen shell had no way to draw either, so a Recipe laid out edge to edge rendered with a frame around it.

**A Plugin has two switches, `noScreenPadding` and `darkMode`, off unless a Recipe or archive turns them on.** They sit on the Plugin like Dithering (ADR-0045), under "Name and description" after it, are read from `no_screen_padding` and `dark_mode` (`'yes'`/`'no'` in TRMNL's archives, booleans in ours) and written back the same way, and reach the template as `trmnl.plugin_settings.no_screen_padding` and `dark_mode` spelled as TRMNL spells them.

**The Plugin's own Screen is drawn with the modifiers; a Mashup slot is not.** The screen shell takes modifiers beside the target and the Framework Version, and the Device render, the device preview and the browser preview of the full size all pass the Plugin's. A Mashup is one screen made of several Plugins' views, and a modifier is a property of the whole screen, so a Mashup keeps its padding and its light paper whatever its slots' Plugins say, as the preview of a slot size shows.

Considered and rejected:

- **Deriving a Mashup's modifiers from its slots, as Dithering is.** Dithering is a conversion of the whole image, so "any slot dithers the whole" has a meaning; one slot drawing dark among light ones does not. A Mashup-level switch can come when a Mashup needs one.
- **Reading the modifiers as Field Values.** They are not the admin's input to the Plugin but the author's statement about its layout; a Recipe update would overwrite a Field Value, and the Recipe Update Check does not compare them yet, which is listed below.

## Consequences

- `Plugin` gains `noScreenPadding` and `darkMode`; the Plugin read model, the create and update inputs, the `.trmnlp` export and the device preview input carry them.
- The Recipe Update Check does not yet notice an upstream change to either; the `refreshInterval` item shows the shape such an item would take.
- A Template that read `trmnl.plugin_settings.no_screen_padding` to lay itself out now reads the truth.
