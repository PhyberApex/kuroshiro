# Headless component library and styling approach for the admin UI rebuild

Research for [#1076](https://github.com/PhyberApex/kuroshiro/issues/1076), part of the map [#1074](https://github.com/PhyberApex/kuroshiro/issues/1074).
Researched 2026-10-01 against `origin/main` at `4406aef`.

## Question

With Vuetify removed and Vue 3 kept, which headless component library and which styling approach should the new UI stand on? Can the new stack coexist with Vuetify in one Vite app during a transition, and what is the code-editing component in the Plugin template editor today?

## Short answer

- **Library: Reka UI** (`reka-ui` 2.10.5). Runner-up: Ark UI. Headless UI for Vue is ruled out as unmaintained.
- **Styling: plain CSS with custom properties** as the token layer, component styles in Vue SFC `<style scoped>`, cascade layers for ordering. No utility framework.
- **Coexistence with Vuetify 4 in one Vite app: possible**, with four concrete hazards (below). Whether to do it is #1082's call.
- **Code editor today: there is none.** The Plugin template editor is a Vuetify `VTextarea`. No headless library ships a code editor; the host should be CodeMirror 6 with the official `@codemirror/lang-liquid`.
- **Drag-to-reorder is in no headless library.** It stays a separate, small decision.

## How this was sourced

- Versions, release dates, licences, peer and runtime dependencies: `npm view <pkg>` and the published tarballs (`npm pack`), read on 2026-10-01.
- Repo health: `gh api repos/<owner>/<repo>` and its commits and releases endpoints, same day.
- Component coverage: the directory listing and type exports of each published tarball, plus the docs sources in each library's repo.
- Bundle cost: measured, not quoted. See [Bundle cost](#bundle-cost) for the method.
- Vuetify behaviour: the `vuetify@4.2.2` tarball (the version pinned in `pnpm-workspace.yaml`).
- App needs: `packages/ui/src` in this repo.

Anything not verified this way is listed under [Not verified](#not-verified).

## What the app uses today

Counted from `packages/ui/src/**/*.vue` (tag instances, tests excluded). The app imports Vuetify components explicitly in PascalCase; `vuetify` is 4.2.2, `vue` 3.5.43, `vite` 8.3.1, `@vueuse/core` 15.0.0 (`pnpm-workspace.yaml` catalog).

| Need | Today | Where |
| --- | --- | --- |
| Dialog | `VDialog` ×10 (10 files), `VOverlay` ×2 | e.g. `components/ScreenScheduleDialog.vue`, `components/PluginImportDialog.vue`, `components/maintenance/*ConfirmDialog.vue` |
| Select | `VSelect` ×15 (10 files) | throughout |
| Combobox | `VAutocomplete` ×1 | `views/VirtualDeviceView.vue` |
| Tabs | `VTabs` ×4 with `VWindow` | 4 files |
| Tooltip | `VTooltip` ×4 | `components/device/DeviceStatusOverview.vue`, `components/ScreenListItem.vue`, `views/PluginsOverviewView.vue` |
| Toast | `VSnackbar` ×4, each a local `v-model` boolean with a 3 s timeout | `components/PluginCardActions.vue`, `components/maintenance/ConfigurationCard.vue` |
| Menu | none (`VMenu` is not used) | — |
| Accordion | `VExpansionPanels` ×6 | 6 files |
| Stepper | `VStepper` ×1 | `views/PluginCreateView.vue` |
| Toggle group | `VBtnToggle` ×1 (weekday multi-select) | `components/ScreenScheduleDialog.vue` |
| Switch / checkbox | `VSwitch` ×8, `VCheckbox` ×4 | — |
| Number input | `VNumberInput` ×1, `type="number"` text fields ×3 | — |
| File input | `VFileInput` ×4 | Screen upload, Plugin import, Configuration Archive import, Firmware upload |
| Time input | native `<input type="time">` via `VTextField` ×4 | `components/ScreenScheduleDialog.vue`, `components/device/DeviceSleepModeSection.vue` |
| Date input | native `<input type="date">` via `VTextField` ×2 | `components/ScreenScheduleDialog.vue` |
| Drag-to-reorder | hand-rolled native HTML5 drag and drop (`draggable`, `dragstart`/`dragover`/`dragend`) with "Move screen up/down" buttons as the keyboard path | `components/ScreenListCard.vue`, `ScreenTable.vue`, `ScreenListItem.vue` |
| Code editing | `VTextarea`, 15 rows, validation rules only | `components/PluginTemplateEditor.vue` |
| Theme | Vuetify `light`/`dark` themes with eight colours each; `useTheme` and `useDisplay` used only in `App.vue` | `plugins/vuetify.ts` |
| Own CSS | 24 lines of route transitions; three components have a `<style>` block | `assets/transitions.css` |

Two things follow. The interactive surface is modest: dialogs and selects dominate, and there is no menu, no date picker popup and no data table. And the app owns almost no CSS today, so the styling approach is a from-zero choice with nothing to migrate.

## Candidates

| | Reka UI | Ark UI | Headless UI (Vue) | Vuetify0 |
| --- | --- | --- | --- | --- |
| Package | `reka-ui` | `@ark-ui/vue` | `@headlessui/vue` | `@vuetify/v0` |
| Latest stable | 2.10.5, 2026-09-21 | 5.39.2, 2026-09-13 | 1.7.23, **2024-09-09** | 1.2.3, 2026-09-24 |
| Stable releases since June 2026 | 5 | 5+ | 0 | 1.0.0 only on 2026-07-22 |
| Last commit on default branch | 2026-10-01 | 2026-10-01 | 2026-04-13 (repo); last commit touching the Vue package 2025-09-03 | 2026-09-24 |
| Stars / open issues | 6,851 / 236 | 5,402 / 13 | 28,769 / 113 | 737 / 36 |
| npm downloads, 2026-08-31 to 09-29 | 7.72 M | 0.12 M | 7.46 M | 0.27 M |
| Licence | MIT | MIT | MIT | MIT |
| Vue peer range | `>= 3.4.0` | `>= 3.5.0` | `^3.2.0` | `>= 3.5.0` |
| Built on | own Vue code, Floating UI, `@internationalized/date` | Zag.js state machines (framework-agnostic), one `@zag-js/*` package per component | own Vue code | own Vue code; ten optional peers (feature flags, i18n, palettes) |
| Maintainer | unovue (formerly Radix Vue) | Chakra UI team | Tailwind Labs | Vuetify |

Notes behind the table:

- **Reka UI is Radix Vue renamed.** `radix-vue` stopped at 1.9.17 on 2025-02-28; `reka-ui` continues it. It is also what shadcn-vue (2.8.2) and Nuxt UI (4.11.2) build on, which explains the download count and gives it the largest pool of worked examples.
- **Headless UI for Vue is effectively frozen at v1.** The React package reached v2.2.10 (2026-04-07); the Vue package never got a v2, its README points at `headlessui.com/v1/vue`, and its last stable release is two years old. Its downloads are legacy weight, not a health signal.
- **Vuetify0 is a live contender I added.** It is Vuetify's own headless layer, 1.0 since July 2026. It is young (first published 2025-08-18), has the smallest community, and the standing constraint is to get away from the Vuetify look and ecosystem, so adopting Vuetify's next product needs a stronger reason than it offers.
- **PrimeVue's unstyled mode is ruled out on licence.** `primevue` 5.0.2 ships a "PrimeUI License" that requires a licence key with annual renewal even for the free community tier. Not acceptable for a self-hosted open source project.
- Zag.js used directly (`@zag-js/vue` 1.44.0) is Ark UI without the component layer; it adds work and no coverage.

## Component coverage against the app's needs

Verified from the published tarballs. "Alpha" is the badge the Reka docs put on the component's own page.

| Need | Reka UI 2.10.5 | Ark UI 5.39.2 | Headless UI 1.7.23 | Vuetify0 1.2.3 |
| --- | --- | --- | --- | --- |
| Dialog, alert dialog | Dialog, AlertDialog | Dialog (role prop) | Dialog | Dialog, AlertDialog |
| Menu | DropdownMenu, ContextMenu, Menubar | Menu | Menu | not found in exports |
| Select | Select, Listbox | Select, Listbox | Listbox | Select |
| Combobox | Combobox; Autocomplete (Alpha) | Combobox | Combobox | Combobox |
| Tabs | Tabs | Tabs | Tabs | Tabs |
| Tooltip | Tooltip, HoverCard | Tooltip, HoverCard | **none** | Tooltip |
| Toast | Toast, with `useToastManager` / `createToastManager`, swipe to dismiss, hotkey to viewport | Toast with `createToaster` | **none** | Snackbar |
| Accordion | Accordion, Collapsible | Accordion, Collapsible | Disclosure (single) | ExpansionPanel |
| Stepper | Stepper | Steps | none | Step |
| Toggle group | ToggleGroup | ToggleGroup, SegmentGroup | RadioGroup only | Group, Toggle |
| Switch, checkbox, radio | yes | yes | Switch, RadioGroup; no Checkbox | yes |
| Number input | NumberField | NumberInput | none | NumberField |
| File input | none | FileUpload | none | none |
| Date input | DateField, DatePicker, Calendar, range variants (all Alpha) | DateInput, DatePicker | none | not found |
| Time input | TimeField, TimeRangeField (Alpha) | **none** (`@zag-js/time-picker` stopped at 1.22.1 in August 2025 and is not in `@ark-ui/vue`) | none | not found |
| Drag-to-reorder | none | none | none | none |
| Code editor host | none | none | none | none |

Reading the table against the app:

- **Reka UI covers every need a headless library can cover except file input**, and file input is a native `<input type="file">` with a styled label; it does not need a primitive.
- **Ark UI covers everything except time input**, and adds FileUpload. The app has four time inputs and two date inputs today.
- **Reka's date and time primitives are all marked Alpha.** The app currently uses native `<input type="time">` and `<input type="date">`, which are accessible and need no library. The recommendation does not depend on the Alpha components: start native, adopt `TimeField` only if the design needs segmented inputs the native control cannot give.
- **Headless UI lacks tooltip, toast, number input, checkbox and date/time**, which would force a second library for half the list.
- **No candidate has drag-to-reorder or a code editor.** These are separate choices; see below.

## Accessibility

All four state the same baseline in their own docs: WAI-ARIA Authoring Practices patterns, managed focus, keyboard navigation, `aria` and `role` attributes handled by the library.

- Reka UI: "follow the WAI-ARIA authoring practices guidelines and are tested in a wide selection of modern browsers and commonly used assistive technologies" (`docs/content/docs/overview/accessibility.md` in `unovue/reka-ui`). The repo contains automated axe checks in its component tests (GitHub code search for `vitest-axe` returns 68 files).
- Ark UI / Zag.js: "WCAG compliant components tested with real assistive technologies" (Ark README); Zag commits to end-to-end tests per component based on the WAI-ARIA spec (Zag README).
- Headless UI: same claims, but the Vue package no longer receives the fixes the React one does.
- Reka's modal Dialog traps focus, hides sibling content from assistive tech (`hideOthers` from the `aria-hidden` package), locks body scroll and sets `pointer-events: none` on `body` while open (verified in `reka-ui/dist`).
- Reka's Toast documents an `aria-live` region, a hotkey to move focus to the toast viewport, and swipe to dismiss.

I found no independent third-party accessibility audit of either Reka UI or Ark UI. On the evidence available they are equivalent; accessibility does not separate the top two. What the library cannot do for us: labels, contrast, focus-visible styling and reduced-motion handling are ours, because the components are unstyled.

## Maintenance health

Reka UI and Ark UI are both shipping several stable releases a month with commits on the day of this research. The differences:

- Ark UI has far fewer open issues (13 against 236) and a funded team behind it. Its Vue binding has roughly 1/60 of Reka's downloads, so Vue-specific bugs get less exposure; the same components are exercised much more through React.
- Reka UI is the de facto Vue standard, so its Vue-specific behaviour (`v-model`, slots, `Teleport`, SSR) is the best-exercised of any candidate.
- Reka UI currently depends on `@vueuse/core ^14.1.0` (also on its `v2` branch today) while this repo's catalog pins `@vueuse/core` 15.0.0. Until Reka widens the range, pnpm installs a second VueUse copy for Reka. This costs bytes, not correctness.
- Ark UI pins every `@zag-js/*` dependency to an exact version (69 packages at 1.43.3). Upgrades are all-or-nothing and Renovate noise is low, but the dependency tree is wide. Zag 2.0 is in pre-release (`2.0.0-next.3`, 2026-09-14), so an Ark major is likely within the life of this rebuild.

## Bundle cost

Measured on 2026-10-01 in a scratch project outside the repo: esbuild 0.28.2, `--bundle --minify --format=esm`, `vue` external, then `gzip -9`. Each entry re-exports the named parts so nothing is shaken away. Rolldown (Vite 8) may shake slightly more; treat the numbers as upper bounds and compare them only with each other.

| Entry | Minified | Gzipped |
| --- | --- | --- |
| Reka UI: Dialog only | 35 kB | 11.6 kB |
| Ark UI: Dialog only | 63 kB | 20.6 kB |
| Headless UI: Dialog only | 30 kB | 10.5 kB |
| Reka UI: app set (Dialog, DropdownMenu, Select, Combobox, Tabs, Tooltip, Toast, Switch, Checkbox, Accordion, ToggleGroup, NumberField) | 222 kB | **65.8 kB** |
| Ark UI: same set | 345 kB | **95.8 kB** |
| Headless UI: the 7 of those it has (no Tooltip, Toast, Checkbox, ToggleGroup, NumberField) | 109 kB | 31.3 kB |
| Vuetify0: 11 comparable components | 113 kB | 31.1 kB |
| Reka UI: TimeField only | 50 kB | 15.5 kB |
| Reka UI: TimeField + DateField + DatePicker | 155 kB | 47.3 kB |
| Ark UI: DatePicker + DateInput | 182 kB | 56.5 kB |
| CodeMirror 6: `basicSetup` + `@codemirror/lang-liquid` | 588 kB | 201 kB |
| `@formkit/drag-and-drop` (Vue entry) | 31 kB | 9.1 kB |
| `vue-draggable-plus` (wraps SortableJS) | 42 kB | 15.0 kB |
| `@dnd-kit/vue` sortable | 110 kB | 36.3 kB |

For the same component set Reka UI is about 30 kB gzipped lighter than Ark UI. Both tree-shake (`sideEffects: false`). The date components are the heaviest single thing in either library because they pull `@internationalized/date`; staying on native date and time inputs avoids that cost entirely. Every library here is small next to the code editor, which must be lazy-loaded on the Plugin editor route.

## Styling approach

The requirement: tokens drive everything, light and dark from day one following system preference, and a deliberately non-generic look (the map's slop rules: no default font, default radius or default spacing).

Both top libraries style the same way: unstyled DOM, a `class` passed straight through, and state exposed as data attributes (`data-state="open"` on Reka; `data-scope`, `data-part` and `data-state` on Ark). Any CSS approach works with either. Reka's docs note one Vue-specific catch: portalled content (dialogs, menus, toasts) is teleported to `body`, so `<style scoped>` rules need the class on the teleported element itself or a `:deep()` selector.

| Approach | Token fit | Light and dark | Non-generic look | Cost and risk here |
| --- | --- | --- | --- | --- |
| **Plain CSS, custom properties, SFC scoped styles** | Tokens are the custom properties; nothing sits between the design spec and the browser | One semantic layer switched by `color-scheme` and `prefers-color-scheme`, with a `[data-theme]` override; `light-dark()` available | Nothing ships a default scale, so every value is a decision | No build dependency. Needs discipline: components may only reference semantic tokens. Portalled parts need unscoped or `:deep()` rules |
| Utility CSS: Tailwind 4.3.3 | `@theme` generates custom properties, so tokens are still real CSS variables | `dark:` variant on every element, or semantic variables as above | The default scale and Preflight are the fastest path to the generic look the map bans; avoiding it means replacing the whole default theme | Class names collide with Vuetify's utilities during coexistence (`.mb-3`, `.rounded-lg`, `.text-center`, `.border`, `.flex-wrap`, `.opacity-50`, `.cursor-pointer` exist in `vuetify.css` 4.2.2). Preflight is a second global reset |
| Utility CSS: UnoCSS 66.10.5 | Same as Tailwind via theme config | Same | Same risk, slightly less default baggage | Same collision risk; another build plugin |
| CSS Modules in SFCs (`<style module>`) | Same as plain CSS | Same | Same | Works on portalled content without `:deep()` because classes are hashed, not attribute-scoped. Class binding is more verbose (`:class="$style.x"`) |
| Build-time CSS-in-TS: Panda CSS 2.0.1, vanilla-extract 1.21.2 | Typed tokens | Built-in conditions | Fine | A second compiler and codegen step for an app with a few dozen components; Panda 2.0 shipped two days before this research |

Plain CSS wins on fit, not on taste. The design system this map produces is a token set plus a few dozen owned components. Tokens are custom properties whichever tool is chosen, so a utility framework adds a naming layer on top of them and the one thing it brings for free, a ready-made scale, is the thing the map forbids. The app also has no existing utility-class habit to preserve: today's utility classes are Vuetify's and leave with it.

Concretely:

- **Tokens** in one global stylesheet, in three tiers: primitive (raw palette, type scale, space scale), semantic (`--surface`, `--ink`, `--line`, `--accent`, `--danger` and so on), and component-level only where a component needs its own knob. Components reference semantic tokens only.
- **Light and dark** by redefining the semantic tier, never per component: `color-scheme: light dark` on the root, values under `@media (prefers-color-scheme: dark)`, plus `[data-theme="light"|"dark"]` to force one. This replaces Vuetify's `useTheme`.
- **Component styles** in `<style scoped>` inside each owned wrapper component, keyed on the library's `data-state` attributes. Parts that render inside a portal get their class on the portalled element.
- **Cascade layers** (`@layer reset, tokens, base, components, overrides`) so ordering is explicit rather than import-order dependent.
- **Breakpoints** from CSS media and container queries, with `useMediaQuery` or `useBreakpoints` from the already-installed `@vueuse/core` where script needs them. This replaces `useDisplay`.

Scoped styles and CSS Modules are both acceptable for component styles; scoped is the Vue default and what the three existing `<style>` blocks use. If portalled parts make `:deep()` noisy in practice, switching those components to `<style module>` is a local change.

## Coexistence with Vuetify in one Vite app

**It works.** Reka UI and Ark UI are plain Vue components with no global plugin, no global CSS and no build plugin, so adding either to an app that runs `vite-plugin-vuetify` changes nothing for existing screens. `vite-plugin-vuetify`'s auto-import only resolves Vuetify's own `V*` components. Component names do not clash (`DialogRoot` against `VDialog`).

What breaks, or can, verified against `vuetify@4.2.2`:

1. **Unlayered new CSS overrides all of Vuetify.** Vuetify 4 ships every rule inside cascade layers (`vuetify-core`, `vuetify-components`, `vuetify-overrides`, `vuetify-utilities`, `vuetify-final`). Unlayered CSS beats layered CSS regardless of specificity. A new global rule such as `button { border: 0; background: none }`, `a { color: … }` or `h1 { … }` will therefore restyle every Vuetify button, link and heading on the old screens. Fix: scope the new base rules under a root selector on the new shell (for example `[data-ui="next"] button`), or put them in a layer declared before Vuetify's. Tokens on `:root` are safe as long as names do not start with `--v-`.
2. **Vuetify's reset reaches the new screens**, but it is small and layered, so new styles always win over it: `box-sizing: border-box` on everything, `margin: 0` on `body`, `font: inherit` on form controls, `cursor: pointer` on buttons, and on `html` a `font-family` (`var(--v-font-body, "Roboto", sans-serif)`), `line-height: 1.5` and `overflow-x: hidden`. New screens inherit Vuetify's font until the new root sets its own.
3. **Overlay stacks do not know about each other.** Vuetify teleports overlays into its own container at `z-index: 2000` with its own focus trap (`VDialog` has `captureFocus` and `retainFocus` on by default) and scroll blocking. A Reka modal traps focus, sets `aria-hidden` on everything outside itself, locks body scroll and sets `pointer-events: none` on `body`. Opening one library's overlay from inside the other's (a Reka select inside a `VDialog`, a `VSnackbar` over a Reka dialog) gives focus fights, dead clicks or wrong stacking. Rule: never mix the two libraries inside one overlay; migrate whole screens or whole dialogs.
4. **A utility framework would collide.** Not relevant to the recommended plain CSS route, but Tailwind or UnoCSS class names overlap Vuetify's utility classes (see the styling table).

Two smaller effects: both libraries ship in the bundle during the transition (the Vuetify chunk stays until the last old screen goes), and two theme systems must be kept in step if a screen of each kind is visible in the same session (Vuetify's `theme.global.name` and the new `data-theme` attribute).

The cleaner alternative is to not share a document at all: build the new UI as a separate Vite entry or package and switch over when it reaches parity. The map says the old UI is feature-frozen and the rebuild is from zero, which favours that. That decision belongs to [#1082](https://github.com/PhyberApex/kuroshiro/issues/1082); this ticket only establishes that both routes are technically open and that the recommended stack does not force either.

## The code editor in the Plugin template editor

`packages/ui/src/components/PluginTemplateEditor.vue` is 64 lines: a `VTextarea` bound to the Liquid markup with 15 rows, the validation rules from `utils/pluginRules.ts`, and a collapsible help card listing Liquid syntax and filters. There is no syntax highlighting, no line numbers, no bracket matching and no autocomplete. No editor library (CodeMirror, Monaco, Ace, Prism, Shiki) is installed or imported anywhere in `packages/ui`. The other multi-line inputs (`PluginDataSourcesEditor.vue`, `AddScreenCard.vue`, `HtmlPreviewView.vue`, the Plugin create and edit views) are `VTextarea` too.

So "code editor host" is a new capability, not a migration. No headless component library provides one; the library choice does not affect it.

- **CodeMirror 6** is the fit: `@codemirror/lang-liquid` 6.3.3 (published 2026-09-29, maintained in the CodeMirror project) gives Liquid-in-HTML highlighting and tag and filter completion; `@codemirror/view` 6.43.13 shipped 2026-09-22. It themes through CSS and its own theme extension, so it can read the same custom properties as the rest of the design system. Measured cost with `basicSetup` and Liquid: 201 kB gzipped, to be lazy-loaded with the editor route.
- Mount it directly with `EditorView` in one owned component. The `vue-codemirror` wrapper was last published in August 2022.
- **Monaco** (`monaco-editor` 0.57.0) is 100 MB unpacked, needs web workers wired into Vite, and has no Liquid language; it is ruled out for a template field.

## Drag-to-reorder

Not in any candidate. Today's implementation is native HTML5 drag and drop plus explicit move up and move down buttons, which is the accessible path and should survive regardless. Options for the pointer path, all measured above: keep the native implementation (0 kB), `@formkit/drag-and-drop` 0.6.1 (9 kB gzipped, published 2026-06-15, still 0.x), `vue-draggable-plus` 0.6.1 on SortableJS (15 kB, slow release cadence), `@dnd-kit/vue` 0.5.0 (36 kB, first published February 2026, 0.x). This does not need deciding now; the build issue for the Screen list can pick, and the keyboard buttons make the choice low-risk.

## Recommendation

**Reka UI for behaviour, plain CSS custom properties for tokens, Vue scoped styles for components, CodeMirror 6 for the template editor, native date and time inputs to start.**

Why Reka UI over Ark UI:

- It covers time input, which Ark UI does not, and the app has four of them. (Native inputs are the starting point either way, but Reka leaves the upgrade path inside the same library.)
- About 30 kB gzipped lighter for this app's component set.
- It is the Vue-native standard: roughly 60 times the Vue usage of Ark, and the base of shadcn-vue and Nuxt UI, so examples and prior art for any composition problem exist.
- Ark's real advantages, a much smaller issue backlog and a built-in FileUpload, do not outweigh those: file upload here is a styled native input.

What this rules out:

- **Headless UI for Vue**: unmaintained v1, missing tooltip, toast, number input and date/time.
- **Ark UI**: a sound choice that loses on time input, size and Vue mindshare. It is the fallback if Reka UI's maintenance degrades.
- **Vuetify0**: three months past 1.0, and it keeps the project inside the ecosystem the rebuild is leaving.
- **PrimeVue unstyled**: licence key requirement.
- **Styled kits on top of Reka** (shadcn-vue, Nuxt UI): they bring Tailwind and a recognisable default look. Their source remains useful as reference for composing Reka parts.
- **Tailwind, UnoCSS, Panda CSS, vanilla-extract** as the styling layer.
- **Monaco** and the `vue-codemirror` wrapper.
- **Mixing Vuetify and Reka inside one overlay** if the two ever share a page.

What it leaves open: the cutover shape (#1082), the concrete token values (brand direction, #1079), which drag library if any, and whether the Schedule and Sleep Mode time inputs stay native.

## Not verified

- **No independent accessibility audit** of Reka UI or Ark UI was found; the accessibility comparison rests on each project's own claims and on the presence of automated axe tests in their repos. Neither was tested here with a screen reader.
- **Coexistence was not run.** The hazards are derived from reading `vuetify@4.2.2`'s shipped CSS and overlay source and `reka-ui@2.10.5`'s dist, not from mounting both in this app.
- **Bundle numbers are esbuild output**, not this app's Vite 8 build, and the Headless UI and Vuetify0 rows cover fewer components than the Reka and Ark rows.
- **Vuetify0 coverage** was read from its type exports only; "not found" for Menu and date/time means no matching `*Root` export, not a confirmed absence in its docs.
- **Reka's Alpha date and time components**: the docs badge was read; how stable they are in practice was not assessed.
- **Browser support for `light-dark()`** and for native drag and drop on touch devices was not re-checked against current compatibility data; both are stated from prior knowledge.
- **When Reka UI will accept `@vueuse/core` 15** is unknown; the duplicate copy was inferred from the dependency ranges, not observed in a lockfile.
- **Zag 2 / a future Ark major** timing is inferred from the `next` dist-tag only.
