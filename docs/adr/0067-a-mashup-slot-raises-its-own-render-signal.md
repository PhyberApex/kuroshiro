# A Mashup slot raises its own Render Signal

ADR-0031 had a Mashup signal as a whole: its slots share one page and one `window`, so a flag could not be told apart from the slot that set it, and one Plugin raising `skip` took three live ones out of Rotation with it. It listed per-slot handling as a follow-up; issue #1469 is that follow-up. This supersedes ADR-0031's "A Mashup signals as a whole" bullet; the rest of ADR-0031 stands.

- **The whole page is still drawn first.** Only when it raises a signal is each slot's own read, on a page of its own holding that slot alone, in the same shared Chromium (ADR-0044) and without a screenshot. A Mashup none of whose Plugins signal costs what it did before.
- **A slot's signal is read once per cached output**, the way a Screen's verdict is remembered until its cached output changes. It is stored on the slot, and the Mashup remembers that its slots were read. A page that raises a signal no slot raises alone, as when two slots' scripts only set a flag together, is then drawn without honouring it rather than read slot by slot on every poll.
- **A skipping slot draws empty.** The Plugin's name is drawn only for a slot whose render failed (#1319); a slot that asked not to be shown is not a problem.
- **A holding slot draws the markup it last drew live.** Every slot drawn live keeps its markup on every render it is live in, whatever the other slots signalled. Re-running that markup is what "hold" means for a slot: the text in it is the text it showed, so a clock shows the time it last showed. There is no per-slot image cache. A slot with no such markup yet, a first render or one right after an edit rebuilt the Mashup's slots, draws empty.
- **The Mashup signals as a whole only when no slot draws live.** Every slot skipping is a Mashup-level `skip`; any other mix with no live slot, all holds or holds with skips, is a Mashup-level `hold`, served as ADR-0031 serves any held Screen: no new image, no Device redraw. A failed slot raises no signal, so it draws its failed-render drawing and keeps the Mashup rendering like a live slot. Otherwise the Mashup renders, slot by slot.

## Considered and rejected

- **Reading every slot on its own on every render.** It would charge every Mashup one Chromium page per slot per refresh, including Mashups none of whose Plugins ever signal — the cost ADR-0031 refused to charge every Plugin refresh.
- **Drawing a skipping slot with its Plugin's name**, as a failed one is. A skip is the Plugin's own wish not to be shown, not a fault to point out.
- **Drawing a held slot from its last image.** Cutting a slot out of the Mashup's last screenshot would need slot boxes in pixels, which TRMNL's CSS, not Kuroshiro, lays out.

## Consequences

- A slot's markup, last live markup and own signal are runtime state, excluded from the Configuration Archive and `.trmnlp` export like the Screen's own Render Signal (ADR-0021). Every Mashup's cached output was dropped once so its slots' markup is written alongside it.
- Editing a Mashup rebuilds its slots, which loses their last live markup: a slot that holds before its next live render draws empty.
- The admin still sees one verdict per Screen: a Mashup reads "Skipping" or "holding image" only when it skips or holds as a whole.
