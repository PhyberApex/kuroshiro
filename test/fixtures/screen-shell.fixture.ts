/**
 * Cross-package golden fixture for the screen-shell helper duplicated at
 * `packages/api/src/device-models/screen-shell.ts` and
 * `packages/ui/src/utils/screenShell.ts`. Both packages' spec suites assert
 * their implementation against this same input/output pair, so the two
 * copies failing to agree fails a test instead of silently drifting.
 *
 * Deliberately untyped against either package's `DeviceModel`/`Palette`
 * entities (they live in separate TypeORM/Vue type trees) — callers cast to
 * their own `{ model, palette }` render-target shape.
 */
export const SCREEN_SHELL_FIXTURE_MODEL = {
  name: 'v2',
  width: 1872,
  height: 1404,
  rotation: 90,
  cssClasses: ['screen--v2', 'screen--lg', 'screen--density-2x'],
  cssVariables: { '--screen-w': '1040px', '--screen-h': '780px' },
}

export const SCREEN_SHELL_FIXTURE_PALETTE = {
  frameworkClass: 'screen--4bit',
}

export const SCREEN_SHELL_FIXTURE_BODY = '<div class="view view--full"><p>x</p></div>'

export const SCREEN_SHELL_FIXTURE_EXPECTED = {
  classes: ['screen', 'screen--v2', 'screen--lg', 'screen--density-2x', 'screen--4bit'],
  style: '--screen-w: 1040px; --screen-h: 780px;',
  wrappedDiv: '<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full"><p>x</p></div></div>',
}
