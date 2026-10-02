# Admin UI spec

The design spec for the admin UI rebuilt from zero in `packages/ui-next`. It is the output of the wayfinder map [Admin UI rebuild from zero](https://github.com/PhyberApex/kuroshiro/issues/1074) and the reference every build issue is written against.

| Surface | Spec |
|---|---|
| Devices: the Screens view, an opened Screen, Add Screen, Settings, Logs, the Devices list, Connect a Device | [devices.md](./devices.md) |
| Plugins: the list and the Plugin page | not written yet |
| The Plugin template editor | not written yet |
| Instance pages and the Alerts page | not written yet |

## What is settled elsewhere

A surface spec does not restate these. It builds on them, and where it has to depart from one it says so in its own "Departures" section.

| Decision | Where |
|---|---|
| Journeys, the three sections, what each screen is for | [Primary journeys and the story each screen tells](https://github.com/PhyberApex/kuroshiro/issues/1078) |
| Hanko: black and white, one vermilion seal, red rationed to the seal and a firing Alert | [Brand direction](https://github.com/PhyberApex/kuroshiro/issues/1079) |
| Masthead: one top bar, second level in the page, three bottom tabs on phone | [App shell and navigation](https://github.com/PhyberApex/kuroshiro/issues/1080) |
| Plate: a Device's Screens view | [Device details hero screen](https://github.com/PhyberApex/kuroshiro/issues/1081) |
| Tokens, the nineteen components and their states | [Design tokens and component inventory](https://github.com/PhyberApex/kuroshiro/issues/1091) |
| The four Fallback Screens | [On-device fallback screens in the Hanko identity](https://github.com/PhyberApex/kuroshiro/issues/1090) |
| Vocabulary | [`CONTEXT.md`](../../CONTEXT.md) |
| Parallel package, cutover at parity | [Cutover strategy from the old UI to the new one](https://github.com/PhyberApex/kuroshiro/issues/1082) |
| Tests every build issue ships with | [Test strategy for the new UI](https://github.com/PhyberApex/kuroshiro/issues/1083) |

## How a surface spec is written

Each surface spec is one Markdown file in this directory. The text is binding. Drawings live in a prototype on a throwaway `prototype/*` branch and are linked by commit; where a drawing and the text disagree, the text wins.

A surface spec has these parts, in this order:

1. **Routes.** Every URL the surface owns and what each one shows.
2. **One section per view.** For each view: the one primary thing it is for, its layout at desktop and phone width, its content with the exact copy, every action with what it calls and what it confirms, and its empty, loading and failed states.
3. **Components it adds.** Anything beyond the component inventory, with its Reka UI primitive and its states.
4. **Capability coverage.** A table that gives every capability of the [capability inventory](https://github.com/PhyberApex/kuroshiro/issues/1075) in the surface's groups a named home, or says why it has none.
5. **What it asks of the admin API.** Endpoints to add, change or remove. This is a request list; the shapes are settled in [Admin API reshaping for the new screens](https://github.com/PhyberApex/kuroshiro/issues/1096).
6. **Open points.** What the spec decided on the agent's own call, and what it left undecided.

Copy is quoted exactly as the admin reads it and uses the `CONTEXT.md` vocabulary. A name in `{braces}` is filled in at runtime.

## Patterns every surface shares

These hold on every page so that no surface spec has to repeat them.

### Loading

- The shell and the page's title line render at once; only the body waits.
- A body that is waiting shows its real structure with nothing in it: a plate in its rendering state where an image will be, `wash` bars where text will be, and one line with the loading mark and what is loading ("Loading {Device}'s Screens"). There is one loading mark per view, the blinking ink square.
- A view that already has data and is refreshing shows no loading state. It swaps the data when the answer arrives.
- A wait under 300 ms shows nothing.

### A failed load

- The view shows a notice above its body: what could not be loaded, the server's reason when it gave one, and "Try again". Data from an earlier load stays visible under the notice.
- When the server cannot be reached at all, the notice reads "Kuroshiro's server is not answering." and the view retries by itself every 10 seconds while it is open.
- A record that does not exist gets a whole-page empty state naming what is missing and one link back ("No Device here. It may have been deleted." with "All Devices").
- Nothing in a failed state is red. Red is for the seal and a firing Alert.

### Saving

- **Save as changed.** A control that is a setting saves by itself: a switch, select, radio or weekday toggle on change; a text, number or time input on blur or Enter. Beside the control: "Saving", then "Saved" for 2 seconds, or "Not saved" with "Try again". A failed save keeps what the admin entered.
- **A form.** A view that creates something, or edits text that is not valid halfway through (HTML, a template), has one primary button and "Cancel". The primary button shows the loading mark while it runs. Leaving with unsaved changes asks first.
- An invalid value is never sent. The field gets the doubled ink border and a message that says what is wrong and what is allowed.

### Destructive actions

- Each one opens a confirmation whose title names the thing, whose body lists what is lost and what stays, and whose safe choice has the focus. The confirming button repeats the action's name ("Delete Screen"), never "OK" or "Yes".
- Unassigning is never worded as deleting. A Plugin Assignment is unassigned; every other Screen is deleted.

### Fresh data

- A view that shows what a Device is doing asks the server again every 30 seconds while the tab is visible, and at once when the tab regains focus. Nothing on the page moves when the answer is unchanged.
- A value that changes under the admin's cursor is never swapped while that control has the focus.

### Time

- Times within the last day are relative ("4 min ago") with the exact time in a tooltip; older ones are a date and time. All of them are in the browser's timezone, except a Schedule's and Sleep Mode's hours, which are in the server's timezone and say so.

### Phone

- Below 820 px the layout is one column. A table-like row stacks its cells; an action row wraps. Touch targets are 44 px.
- What must work fully on a phone is listed per surface. Everything else only has to stay readable.
