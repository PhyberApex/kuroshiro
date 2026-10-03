# Spec: the Plugins surfaces

Everything under **Plugins** in the rebuilt admin UI except the template editor itself: the Plugins list, Add a Plugin, the Plugin page around the editor, and the Recipe Update Check. Read [README.md](./README.md) first; its shared patterns (loading, a failed load, saving, destructive actions, fresh data, time, phone) apply here and are not repeated.

- **Reference.** [Primary journeys and the story each screen tells](https://github.com/PhyberApex/kuroshiro/issues/1078) set what the list and the Plugin page are for. [Plugin field values and Plugin Variables](https://github.com/PhyberApex/kuroshiro/issues/1087) and [ADR-0032](../adr/0032-field-values-belong-to-the-plugin-and-plugin-variables-are-removed.md) set what a Field Value is. The page patterns are those of [devices.md](./devices.md).
- **The template editor** is specced in [template-editor.md](./template-editor.md). This spec gives it its place on the page and says what the page hands it. The editor and preview in the drawings here are a stand-in.
- **Drawings.** [`packages/ui/prototypes/plugin-surfaces`][proto] on the throwaway branch `prototype/plugin-surfaces`, at commit `d19583b`. Open `index.html` in a browser; `t` switches the theme, `d` the number of Devices (1, 3, none), `a` the firing Alert, `g` the number of Plugins (10, 4, none), `l` loaded, loading or failed, `c` the outcome of the Recipe Update Check. Each section below links the renders it describes.
- **Facts.** How the server behaves today was read from `main` at `d0589c7`. Nothing was run.

## Routes

| Route | Shows |
|---|---|
| `/plugins` | The Plugins list. `?q=` holds the search, `?show=problems` the filter. |
| `/plugins/new` | Add a Plugin. `?way=recipe\|file\|github\|poll\|webhook` preselects the way; `?device=:deviceId` carries the Device the new Plugin is assigned to. |
| `/plugins/:pluginId` | The Plugin page. `?source=:name` opens that Data Source's row and scrolls to it. The sections answer to `#template`, `#data`, `#values`, `#devices` and `#recipe`. |
| `/plugins/:pluginId/update` | The Recipe Update Check, for a Plugin imported from a Recipe only. |

A Plugin that does not exist gets the whole-page empty state of the shared patterns: "No Plugin here. It may have been deleted." with "All Plugins" ([render][missing]).

In the bar, "Plugins" is current on all four. A Plugin page and the Recipe Update Check carry a back link above the title ("All Plugins", and "{Plugin}").

## The Plugins list

`/plugins` · [ten Plugins, three Devices][list-light] · [only those with a problem, dark][list-problems] · [four Plugins, nothing wrong][list-few] · [phone][phone-list]

**For:** finding a Plugin and seeing whether it is healthy.

- Title "Plugins". Actions on the title line: "Build a Plugin" (plain) and "Import a Recipe" (primary). Both open Add a Plugin, with the Poll way and the Recipe way preselected.
- One plain row per Plugin, ordered by name, case-insensitive. The whole row is a link to the Plugin page. No thumbnail: a Plugin has no single image, it is rendered per Device. A row, left to right:
  - **The name**, at weight 600.
  - **Kind and origin**, in `ink-soft`: "Poll Plugin" or "Webhook Plugin", with "· from a Recipe" when it was imported from one.
  - **Where it shows**, in `ink-soft`. Devices are named, not counted: "On {Device}", "On {Device} and {Device}", from three "On {n} Devices". A Plugin on no Device that fills a Mashup slot reads "In a Mashup on {Device}". Otherwise "Not on a Device".
  - **Its state**, empty when nothing is wrong. The first that applies:

    | State | Reads | Look |
    |---|---|---|
    | A fetch Alert fires on one of its Data Sources | "Alert: a Data Source keeps failing" | red, with the red square |
    | A Fetch Failure Streak of 1 | "The last fetch failed" | ink at weight 500, the problem icon |
    | A Fetch Failure Streak of 2 or more, no Alert yet | "{n} fetches failed in a row" | the same |
    | A required Plugin Field has neither a Field Value nor a default | "A required Plugin Field is empty" | the same |
    | A Webhook-kind Plugin whose Webhook Payload is empty | "Nothing received yet" | `ink-soft`; not a problem |

  - **The row menu**, an icon button named "More actions for {Plugin}" ([render][list-menu]): "Duplicate", "Export", a rule, "Delete Plugin". Each does what the same action on the Plugin page does (see [Duplicate, export, delete](#duplicate-export-delete)).
- **Above the rows.**
  - With more than eight Plugins: a search field, "Find a Plugin", filtering by name as it is typed.
  - While at least one Plugin has a problem (the first four states above): a segmented filter, "All" and "With a problem".
  - Always: one line in `ink-soft`, "{N} Plugins, by name", followed by "· {n} with a problem" when there are any. With a search or the filter on: "{n} of {N} Plugins".
- No counts beyond that line, no sorting control, no paging. The list is whole at any length.
- **Nothing matches** ([render][list-none]): "No Plugin matches" · "No Plugin is called “{query}” among those with a problem." (each half only when it applies) · "Show all Plugins".
- **Empty** ([render][list-empty]): "No Plugins yet" · "A Plugin fetches data and renders it with a template, for a Device to show as a Screen. Import one as a Recipe from TRMNL, or build your own." · "Import a Recipe" (primary) and "Build a Plugin". The title line carries no actions then.
- **Loading** ([render][list-loading]): "Loading Plugins" and four rows of `wash` bars. **Failed** ([render][list-failed]): the notice "Could not load the Plugins."
- The list asks the server again every 30 seconds, like a Device's Screens view, so a state appears without a reload.

## Add a Plugin

`/plugins/new` · [Recipe][add-recipe] · [a Recipe imported before, dark][add-twice] · [refused][add-refused] · [File][add-file] · [GitHub][add-github] · [Poll, for a Device][add-poll] · [Webhook][add-webhook] · [phone][phone-add]

**For:** getting one more Plugin, by importing or by starting an empty one. A page, not a dialog, in the shape of Add Screen: the ways as a radio row at the left, only that way's form at the right. On phone the ways come first.

The back link reads "All Plugins". Heading: "Add a Plugin".

| Way | Line under it |
|---|---|
| Recipe | A ready-made Plugin from trmnl.com/recipes |
| File | A Plugin exported from Kuroshiro or TRMNL |
| GitHub | A Plugin kept in a public repository |
| Build a Poll Plugin | Kuroshiro fetches the data on a schedule |
| Build a Webhook Plugin | Another system sends the data |

Each form ends with its primary button, "Cancel" (back to where the admin came from) and one line in `ink-soft`. The primary button shows the loading mark while it runs. On success the new Plugin's page opens.

- **Recipe.** One field, "Recipe", placeholder "https://trmnl.com/recipes/41120", hint "The address of the Recipe's page on trmnl.com, or only its id." Under it the link "Browse Recipes on trmnl.com". Button "Import Recipe". Line: "Imports as a Poll Plugin you can edit. Nothing updates by itself afterwards."
  - When a Plugin from the same Recipe exists, as soon as the id can be read from the field: "You already have {Plugin} from this Recipe. Importing makes a second Plugin." The import is still allowed.
  - Refusals, shown under the field with the problem icon:

    | Cause | Message |
    |---|---|
    | Empty | "Enter a Recipe's address or its id." |
    | Neither digits nor an address holding `recipes/{digits}` | "This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120." |
    | TRMNL has no such Recipe | "TRMNL has no Recipe {id}." |
    | The Recipe signs in to another service | "This Recipe signs in to another service with OAuth, which Kuroshiro cannot do." |
    | The Recipe is fed by a webhook or anything else that is not polling or static | "This Recipe gets its data pushed by TRMNL. Kuroshiro can only import Recipes that poll or hold fixed data. Build a Webhook Plugin instead." |
    | TRMNL does not answer | "trmnl.com did not answer. Nothing was imported." with "Try again" |

- **File.** A drop zone: "Drop a .zip here: a Plugin as Kuroshiro or TRMNL exports it." and "Choose file". Once a file is chosen its name replaces the sentence. Button "Import Plugin". Line: "Imports as a Poll Plugin. Field Values are not part of a file, so you enter them afterwards." A file that holds no Plugin: "This .zip holds no Plugin. It needs a .trmnlp.yml and at least one .liquid template."
- **GitHub.** One field, "Repository", placeholder "https://github.com/owner/repository", hint "A public repository with the Plugin at its root, on the branch main." Button "Import Plugin". Line: "Imports as a Poll Plugin, copied once. Later changes in the repository do not reach it." Refusals: "Enter a repository address like https://github.com/owner/repository.", "GitHub has no public repository at this address.", "This repository holds no Plugin at its root."
- **Build a Poll Plugin.** "Name" (required: "A Plugin needs a name.") and the sentence "Kuroshiro fetches its Data Sources on a schedule and renders them with a template. You write both on the Plugin's page, which opens next." Button "Create Plugin". Line: "A Poll Plugin stays a Poll Plugin: the Plugin Kind cannot be changed later."
- **Build a Webhook Plugin.** "Name"; "Merge Strategy" as a radio row, "Replace" chosen; for Stream, "Stream Limit"; the sentence "Kuroshiro gives the Plugin a Webhook URL. Whatever is POSTed there becomes its Webhook Payload and is rendered at once." Button "Create Plugin". Line: "The Plugin Kind and the Merge Strategy cannot be changed later."

  | Merge Strategy | API value | Line under it |
  |---|---|---|
  | Replace | `standard` | Each POST replaces the Webhook Payload. |
  | Deep merge | `deep_merge` | Objects are merged key by key. An array is replaced. |
  | Stream | `stream` | Top-level arrays are appended to, up to the Stream Limit. Other keys are replaced. |

  The API value is shown in mono beside the name, since a sender's documentation uses it. Stream Limit reads "Keep the newest {20} entries of each array", a whole number of at least 1: "Enter a whole number of 1 or more."

**Building creates the Plugin at once**, with its name, its Plugin Kind and a starter template that shows the name, and opens its page. There is no unsaved "new Plugin" state: the Plugin page has one shape, and a Webhook-kind Plugin has its Webhook URL from the first moment.

**Carrying a Device.** Add Screen on a Device links here with `?device=`. Then the back link reads "{Device}'s Screens", a line under the heading says "It is assigned to {Device} as soon as it exists, at the end of the Order.", and "Cancel" returns to that Device. The new Plugin's page opens with the line "Assigned to {Device}." and the link "Back to {Device}'s Screens".

## The Plugin page

`/plugins/:pluginId` · [a Poll Plugin][plugin-poll] · [a Data Source opened, dark][plugin-poll-dark] · [a firing Alert][plugin-alert] · [one failed fetch][plugin-streak] · [required Plugin Fields empty][plugin-needs] · [a Webhook-kind Plugin][plugin-webhook] · [nothing received yet, dark][plugin-webhook-empty] · [phone][phone-plugin]

**For:** the template and its preview, seen together. Everything else on the page is what the template is fed with, where it shows and what it came from, in that order.

One page, no tabs. From the top:

1. The back link, the Plugin's name as the title, and **the facts line**.
2. **Lines that are shown once** and **problems**, when there are any.
3. **Template**: the editor and the preview.
4. **Data Sources** for a Poll-kind Plugin, **Webhook** for a Webhook-kind one.
5. **Field Values**, when the Plugin has Plugin Fields.
6. **Devices**.
7. **Recipe**, when the Plugin was imported from one.
8. Tucked: **Plugin Fields**, **Name and description**, **Duplicate, export or delete {Plugin}**.
9. **The save bar**, while there are unsaved changes.

Each section heading sits on a 2 px ink rule, as on a Device's Settings.

### What is saved together

The page is one form. A Plugin's template is not valid halfway through, and its Data Sources, Plugin Fields and Field Values all change what is rendered, so they are saved in one step and the preview shows them before that.

- **In the form:** the template, the refresh interval, the Data Sources, the Field Values, the Plugin Fields, the name and the description.
- **Acting at once, outside the form:** assigning and unassigning, the Recipe Update Check, clearing the Webhook Payload, regenerating the Webhook Token, duplicate, export and delete.

**The save bar** ([render][plugin-unsaved]) appears at the bottom of the window as soon as anything in the form differs from what is saved, and stays there while the page scrolls. Left: "**Unsaved changes** to the {template, Data Sources and Field Values}. The preview already shows them." Right: "Discard changes" (quiet) and "Save Plugin" (primary).

- "Save Plugin" saves everything at once; the server then fetches and renders the Plugin again for every Device it is on. The bar leaves and a line under the facts reads "Saved at {hh:mm}. Fetched and rendered again for {Devices}." until the page is left ([render][plugin-saved]). For a Plugin on no Device: "Saved at {hh:mm}."
- When something is invalid, nothing is sent. The bar reads "{n} things to fix before this can be saved." with "Show the first", which opens the row or tucked section holding it and focuses the field. The rules are named with each field below.
- A save the server refuses keeps everything the admin entered. The bar reads "Not saved. {reason}" with "Try again".
- "Discard changes" puts every field back and asks nothing, since nothing saved is lost.
- Leaving the page with unsaved changes asks: "Leave without saving?" · Lost: "Your changes to {Plugin}'s {template and Data Sources}." · "Leave" / "Keep editing". Running a Recipe Update Check, duplicating and exporting count as leaving.
- The page asks the server again every 30 seconds for what the form does not hold: each Data Source's Fetch Failure Streak, the Webhook Payload, the assignments and the firing Alerts. A refresh never touches a field of the form.

### The facts line and the problems

**The facts line** is one line in `ink-soft` under the title, its parts separated by a middle dot:

- "Poll Plugin" or "Webhook Plugin".
- For Poll: "Fetches every {15 minutes}". For Webhook: "Last received {when}", or "Nothing received yet".
- "On {Device} and {Device}" as in the list, or "Not on a Device".
- "From the Recipe {name}", when imported from one.

**Lines shown once** sit under the facts on a `wash` ground, each with "Dismiss". They report what just happened and are gone after a reload:

| After | Line |
|---|---|
| A Recipe, file or GitHub import | "Imported from the Recipe {name}." or "Imported from {file name}." or "Imported from {owner/repository}." Then "It is not on a Device yet." or "Assigned to {Device}." |
| An import that brought a transform | The line above, then: "It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources." |
| Building | "Created. It shows its name until you write its template." |
| Duplicating | "A copy of {Plugin}. It is not on a Device yet." |
| Saving, or applying a Recipe Update Check | "Saved at {hh:mm}. Fetched and rendered again for {Devices}." or "Applied {n} Update Items from the Recipe {name}." |

**Problems** follow, one line each between 1 px rules, each with a link at the right that goes to where it is fixed:

| Problem | Line | Link |
|---|---|---|
| A fetch Alert fires on a Data Source | in red with the red square: "Alert: the Data Source `{name}` keeps failing" | "See the error", which opens that Data Source |
| A Fetch Failure Streak without an Alert | the problem icon and "The last fetch of the Data Source `{name}` failed." | "See the error" |
| Required Plugin Fields without a value or a default | the problem icon and "The required Plugin Field {label} is empty. {Plugin} renders without it." or "{n} required Plugin Fields are empty: {labels}. {Plugin} renders without them." | "Fill in the Field Values" |
| The last scheduled render failed | the problem icon and "The template could not be rendered at {hh:mm}: {the server's message}" | "Open the template" |

A Plugin with nothing wrong has no such lines and no "all good" line either.

### Template

A heading "Template", then the code editor and the live preview side by side, the full width of the column; stacked on phone, editor first. Everything inside this section is specced by [The Plugin template editor](https://github.com/PhyberApex/kuroshiro/issues/1095): the editor, the layouts a Plugin has, what the preview renders against and how a render error is shown.

What the page hands the editor:

- The preview renders the form as it stands: the unsaved template with the unsaved Data Sources and Field Values. That is why the save bar says "The preview already shows them."
- The preview starts out for the first Device the Plugin is assigned to, by name; for a Plugin on no Device, for the first Device there is; with no Devices, for TRMNL OG.
- A change to the template marks the form as changed like any other field. The editor has no save of its own.

### Data Sources

For a Poll-kind Plugin. A heading "Data Sources" with the action "Add a Data Source" (plain) on its line.

**The refresh interval** is the first row: "Fetch" · "every {number} {minutes|hours}" · under it "The refresh interval: how often Kuroshiro fetches every Data Source and renders {Plugin} again. A Device shows the newest render at its own next poll." At least 1 minute, at most 24 hours, a whole number: "Enter between 1 minute and 24 hours."

**One row per Data Source**, in the Plugin's order, opening in place like a Screen row; opening another closes it. A row, left to right:

- **The name** in mono at weight 600. It is the button that opens the row, and it is the name the template uses.
- **What it is**, in mono `ink-soft`, cut with an ellipsis: "{GET} {host and path}" without the scheme, or "literal · a fixed value".
- **Its health**: "Fetched {when}" in `ink-soft`; "Not fetched yet"; the problem icon and "The last fetch failed" or "{n} fetches failed in a row"; or in red with the red square "Alert: keeps failing". A `literal` Data Source has none.
- A chevron.

**Opened** ([render][plugin-alert]), the row shows a form at the left and its story at the right; on phone the story comes after the form.

| Field | Control | Rules and hints |
|---|---|---|
| Name | text input, mono | Hint: "The template reads it as `{{ {name} }}`." Required: "A Data Source needs a name." Unique in the Plugin: "Another Data Source of {Plugin} is called {name}." Not a Plugin Field's keyname: "{name} is already the keyname of a Plugin Field." Not `trmnl`: "`trmnl` is taken by Kuroshiro." |
| Data Source Mode | segmented, "Fetch" and "Literal" | Under it: "An HTTP request Kuroshiro makes at every scheduled render." or "A fixed JSON value you type here." Switching keeps what the other mode held until the Plugin is saved. |
| Request (Fetch) | a method select, GET or POST, and a URL input | Hint: "The response must be JSON. A Field Value can be used as `{{ keyname }}` here, in the headers and in the body." Must start with `http://` or `https://`: "Enter an address that starts with http:// or https://." In demo mode an address that is not public: "In the demo a Data Source can only fetch a public address." |
| Headers (Fetch) | code input | Hint: "A JSON object. Keep a secret in a password Plugin Field and name it here, not in the header itself." Not a JSON object: "Headers must be a JSON object, like { "Accept": "application/json" }." |
| Body (Fetch, POST only) | code input | Hint: "A JSON object, sent with POST." Not a JSON object: "The body must be a JSON object." |
| Transform (Fetch) | a tucked section titled "Transform · none" or "Transform · JavaScript, {n} lines", holding a code input | Inside: "JavaScript that reshapes the response before the template sees it. It runs on this server at every fetch." |
| Value (Literal) | code input | Hint: "JSON." Not valid JSON: "This is not valid JSON: {the parser's message}." |

The code inputs are the code editor of [The Plugin template editor](https://github.com/PhyberApex/kuroshiro/issues/1095) in its JSON and JavaScript modes, a few lines high. The drawings show a mono textarea.

The story at the right says how the Data Source is doing:

| State | Sentences |
|---|---|
| Fetched | "Fetched {when}, at the last scheduled render." |
| Never fetched | "Not fetched yet. The first scheduled render fetches it." |
| A Fetch Failure Streak | "Its Fetch Failure Streak is {n}: the last {n} scheduled fetches failed, most recently {when}." (for 1: "the last scheduled fetch failed") · the server's last error in a code block · "{Plugin} still renders. `{{ {name} }}` carries an error marker instead of data until a fetch succeeds." · "An Alert fires when the streak reaches {threshold}." |
| The Alert fires | in red with the red square, "Alert: this Data Source keeps failing", then the same sentences without the last one |
| Literal | "A fixed value. Nothing is fetched, so it has no Fetch Failure Streak." |

Under the story: **"Remove Data Source"** (plain). It asks nothing, because it is part of the unsaved form: the row closes, its name and line are struck through, and its health reads "Removed when you save" with "Put back" ([render][plugin-unsaved]). Saving removes it.

**"Add a Data Source"** appends an opened row in Fetch mode with GET, named `source`, or `source_2` and so on when that is taken, with the name selected.

- Data Sources keep the order they were added in. There is no reordering: every Data Source is a top-level variable of its own, so the order changes nothing.
- **No Data Sources:** in place of the rows, "No Data Sources. The template renders without data. Add one to fetch JSON from an address, or to keep a fixed value."
- Only scheduled renders move a Fetch Failure Streak. A fetch the preview makes does not, and the page does not pretend otherwise: there is no "Fetch now".

### Webhook

For a Webhook-kind Plugin, in place of Data Sources ([render][plugin-webhook], [nothing received yet][plugin-webhook-empty], [phone][phone-webhook]). A heading "Webhook", then rows in the shape of a Device's Settings.

| Row | Content | Notes |
|---|---|---|
| Webhook URL | a Copy value: the address with the Webhook Token shown as dots and its last four characters, then "Reveal" (which becomes "Hide") and "Copy" | "Copy" copies the whole address either way. Under the row: "POST a JSON object or array here. It becomes the Webhook Payload and {Plugin} is rendered again at once. The Webhook Token at its end is the only key, so treat the address as a secret." |
| Merge Strategy | the name, the API value in mono, and for Stream "· Stream Limit {n}" | At the right: "Fixed when the Plugin was created". Under the row, the strategy's sentence from Add a Plugin; for Stream: "Top-level arrays are appended to and keep their newest {n} entries. Other keys are replaced." |
| Example | a code block with a `curl` call to the Webhook URL, and "Copy" | The token is written out only while the URL is revealed; otherwise the block shows "…" in its place and "Copy" still copies the working command. |
| Webhook Payload | "Received {when}. The template reads its keys directly, for example `{{ {first key} }}`.", the stored JSON in a code block, and "Clear Webhook Payload" (plain) | A payload longer than 30 lines shows its first 30 and "Show all {n} lines". Empty: "Nothing received yet. Until the first POST arrives the template renders without data." |

Under the rows: "A sender that should no longer reach {Plugin}? Regenerate the Webhook Token" (a quiet button).

- **Clear Webhook Payload** ([render][confirm-clear]). "Clear {Plugin}'s Webhook Payload?" · Lost: "The stored Webhook Payload. {Plugin} renders without data until the next POST." · Stays: "The Webhook URL, the template and the Merge Strategy." · "Clear Webhook Payload". The Plugin is rendered again at once.
- **Regenerate the Webhook Token** ([render][confirm-regenerate]). "Regenerate {Plugin}'s Webhook Token?" · "Everything that posts to the current Webhook URL is refused from now on, until you give it the new one." · Lost: "The current Webhook URL." · Stays: "The Webhook Payload, the template and the Merge Strategy." · "Regenerate Webhook Token". Afterwards the new URL is shown revealed.

A Webhook-kind Plugin has no refresh interval and no Data Sources, and the page shows neither.

### Field Values

Shown only when the Plugin has Plugin Fields ([render][plugin-needs]). A heading "Field Values", then one row per Plugin Field in the Plugin Fields' order: the Plugin Field's label, with "required" under it in `ink-soft` when it is; the control; a note at the right; the Plugin Field's help text under the control.

| Plugin Field type | Control |
|---|---|
| Single-line text, and `url` | text input, with the default as its placeholder |
| Multi-line text | textarea |
| Number | number input |
| On or off | switch, with "On" or "Off" |
| Select | select of its options |
| Password | when a value is stored: twelve dots and "Replace", which swaps in an empty password input. Otherwise a password input with the placeholder "Not set". The stored secret is never sent to the browser. |
| `author_bio` | no row. Its text is a line in `ink-soft` under the section. |
| Anything else | text input |

The note at the right reads "The default" while the value equals the Plugin Field's default, "Set. A secret is never shown again." for a stored password, and for a required Plugin Field with neither a value nor a default the problem icon and "Empty", with the doubled ink border on the control. An empty required Plugin Field never stops a save.

Under the rows: "Every Device and every Mashup shows {Plugin} with these values. To show it with other values somewhere, duplicate the Plugin." The Plugin Fields themselves are edited in the tucked section "Plugin Fields".

Field Values are part of the form: they save with "Save Plugin", and the preview shows them as they are typed.

### Devices

A heading "Devices", then one row per Device, by name ([render][plugin-poll]): the Device's name as a link to its Screens view; how the Plugin stands there; one button.

| State | Middle | Button |
|---|---|---|
| Assigned | "Assigned · **Order {n} of {N}**", and the Screen State when the Screen carries one ("· Active Screen", "· Schedule off") | "Unassign" |
| Not assigned | "Not assigned" | "Assign to {Device}" |

- **Assign to {Device}** acts at once and asks nothing: the row turns to "Assigned · Order {N} of {N}". It never changes the Active Screen.
- **Unassign** opens the confirmation the Device surfaces use ([render][confirm-unassign]): "Unassign {Plugin} from {Device}?" · Lost: "This Screen on {Device} and its Schedule." · Stays: "The Plugin {Plugin}, with its template, its Data Sources and its place in any Mashup." (for a Webhook-kind Plugin "its Webhook URL" in place of "its Data Sources") · "Unassign Plugin".
- After the Devices, one row per **Mashup** that holds the Plugin in a slot: the Mashup's name, "A Mashup on {Device}. {Plugin} fills one of its slots.", and the link "Open the Mashup", which opens that Device's Screens view with the Mashup's row opened. A slot is changed there, not here.
- Under the rows: "Assigning adds {Plugin} to the end of that Device's Order as a Screen, always shown until you give it a Schedule there."
- **No Devices** ([render][plugin-no-devices]): "No Device is connected yet, so there is nothing to assign {Plugin} to." and "Connect a Device".
- A Schedule, the Order and a Plugin Assignment's Screen State are edited on the Device. This section only says where the Plugin stands.

### Recipe

Shown only for a Plugin imported from a Recipe. A heading "Recipe" with the action "Run a Recipe Update Check" (plain) on its line, then: "Imported from the Recipe {name} {id} on trmnl.com, on {date}. Nothing updates by itself: a Recipe Update Check downloads the Recipe again and shows what changed before anything is applied." The Recipe's name and id link to its page on trmnl.com. After a check has been applied or skipped, the date is that of the Recipe Snapshot: "last taken over on {date}".

### Tucked at the bottom

Three tucked sections, closed by default ([render][plugin-fields]).

**Plugin Fields · {n}.** "A Plugin Field is one input this Plugin asks you to fill in. What you enter is its Field Value, which templates and Data Sources read by the keyname." For a Recipe's Plugin: "These arrived with the Recipe; a Recipe Update Check may offer changes to them." Then one row per Plugin Field: a drag grip, the keyname in mono, the label with "· required", the type, and "Edit", which opens the row's form in place and becomes "Done".

| Field | Control | Rules and hints |
|---|---|---|
| Keyname | text input, mono | Hint: "Templates and Data Sources read `{{ {keyname} }}`. Changing it starts the Field Value over." Required; letters, digits and underscores, not starting with a digit: "Use letters, digits and underscores, starting with a letter." Unique: "Another Plugin Field is called {keyname}." Not a Data Source's name and not `trmnl`, worded as for a Data Source. |
| Label | text input | What the Field Values row is called. Empty falls back to the keyname. |
| Type | select: Single-line text, Multi-line text, Number, On or off, Password, Select | An `author_bio` Plugin Field shows "Credit, read-only" and cannot be changed to or from. |
| Default | text input, placeholder "None" | Not offered for Password. |
| Options (Select only) | textarea | Hint: "One per line." At least one: "A Select needs at least one option." |
| Help text | text input | Shown under the Field Values row. |
| Required | checkbox | |

- "Remove Plugin Field" (quiet) works like "Remove Data Source": struck through, "Removed when you save, with its Field Value", "Put back".
- "Add a Plugin Field" (plain, under the rows) appends an opened row of type Single-line text.
- Rows are reordered by the grip, with the keyboard and the phone behaviour of the Screens in Order. The order is the order of the Field Values rows.
- A Plugin with none reads "{Plugin} declares none." above "Add a Plugin Field", and the title has no count.
- All of it is part of the form. A Plugin Field added here appears under Field Values at once, unsaved.

**Name and description.** "Name" (required: "A Plugin needs a name."; the title and the bar follow on save) and "Description", a two-line text input with the placeholder "What this Plugin shows. Only you read it." A Recipe brings its own description.

**Duplicate, export or delete {Plugin}.** One paragraph, then three plain buttons: "A duplicate is a second Plugin with the same template, Data Sources, Plugin Fields and Field Values, on no Device. An export is a .zip with the template, the Data Sources as written, headers included, and the Plugin Fields, without Field Values. Deleting removes {Plugin} from this Instance and from {Devices}." For a Webhook-kind Plugin: "the same template, Merge Strategy, Plugin Fields and Field Values, on no Device, with its own Webhook URL", and the export sentence leaves out the Data Sources.

### Duplicate, export, delete

The same three actions from the row menu of the list and from the tucked section.

- **Duplicate** asks nothing. It makes "{Plugin} (copy)" and opens the copy's page with the line "A copy of {Plugin}. It is not on a Device yet." The copy has the template, the Data Sources or the Merge Strategy, the Plugin Fields and the Field Values, secrets included. It has no Plugin Assignment, an empty Webhook Payload and its own Webhook Token. A copy of a Recipe's Plugin stays tied to that Recipe.
- **Export** downloads `{Plugin}.trmnlp.zip` at once. From the list, the row's state column reads "Exported" for 2 seconds; on the page, the button does.
- **Delete Plugin** ([render][confirm-delete]). "Delete {Plugin}?" · Lost: "The Plugin: its template, its Data Sources, its Plugin Fields and Field Values. Its Screen on {Devices}, with their Schedules." (for a Webhook-kind Plugin "its Webhook URL and Webhook Payload" in place of "its Data Sources"; the second sentence only when it is assigned) · Stays: "The other Screens of {Devices}, which move up in the Order." or "Everything else. It is on no Device." · "Delete Plugin". Afterwards the list opens.
- **A Plugin that fills a Mashup slot cannot be deleted** ([render][confirm-mashup]). "Delete Plugin" then opens a dialog with no confirming button: "{Plugin} cannot be deleted yet" · "It fills a slot in the Mashup {Mashup} on {Device}. Give that slot another Plugin, or delete the Mashup. Then {Plugin} can be deleted." · "Close", and for a single Mashup also "Open the Mashup". With several: "It fills a slot in {n} Mashups: {Mashup} on {Device}, …".

### Loading and failed

**Loading** ([render][plugin-loading]): the back link and, once known, the title; "Loading {Plugin}"; the heading "Template" over a `wash` block where the editor will be and a rendering plate. **Failed:** the notice "Could not load {Plugin}." above what was loaded before; the form stays usable and a save is tried as usual.

## Recipe Update Check

`/plugins/:pluginId/update` · [Update Items, a template's diff opened][update-items] · [a conflict opened, dark][update-conflict] · [nothing to apply][update-same] · [no Recipe Snapshot][update-nosnapshot] · [running][update-running] · [failed][update-failed] · [phone][phone-update]

**For:** seeing what a Recipe changed and choosing what the Plugin takes over. Its own page, because a template's diff needs the width and because applying is a form.

The back link reads "{Plugin}", the title stays the Plugin's name, the heading is "Recipe Update Check". Opening the page runs the check; it is never run in the background.

- **Running:** the loading mark and "Downloading the Recipe {name} {id} from TRMNL and comparing".
- **Failed:** the notice "Could not download the Recipe." with the reason ("trmnl.com did not answer. Nothing was changed.", or "TRMNL no longer has the Recipe {id}. {Plugin} keeps working as it is.") and "Try again".
- **Nothing to apply:** "Nothing to apply" · "The Recipe {name} {id} has not changed since {Plugin} last took it over, on {date}. Your own changes to {Plugin} are untouched." · "Back to {Plugin}".

**With Update Items**, the page opens with "The Recipe {name} {id} changed in {n} places since {date}. Choose what {Plugin} takes over. Nothing is applied until you say so." Then the Update Items in up to four groups, each under a small heading and left out when empty: "Plugin details", "Templates", "Data Sources", "Plugin Fields".

A row, left to right: a checkbox; what it is; `added`, `changed` or `removed` in mono; the conflict mark; a chevron. The name opens the row.

| Update Item | Reads |
|---|---|
| The name, the description, the refresh interval | "Name", "Description", "Refresh interval" |
| A template | "Template `{layout}`" |
| A Data Source | "Data Source `{name}`" |
| A Plugin Field | "Plugin Field `{keyname}`" |

- **Checked by default:** every Update Item but a conflict.
- **A conflict** carries the problem icon and "Conflict: you changed this too". Opened, it says first: "The Recipe and you both changed this {Data Source} since the Recipe Snapshot. Applying replaces your version with the Recipe's." and for a Data Source "; headers you added yourself are kept." Then "Yours reads:" over the admin's version, and "The Recipe's change:" over the diff.
- **An opened row** shows the diff. A removed line carries "−", is struck through and is `ink-soft`; an added line carries "+" at weight 600 on `wash`; unchanged lines stand between them, and a longer run of them is folded to "… {n} lines the same". There is no red and no green. A one-line value (the refresh interval, a name) is the same diff with one line each.
- **Removing a Plugin Field** says so under its diff: "Its Field Value is removed with it."
- **A required Plugin Field the Recipe adds** says: "It is required and has no default, so {Plugin} is marked until you fill it in."

The foot of the page:

- "Apply {n} Update Items" (primary; disabled at 0).
- "Skip all {N}" (plain).
- "Cancel" (quiet), back to the Plugin.
- Under them: "Either button makes the Recipe as it is now the Recipe Snapshot, so an Update Item you leave unchecked is not offered again. Cancel records nothing."

Applying saves at once, fetches and renders the Plugin again and opens the Plugin page with "Applied {n} Update Items from the Recipe {name}." Skipping opens it with "Skipped {N} Update Items from the Recipe {name}."

- **The Recipe changed while the page was open:** the notice "The Recipe changed again while you were reading. This is the new comparison." and the page shows the check run again, every Update Item back at its default.
- **No Recipe Snapshot** ([render][update-nosnapshot]), for a Plugin imported before Kuroshiro kept them. The opening reads: "{Plugin} has no Recipe Snapshot, so Kuroshiro cannot tell your changes from the Recipe's. Every difference between {Plugin} and the Recipe {name} {id} is listed. Applying one replaces your version." Nothing is a conflict and nothing is `removed`. The second button reads "Apply nothing and save the Recipe Snapshot".
- **Unsaved changes on the Plugin page** are asked about before the check opens, like any leaving.

## On the Device: a Mashup slot whose Plugin could not be rendered

[render][cell]

[On-device fallback screens in the Hanko identity](https://github.com/PhyberApex/kuroshiro/issues/1090) handed this here. Today a failed slot shows the static `error.png`, which names nothing. It is replaced by a drawing made for the slot:

- Paper ground, ink only, no dithering, no seal. The seal signs a whole sheet; a slot is not one.
- Set at the slot's left, centred vertically: the problem mark (the icon's ink square with its exclamation mark), the Plugin's name in the title face, then two lines in the text face: "could not be shown." and "Next try on its next turn in Rotation."
- Sized from the slot, not the Screen: the name at about 11 % of the slot's height and never wider than the slot less its margins, cut with an ellipsis; the two lines at about half that.
- The other slots render as usual. The Mashup itself is not an error: the Device shows it, and its row on the Device's Screens view carries no fault.
- When every slot fails, the Device still shows the Mashup with every slot saying so. The error Fallback Screen is for a Screen that could not be produced at all.

The wording is kept in step with the error Fallback Screen's "{Screen} could not be shown" ([The error Fallback Screen's wording when a Screen could not be rendered](https://github.com/PhyberApex/kuroshiro/issues/1105)): the name first, then the same phrase.

A Data Source whose fetch failed does not make a slot fail: the Plugin renders with the error marker, in a slot as on its own Screen.

## Phone

Works fully below 820 px: the Plugins list with its search, filter and row menu; on the Plugin page, reading the facts and the problems, the Field Values, assigning and unassigning, the Webhook URL with "Reveal" and "Copy", clearing the Webhook Payload, and the save bar, which sits above the bottom tabs; Add a Plugin for every way; the Recipe Update Check, where a diff scrolls sideways inside its block.

Only has to stay readable: the template editor, an opened Data Source and the Plugin Fields. Their forms stack to one column and can be used, but nothing is tuned for a phone.

A row of the list stacks to name, kind, where it shows and its state, with the menu button at the right. A Data Source row stacks to name, line and health.

## Components this spec adds

Each uses the tokens and rules of [Design tokens and component inventory](https://github.com/PhyberApex/kuroshiro/issues/1091).

| Component | Backed by | States |
|---|---|---|
| Row menu | `DropdownMenuRoot`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`; drawn like the select's list, 1 px ink border, the highlighted item solid ink | closed, open, item highlighted, item disabled |
| Save bar | a `section` named "Unsaved changes", sticky at the bottom of the window, 2 px ink rule above, paper ground, no shadow | hidden, unsaved, saving, invalid, not saved |
| Line shown once | `role="status"` on a `wash` ground, with "Dismiss" | shown, dismissed |
| Problem lines | `ul`, no primitive | Alert (red, the red square), problem (ink, the problem icon) |
| Data Source row | `AccordionRoot` (single, collapsible), the Screen row without a thumbnail | default, hover, focus, open, removed |
| Code block | `pre` on `wash` with an optional "Copy" button | default, copied, folded |
| Diff | `ol` of lines, each named for a screen reader ("removed", "added") | unchanged, removed, added, folded run |
| Secret field | a password input, or dots and "Replace" | empty, typed, stored |
| Checkbox | native `input type="checkbox"`, as the Schedule editor's "All day" already uses; listed because the inventory has no entry for it | off, on, hover, focus, disabled |

One icon joins the twelve: **more**, three squares in a row on the 16 px grid, for the row menu's button.

## Capability coverage

Numbers are those of the [capability inventory](https://github.com/PhyberApex/kuroshiro/issues/1075).

| # | Capability | Home |
|---|---|---|
| 42 | See all Plugins | The Plugins list |
| 43 | Create a Poll-kind Plugin | Add a Plugin, "Build a Poll Plugin", then the Plugin page |
| 44 | Edit a Plugin | The Plugin page; "Save Plugin" stays on the page |
| 45 | Edit Data Sources | Plugin page, Data Sources |
| 46 | Edit the Liquid template | Plugin page, Template; specced by the template editor |
| 47 | Preview a Plugin, with the fetched data | Plugin page, Template; specced by the template editor |
| 18 | Preview as another Device Model and Palette | The same |
| 48 | Duplicate a Plugin | The row menu; the Plugin page's tucked section |
| 49 | Export a Plugin | The same |
| 50 | Delete a Plugin | The same |
| 51 | Import a Plugin from a file | Add a Plugin, File |
| 52 | Import a Plugin from a GitHub repository | Add a Plugin, GitHub |
| 53 | See a Data Source's Fetch Failure Streak, last attempt and last error | The list's state; the Plugin page's problems; an opened Data Source |
| 54 | Field Values | Plugin page, Field Values; Plugin Fields in the tucked section. Plugin Variables are removed (ADR-0032). |
| 55 | Edit templates other than the first | Plugin page, Template; specced by the template editor |
| 56 | Create a Webhook-kind Plugin with its Merge Strategy and Stream Limit | Add a Plugin, "Build a Webhook Plugin" |
| 57 | See and copy the Webhook URL | Plugin page, Webhook |
| 58 | Regenerate the Webhook Token | Plugin page, Webhook |
| 59 | Read the Webhook Payload | Plugin page, Webhook |
| 60 | Clear the Webhook Payload | Plugin page, Webhook |
| 61 | Assign or unassign from the Plugin | Plugin page, Devices |
| 62 | Assign from the Device, with a shortcut to a new Plugin | [devices.md](./devices.md), Add Screen; the shortcut lands on Add a Plugin carrying the Device |
| 63 | Unassign from the Device | [devices.md](./devices.md) |
| 64 | A Plugin Assignment's own enable flag and order | None. Removed, as Primary journeys decided. |
| 65 | Import a Recipe | Add a Plugin, Recipe; "Import a Recipe" on the list |
| 66 | Recipe Update Check | Plugin page, Recipe; the Recipe Update Check page |

Capability 77 (the Alerts page, where a fetch Alert links to its Plugin) belongs to the Instance spec. This spec gives it the address to link to: `/plugins/:pluginId?source=:name`.

## What this asks of the admin API

A request list for [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096), which settles the shapes. Saving Field Values and removing Plugin Variables is already its own build issue, [#1101](https://github.com/PhyberApex/kuroshiro/issues/1101); this list leans on it and does not repeat it.

**To add**

1. A list read made for rows: id, name, Plugin Kind, the source Recipe's id, the Devices it is assigned to (id and name), the Mashups it fills a slot in (name and Device), its worst Fetch Failure Streak, whether a fetch Alert fires, whether a required Plugin Field is empty, and for Webhook whether a Webhook Payload is stored. Today the list sends every template, the whole Webhook Payload, the Recipe Snapshot and each assigned Device's API key and mirror API key.
2. On a Plugin read: per assignment the Screen's Order, the number of Screens on that Device and its Screen State; the Mashups it fills a slot in; the Recipe's name and the date of the Recipe Snapshot; when the Webhook Payload was last received; when the last scheduled render ran and its error if it failed.
3. On a Data Source: when it last fetched successfully, apart from the last attempt.
4. The Plugin's id on a fetch Alert, so the Alerts page can link to it. Today it carries the Plugin's name only.
5. Building a Plugin with only a name and a Plugin Kind, with a starter template that shows the name.
6. Options on a Plugin Field of type select (no column holds them today), and its help text on the read.
7. In an export: the Plugin Kind, the Merge Strategy and the Stream Limit, so a Webhook-kind Plugin comes back as one.
8. A worded reason on every import refusal. Today nearly all of them are a server error with no reason: a bad id, a Recipe TRMNL does not have, OAuth, a pushed strategy, a file or repository without a Plugin, TRMNL or GitHub not answering.

**To change**

1. Saving a Plugin is one change, in one transaction, answered with the saved Plugin as a read gives it. Today the answer lacks the assignments and carries the Plugin Fields from before the save.
2. Saving matches Data Sources by id. Today every save deletes and recreates them, so each save resets every Fetch Failure Streak and removes a firing Alert.
3. Saving validates: a name that is not empty, a whole refresh interval from 1 minute to 24 hours, a method of GET or POST.
4. The refresh interval is kept as entered. Today it is rounded down to whole hours from 60 minutes on, an interval that does not divide the hour runs unevenly, and a save that changes only the interval is not rescheduled.
5. A Poll-kind Plugin without Data Sources renders. Today it is never scheduled and never rendered on demand.
6. A Webhook-kind Plugin renders in a Mashup slot. Today the slot always fails, because it has no Data Sources.
7. A Webhook-kind Plugin with an empty Webhook Payload renders its template without data. Today nothing is rendered until the first POST, so its Screen falls back.
8. Clearing the Webhook Payload renders the Plugin again. Today the cleared data stays on its Screens.
9. The Merge Strategy and the Stream Limit are refused in an update. Today an update changes them, though they are fixed at creation.
10. A Plugin that does not exist answers "not found" on read, update and delete. Today a read answers an empty body with success.
11. A delete refused for a Mashup names the Mashups and their Devices as data, not as a sentence.
12. Assigning must not change the Active Screen, as [devices.md](./devices.md) already asks, and must check that the Device exists.
13. Duplicating copies the Field Values.
14. A failed slot of a Mashup is drawn as specced above, in place of `error.png`.
15. A transform that throws is reported as a failed fetch with its message. Today the untransformed data passes through silently.
16. A file import that is not a .zip is refused with a reason. Today a bare `.trmnlp.yml` fails inside the server.
17. The Recipe Update Check reports required Plugin Fields left empty for the Plugin, not per Plugin Assignment, following ADR-0032.

**To remove** (named by Primary journeys, repeated for completeness): a Plugin Assignment's own enable flag and order, and the list of a Device's Plugin Assignments, which no screen reads.

## Departures

- **The import no longer asks for a Device.** The old dialog required one; the API never did. A Device is carried only when the admin came from one.
- **File import takes a .zip only.** The old UI also offered a bare `.trmnlp.yml`, which holds no template and does not work on the server.
- **A Fetch Failure Streak is shown from 1**, not only once it has become an Alert, with the Alert told apart by the red.
- **The description is not on the list.** It is kept and tucked on the Plugin page.
- **"Check for Updates" and "Save baseline"** are "Run a Recipe Update Check" and "Apply nothing and save the Recipe Snapshot", after `CONTEXT.md`.
- **Dismissing a Recipe Update Check** is "Skip all {N}", and the page says that skipped Update Items are not offered again. The old dialog did the same without saying so.

## Open points

**Decided on the agent's own call; the maintainer may want to overturn them**

- The Plugin page is one long page with one save, not tabs, and its order is Template, Data Sources or Webhook, Field Values, Devices, Recipe. Someone who only imports Recipes meets Field Values third; an empty required one is raised to the top as a problem.
- Building creates the Plugin at once instead of holding an unsaved new one. A Plugin built from a Device's Add Screen is therefore in that Device's Rotation, showing its name, before its template is written.
- The list names up to two Devices and counts from three.
- A Plugin that fills a Mashup slot cannot be deleted, as on the server today. The alternative, deleting it and leaving the Mashup with an empty slot, was not chosen.
- Removing a Data Source or a Plugin Field asks nothing, because it is undone by "Discard changes" until the Plugin is saved.
- There is no "Fetch now". The preview fetches live and a save fetches at once.
- Data Sources cannot be reordered.
- The Webhook Token is masked until "Reveal", like a Device's API key.
- The refresh interval is limited to 1 minute through 24 hours.
- A duplicate copies the Field Values, secrets included.
- A diff uses sign, weight and strike, no colour.
- A row menu and one new icon join the inventory.
- A failed Mashup slot names its Plugin and carries no seal.

**Left undecided**

- **The starter template** of a built Plugin is settled in [template-editor.md](./template-editor.md).
- **A Recipe whose refresh interval is longer than 24 hours.** It is shown and kept as imported; whether the limit should rise is the API ticket's call.
- **A size limit for a Webhook POST.** None is set in the code; the framework's default of about 100 kB probably applies. The page states no limit.
- **Secrets in an export.** A header written out in a Data Source is exported as written. The page says so and steers secrets into password Plugin Fields, which are not exported; it does not warn at the moment of exporting.
- **Whether a Mashup slot should use the template of its own size** is settled in [template-editor.md](./template-editor.md): it does, and falls back to `full`.
- **GitHub import of a branch or a sub-folder.** The server reads the root of `main` only, and the form says so.
- **A copy of a Recipe's Plugin** stays tied to the Recipe, so both offer the same Recipe Update Check. Untying it would need an action that does not exist.

[proto]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces
[list-light]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-light.png
[list-problems]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-dark-problems.png
[list-few]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-few.png
[list-menu]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-menu.png
[list-none]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-search-none.png
[list-empty]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-empty.png
[list-loading]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-loading.png
[list-failed]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/list-failed.png
[add-recipe]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-recipe.png
[add-twice]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-recipe-twice.png
[add-refused]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-recipe-refused.png
[add-file]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-file.png
[add-github]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-github.png
[add-poll]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-poll-for-device.png
[add-webhook]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/add-webhook.png
[plugin-poll]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-poll.png
[plugin-poll-dark]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-poll-dark.png
[plugin-alert]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-alert.png
[plugin-streak]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-streak.png
[plugin-needs]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-needs-values.png
[plugin-webhook]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-webhook.png
[plugin-webhook-empty]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-webhook-empty.png
[plugin-unsaved]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-unsaved.png
[plugin-saved]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-saved.png
[plugin-fields]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-fields.png
[plugin-no-devices]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-no-devices.png
[plugin-loading]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-loading.png
[missing]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/plugin-missing.png
[confirm-unassign]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/confirm-unassign.png
[confirm-delete]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/confirm-delete.png
[confirm-mashup]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/confirm-delete-in-mashup.png
[confirm-clear]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/confirm-clear-payload.png
[confirm-regenerate]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/confirm-regenerate.png
[update-items]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-items.png
[update-conflict]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-conflict-dark.png
[update-same]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-same.png
[update-nosnapshot]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-no-snapshot.png
[update-running]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-running.png
[update-failed]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/update-failed.png
[cell]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/mashup-slot-failed.png
[phone-list]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/phone-list.png
[phone-plugin]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/phone-plugin.png
[phone-webhook]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/phone-webhook.png
[phone-add]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/phone-add.png
[phone-update]: https://github.com/PhyberApex/kuroshiro/blob/d19583b/packages/ui/prototypes/plugin-surfaces/shots/phone-update.png
