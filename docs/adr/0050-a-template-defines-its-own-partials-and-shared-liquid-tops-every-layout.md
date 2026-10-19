# A Template defines its own partials, and a Recipe's shared.liquid tops every layout

Five of the 25 Recipes featured on trmnl.com/recipes define `{% template name %}…{% endtemplate %}` blocks in `shared.liquid` and draw them with `{% render "name", key: value %}` from each layout, some nested. TRMNL's Liquid (the `trmnl-liquid` gem) registers `template` as a block tag that, when rendered, files its body under its name in an in-memory file system the standard `render` tag reads, and TRMNL prepends `shared.liquid` to every screen template before rendering. Kuroshiro's engine refuses every partial lookup (the `noPartials` file system, after #1241 and #1260), and the importer inlined only `{% template main %}` into a layout holding `{% render "main" %}`, dropping its arguments and every other block, and dropping a `shared.liquid` that holds only styles.

**The Liquid engine gains TRMNL's `{% template %}` tag, and `{% render %}` draws a template the same render defined; any other name is still refused.** A defined template is kept per render, not on the engine, so two renders never see each other's. `render` gives the template only the arguments it is passed, as Liquid's `render` does on TRMNL; a Recipe that needs `trmnl` inside a template passes `trmnl: trmnl`, as the Recipes on trmnl.com do. A template's name holds only letters, numbers, underscores and slashes, as on TRMNL. A name no `{% template %}` defined goes to the engine's own tag, whose file system refuses it with the same error as before, so nothing is read from the server's disk or over the browser's network.

**The importer puts `shared.liquid` at the top of every layout.** That is what TRMNL does before rendering, and it keeps the stored Template self-contained: a layout carries the templates and styles it draws with, the `.trmnlp` export and the Recipe Update Check compare what was stored, and the editor shows what renders.

Considered and rejected:

- **Storing `shared.liquid` as a Template of its own.** Faithful to the archive and the right shape for an editor tab, but it needs a layout value, a renderer that concatenates, an export, a Recipe Update Check item and an editor surface. Prepending gets every current Recipe rendering now; a stored shared Template can come later and import the same archives.
- **Keeping the inlining and extending it to every block.** Inlining shares the layout's scope, which `render` on TRMNL does not, so a Recipe would render differently here; and it cannot pass arguments.
- **Collecting definitions at parse time so order does not matter.** TRMNL registers at render time, so a block must precede its use there too; matching it keeps a Recipe's behaviour identical.

## Consequences

- A Recipe whose layouts draw named templates renders unmodified, and so does one whose `shared.liquid` holds only `<style>` or `<link>` markup.
- A Plugin imported before this keeps its inlined `main`; nothing is migrated.
- `{% render "main" %}` without arguments now draws `main` with an empty scope, as on TRMNL, where before the inlined `main` read the layout's variables.
- The editor's completion does not yet offer the `template` tag or the names a Template defines.
