# Spec: the Plugin template editor

The section "Template" of the Plugin page, and the code editor every other surface borrows: the editor itself, the Templates a Plugin has, the live preview and what it draws against, and how a problem is shown. Read [README.md](./README.md) first; its shared patterns apply here and are not repeated. [plugins.md](./plugins.md) gives the section its place on the Plugin page and its one save; this spec fills it.

- **Reference.** [Headless component library and styling approach](https://github.com/PhyberApex/kuroshiro/issues/1076) suggested CodeMirror 6. [Plugin field values and Plugin Variables](https://github.com/PhyberApex/kuroshiro/issues/1087) set what a Field Value is.
- **Drawings.** [`packages/ui/prototypes/template-editor`][proto] on the throwaway branch `prototype/template-editor`, at commit `80b8427`. It is a working prototype: the editor is CodeMirror 6, and the preview is rendered by liquidjs in the browser and drawn with TRMNL's framework, so it needs the network. Open `index.html` in a browser; `t` switches the theme, `d` the number of Devices (3, 1, none), `f` the preview's data (fetched, a failed fetch, fetching, server down), `r` whether the last scheduled render failed, `w` the full window. Each section below links the renders it describes.
- **Facts.** How the server behaves today was read from `main` at `85868a1`. Nothing on the server was run.

## Routes

The editor owns no route. It lives where another spec puts it:

| Where | Mode | Specced in |
|---|---|---|
| `/plugins/:pluginId#template`, the section "Template" | Liquid, with the preview | here |
| `/plugins/:pluginId?view=template` | the same section in the full window | here |
| A Data Source's headers, body and literal value | JSON, a code input | [plugins.md](./plugins.md) |
| A Data Source's transform | JavaScript, a code input | [plugins.md](./plugins.md) |
| `/devices/:deviceId/screens/:screenId/html` and Add Screen's HTML kind | HTML, with the preview | [devices.md](./devices.md) |

## The Template section

`/plugins/:pluginId#template` · [light][template-light] · [dark][template-dark] · [the whole page][template-page] · [one Device, the data opened][template-one] · [phone][phone-template]

**For:** changing a Template with its drawing in view.

From the top:

1. The heading "Template" on its 2 px rule, with **"Full window"** (plain) on its line.
2. **The scheduled render's failure**, when the last one failed.
3. **The Template line**: which Templates the Plugin has.
4. **The bench**: the code editor at the left (6 parts of 11), the preview at the right; 24 px between them. Stacked on phone, editor first.

The section has no save of its own. A change marks the Plugin page's form as changed and the save bar appears, as [plugins.md](./plugins.md) specs ([render][template-unsaved]).

### The Templates a Plugin has

A Plugin has one to four Templates, one per size: `full`, `half_horizontal`, `half_vertical` and `quadrant`. It always has `full`.

- **Full** is the Screen on its own.
- **Half horizontal** is the top or bottom half of a Mashup, **Half vertical** the left or right half, **Quadrant** a quarter.
- A Mashup slot shows the Template of its own size. A Plugin without one shows its `full` Template there. (Today a slot always shows `full`; see the API list.)

**The Template line** ([one Template][starter], [two][template-light], [the menu][template-add], [a removed one][template-removed]):

- **One Template:** "One template. It is shown full screen and in every Mashup slot." and at the right "Add a template for a Mashup slot" (quiet). Someone who never builds a Mashup reads one sentence and is done.
- **Several:** a segmented control named "Template" with the Templates the Plugin has, in the order Full, Half horizontal, Half vertical, Quadrant. Beside it, what the chosen one is: "**Full**: the Screen on its own, and any Mashup slot that has no template of its own size." · "**Half horizontal**: the top or bottom half of a Mashup." · "**Half vertical**: the left or right half of a Mashup." · "**Quadrant**: a quarter of a Mashup." For every size but Full the sentence ends with "Remove this template" (quiet). At the right "Add a template" (quiet), while a size is missing.
- **Adding** opens a row menu of the missing sizes, each with its place in `ink-soft` ("Half horizontal · top or bottom", "Half vertical · left or right", "Quadrant · a quarter"). The new Template starts as a copy of Full, is chosen, and the editor takes the focus.
- **Removing** asks nothing, because it is part of the unsaved form. The segment stays, struck through; its sentence reads "Removed when you save. A {size} slot then shows the full template." with "Put back"; the editor is read-only and its strip reads "This template is removed when you save."
- A segment whose Template cannot be parsed carries the problem icon.
- Switching Templates keeps each one's undo history and cursor until the page is left.

### The code editor

[light][template-light] · [dark][template-dark] · [completing a name][template-complete] · [search][template-search]

- **Frame.** The control border and radius of an input, paper ground. Hover turns the border ink; focus inside adds the focus ring. 27 rem high on the Plugin page (20 rem on phone) and scrolling inside; in the full window it fills the height.
- **Type.** JetBrains Mono at `text-xs` on the page and `text-sm` in the full window, line height 1.65. Lines wrap; nothing scrolls sideways. Two spaces indent.
- **Gutter.** Line numbers in `ink-soft` at 11 px, right of a 1 px rule; the current line's number is ink at weight 700. No line highlight.
- **Syntax, without colour.** Liquid is told from HTML by a `wash` ground behind every `{{ … }}`, `{% … %}` and comment, and by weight: delimiters and tag keywords 700; HTML tag names, property names and Liquid variables being defined 600; attribute values, strings, angle brackets and punctuation `ink-soft`; comments `ink-soft` italic. Nothing in the editor is red.
- **Selection** is the page's: ink ground, paper text. The cursor is a 2 px ink bar. A matching bracket gets a 1 px ink outline while the editor has the focus.
- **Keys.** Tab indents, Shift Tab outdents. Esc, then Tab moves the focus on, and the strip says so. Ctrl/Cmd S is "Save Plugin". Ctrl/Cmd F opens search and replace at the top of the editor, in the same tokens. Ctrl/Cmd Z and Shift Z undo and redo.
- **Typing help.** Brackets, quotes and HTML tags close themselves; `{%` closes to `{% %}`.
- **Completion** ([render][template-complete]), drawn like a select's list with the chosen item solid ink:
  - after `{{` or inside a tag: every name of the preview's data, each with its kind ("object", "list of 8", "string");
  - after a dot: the keys under that path in the preview's data; for a list `first`, `last` and `size`;
  - after `|`: Liquid's filters and Kuroshiro's own (`date_short`, `date_long`, `time_short`, `number_with_delimiter`, `round`, `truncate_words`, `titleize`, `shuffle`, `sample`, `yesno`, `json`, `url_encode`, `url_decode`), the latter marked "Kuroshiro";
  - after `{%`: Liquid's tags.
- **The strip** under the code, on a 1 px rule, `text-xs` in `ink-soft`: at the left "`Tab` indents. `Esc` then `Tab` moves on."; at the right the mode ("Liquid and HTML", "HTML"). When there is a problem the strip holds it instead (see Problems).
- The editor is named for a screen reader: "Template of {Plugin}, {size}".

### The preview

[for a Device][template-light] · [another Device][template-hallway] · [another Device Model][template-other] · [no Devices][template-none] · [a Mashup slot][template-quadrant]

**The plate** is the hero plate (2 px ink outline, always paper white, in both themes) in the shape of the Device Model. Inside it the Template is drawn the way the server draws it: Liquid's output wrapped in the screen shell of `packages/shared`, in a sandboxed frame at the Device Model's own pixel size, scaled down to the plate.

- **Where it is rendered.** In the browser. The Liquid engine and Kuroshiro's filters move to `packages/shared`, so the browser and the server run the same code against the same data. Nothing goes to the server while a Template is typed.
- **When.** 300 ms after the last keystroke, and at once when a Field Value, the Device or the Template changes. The new drawing replaces the old one when it is ready; the plate is never blank in between.
- **What it is not.** The Device shows an image dithered to its Palette; the plate shows what a browser draws before that step. One line under the plate says so (below), and offers the device preview.
- **The device preview** (ADR-0040). On request, the server draws the plate's own HTML as the Device would get it and the plate shows that image instead. Any change to what it was drawn from (the Template, a Field Value, the data, the Device, Device Model or Palette) puts the live browser drawing back.
- **A Template of a slot size** is drawn in its slot of a Mashup, the other slots empty: Half horizontal at the top of two rows, Half vertical at the left of two columns, Quadrant at the top left of four.

**Under the plate**, in this order:

1. **"Preview for"** and a select of the Devices by name, then "Another Device Model". It starts as [plugins.md](./plugins.md) says: the first Device the Plugin is assigned to, else the first Device, else no Device.
   - "Another Device Model" shows two more selects in the same line, "Device Model" and "Palette"; the second lists the Palettes of the chosen Device Model and starts at its first.
   - With no Devices there is no first select, only "Preview for" and the two selects, starting at TRMNL OG (2-bit) and 4 Grays.
   - The choice is the admin's for this visit. It is not saved and not part of the form.
2. **The facts**, in mono `ink-soft`: "{Device Model} · {width} × {height} · {Palette}" for a Device; "{width} × {height}" for a chosen Device Model, whose name the selects already show.
3. **The honest line**, in `ink-soft`: "Your browser draws this. {Device} shows it in {4 grays}." ("The Device" when none is chosen.) For a slot size it goes on: ", in {a quarter of a Mashup}; the other slots are left empty here." It ends with a plain button, "See it as {Device} shows it" ("See it as the Device shows it" when none is chosen).
   - While drawing: the plate keeps the browser drawing, with the loading mark and "Drawing it as {Device} shows it"; the button is disabled.
   - Drawn: the plate shows the image, and the line reads "As {Device} shows it, in {4 grays}, drawn at {hh:mm}." with "Back to the browser drawing". When the content raised a Render Signal, a second line: "This content asks to be skipped." or "This content asks to keep its previous image."
   - Busy (another device preview is being drawn): "Another preview is being drawn. Try again in a moment."
   - Failed: "Could not draw it as {Device} shows it." with "Try again"; the browser drawing stays.
4. **Notices about the data**, when there are any (see Problems).
5. **Data**, a tucked section.

### The data the Template reads

[opened][template-one] · [a failed fetch][template-failed] · [a Webhook-kind Plugin][webhook] · [in the full window][wide-unsaved]

The preview draws against real data, fetched once and then held. Typing a Template never fetches.

- **What is fetched.** The server answers one request with everything the Template can read: every Data Source's result (fetched live, through its transform) or its error marker; the Field Values; `trmnl`; and `sensors` of the Device the preview is for. For a Webhook-kind Plugin the stored Webhook Payload takes the Data Sources' place. The request carries the form as it stands, so unsaved Data Sources and Field Values count.
- **When.** When the section is first shown; 800 ms after the last change to a Data Source or a Field Value; when another Device is chosen; and on "Fetch again". A Field Value also reaches the Template at once, without waiting for the fetch.
- **A preview fetch moves no Fetch Failure Streak** and fires no Alert, as `CONTEXT.md` already says.
- **A password Field Value** is never sent to the browser. In the preview's data it is eight dots.

**"Data"** is tucked under the preview; closed on the Plugin page, open in the full window. Its title line carries "{n} names" and, with Data Sources, ", fetched {when}". Opened:

- One row per name the Template can read, between 1 px rules: the name in mono at weight 600, and at the right where it comes from in `ink-soft`: "Data Source", "Field Value", "Webhook Payload", "{Device}'s Sensors" (or "No Device, so no Sensors"), "Kuroshiro" for `trmnl`. Order: the Field Values, the Data Sources, `sensors`, `trmnl`.
- A plain value is shown in the row (`"Lindenplatz" · Field Value`). An object or a list opens in place to a code block of its JSON, at most 14 rem high and scrolling.
- Under the rows, in `ink-soft`: "Fetched for this preview only. It does not move a Fetch Failure Streak." and "Fetch again" (plain). While it runs: the loading mark and "Fetching the Data Sources", the button disabled, the drawing unchanged. For a Webhook-kind Plugin: "The stored Webhook Payload, received {when}." or "Nothing received yet.", and no button. For a Plugin without Data Sources: "No Data Sources, so nothing is fetched."

### The full window

[light][wide-light] · [a problem, dark][wide-problem] · [unsaved, the data opened][wide-unsaved]

"Full window" lets the section take the whole window under the bar, for writing a Template instead of touching one up. It is the same section with the same state, not a second page: `?view=template` on the Plugin's route, so Back returns to the page and the address can be shared.

- The heading reads "Template of {Plugin}" and its button "Back to the page".
- The editor takes the width that is left and the full height, at `text-sm`. The preview column is 40% of the window and at least 22 rem, and scrolls by itself; "Data" starts open.
- The save bar sits at the bottom of the window, as on the page.
- Not offered below 820 px.

### Problems

Nothing here is red. A problem is ink, with the problem icon.

**A Template that cannot be parsed or rendered** ([render][template-problem], [dark][template-problem-dark], [full window][wide-problem]):

- The plate keeps its last drawing at 40% and a note on it at the bottom left: "Not drawn. This is the last drawing." With no earlier drawing the plate is empty and the note reads "Not drawn."
- The strip holds the problem in place of the hint: the problem icon, "Line {n}: " and Liquid's own message in mono, and at the right "Go to line {n}" (quiet), which puts the cursor there.
- In the code, the place is underlined twice in ink and its line carries the problem icon in the gutter. Hovering either shows the message.
- It appears 700 ms after the last keystroke, so a tag that is only half typed is not called a problem. It leaves as soon as the Template renders.
- **A Template that cannot be parsed blocks the save.** The editor gets the doubled ink border of an invalid field, the save bar reads "1 thing to fix before this can be saved." and "Show the first" chooses that Template and puts the cursor at the place. A Template that parses but fails against the data fetched now does not block: it may well render with the next data.
- **An empty Template** is invalid: "A template cannot be empty."

**A Data Source the preview could not fetch** ([render][template-failed]): the Template is still drawn, with that name's error marker, exactly as on the Device. Under the honest line, between 1 px rules: the problem icon and "The Data Source `{name}` could not be fetched: {reason}." In "Data" its row reads "Data Source, not fetched" with the problem icon, and opened: "The preview's fetch failed: {reason}. The template reads an error marker in place of the data, as it would on the Device." above the marker's JSON.

**The data could not be fetched at all** ([render][template-down]): a notice in the same place: "**The data could not be fetched.** Kuroshiro's server is not answering." and "Try again". With data from an earlier fetch the preview keeps drawing against it and the notice adds "The preview uses the data from {when}." With none, the plate is in its rendering state.

**While the first data is on its way** ([render][template-fetching]): the plate in its rendering state with the note "Fetching the data" and the loading mark.

**The last scheduled render failed** ([render][template-scheduled]). The Plugin page's problem line "The template could not be rendered at {hh:mm}: {message}" links here with "Open the template". In the section, between the heading and the Template line: the problem icon, "The scheduled render at {hh:mm} failed at line {n}: `{message}`." and in `ink-soft` "The preview draws with the data fetched now, so it may not fail the same way." At the right "Go to line {n}" (quiet), when the server's error names a line. The line stays until a scheduled render succeeds.

### The starter template

A Plugin built from scratch starts with one `full` Template that shows its name ([render][starter]):

```liquid
<div class="layout layout--col layout--center">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
```

It reads the name from `trmnl`, so renaming the Plugin renames what the Device shows.

## The code editor elsewhere

The same component in three more modes. Only what differs is listed.

**A code input** ([render][code-inputs], [invalid][code-invalid]) is the editor inside a form: a Data Source's headers, body and literal value in JSON, its transform in JavaScript.

- As high as its text, from 3 lines to 15 rem, then scrolling. No strip. JSON has no line numbers; JavaScript has them.
- JSON that does not parse is underlined twice at the place as it is typed. On leaving the field it gets the doubled ink border and the message [plugins.md](./plugins.md) names ("Headers must be a JSON object, like { "Accept": "application/json" }."), and blocks the save like any invalid field.
- JavaScript is highlighted and not checked.
- Completion is off, except JavaScript's own keywords.

**HTML** ([render][html-screen], [dark][html-dark], [phone][phone-html]) is the bench without Liquid, on Edit HTML and in Add Screen's HTML kind, as [devices.md](./devices.md) specs.

- The strip's mode reads "HTML". Nothing is `wash`, since nothing is Liquid, and `{{ … }}` is shown as written.
- The preview is always for the Screen's own Device, so there is no "Preview for": the facts line reads "Preview for {Device} · {Device Model} · {width} × {height} · {Palette}", then the honest line. There is no data, no "Data" section and nothing to fetch.
- HTML is never invalid, so nothing is marked and nothing blocks "Save HTML". Ctrl/Cmd S is "Save HTML".
- No full window.

## Phone

Only has to stay readable, as [plugins.md](./plugins.md) and [devices.md](./devices.md) already say ([render][phone-template]). The Template line wraps, the editor is 20 rem high above the preview, the selects wrap, and "Full window" is not offered. The editor can be typed in; nothing is tuned for it.

## Components this spec adds

Each uses the tokens and rules of [Design tokens and component inventory](https://github.com/PhyberApex/kuroshiro/issues/1091).

| Component | Backed by | States |
|---|---|---|
| Code editor | CodeMirror 6 (`@codemirror/view`, `state`, `language`, `commands`, `autocomplete`, `search`, `lint`, and `lang-liquid`, `lang-html`, `lang-json`, `lang-javascript`), themed from the tokens; loaded lazily with the first editor on a page | default, hover, focus, problem, invalid, read-only; modes Liquid, HTML, JSON, JavaScript; sizes bench, full window, code input |
| Preview plate | the hero plate holding a sandboxed `iframe` (`sandbox="allow-scripts"`) | drawn, redrawing (the old drawing stays), not drawn (40% and a note), rendering |
| Data list | `ul` of rows; an object or list is a `CollapsibleRoot` | plain value, closed, open, not fetched |
| Template line | the segmented control (`RadioGroupRoot`) and the row menu of [plugins.md](./plugins.md) | one Template, several, a problem on a segment, removed |

The bundle of the editor and the Liquid engine is about 650 kB minified, 224 kB gzipped. It must not be in the first load of any page.

## Capability coverage

Numbers are those of the [capability inventory](https://github.com/PhyberApex/kuroshiro/issues/1075).

| # | Capability | Home |
|---|---|---|
| 46 | Edit the Liquid template | The code editor in the Template section |
| 47 | Preview a Plugin, with the fetched data | The preview; "Data" under it |
| 18 | Preview as another Device Model and Palette | "Preview for", then "Another Device Model" |
| 55 | Edit templates other than the first | The Template line |
| 90 | HTML Preview | The bench in its HTML mode, on the pages [devices.md](./devices.md) names |

The old "Show Template Help" panel has no home. Its syntax examples are replaced by completion, and its filter list by the filters completion offers.

## What this asks of the admin API

A request list for [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096), which settles the shapes.

**To add**

1. **The preview's data.** One request that takes the Plugin's id, the unsaved Data Sources and Field Values, and a Device's id or none, and answers the whole Liquid context: each Data Source's result or error marker, the Field Values (a password as dots), `trmnl`, and that Device's `sensors`; for a Webhook-kind Plugin the stored Webhook Payload. It renders nothing. It replaces `POST /api/plugins/preview`, which fetches and renders in one step, takes no Device, and answers a server error for a Liquid error.
2. **The Liquid engine in `packages/shared`**: the engine's configuration and Kuroshiro's filters, used by the server's renderer and by the browser's preview alike ([ADR-0020](../adr/0020-shared-package-holds-only-identical-cross-package-code.md) names what belongs there).
3. On a Plugin read: when the last scheduled render ran, and for a failed one its message and, when Liquid gave one, its line. Today a failed scheduled render is only logged. ([plugins.md](./plugins.md) asks for the time and the error; this adds the line.)
4. A Plugin built with only a name gets the starter template above.

**To change**

1. **Saving writes every Template.** The save carries the Templates by size: it updates, adds and removes them. Today an update writes the first one and ignores the rest.
2. **One Template per size, and always `full`.** An import whose files hold no `full` Template makes its first Template `full`.
3. **A render picks a Template by size, never by position.** A Screen on its own, a scheduled render and a Webhook render use `full`. Today the scheduler and a Webhook render use whichever Template is first.
4. **A Mashup slot renders the Template of its own size**, and `full` when the Plugin has none. Today it always renders `full`.
5. **Every render sees the same context.** `trmnl` on a Webhook render (today it has none), and the Field Values everywhere (already [#1101](https://github.com/PhyberApex/kuroshiro/issues/1101)). Otherwise the starter template, which reads `trmnl`, shows nothing on a Webhook-kind Plugin.
6. **A save refuses a Template that cannot be parsed**, with Liquid's message and line, and an empty one. The browser checks first; the server is the gate.

## Departures

- **The preview is live.** The old one was a dialog opened by a button, and did nothing for a Plugin without Data Sources.
- **Liquid is rendered in the browser**, not by the server. The server only hands over the data.
- **The fetched data sits beside the preview** as a list by name, not as a second tab of raw JSON.
- **A Template that cannot be parsed cannot be saved.** Today anything that is not empty is saved, and the Device gets the error Fallback Screen.
- **The Template section may leave the page's column** in the full window. Every other section keeps to it.

## Open points

**Decided on the agent's own call; the maintainer may want to overturn them**

- The live preview is a browser's drawing, not the dithered image the Device gets; the dithered image is drawn on request (ADR-0040, [#1111](https://github.com/PhyberApex/kuroshiro/issues/1111)).
- Liquid runs in the browser from shared code. The alternative, a server round trip per keystroke, is slower and would make the server parse half-typed Templates.
- A Plugin with one Template shows no size control, only one sentence and a quiet action.
- A new Template starts as a copy of Full, not empty.
- A Mashup slot uses the Template of its own size and falls back to `full`.
- A Template that cannot be parsed blocks the save; one that only fails against the data fetched now does not.
- Syntax is told apart by weight, `ink-soft` and a `wash` ground. No colour, in keeping with Hanko.
- Lines wrap in the editor.
- The full window is a state of the Plugin page, not a page of its own.
- The preview's Device is not remembered between visits.
- "Fetch again" exists in "Data". [plugins.md](./plugins.md) has no "Fetch now" for the scheduled data; this one only refreshes the preview and says so.
- The starter template shows the name twice, as its title and in the title bar, and nothing else.

**Left undecided**

- **A name the data does not have.** `{{ forcast.current }}` renders as nothing and is not marked. Marking unknown names needs to know every name a Template defines itself (`assign`, `for`, `capture`), and a Webhook Payload's keys change with every POST. Completion is the help that is offered.
- **TRMNL's framework is loaded from usetrmnl.com, at "latest"**, by the browser for the preview as by the server for the image. An Instance without the internet draws an unstyled preview, and a new framework version can change every Screen. Hosting or pinning it is not decided here.
- **`{% render %}` and shared markup.** The importer inlines `shared.liquid` only for `{% render "main" %}`; any other `{% render %}` stays in the Template and fails, since the engine has no partials. The editor shows such a Template with its problem. Whether a Plugin should carry shared markup of its own is not decided.
- **The dark mode and padding switches** in `trmnl.plugin_settings` are always "no". Nothing in the UI sets them.
- **Sensors in a scheduled render.** A scheduled render is made once for all Devices and has no Sensors, while the preview for a Device shows that Device's. A Template that reads `sensors` therefore looks better here than on the Device until the server renders per Device; the API ticket owns that.
- **Above about 2,000 lines** the editor was not tried.

[proto]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor
[template-light]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-light.png
[template-dark]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-dark.png
[template-page]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-page.png
[template-one]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-one-device.png
[template-problem]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-problem.png
[template-problem-dark]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-problem-dark.png
[template-unsaved]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-unsaved.png
[template-quadrant]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-quadrant.png
[template-add]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-add-menu.png
[template-removed]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-removed.png
[template-other]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-another-model.png
[template-hallway]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-hallway.png
[template-none]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-no-devices.png
[template-failed]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-fetch-failed.png
[template-fetching]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-fetching.png
[template-down]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-down.png
[template-scheduled]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-scheduled-failed.png
[template-complete]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-complete.png
[template-search]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/template-search.png
[wide-light]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/wide-light.png
[wide-problem]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/wide-dark-problem.png
[wide-unsaved]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/wide-unsaved.png
[starter]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/starter.png
[webhook]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/webhook.png
[code-inputs]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/code-inputs.png
[code-invalid]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/code-input-invalid.png
[html-screen]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/html-screen.png
[html-dark]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/html-screen-dark.png
[phone-template]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/phone-template.png
[phone-html]: https://github.com/PhyberApex/kuroshiro/blob/80b8427/packages/ui/prototypes/template-editor/shots/phone-html.png
