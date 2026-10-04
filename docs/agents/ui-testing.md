# Testing the admin UI

How `packages/ui-next` is tested, decided in [Test strategy for the new UI](https://github.com/PhyberApex/kuroshiro/issues/1083). Everything that renders runs in real Chromium; the old `packages/ui` specs are a reference for behaviour only and are never ported.

All commands run from `packages/ui-next` (or with `pnpm --filter kuroshiro-ui-next <script>`).

| Command | What it runs | Needs |
| --- | --- | --- |
| `pnpm test` | Node specs and browser-mode specs | Chromium: `pnpm exec playwright install --only-shell chromium`, once |
| `pnpm test:watch` | The same, watching | |
| `pnpm test:coverage` | The same, with the lcov report Codecov's `ui` flag reads | |
| `pnpm test:screenshots` | Compares every shot with its committed baseline | Docker |
| `pnpm test:screenshots:update` | Rewrites the baselines | Docker |
| `pnpm test:real-api` | Builds the API and the UI and drives them against Postgres | Docker (or a Postgres named by `KUROSHIRO_DB_*`), Chromium, and ImageMagick 7 (`magick`) for a journey that adds a Screen |

The root `pnpm test` runs the first one. CI (`.github/workflows/checks.yml`) runs all three kinds.

## Which file is which kind of test

| File | Runs in | For |
| --- | --- | --- |
| `src/**/*.spec.ts` | Chromium (Vitest browser mode) | A component, a page, anything that touches the DOM |
| `src/**/*.node.spec.ts`, `scripts/**/*.node.spec.ts` | Node | Pure logic |
| `src/**/*.shots.ts` | Chromium, inside the pinned image only | Screenshot baselines |
| `real-api/**/*.spec.ts` | Node, driving Chromium through Playwright | The journeys against the real API |

Specs sit in a `__test__` folder beside what they test. There is no jsdom.

## The helpers

All in `packages/ui-next/src/testing/`. The specs in `src/testing/__test__/` are one worked example of each.

- **`mount(Component, { props, slots, theme })`** and **`mountPage({ routes, at, theme })`** (`mount.ts`). Both return the `vitest-browser-vue` screen (`getByRole`, `getByText`, ...) and are awaited. `mountPage` builds a test router over the routes you pass and opens it at `at`; it also returns `router`. The tokens, the reset and the faces are already loaded by the setup file, in the order the app loads them. The theme is `light` unless you pass `dark`.
- **`mountApp({ at, theme })`** and **`fakeShellReads({ instance, devices, alerts })`** (`app.ts`) are how a screen is mounted: the whole app, shell and real routes, opened at `at`, returning the screen and `router`. The shell reads the Instance facts, the Devices and the Alerts on every page, so call `fakeShellReads()` first; left out, each argument is an ordinary Instance with one Device, Kitchen, and no Alert firing. `mountApp` also takes `routes`, stand-in routes for a spec of the shell itself. `mountPage` is for a component that needs a router but is not a route of the app; it installs the shared reads too, and each asks the API only once something uses it.
- **`freezeTime('2026-10-03T07:35:00.000Z')`** (`time.ts`) holds `Date` for the rest of the test, so a relative time reads the same on every run. A page with a `RelativeTime` calls it before mounting, in its spec and in its shots. The held clock still creeps on by a millisecond every few real ones: Vue drops an event that is not later than the moment its listener was attached, so on a clock that stood quite still a `Button` would never fire.
- **`fakeScreenImages()`** (`images.ts`) answers every Screen image a page asks for (`/screens/…`) with one drawing, so a `Plate` shows an image and not its error state. Call it before mounting a page that shows Screen images.
- **Events** come from `vitest/browser`: `await locator.click()`, `await userEvent.keyboard('{Tab}')`. They are real pointer and keyboard events, which is what Reka UI needs. Assert with `await expect.element(locator).toBeVisible()`, which retries.
- **`expectAccessible()`** (`a11y.ts`) runs axe-core at WCAG 2.1 AA on what is mounted, in light and in dark, and fails on any violation.
- **`expectNoHorizontalOverflow()`** (`overflow.ts`) fails if the page scrolls sideways at 375, 768 or 1280 px and names the elements that stick out.
- **`expectPageScreenshots(name)`** and **`expectScreenshot(locator, name)`** (`screenshots.ts`), for `*.shots.ts` files only.

- **`withCoarsePointer(body)`** and **`withMotionAllowed(body)`** (`media.ts`) run `body` as on a touch screen (a control is 44 px high) or with motion allowed, and put the browser back afterwards.
- **`pressAndHold(key)`** (`keys.ts`) presses a key down, waits a tick and lets go. A Reka radio group (`SegmentedFilter`, `RadioRow`, `LayoutPicker`) chooses the radio an arrow key moved to only while the key is still down a tick later, so `userEvent.keyboard('{ArrowRight}')` moves the focus and chooses nothing.

The browser may read and write the clipboard, so a spec reads back what a control copied with `await navigator.clipboard.readText()`.

Spec files run side by side and share that one clipboard, so only one of them may read it back: `CopyValue.spec.ts`. Any other spec that copies replaces `navigator.clipboard.writeText` with a `vi.fn` for the test and asserts what it was called with (`CodeBlock.spec.ts`).

Playwright refuses to click what is disabled, `aria-disabled` included. To assert that such a control does not fire, click it with `{ force: true }`.

The pointer stays where the last click left it, so an element mounted under it is hovered from the start. Do not assert a resting colour that hover changes.

A click moves the place Tab starts from, a forced click on a disabled control included. In a test that walks a group by keyboard, press the keys first and click afterwards.

A component under test is controlled: it emits and waits for its `modelValue` to follow. Where a test needs the value to follow, give the mock `mockImplementation(value => screen.rerender({ modelValue: value }))` after mounting (`Switch.spec.ts`).

`toHaveStyle` normalises what it expects on an element without a border style, so `{ 'border-bottom-width': '2px' }` is compared as `0px`. Read a border from `getComputedStyle` inside `expect.poll`.

A Reka UI layer (a tooltip, a menu) is teleported to `body`. The `screen` queries still find it, but Reka's `role="tooltip"` element is hidden from the accessibility tree: query it with `getByRole('tooltip', { includeHidden: true })` or assert the trigger's accessible description.

The browser runs with reduced motion, so the duration tokens collapse and nothing is asserted or shot mid-transition. A style change still lands one frame later; `forceTheme` and the viewport helpers wait for it, and `expect.element` retries, so read computed styles through those rather than straight after a change.

Under reduced motion every property still transitions for 0.01 ms, and a colour a child inherits from a parent with a transition of its own starts a second transition when the parent's ends. `settled()` (`paint.ts`), which `forceTheme` and the viewport helpers call, therefore waits until no CSS transition is running, not for a fixed number of frames.

A Reka popper layer is parked off screen until it is placed, and `click({ force: true })` does not wait for that. Before a forced click on something in a layer, poll its `getBoundingClientRect().top` (`Select.spec.ts`).

Two fast presses of an arrow key in an open Reka `Select` both start from the same option, because Reka moves the focus in a timeout. Press once, assert where the focus is, press again.

**`holdTabVisible()`** (`visibility.ts`) holds `document.visibilityState` at `visible` for the test. Spec files run side by side and the tab that takes the shots is never in front, so a page that only asks while its tab is visible (`usePolling`, so anything `fresh` and Connect a Device) asks in some runs and not in others. A spec or a shot that waits for such a poll calls it before mounting (`ConnectPage.spec.ts`).

`expect.poll` gives up after one second, far sooner than `expect.element`. An assertion that waits for a real timer of the page (Connect a Device asks every 3 seconds) passes `expect.poll` a `timeout`.

`userEvent.dragAndDrop` onto a target below the window's edge drops nothing: drag onto a row that is in view.

A download (`apiDownload`) is a click on a link with a `download` attribute. A spec catches it with a capturing `click` listener on `document` that calls `preventDefault()` and keeps the link's `href` (`PluginsListPage.spec.ts`).

While a dialog or a menu is open, the rest of the page is hidden from assistive technology, so `getByRole` finds nothing outside it: read the page under an open layer from the DOM.

`userEvent.upload(input, file)` chooses a file in a native file input; a drop is a `DragEvent` dispatched with a `DataTransfer` holding the file (`FileDrop.spec.ts`).

## Faking the API

MSW answers at the network boundary; nothing in the UI is mocked. `src/testing/api/server.ts` exports:

- `api`: the MSW worker. Add handlers in a test with `api.use(...)`; they are dropped after each test.
- `apiUrl(path)`: the absolute URL of an admin API path, resolved against `document.baseURI` as the UI resolves it. Always build handler URLs with it.
- `apiErrorResponse(overrides)`: a refusal in the `ApiError` envelope with its status.

```ts
api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())))
api.use(http.get(apiUrl('devices/42'), () => apiErrorResponse({ statusCode: 404, code: 'not-found' })))
```

A request to the admin API that no handler fakes fails as a network error and is named on the console. That is the "failed request" state for free when you want it, and a loud miss when you do not.

### Fixture builders

`src/testing/fixtures/`, one file per resource group, named like the files of `packages/shared/src/api/`. Each builder is

```ts
export const buildInstanceSettings = defineBuilder<InstanceSettingsResponse>(() => ({ ...every key... }))
```

and is called as `build<ReadModel>(overrides?)`. There are builders for the Instance facts and Instance Settings (`instance.ts`), a Device's summary and its detail (`devices.ts`), an Alert and the Alerts list (`alerts.ts`), a Screen and its Schedule (`screens.ts`), a Plugin's summary, its detail and a Mashup it fills a slot in (`plugins.ts`) and a refusal (`errors.ts`). The type always comes from `kuroshiro-shared` and every key is spelled out, so a reshaped read model fails `pnpm type-check` in its builder. A builder lands with the UI slice that first reads its endpoint. Defaults are plausible values in the vocabulary of `CONTEXT.md`, not `foo`.

## The gallery

`/gallery` on the dev server (`pnpm dev`) shows every primitive in every state. It is not in the production build: `vite build` fails if a module of `src/gallery/` or `src/testing/` reaches the bundle.

A primitive registers its section by adding `<Name>.gallery.vue` beside its component. So do the parts of the shell and the page patterns that have states to show (`src/shell/Bar.gallery.vue`, `src/patterns/TitleLine.gallery.vue`); a page does not. The file name is the section: `IconButton.gallery.vue` becomes "Icon Button" at `#icon-button`. Nothing else has to be edited, and `src/gallery/gallery.shots.ts` shoots every section in light and dark without being touched.

### A primitive's files

Primitives live flat in `src/components/`, named as the component inventory names them:

| File | Holds |
| --- | --- |
| `src/components/IconButton.vue` | The component. Styles are `<style scoped>` inside `@layer components { … }`, built from the tokens |
| `src/components/IconButton.gallery.vue` | Its gallery section: every state of the inventory |
| `src/components/__test__/IconButton.spec.ts` | Its spec; the last test mounts the gallery file and calls `expectAccessible()` and `expectNoHorizontalOverflow()` |

A gallery file is rows of specimens: `SpecimenRow` (an optional `title`) holding one `Specimen` per state, whose `caption` is the state's name. Both are in `src/gallery/`.

A state that needs a pointer, a key press or a narrow window is shown in the gallery in one of these ways:

- **Hover and active**: for each such state its gallery shows, the component's own CSS answers `[data-force~='hover']` or `[data-force~='active']` beside `:hover` or `:active`, and the gallery sets `data-force="hover"` on it. The focus ring belongs to the page, so `data-force="focus"` works on any element with no CSS in the component.
- **A state held in script** (an open tooltip, "Copied"): the component takes a prop for it, documented as being for the gallery (`tooltipOpen`, `copied`).
- **A state of one choice among several** (a hovered segment, a focused tab): a component that draws its choices from a list takes a `force` prop, documented as being for the gallery, that maps a choice's key to the `data-force` value set on it: `:force="{ Settings: 'hover', Logs: 'focus' }"`.
- **A state only a narrow window has** (the page list as a row below 820 px): the gallery is shot at desktop width, so the state gets its baselines from a `<Name>.shots.ts` that resizes the page first (`PageList.shots.ts`).
- **A state behind a modal layer** (an open select, an open row menu, a confirmation): Reka hides everything but an open `Select` or `Combobox` list, a `DropdownMenu` or an `AlertDialog` from assistive technology and traps the focus in it, so it cannot be held open on the gallery page. The gallery shows the control closed and says "press it"; the open state gets its baselines from a `<Name>.shots.ts` beside the component, which opens it for real and shoots a stage around it (`Select.shots.ts`), and its axe run in the spec, given the list (`expectAccessible(listbox)`).

### Field components

- **The frame of a typed-in control** is the `.control` class of `src/styles/controls.css`, not a component: an `input`, a `textarea` and a select's `button` all wear it. It carries the border, hover, disabled, `aria-invalid` (the doubled ink border) and the 16 px text on touch. `.control.prose` sets the value in the text face instead of mono.
- **Every control** takes `v-model`, `disabled` and `invalid`, and passes any other attribute (`id`, `aria-label`, `aria-describedby`, `placeholder`, `min`) to its native control, wherever that sits in its markup.
- **`Field`** hands its control what it needs through its slot: `<Field v-slot="{ control }" label="Refresh rate" :error="error"><NumberInput v-model="rate" v-bind="control" /></Field>`. An error takes the hint's place.
- **`FieldError`** is the message with the problem icon, inside a live region that is rendered before the message is. It is a part, not a primitive of the inventory: `Field`, `FileDrop` and `InlineEdit` show it, and their galleries and specs are where it is seen and tested.
- **`InlineEdit`** is the exception to the rule above: it is a value with an editing mode, not a form control, so it takes `value`, `v-model:editing`, `validate` and `v-model:error`, and emits `save`.
- **"commit"** is what save as changed listens to: `TextInput`, `NumberInput`, `TimeInput` and `DateInput` emit it on blur and on Enter, `Textarea` on blur, and only for a value that differs from the one held on focus or committed last. `commitWhenDone` holds that rule. The `#status` slot beside each is the place of the save state.

### Choices and in-page navigation

- **`Switch`** is labelled by its default slot and has the `#status` slot beside it for the save state. `saving` and `error` are its own looks while that state runs; it stays pressable in both. Where motion is reduced, saving is a hollow thumb instead of a blinking one, which is also what the baselines show.
- **`WeekdayToggle`** holds its days as a Schedule does: an array of numbers where 0 is Sunday, given back in ascending order.
- **`SegmentedFilter`**, **`RadioRow`** and **`LayoutPicker`** are Reka radio groups over a list of choices passed as a prop. Their name comes from an `aria-label` or `aria-labelledby` attribute, which lands on the group. `LayoutPicker` draws the layouts it is given; `layoutDrawing.ts` only knows how each known id arranges its slots.
- **`Tabs`** and **`PageList`** take `label` (the name of the `nav`) and `items`, a list of `NavItem` (`{ label, to }`). They render `RouterLink`s, so they need a router: `mountPage` in a spec, and in a gallery file `RouteStage` from `src/gallery/`, which gives what is inside it a router of its own at the path `at`, so a specimen has a current link and a pressed link does not leave the gallery.
- The current link (`aria-current="page"`) is the item whose path the current route is at, or the nearest item above it (`useCurrentNavItem` in `navItem.ts`). So `/instance/firmware/upload` keeps "Firmware" current, and `/devices/7/settings` is "Settings" and not the Screens view at `/devices/7`. It compares paths, not route records, so it does not care how the routes are nested.

### Layers and messages

- **Save as changed** is three parts. `useSaveAsChanged(save, value)` is the state machine: `commit()` saves what the `value` ref holds, `retry()` repeats the last save, and `status` (`idle`, `saving`, `saved`, `failed`) and `reason` say where it stands. A save that worked writes the server's answer into `value` unless the admin changed it meanwhile; "Saved" lasts 2 seconds. `SaveState` shows it (`:status`, `:reason`, `@retry`) and goes into a control's `#status` slot: `<TextInput v-model="name" @commit="nameSave.commit"><template #status><SaveState :status="nameSave.status" :reason="nameSave.reason" @retry="nameSave.retry" /></template></TextInput>`. `SettingRow` takes the same three itself and hands its control `v-bind="control"`, as `Field` does, or `labelId` for a group of controls. "Saving" and "Saved" stand at the row's side; a failed save, which has a reason and a button, goes under the control. Unlike `Field`'s hint, the row's note stays while there is an error: it may hold an action.
- **`save` rejects with an `Error`** whose `message` is the sentence the admin reads; `failureReason.ts` reads it. `Confirmation`'s `action` is worded the same way. Wording an `ApiError` by its `code` is the API client's job, not a primitive's.
- **A live region is in the page before it says anything.** `SaveState` and `SaveBar` render their `role="status"` element empty and fill it, and so does a `ResultLine` that is mounted without its sentence (mount it with the button that starts the action, and give it the sentence once the action runs). `LineShownOnce` arrives with its text, after the navigation that caused it; a button ("Try again", "Dismiss") sits beside the region, never in it. So a spec asserts on the region that was already there (`expect(screen.getByRole('status').element()).toBe(region)`).
- **`SaveBar` has two roots**, the status region and the `section`, because a wrapper would be what the bar sticks to. It is `position: sticky`, so it must be a direct child of the page's column, and on a phone it stands `--bar-height` above the window's edge, where the bottom tabs are.
- **`Confirmation`** is controlled with `v-model:open` and has no trigger of its own; Reka gives the focus back to whatever had it. With an `action`, its `confirmLabel` is required and, in development and in the specs, it throws without one, as `IconButton` does without a label. It runs `action` itself: the caller does not close it. Without an `action` it has nothing to confirm: it only says why something cannot be done yet, has the safe choice alone, and takes a link to where the obstacle is removed in `#also`.
- **`RowMenu`** takes `items`, each an action (`select`) or a link (`to`); link items need a router. A Reka `as-child` trigger works around `IconButton` as it is.
- **`TuckedSection`** opens when the address names its `id` as the fragment. It reads the router's route where there is one (a routed navigation fires no `hashchange`) and the window otherwise (`urlFragment.ts`).
- **`ProblemLines`** is the one primitive here that paints in the seal colour, and only on a line of `kind: 'alert'`. `elementsInSealColour(root)` (`src/testing/sealColour.ts`) lists what is painted in it; a component that reports any other trouble asserts that it is empty.
- **An opening animation** sits inside `@media (prefers-reduced-motion: no-preference)`, so the specs and the shots see none. A spec asserts both sides: `animation-name` is `none`, and inside `withMotionAllowed` it is not.
- **Under a Reka part** (`AlertDialogContent`, `AlertDialogOverlay`, `CollapsibleContent`), pass `as-child` and your own element: it carries the scoped style id, and a fixed layer sets its own `z-index` in its CSS.

### Things that show

- **`Seal`** picks its drawing from `size`: 黒白 from 20 px up, 白 alone below. `colour` is `seal` or `ink`. Its characters are cut in `--seal-ground`, which is paper unless what it sits on sets it, as `Plate` does. `stamps` lands it once when it is mounted; to stamp again, mount it anew with a `key`.
- **`Plate`** needs `name` and throws without one, as `IconButton` does. It takes the `src` as it is: the caller resolves an app-relative image path against `document.baseURI`. Without `src` (a Screen never rendered) or with `rendering` it is the dither; `failed`, or an image that cannot be loaded, is the error state. `width` and `height` are the Device Model's panel and set the frame's shape before the image is known; left out, the frame takes the image's own ratio. `sealed` puts the seal on it and `stampKey` (the Active Screen's id) stamps it when it changes. The seal hangs over the frame by up to 14 px, so the place it stands in leaves that room above and to the right. The default slot replaces the image and makes the frame a `group` with the same name.
- **`FactRows`** takes `facts` (`Fact` in `fact.ts`): a fact with no `value` is left out, `alert` is the label a firing Alert replaces the row's with, `pending` adds the loading mark, `to` makes the value a link (which needs a router). The `#value` slot, handed the `fact`, stands in place of a value that is more than words, such as a `RelativeTime`; the fact still needs its `value`, which decides whether the row is shown.
- **`ScreenRows` and `ScreenRow`** are one accordion. `ScreenRows` takes `items` (each with `id` and `name`), renders its default slot once per item and holds `v-model:open`; a `ScreenRow` outside one throws. The row's `state` (a `ScreenState` or `null`) decides its look and whether Rotation passes it over; the `#thumbnail` slot is handed `active` and `passedOver` for the `Plate` in it. The whole line opens the row except where a slot holds a control of its own. Its slots are `#thumbnail`, `#schedule`, `#state` (the words beside the seal, for a qualifier such as "Active Screen, paused") and the default one, the opened row. `SCREEN_KIND_LABELS` and `SCREEN_STATE_LABELS` (`screenRows.ts`) word the wire values.
- **Reordering** is `sortable` on `ScreenRows`. The list is controlled: it emits `reorder` with every id in the new order and shows that order once `items` holds it, so the owner takes the order at once and, when the save is rejected, hands `items` back as they were, which the list announces. With `useSaveAsChanged`, which leaves the value as entered after a failed save, that is one `watch` on its `status`. Pointer dragging is `@atlaskit/pragmatic-drag-and-drop`, which rides the browser's own drag and drop: in a spec, `userEvent.dragAndDrop(grip, target, { targetPosition })` drops for real, and a state in the middle of a drag is reached by dispatching `DragEvent`s (`ScreenRow.spec.ts`). The lifted and landing looks are held still for the gallery with `force`.
- **`CodeBlock`** takes `code`, `copy` for the button, `copyValue` when "Copy" writes more than is shown, and `foldAfter` (a number of lines). `useCopied` and `CopyFaces` are the state and the two faces of a "Copy" button, shared with `CopyValue`.
- **`DayHeading`** is an `li` for the list it stands in. **`NumberedSteps`** is an `ol` whose slot holds the `li`s.
- **A class on a component's root can be matched by an ancestor's class in another component's scoped CSS.** `Plate`'s size class `row` sits inside the gallery's `.row`. So a rule that hangs on a state or size class names the root with it: `.plate.row .note`, not `.row .note`.

### The code editor, the preview plate and the bench

- **`CodeEditor`** is CodeMirror 6 behind a shell. `mode` (`liquid`, `html`, `json`, `javascript`) and `size` (`bench`, `full-window`, `code-input`) are read once; it takes `v-model`, `read-only`, `invalid`, `strip-note`, `problem`, `completion-data`, `kuroshiro-filters` and `document`, emits `save`, `blur` and (JSON only) `validity`, and exposes `focus()` and `goToLine(n)`. It throws without `aria-label` or `aria-labelledby`: the element that is typed in is a `div`, which a `label`'s `for` does not name, so inside a `Field` it still needs one of the two. `id` and every `aria-*` attribute go to that element, anything else to the frame.
- **Every `@codemirror/*` import lives in `codeEditorView.ts` and what it imports** (`codeEditorTheme.ts`, `codeEditorLanguage.ts`), which the shell fetches with `import()`. `vite build` fails when a module of `@codemirror/*` or `@lezer/*` would be fetched by the entry or by any other dynamic import, a route's chunk included (`scripts/firstLoad.ts`). Until the editor is there its frame is a `wash` block with `aria-busy="true"`.
- **CodeMirror writes its styles outside the cascade layers**, so its look is a CodeMirror theme built from the tokens (`codeEditorTheme.ts`), not scoped CSS. An unlayered `!important` loses to a layered one, so the theme cannot outbid `base.css` that way.
- **A spec waits for the editor** with `await expect.element(screen.getByRole('textbox', { name })).toBeVisible()` and reads the code from `.cm-line` elements. In `userEvent.keyboard`, `{{` types one `{`. Completion is asked for with `{Control>} {/Control}` and read from `.cm-tooltip-autocomplete li`; `getByRole('option')` does not find its options.
- **`document`** names the text's document. When it changes, the document that leaves keeps its undo history and cursor; pass the new document's text in the same update.
- **`problem`** is `{ message, line }`, which is what `checkTemplate` of `kuroshiro-shared` answers, with an optional `from` and `to` (offsets into the text) for a narrower mark. A problem without a line is worded in the strip only.
- **`PreviewPlate`** takes a complete HTML `document` and the Device Model's `width` and `height`, and draws it in an `iframe` with `sandbox="allow-scripts"`. Keep passing the last document while `not-drawn` is set; `rendering` (with `rendering-note`) shows the dither. While a new document loads, the `div` inside the plate has `aria-busy="true"` and the old drawing stays.
- **A `PreviewPlate` that is shot** stands in a place whose width makes the plate a whole number of pixels high (`EditorBench.gallery.vue`): the edge of a scaled frame on a fraction of a pixel is antialiased differently from run to run.
- **`EditorBench`** is layout only: the slots `#editor`, `#plate` and the default one for what sits under the plate. `full-window` fills the height of its place, which the caller sizes.
- **`arrived(root)`** (`src/testing/arrivals.ts`) resolves once no `div` under `root` is `aria-busy`: an editor is fetched and a frame loads after the page is mounted. `gallery.shots.ts` awaits it before every shot, and a spec that mounts a gallery file holding either awaits it before `expectAccessible()`.
- **`CodeEditor` is not a field control** in the sense of "Field components": its frame holds the strip as well as what is typed in, so it draws the control border itself instead of wearing `.control`, and it has `read-only` where a control has `disabled`. `pending` holds the `wash` block for the gallery.

Three things Reka UI does not do for you:

- Its `VisuallyHidden` is always `aria-hidden`, so it cannot hold a live region. Use the `.visually-hidden` class of `base.css` on a plain element with `role="status"`.
- A teleported layer's content does not carry the component's scoped style id. Style an element of your own inside it (see `Tooltip.vue`), and set its layer with a `z-index` on the content, which Reka copies to the positioned wrapper.
- A component whose root is a Reka root with a teleported part (`Tooltip`, so `IconButton` too) has no single root element: it sets `inheritAttrs: false` and binds `$attrs` to its control.

## Screenshots

Baselines are the `*-chromium-linux.png` files in `__screenshots__/` folders beside their `*.shots.ts` file, and they are committed. Fonts render differently from machine to machine, so shots are only written or compared inside one pinned image, `mcr.microsoft.com/playwright:v<version>-noble`, where `<version>` is the `playwright` entry of the workspace catalog in `pnpm-workspace.yaml`. `scripts/screenshots.mjs` starts it; running a `*.shots.ts` file any other way is refused.

- The comparison is as good as exact: one grey level of one pixel is forgiven, because Chromium antialiases a rounded corner at the edge of a shot a level lighter or darker from run to run. Two levels of grey fail, so a token that changes by more than a hair is still caught.
- A new or changed shot: run `pnpm test:screenshots:update`, look at the PNGs, commit them.
- A failing comparison writes the actual image and the diff under `packages/ui-next/.vitest/attachments/`; CI uploads that folder as the `ui-screenshot-diffs` artifact.
- A new gallery section moves every section below it, and a section that lands on another fraction of a pixel is shot a pixel taller or shorter with its text antialiased differently. So a PR that adds a primitive rewrites the gallery baselines after it in the page too; say so in the description.
- **A PR that changes a baseline says why in its description**, baseline by baseline or by group ("every section: `--space-3` grew"). A baseline that changed for no stated reason is a regression until explained.
- Bumping `playwright` changes the image and the browser. Regenerate the baselines in the same PR and say so.

A screen's four shots are one call in a `*.shots.ts` file beside the page:

```ts
freezeTime('2026-10-03T07:35:00.000Z')
fakeShellReads({ devices })
const screen = await mountApp({ at: '/devices' })
await expect.element(screen.getByRole('heading', { name: 'Devices' })).toBeVisible()
await expectPageScreenshots('devices')
```

A `*.shots.ts` file does not click: the shot files run side by side and share one pointer, so a click leaves it hovering in another file's shot, which then fails in some runs. Reach a state by the address (`?screen=`, a fragment that opens a tucked section), by `fill` and by `blur()` (`PluginPage.shots.ts`), or shoot a stage of the file's own as the component shots do.

The shots hold the shell, so wait for what the shell loads as well (a Device's name in the bar) before shooting. The shell's own baselines (`src/shell/AppShell.shots.ts`) mount a stand-in page, so they do not change when a page lands.

## The real-API suite

`packages/ui-next/real-api/`. Its global setup builds the API and the UI, lays them out as the image does, starts the API against an empty Postgres and hands the specs `inject('baseUrl')`. Without `KUROSHIRO_DB_HOST` it starts and removes a throwaway `postgres:18-alpine` container; with it (as in CI) it uses that database, which must be empty.

Specs drive the UI with Playwright (`chromium.launch()`, `page.goto(baseUrl)`) and play the Device with `connectDevice(baseUrl, { mac, model })` from `devicePlayer.ts`: it calls `/api/setup`, and the returned Device has `setup` (the answer), `display(report?)` for a poll and `log(entries)`.

Every spec file shares that one Instance. `firstRun.spec.ts` runs first, on the empty Instance, and the other files after it, one at a time; any other journey must not assume that no other Device exists.

The suite holds one test per primary journey of [Primary journeys and the story each screen tells](https://github.com/PhyberApex/kuroshiro/issues/1078), plus `smoke.spec.ts`. It is not the place for broad coverage; that is the page specs' job.

## What every build issue ships with

Decision 9 of the test strategy. A PR that builds one of these is not done without it.

- **A primitive**: a spec covering its behaviour and its keyboard paths; `expectAccessible()`; a `<Name>.gallery.vue` showing every state; regenerated baselines.
- **A screen**: built as [`ui-screens.md`](./ui-screens.md) says; a page spec with the API faked (`mountApp`) that has at least one test per capability its issue names, plus its empty state and its failed-request state; `expectAccessible()`; `expectNoHorizontalOverflow()`; a `*.shots.ts` calling `expectPageScreenshots`.
- **A journey**: the issue that completes a primary journey adds its test to `real-api/`.
- A store gets its own spec only when it holds real logic; otherwise the page spec covers it.
