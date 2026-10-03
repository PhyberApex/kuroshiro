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
| `pnpm test:real-api` | Builds the API and the UI and drives them against Postgres | Docker (or a Postgres named by `KUROSHIRO_DB_*`), Chromium |

The root `pnpm test` runs the first one. CI (`.github/workflows/checks.yml`) runs all three kinds.

## Which file is which kind of test

| File | Runs in | For |
| --- | --- | --- |
| `src/**/*.spec.ts` | Chromium (Vitest browser mode) | A component, a page, anything that touches the DOM |
| `src/**/*.node.spec.ts` | Node | Pure logic |
| `src/**/*.shots.ts` | Chromium, inside the pinned image only | Screenshot baselines |
| `real-api/**/*.spec.ts` | Node, driving Chromium through Playwright | The journeys against the real API |

Specs sit in a `__test__` folder beside what they test. There is no jsdom.

## The helpers

All in `packages/ui-next/src/testing/`. The specs in `src/testing/__test__/` are one worked example of each.

- **`mount(Component, { props, slots, theme })`** and **`mountPage({ routes, at, theme })`** (`mount.ts`). Both return the `vitest-browser-vue` screen (`getByRole`, `getByText`, ...) and are awaited. `mountPage` builds a test router over the routes you pass and opens it at `at`; it also returns `router`. The tokens, the reset and the faces are already loaded by the setup file, in the order the app loads them. The theme is `light` unless you pass `dark`.
- **Events** come from `vitest/browser`: `await locator.click()`, `await userEvent.keyboard('{Tab}')`. They are real pointer and keyboard events, which is what Reka UI needs. Assert with `await expect.element(locator).toBeVisible()`, which retries.
- **`expectAccessible()`** (`a11y.ts`) runs axe-core at WCAG 2.1 AA on what is mounted, in light and in dark, and fails on any violation.
- **`expectNoHorizontalOverflow()`** (`overflow.ts`) fails if the page scrolls sideways at 375, 768 or 1280 px and names the elements that stick out.
- **`expectPageScreenshots(name)`** and **`expectScreenshot(locator, name)`** (`screenshots.ts`), for `*.shots.ts` files only.

- **`withCoarsePointer(body)`** and **`withMotionAllowed(body)`** (`media.ts`) run `body` as on a touch screen (a control is 44 px high) or with motion allowed, and put the browser back afterwards.

The browser may read and write the clipboard, so a spec reads back what a control copied with `await navigator.clipboard.readText()`.

Playwright refuses to click what is disabled, `aria-disabled` included. To assert that such a control does not fire, click it with `{ force: true }`.

The pointer stays where the last click left it, so an element mounted under it is hovered from the start. Do not assert a resting colour that hover changes.

A Reka UI layer (a tooltip, a menu) is teleported to `body`. The `screen` queries still find it, but Reka's `role="tooltip"` element is hidden from the accessibility tree: query it with `getByRole('tooltip', { includeHidden: true })` or assert the trigger's accessible description.

The browser runs with reduced motion, so the duration tokens collapse and nothing is asserted or shot mid-transition. A style change still lands one frame later; `forceTheme` and the viewport helpers wait for it, and `expect.element` retries, so read computed styles through those rather than straight after a change.

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

and is called as `build<ReadModel>(overrides?)`. The type always comes from `kuroshiro-shared` and every key is spelled out, so a reshaped read model fails `pnpm type-check` in its builder. A builder lands with the UI slice that first reads its endpoint. Defaults are plausible values in the vocabulary of `CONTEXT.md`, not `foo`.

## The gallery

`/gallery` on the dev server (`pnpm dev`) shows every primitive in every state. It is not in the production build: `vite build` fails if a module of `src/gallery/` or `src/testing/` reaches the bundle.

A primitive registers its section by adding `<Name>.gallery.vue` beside its component. The file name is the section: `IconButton.gallery.vue` becomes "Icon Button" at `#icon-button`. Nothing else has to be edited, and `src/gallery/gallery.shots.ts` shoots every section in light and dark without being touched.

### A primitive's files

Primitives live flat in `src/components/`, named as the component inventory names them:

| File | Holds |
| --- | --- |
| `src/components/IconButton.vue` | The component. Styles are `<style scoped>` inside `@layer components { … }`, built from the tokens |
| `src/components/IconButton.gallery.vue` | Its gallery section: every state of the inventory |
| `src/components/__test__/IconButton.spec.ts` | Its spec; the last test mounts the gallery file and calls `expectAccessible()` and `expectNoHorizontalOverflow()` |

A gallery file is rows of specimens: `SpecimenRow` (an optional `title`) holding one `Specimen` per state, whose `caption` is the state's name. Both are in `src/gallery/`.

A state that needs a pointer or a key press is held still for the gallery in one of two ways:

- **Hover and active**: for each such state its gallery shows, the component's own CSS answers `[data-force~='hover']` or `[data-force~='active']` beside `:hover` or `:active`, and the gallery sets `data-force="hover"` on it. The focus ring belongs to the page, so `data-force="focus"` works on any element with no CSS in the component.
- **A state held in script** (an open tooltip, "Copied"): the component takes a prop for it, documented as being for the gallery (`tooltipOpen`, `copied`).

Three things Reka UI does not do for you:

- Its `VisuallyHidden` is always `aria-hidden`, so it cannot hold a live region. Use the `.visually-hidden` class of `base.css` on a plain element with `role="status"`.
- A teleported layer's content does not carry the component's scoped style id. Style an element of your own inside it (see `Tooltip.vue`), and set its layer with a `z-index` on the content, which Reka copies to the positioned wrapper.
- A component whose root is a Reka root with a teleported part (`Tooltip`, so `IconButton` too) has no single root element: it sets `inheritAttrs: false` and binds `$attrs` to its control.

## Screenshots

Baselines are the `*-chromium-linux.png` files in `__screenshots__/` folders beside their `*.shots.ts` file, and they are committed. Fonts render differently from machine to machine, so shots are only written or compared inside one pinned image, `mcr.microsoft.com/playwright:v<version>-noble`, where `<version>` is the `playwright` entry of the workspace catalog in `pnpm-workspace.yaml`. `scripts/screenshots.mjs` starts it; running a `*.shots.ts` file any other way is refused.

- The comparison is as good as exact: one grey level of one pixel is forgiven, because Chromium antialiases a rounded corner at the edge of a shot a level lighter or darker from run to run. Two levels of grey fail, so a token that changes by more than a hair is still caught.
- A new or changed shot: run `pnpm test:screenshots:update`, look at the PNGs, commit them.
- A failing comparison writes the actual image and the diff under `packages/ui-next/.vitest/attachments/`; CI uploads that folder as the `ui-screenshot-diffs` artifact.
- **A PR that changes a baseline says why in its description**, baseline by baseline or by group ("every section: `--space-3` grew"). A baseline that changed for no stated reason is a regression until explained.
- Bumping `playwright` changes the image and the browser. Regenerate the baselines in the same PR and say so.

A screen's four shots are one call in a `*.shots.ts` file beside the page:

```ts
const screen = await mountPage({ routes, at: '/devices' })
await expect.element(screen.getByRole('heading', { name: 'Devices' })).toBeVisible()
await expectPageScreenshots('devices')
```

## The real-API suite

`packages/ui-next/real-api/`. Its global setup builds the API and the UI, lays them out as the image does, starts the API against an empty Postgres and hands the specs `inject('baseUrl')`. Without `KUROSHIRO_DB_HOST` it starts and removes a throwaway `postgres:18-alpine` container; with it (as in CI) it uses that database, which must be empty.

Specs drive the UI with Playwright (`chromium.launch()`, `page.goto(baseUrl)`) and play the Device with `connectDevice(baseUrl, { mac, model })` from `devicePlayer.ts`: it calls `/api/setup`, and the returned Device has `setup` (the answer), `display(report?)` for a poll and `log(entries)`.

The suite holds one test per primary journey of [Primary journeys and the story each screen tells](https://github.com/PhyberApex/kuroshiro/issues/1078), plus `smoke.spec.ts`. It is not the place for broad coverage; that is the page specs' job.

## What every build issue ships with

Decision 9 of the test strategy. A PR that builds one of these is not done without it.

- **A primitive**: a spec covering its behaviour and its keyboard paths; `expectAccessible()`; a `<Name>.gallery.vue` showing every state; regenerated baselines.
- **A screen**: a page spec with the API faked that has at least one test per capability its issue names, plus its empty state and its failed-request state; `expectAccessible()`; `expectNoHorizontalOverflow()`; a `*.shots.ts` calling `expectPageScreenshots`.
- **A journey**: the issue that completes a primary journey adds its test to `real-api/`.
- A store gets its own spec only when it holds real logic; otherwise the page spec covers it.
