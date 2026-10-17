# Dithering is a switch on the Screen and on the Plugin, a Mashup derives it, and off keeps the colour

Every image Kuroshiro converts for a Device is Floyd-Steinberg dithered, which is right for photos and gradients and wrong for a page of text on a 1-bit or 2-bit panel, where it speckles flat greys and frays glyph edges. Terminus offers `text` and `dither` modes per Design and per Extension (issue #1457). The converter already takes a `dither` option, used by the Fallback Screens; what was missing was a stored choice. Grilling settled the following.

- **Dithering is a boolean on a Screen and on a Plugin, not on the Device or the Palette.** A Device-wide switch would ruin every photo on a Device that mostly shows text, and a Palette is the hardware's ink set, not a statement about content. A `file`, `url` or `html` Screen carries its own value; a `plugin` Screen uses its Plugin's, with no per-Screen override and no per-Template value, as Field Values belong to the Plugin (ADR-0032).
- **A Mashup stores nothing and derives it.** A Mashup is one screenshot and one conversion, so it is undithered only when every slot's Plugin is undithered; one dithered slot dithers the whole. It needs no field and no form control.
- **Default on.** Terminus defaults to `text`, but every existing Screen and Plugin here is dithered today and a flipped default would change panels on upgrade.
- **Off changes only the dither method.** On a colour Palette the colour remap, bit depth and colour type stay, so a red headline stays red with hard thresholds. Terminus routes `text` on a colour palette through its monochrome converter and drops the colour; throwing away ink the Device has was judged the worse trade. Full-color Palettes ignore the switch. Fallback Screens stay undithered as before.
- **Every drawing of the content honours it**: `/display`, the device preview (ADR-0040, which takes the unsaved value from the form), Plugin page previews and Edit HTML. Flipping it on a `file` Screen reconverts the stored image at once; flipping it on a Plugin invalidates its cached output so the next poll redraws.
- **It is a boolean named for what it does**, not a `text | art` enum. Terminus stores `text` and `dither` and shows "Art" only as a label; "render mode" is a term the glossary already avoids for Palette Family. The UI help may still say "what TRMNL calls Art".

## Considered and rejected

- **Per Device.** The smallest UI, and the wrong granularity for a Rotation that mixes a photo with a timetable.
- **Per Palette.** Would need a second copy of every Palette to get both treatments.
- **A per-Screen override for `plugin` Screens.** A second inheritance rule and a "which one wins" UI for a case nobody asked for.
- **A stored value on the Mashup.** One more control that can disagree with its slots.
- **Importing it from a Recipe.** The `.trmnlp` format has no such key; trmnl.com dithers per element through the `image-dither` CSS class instead, which is a different feature.

## Consequences

- The Screen and the Plugin gain a non-null boolean column, default true, via migration.
- The Configuration Archive carries it on Screen and Plugin entries at schemaVersion 5; an older archive reads a missing value as dithered. The Showcase Archive is unchanged.
- Additive follow-ups: honouring TRMNL's `image-dither` class for per-element dithering, a hint on the Mashup form when its slots make it undithered.
